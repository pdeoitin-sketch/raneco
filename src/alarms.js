/**
 * Alarms — the feature that was missing entirely.
 *
 * Tempo had a *timer*: set a length, it counts down, it rings. But "wake me
 * at 06:30" is a different sentence. A timer answers "how long from now?",
 * an alarm answers "when, on the clock?" — and until this module existed the
 * app could only do the first one.
 *
 * An alarm is:
 *
 *   • a **time** — 06:30, on the wall clock of your home place,
 *   • an optional **date** — one time only, on the 21st,
 *   • an optional **weekday repeat** — every Friday, weekdays only,
 *   • a **label** and **notes attached to that particular alarm** ("take the
 *     bread out of the freezer", "call Mum"),
 *   • any of the **sixteen sounds** from src/alarm-sounds.js.
 *
 * The engine runs on the device clock: every alarm's next ring is an epoch,
 * not a countdown, so a throttled background tab that wakes up late still
 * rings — the **90-second grace window** below covers exactly that — and a
 * DST shift moves the wall clock, not the ring time. Occurrences are found
 * by **walking calendar days** in the alarm's own zone, which is why a
 * Friday-only alarm jumps clean over the weekend and why a daily 07:00 stays
 * at 07:00 across the spring-forward night even though the epoch distance to
 * it changed by an hour.
 *
 * When an alarm rings, the page scrolls itself to it — an alarm you cannot
 * see is a bell in another room.
 *
 * Pure functions first (testable with no DOM), then the section controller.
 */

import { clockParts } from "./clock-face.js";
import { pad, escapeHTML } from "./ui.js";
import {
  ALARM_SOUNDS,
  DEFAULT_SOUND_ID,
  MAX_ALARM_MS,
  createAlarmPlayer,
  findSound,
  soundsByMood,
} from "./alarm-sounds.js";

/** localStorage key for the alarm list. */
export const STORE_KEY = "tempo-alarms";

/**
 * A ring this far in the past still counts. Background tabs get their timers
 * clamped to once a minute (or worse); the alarm that was due at 06:30:00 is
 * still worth ringing when the tab finally notices at 06:30:50. Anything
 * older is yesterday's news — it is rescheduled, not rung.
 */
export const GRACE_MS = 90 * 1000;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ------------------------------------------------------------ cleaning */

/**
 * Turn whatever a form or an old save left in `repeat` into a sorted list of
 * weekdays (0 = Sunday … 6 = Saturday), or `null` for "no repeat".
 *
 * The trap here is `Number(null) === 0`: a naive `Number(value)` turns a
 * missing repeat into *Sunday*, and an alarm that was never asked to repeat
 * starts ringing every Sunday morning. Null-ish input means "no repeat" and
 * must come out as null.
 */
export function normaliseRepeat(value) {
  if (value === null || value === undefined || value === "") return null;
  const list = Array.isArray(value) ? value : [value];
  const days = new Set();
  for (const entry of list) {
    if (entry === null || entry === undefined || entry === "") continue;
    const day = typeof entry === "number" ? entry : Number(String(entry).trim());
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    days.add(day);
  }
  return days.size ? [...days].sort((a, b) => a - b) : null;
}

/**
 * Wash one stored alarm into shape, or reject it with `null`.
 *
 * The sound id is checked by **membership in the catalogue**, not by asking
 * `findSound()`: findSound never returns null — it *falls back* to the
 * default — so using it to ask "is this id real?" always answers yes, and a
 * dead id (from a sound that was renamed or removed) survives the wash and
 * only dies later, silently, at ring time.
 */
export function sanitiseAlarm(raw, { sounds = ALARM_SOUNDS, defaultSound = DEFAULT_SOUND_ID } = {}) {
  if (!raw || typeof raw !== "object") return null;
  const time = typeof raw.time === "string" ? raw.time.trim() : "";
  if (!TIME_PATTERN.test(time)) return null;

  let date = null;
  if (typeof raw.date === "string" && DATE_PATTERN.test(raw.date) && !Number.isNaN(Date.parse(`${raw.date}T12:00Z`))) {
    date = raw.date;
  }

  const repeat = normaliseRepeat(raw.repeat);
  const label = String(raw.label ?? "").trim().slice(0, 80);
  const notes = String(raw.notes ?? "").trim().slice(0, 500);
  const sound = sounds.some((entry) => entry.id === raw.sound) ? raw.sound : defaultSound;
  const enabled = raw.enabled === undefined ? true : Boolean(raw.enabled);
  const lastRang = Number.isFinite(Number(raw.lastRang)) && Number(raw.lastRang) > 0 ? Number(raw.lastRang) : 0;
  const id = String(raw.id ?? "").trim() || makeId();

  return { id, time, date, repeat, label, notes, sound, enabled, lastRang };
}

/** A stored list (already JSON.parse-d) into clean alarms, dropping junk. */
export function parseStoredAlarms(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => sanitiseAlarm(entry)).filter(Boolean);
}

function makeId() {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/* ------------------------------------------------------- zone arithmetic */

/** The zone's offset from UTC at an instant, in ms (east positive). */
function zoneOffsetMs(epochMs, zone) {
  const parts = clockParts(new Date(epochMs), zone);
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUTC - Math.floor(epochMs / 1000) * 1000;
}

/**
 * A wall-clock time in a zone → the epoch it occurs at.
 *
 * Offsets are looked up, not assumed: the candidate is refined against the
 * zone's real offset until it agrees with itself, which is what keeps a
 * 07:00 alarm at 07:00 across a DST boundary. Two DST corners are handled
 * deliberately:
 *
 *   • a wall time that does not exist (02:30 on the spring-forward night)
 *     oscillates instead of converging — the alarm rings once the clock has
 *     moved past it (03:30), the shift-forward convention;
 *   • a wall time that occurs twice (01:30 on the fall-back night) converges
 *     on the *first* occurrence.
 */
export function wallTimeToEpoch({ year, month, day, hour, minute }, zone) {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const candidates = [];
  let candidate = naive - zoneOffsetMs(naive, zone);
  for (let round = 0; round < 4; round += 1) {
    const offset = zoneOffsetMs(candidate, zone);
    const next = naive - offset;
    if (next === candidate) break;
    if (candidates.includes(next)) {
      candidates.push(next);
      break;
    }
    candidates.push(next);
    candidate = next;
  }
  if (candidates.length && candidates[candidates.length - 1] !== candidate) {
    candidate = Math.max(candidate, ...candidates);
  }
  return candidate;
}

/** Wall-clock day parts of an epoch, in a zone. */
function dayInZone(epochMs, zone) {
  return clockParts(new Date(epochMs), zone);
}

/** Weekday (0–6) of a UTC-midnight day value. */
function weekdayOf(utcDayMs) {
  return new Date(utcDayMs).getUTCDay();
}

function dayMsFromParts(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function occurrenceOn(alarm, utcDayMs, zone) {
  const [hour, minute] = alarm.time.split(":").map(Number);
  const date = new Date(utcDayMs);
  return wallTimeToEpoch(
    { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour, minute },
    zone
  );
}

/**
 * The next epoch after `fromMs` at which the alarm rings, or `null` when it
 * never will (a one-time alarm whose date and time have both passed).
 *
 * Calendar days are walked in the alarm's zone — today, tomorrow, the day
 * after — and each candidate day is tested against the pin (an optional
 * date) and the repeat (optional weekdays). A Friday-only alarm therefore
 * walks straight past Saturday and Sunday; the weekend is just days 1 and 2
 * of its walk.
 */
export function nextOccurrence(alarm, fromMs, zone) {
  const today = dayMsFromParts(dayInZone(fromMs, zone));
  const pinned = alarm.date ? Date.parse(`${alarm.date}T00:00Z`) : null;

  for (let step = 0; step < 370; step += 1) {
    const dayMs = today + step * 86400000;
    if (pinned !== null && dayMs < pinned) continue;
    if (alarm.repeat && !alarm.repeat.includes(weekdayOf(dayMs))) continue;
    if (pinned !== null && dayMs > pinned && !alarm.repeat) return null; // one-time, date gone
    const epoch = occurrenceOn(alarm, dayMs, zone);
    if (epoch > fromMs) return epoch;
  }
  return null;
}

/**
 * The latest epoch at or before `nowMs` at which the alarm *should* have
 * rung, or null. Walking back a week is enough: nothing further back can be
 * inside the grace window, and weekly repeats recur within seven days.
 */
export function lastOccurrence(alarm, nowMs, zone) {
  const today = dayMsFromParts(dayInZone(nowMs, zone));
  const pinned = alarm.date ? Date.parse(`${alarm.date}T00:00Z`) : null;

  for (let step = 0; step < 8; step += 1) {
    const dayMs = today - step * 86400000;
    if (pinned !== null && dayMs < pinned) return null;
    if (alarm.repeat && !alarm.repeat.includes(weekdayOf(dayMs))) continue;
    if (pinned !== null && !alarm.repeat && dayMs !== pinned) continue;
    const epoch = occurrenceOn(alarm, dayMs, zone);
    if (epoch <= nowMs) return epoch;
  }
  return null;
}

/**
 * The occurrence an alarm is *due* for right now, if any: within the grace
 * window, strictly later than the last time it rang. This is the whole
 * throttled-tab story in one function.
 */
export function dueOccurrence(alarm, nowMs, zone, { graceMs = GRACE_MS, lastRang = alarm.lastRang || 0 } = {}) {
  const occurrence = lastOccurrence(alarm, nowMs, zone);
  if (occurrence === null) return null;
  if (nowMs - occurrence > graceMs) return null;
  if (occurrence <= lastRang) return null;
  return occurrence;
}

/* ------------------------------------------------------------- wording */

/** "Today 06:30" · "Tomorrow 06:30" · "Fri 06:30" · "21 Mar 06:30". */
export function formatOccurrence(epochMs, zone, nowMs = Date.now()) {
  const target = dayInZone(epochMs, zone);
  const now = dayInZone(nowMs, zone);
  const time = `${pad(target.hour)}:${pad(target.minute)}`;
  const dayDiff = (dayMsFromParts(target) - dayMsFromParts(now)) / 86400000;
  if (dayDiff === 0) return `Today ${time}`;
  if (dayDiff === 1) return `Tomorrow ${time}`;
  if (dayDiff > 1 && dayDiff < 7) return `${WEEKDAYS[weekdayOf(dayMsFromParts(target))]} ${time}`;
  return `${pad(target.day)} ${MONTHS[target.month - 1]} ${time}`;
}

/** "in 25 min" · "in 5 h 20 min" · "in 3 days" — how long until an epoch. */
export function relativeWhen(epochMs, nowMs = Date.now()) {
  const ms = epochMs - nowMs;
  if (ms <= 0) return "now";
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "in under a minute";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `in ${hours} h ${minutes % 60} min` : `in ${hours} h`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

/** "Once" · "Once · 2026-09-21" · "Every day" · "Weekdays" · "Mon, Fri". */
export function describeRepeat(alarm) {
  if (!alarm.repeat) return alarm.date ? `Once · ${alarm.date}` : "Once";
  if (alarm.repeat.length === 7) return "Every day";
  const weekdays = [1, 2, 3, 4, 5];
  if (weekdays.every((day) => alarm.repeat.includes(day)) && alarm.repeat.length === 5) return "Weekdays";
  if (alarm.repeat.length === 2 && alarm.repeat.includes(0) && alarm.repeat.includes(6)) return "Weekends";
  return alarm.repeat.map((day) => WEEKDAYS[day]).join(", ");
}

/* ----------------------------------------------------------- controller */

/**
 * The Alarms section: editor, list, and the thing that watches the clock.
 *
 * @param {object} options
 *   @param {object} options.elements the section's ids (see index.html)
 *   @param {() => string} [options.getZone] the zone wall-clock times run in
 *   @param {(message: string, symbol?: string, duration?: number) => void} [options.notify]
 *   @param {object} [options.player] an alarm player (injectable for tests)
 */
export function createAlarms({ elements = {}, getZone, notify, player } = {}) {
  const sounds = player || createAlarmPlayer();
  const alarms = loadAlarms();
  const ui = { editingId: null, ringing: null, queue: [] };
  const scheduleDays = {
    once: null,
    weekdays: [1, 2, 3, 4, 5],
    daily: [0, 1, 2, 3, 4, 5, 6],
    weekends: [0, 6],
  };
  const starterTemplates = {
    morning: { time: "07:00", repeat: scheduleDays.weekdays, label: "Good morning" },
    lunch: { time: "12:30", repeat: scheduleDays.weekdays, label: "Lunch break" },
    unwind: { time: "21:30", repeat: scheduleDays.daily, label: "Time to unwind" },
  };

  function currentZone() {
    if (typeof getZone === "function") {
      try {
        const zone = getZone();
        if (zone) return zone;
      } catch (_) {
        /* fall through to the device zone */
      }
    }
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch (_) {
      return "UTC";
    }
  }

  /* ------------------------------------------------------------ storage */

  function loadAlarms() {
    try {
      return parseStoredAlarms(JSON.parse(localStorage.getItem(STORE_KEY)));
    } catch (_) {
      return [];
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(alarms));
    } catch (_) {
      /* private mode: the alarms last for this visit only */
    }
  }

  function readSetting(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : raw;
    } catch (_) {
      return fallback;
    }
  }

  function volumeSetting() {
    const value = Number(readSetting("tempo-alarm-volume", 0.7));
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.7;
  }

  /** Seconds; 0 means "until I stop it". Shared with the timer's settings. */
  function durationSetting() {
    const value = Number(readSetting("tempo-alarm-duration", 30));
    return Number.isFinite(value) && value >= 0 ? value : 30;
  }

  function notificationsOn() {
    return readSetting("tempo-alarm-notify", "off") === "on";
  }

  /* ------------------------------------------------------------ ringing */

  function systemNotify(alarm) {
    if (!notificationsOn()) return;
    try {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const note = new Notification(alarm.label || "Alarm", {
        body: `It is ${alarm.time} — ${findSound(alarm.sound).name}.`,
        tag: `tempo-alarm-${alarm.id}`,
        requireInteraction: durationSetting() === 0,
        silent: true,
      });
      note.onclick = () => {
        try {
          window.focus();
          note.close();
        } catch (_) {
          /* nothing to focus */
        }
      };
    } catch (_) {
      /* notifications are a bonus, never a requirement */
    }
  }

  function startRinging(alarm, occurrence) {
    ui.ringing = { id: alarm.id, occurrence };
    const duration = durationSetting();
    sounds.play(findSound(alarm.sound).id, {
      volume: volumeSetting(),
      durationMs: duration > 0 ? Math.min(duration * 1000, MAX_ALARM_MS) : MAX_ALARM_MS,
      repeat: true,
    });

    if (elements.ringingBar) {
      elements.ringingBar.hidden = false;
      if (elements.ringingLabel) elements.ringingLabel.textContent = alarm.label || `It is ${alarm.time}`;
      if (elements.ringingNote) {
        elements.ringingNote.textContent = alarm.notes || `${describeRepeat(alarm)} · ${findSound(alarm.sound).name}`;
      }
    }
    systemNotify(alarm);
    scrollToAlarm(alarm.id);
    render();

    if (duration > 0 && typeof window !== "undefined") {
      window.setTimeout(() => {
        if (ui.ringing && ui.ringing.id === alarm.id && !sounds.playing) dismiss({ silent: true });
      }, duration * 1000 + 400);
    }
  }

  /**
   * An alarm you cannot see is a bell in another room: the page scrolls
   * itself to the ringing card, wherever the reader happens to be.
   */
  function scrollToAlarm(id) {
    if (!elements.list || typeof elements.list.querySelector !== "function") return;
    const card = elements.list.querySelector(`[data-alarm-id="${typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id}"]`);
    if (!card || typeof card.scrollIntoView !== "function") return;
    try {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (_) {
      /* older webviews: the highlight will have to do */
    }
  }

  function dismiss({ silent = false } = {}) {
    const wasRinging = Boolean(ui.ringing);
    ui.ringing = null;
    sounds.stop();
    if (elements.ringingBar) elements.ringingBar.hidden = true;
    if (wasRinging && !silent && notify) notify("Alarm stopped.");
    if (ui.queue.length) {
      const next = ui.queue.shift();
      startRinging(next.alarm, next.occurrence);
    }
    render();
    return wasRinging;
  }

  /* -------------------------------------------------------------- clock */

  function check() {
    const now = Date.now();
    const zone = currentZone();
    let changed = false;

    for (const alarm of alarms) {
      if (!alarm.enabled) continue;
      if (ui.ringing && ui.ringing.id === alarm.id) continue;
      if (ui.queue.some((entry) => entry.alarm.id === alarm.id)) continue;
      const occurrence = dueOccurrence(alarm, now, zone);
      if (occurrence === null) continue;
      alarm.lastRang = occurrence;
      if (!alarm.repeat) alarm.enabled = false; // a one-time alarm has had its moment
      changed = true;
      ui.queue.push({ alarm, occurrence });
    }

    if (changed) persist();
    if (!ui.ringing && ui.queue.length) {
      const next = ui.queue.shift();
      startRinging(next.alarm, next.occurrence);
    }
    renderTimes();
    return changed;
  }

  /* ------------------------------------------------------------ editor */

  function fillSoundSelect() {
    if (!elements.sound) return;
    const groups = soundsByMood()
      .map(
        (group) =>
          `<optgroup label="${escapeHTML(group.label)}">${group.sounds
            .map((sound) => `<option value="${escapeHTML(sound.id)}">${escapeHTML(sound.name)}</option>`)
            .join("")}</optgroup>`
      )
      .join("");
    elements.sound.innerHTML = groups;
    elements.sound.value = DEFAULT_SOUND_ID;
  }

  function repeatFromChips() {
    if (!elements.repeatRow) return null;
    const days = Array.from(elements.repeatRow.querySelectorAll("[data-repeat-day]"))
      .filter((chip) => chip.getAttribute("aria-pressed") === "true")
      .map((chip) => Number(chip.dataset.repeatDay));
    return normaliseRepeat(days);
  }

  function syncChips(alarm) {
    if (!elements.repeatRow) return;
    for (const chip of elements.repeatRow.querySelectorAll("[data-repeat-day]")) {
      const active = Boolean(alarm && alarm.repeat && alarm.repeat.includes(Number(chip.dataset.repeatDay)));
      chip.setAttribute("aria-pressed", String(active));
      chip.classList.toggle("active", active);
    }
    syncDateField();
    syncSchedulePresets();
    renderEditorPreview();
  }

  /** The date only means anything for a one-time alarm. */
  function syncDateField() {
    if (!elements.date) return;
    const repeating = repeatFromChips() !== null;
    elements.date.disabled = repeating;
    if (repeating) elements.date.value = "";
  }

  function scheduleForRepeat(repeat) {
    const normalised = normaliseRepeat(repeat);
    if (!normalised) return "once";
    return Object.entries(scheduleDays).find(([, days]) => days && days.length === normalised.length && days.every((day, index) => day === normalised[index]))?.[0] || "";
  }

  function syncSchedulePresets() {
    if (!elements.schedulePresets) return;
    const activeId = scheduleForRepeat(repeatFromChips());
    for (const button of elements.schedulePresets.querySelectorAll("[data-alarm-schedule]")) {
      const active = button.dataset.alarmSchedule === activeId;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  function applySchedule(id) {
    if (!(id in scheduleDays) || !elements.repeatRow) return;
    const days = scheduleDays[id];
    for (const chip of elements.repeatRow.querySelectorAll("[data-repeat-day]")) {
      const active = Boolean(days && days.includes(Number(chip.dataset.repeatDay)));
      chip.classList.toggle("active", active);
      chip.setAttribute("aria-pressed", String(active));
    }
    syncDateField();
    syncSchedulePresets();
    renderEditorPreview();
  }

  function editorDraft() {
    const time = elements.time ? String(elements.time.value || "").trim() : "";
    if (!TIME_PATTERN.test(time)) return null;
    const repeat = repeatFromChips();
    return {
      time,
      repeat,
      date: repeat ? null : elements.date && elements.date.value ? String(elements.date.value) : null,
    };
  }

  function renderEditorPreview() {
    if (!elements.preview) return;
    const draft = editorDraft();
    if (!draft) {
      elements.preview.textContent = "Choose a time";
      return;
    }
    const next = nextOccurrence(draft, Date.now(), currentZone());
    elements.preview.textContent = next
      ? `Next · ${formatOccurrence(next, currentZone())} · ${relativeWhen(next)}`
      : "That moment has already passed";
  }

  function applyStarterTemplate(id) {
    const template = starterTemplates[id];
    if (!template) return;
    if (elements.time) elements.time.value = template.time;
    if (elements.label) elements.label.value = template.label;
    if (elements.notes) elements.notes.value = "";
    applySchedule(scheduleForRepeat(template.repeat));
    if (elements.time && typeof elements.time.focus === "function") elements.time.focus();
    if (notify) notify(`${template.label} is ready to personalise — save it when it feels right.`, "✦");
  }

  function resetEditor() {
    ui.editingId = null;
    if (elements.time) elements.time.value = "07:00";
    if (elements.date) elements.date.value = "";
    if (elements.label) elements.label.value = "";
    if (elements.notes) elements.notes.value = "";
    if (elements.sound) elements.sound.value = DEFAULT_SOUND_ID;
    syncChips(null);
    if (elements.save) elements.save.textContent = "Add alarm";
    if (elements.cancel) elements.cancel.hidden = true;
    if (elements.editorTitle) elements.editorTitle.textContent = "New alarm";
  }

  function editAlarm(id) {
    const alarm = alarms.find((entry) => entry.id === id);
    if (!alarm) return;
    ui.editingId = id;
    if (elements.time) elements.time.value = alarm.time;
    if (elements.date) elements.date.value = alarm.date || "";
    if (elements.label) elements.label.value = alarm.label;
    if (elements.notes) elements.notes.value = alarm.notes;
    if (elements.sound) elements.sound.value = alarm.sound;
    syncChips(alarm);
    if (elements.save) elements.save.textContent = "Save changes";
    if (elements.cancel) elements.cancel.hidden = false;
    if (elements.editorTitle) elements.editorTitle.textContent = "Edit alarm";
    if (elements.time && typeof elements.time.focus === "function") elements.time.focus();
  }

  function saveFromEditor() {
    const time = elements.time ? String(elements.time.value || "").trim() : "";
    if (!TIME_PATTERN.test(time)) {
      if (notify) notify("Pick a time first — the alarm needs one.", "!");
      return;
    }
    const repeat = repeatFromChips();
    const date = repeat ? null : elements.date && elements.date.value ? String(elements.date.value) : null;
    if (date && (!DATE_PATTERN.test(date) || Number.isNaN(Date.parse(`${date}T12:00Z`)))) {
      if (notify) notify("That date does not look like a date.", "!");
      return;
    }

    const base = {
      time,
      date,
      repeat,
      label: elements.label ? String(elements.label.value || "").trim().slice(0, 80) : "",
      notes: elements.notes ? String(elements.notes.value || "").trim().slice(0, 500) : "",
      sound:
        elements.sound && ALARM_SOUNDS.some((entry) => entry.id === elements.sound.value)
          ? elements.sound.value
          : DEFAULT_SOUND_ID,
      enabled: true,
    };

    const editing = ui.editingId ? alarms.find((entry) => entry.id === ui.editingId) : null;
    if (editing) Object.assign(editing, base);
    else alarms.push({ id: makeId(), ...base });

    // A saved alarm never rings for a moment that is already past — you set
    // it *now*, so the past version of its time is not something you missed.
    const saved = editing || alarms[alarms.length - 1];
    saved.lastRang = lastOccurrence(saved, Date.now(), currentZone()) || 0;

    persist();
    resetEditor();
    render();
    check();
    const zone = currentZone();
    const next = nextOccurrence(saved, Date.now(), zone);
    if (notify) {
      notify(next ? `Alarm set for ${formatOccurrence(next, zone)} — ${relativeWhen(next)}.` : "Alarm saved.", "⏰");
    }
  }

  function toggleAlarm(id) {
    const alarm = alarms.find((entry) => entry.id === id);
    if (!alarm) return;
    alarm.enabled = !alarm.enabled;
    if (!alarm.enabled && ui.ringing && ui.ringing.id === id) dismiss({ silent: true });
    if (alarm.enabled) alarm.lastRang = lastOccurrence(alarm, Date.now(), currentZone()) || 0;
    persist();
    render();
  }

  function removeAlarm(id) {
    const index = alarms.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    const [alarm] = alarms.splice(index, 1);
    if (ui.ringing && ui.ringing.id === id) dismiss({ silent: true });
    if (ui.editingId === id) resetEditor();
    persist();
    render();
    if (notify) notify(`Removed the ${alarm.time} alarm.`);
  }

  /* ------------------------------------------------------------ render */

  function render() {
    if (elements.list) elements.list.innerHTML = alarms.map((alarm, index) => alarmCard(alarm, index)).join("");
    if (elements.empty) elements.empty.hidden = alarms.length > 0;
    if (elements.status) {
      const on = alarms.filter((alarm) => alarm.enabled).length;
      elements.status.textContent = alarms.length ? `${on} ON · ${alarms.length - on} OFF` : "NO ALARMS YET";
      elements.status.classList.toggle("neutral", on === 0);
      elements.status.classList.toggle("running", on > 0);
    }
    if (elements.ringingBar && !ui.ringing && !ui.queue.length) elements.ringingBar.hidden = true;
    renderTimes();
  }

  function alarmCard(alarm, index = 0) {
    const zone = currentZone();
    const next = alarm.enabled ? nextOccurrence(alarm, Date.now(), zone) : null;
    const sound = findSound(alarm.sound);
    const ringing = ui.ringing && ui.ringing.id === alarm.id;
    const nextLine = !alarm.enabled
      ? "Paused — tap the switch when you need it"
      : next
        ? `${escapeHTML(relativeWhen(next))} · ${escapeHTML(formatOccurrence(next, zone))}`
        : "This one-time moment has passed";
    return `<li class="alarm-item alarm-color-${index % 4}${alarm.enabled ? "" : " is-off"}${ringing ? " is-ringing" : ""}" data-alarm-id="${escapeHTML(alarm.id)}">
      <span class="alarm-card-icon" aria-hidden="true">${ringing ? "♪" : "↗"}</span>
      <div class="alarm-when">
        <span class="alarm-time">${escapeHTML(alarm.time)}</span>
        <span class="alarm-repeat">${escapeHTML(describeRepeat(alarm))}</span>
      </div>
      <div class="alarm-body">
        <strong class="alarm-label">${alarm.label ? escapeHTML(alarm.label) : "Alarm"}</strong>
        ${alarm.notes ? `<p class="alarm-notes">${escapeHTML(alarm.notes)}</p>` : ""}
        <div class="alarm-card-meta"><span class="alarm-sound"><span aria-hidden="true">♪</span> ${escapeHTML(sound.name)}</span><span class="alarm-next" data-next-for="${escapeHTML(alarm.id)}">${nextLine}</span></div>
      </div>
      <div class="alarm-actions">
        <button type="button" class="alarm-toggle" data-alarm-toggle="${escapeHTML(alarm.id)}" aria-pressed="${alarm.enabled}" title="${alarm.enabled ? "Turn off" : "Turn on"}">
          <span class="alarm-toggle-track" aria-hidden="true"><span></span></span><span class="alarm-toggle-label">${alarm.enabled ? "On" : "Off"}</span>
        </button>
        <button type="button" class="alarm-edit" data-alarm-edit="${escapeHTML(alarm.id)}">Edit</button>
        <button type="button" class="alarm-remove" data-alarm-remove="${escapeHTML(alarm.id)}" aria-label="Remove the ${escapeHTML(alarm.time)} alarm">✕</button>
      </div>
    </li>`;
  }

  /** The "in 8 h" lines, refreshed by the clock tick without a re-list. */
  function renderTimes() {
    if (!elements.list) return;
    const zone = currentZone();
    for (const alarm of alarms) {
      const line = elements.list.querySelector(`[data-next-for="${alarm.id}"]`);
      if (!line) continue;
      if (!alarm.enabled) {
        line.textContent = "Paused — tap the switch when you need it";
        continue;
      }
      const next = nextOccurrence(alarm, Date.now(), zone);
      line.textContent = next ? `${relativeWhen(next)} · ${formatOccurrence(next, zone)}` : "past — it will not ring";
    }
  }

  /* ------------------------------------------------------------- events */

  function bindEvents() {
    if (elements.save) elements.save.addEventListener("click", saveFromEditor);
    if (elements.cancel) elements.cancel.addEventListener("click", resetEditor);
    if (elements.dismiss) elements.dismiss.addEventListener("click", () => dismiss());
    if (elements.time) elements.time.addEventListener("input", renderEditorPreview);
    if (elements.date) elements.date.addEventListener("change", renderEditorPreview);
    if (elements.sound) elements.sound.addEventListener("change", renderEditorPreview);
    if (elements.testSound) {
      elements.testSound.addEventListener("click", () => {
        const id = elements.sound && ALARM_SOUNDS.some((entry) => entry.id === elements.sound.value)
          ? elements.sound.value
          : DEFAULT_SOUND_ID;
        sounds.preview(id, { volume: volumeSetting() });
        if (notify) notify(`Previewing ${findSound(id).name}.`, "♪");
      });
    }
    if (elements.schedulePresets) {
      elements.schedulePresets.addEventListener("click", (event) => {
        const button = event.target.closest("[data-alarm-schedule]");
        if (button) applySchedule(button.dataset.alarmSchedule);
      });
    }
    if (elements.empty) {
      elements.empty.addEventListener("click", (event) => {
        const button = event.target.closest("[data-alarm-template]");
        if (button) applyStarterTemplate(button.dataset.alarmTemplate);
      });
    }
    if (elements.repeatRow) {
      elements.repeatRow.addEventListener("click", (event) => {
        const chip = event.target.closest("[data-repeat-day]");
        if (!chip) return;
        const active = chip.getAttribute("aria-pressed") !== "true";
        chip.setAttribute("aria-pressed", String(active));
        chip.classList.toggle("active", active);
        syncDateField();
        syncSchedulePresets();
        renderEditorPreview();
      });
    }
    if (elements.list) {
      elements.list.addEventListener("click", (event) => {
        const toggle = event.target.closest("[data-alarm-toggle]");
        const edit = event.target.closest("[data-alarm-edit]");
        const remove = event.target.closest("[data-alarm-remove]");
        if (toggle) toggleAlarm(toggle.dataset.alarmToggle);
        else if (edit) editAlarm(edit.dataset.alarmEdit);
        else if (remove) removeAlarm(remove.dataset.alarmRemove);
      });
    }
  }

  /* --------------------------------------------------------------- api */

  let ticker = 0;

  return {
    init() {
      fillSoundSelect();
      resetEditor();
      bindEvents();
      render();
      check();
      if (typeof window !== "undefined" && !ticker) {
        ticker = window.setInterval(check, 1000);
      }
      if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
        // A throttled background tab catches up the moment it is visible.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") check();
        });
      }
    },
    /** Called by the scroll spy when the section comes into view. */
    sync() {
      check();
      render();
    },
    check,
    dismiss,
    stop() {
      if (ticker && typeof window !== "undefined") window.clearInterval(ticker);
      ticker = 0;
      sounds.stop();
    },
    get alarms() {
      return alarms;
    },
    get ringingId() {
      return ui.ringing ? ui.ringing.id : null;
    },
  };
}
