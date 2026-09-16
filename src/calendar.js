/**
 * A home-zone calendar that speaks more than one calendar.
 *
 * The grid itself stays Gregorian and honest: it follows the dashboard's
 * home place, highlights that place's today, and remembers the month and day
 * you were looking at. Around that spine:
 *
 *   • The week can start Monday, Sunday or Saturday (Settings).
 *   • Each cell can carry a date from Bikram Sambat, Chinese, Korean (Dangi),
 *     Hebrew, Hijri, Persian, Indian, Thai Buddhist or Japanese. When one is
 *     selected it becomes the large primary date and Gregorian moves below
 *     it, so switching calendars changes what the reader sees first.
 *   • Holidays and observances from `calendar-events.js` mark cells with
 *     colored dots, grouped in a legend, and list themselves on the
 *     selected day.
 *   • And any date can hold the reader's own notes, kept on this device
 *     (`calendar-notes.js`).
 *
 * All calculations are done as plain UTC dates so the browser's own time
 * zone cannot move a calendar cell.
 */

import { escapeHTML } from "./ui.js";
import { getFormatter, partsFor } from "./time-math.js";
import { describeInSystem, calendarSystem } from "./calendar-systems.js";
import { eventCategory, eventsForDate } from "./calendar-events.js";
import { addNote, notesForDate, removeNote } from "./calendar-notes.js";

export const CALENDAR_STORAGE_KEY = "tempo-calendar";
export const WEEK_STARTS_ON = "monday";
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY = 86_400_000;
const SUN_FIRST_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const monthTitleFormatter = getFormatter("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
const fullDateFormatter = getFormatter("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
const shortDateFormatter = getFormatter("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

export function pad2(value) {
  return String(value).padStart(2, "0");
}

export function plainDate({ year, month, day }) {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

export function parsePlainDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function parseYearMonth(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function dayOfYear(date) {
  return Math.floor((Date.UTC(date.year, date.month - 1, date.day) - Date.UTC(date.year, 0, 1)) / DAY) + 1;
}

export function isoWeek(date) {
  const target = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const weekday = (target.getUTCDay() + 6) % 7; // Monday = 0, Sunday = 6
  target.setUTCDate(target.getUTCDate() - weekday + 3); // Thursday decides the ISO week-year

  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);

  return {
    year: target.getUTCFullYear(),
    week: 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * DAY)),
  };
}

export function addMonths(view, amount) {
  const base = new Date(Date.UTC(view.year, view.month - 1 + amount, 1));
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1 };
}

export function monthKey(view) {
  return `${String(view.year).padStart(4, "0")}-${pad2(view.month)}`;
}

/**
 * Weekday headers for a week start. `weekStart` is a getUTCDay-style index:
 * 1 = Monday (default), 0 = Sunday, 6 = Saturday.
 */
export function weekdayLabels(weekStart = 1) {
  const start = Number.isInteger(weekStart) && weekStart >= 0 && weekStart <= 6 ? weekStart : 1;
  return Array.from({ length: 7 }, (_, index) => SUN_FIRST_WEEKDAYS[(start + index) % 7]);
}

export function buildMonth({ year, month, today, selected, weekStart = 1 } = {}) {
  const start = Number.isInteger(weekStart) && weekStart >= 0 && weekStart <= 6 ? weekStart : 1;
  const labels = weekdayLabels(start);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const leading = (first.getUTCDay() - start + 7) % 7;
  const gridStart = Date.UTC(year, month - 1, 1 - leading);
  const todayIso = today ? plainDate(today) : "";
  const selectedIso = selected || todayIso;

  return Array.from({ length: 42 }, (_, index) => {
    const stamp = new Date(gridStart + index * DAY);
    const cell = {
      year: stamp.getUTCFullYear(),
      month: stamp.getUTCMonth() + 1,
      day: stamp.getUTCDate(),
    };
    const iso = plainDate(cell);
    const nativeDay = stamp.getUTCDay();
    return {
      ...cell,
      iso,
      weekday: labels[index % 7],
      inMonth: cell.month === month,
      isToday: iso === todayIso,
      isSelected: iso === selectedIso,
      isWeekend: nativeDay === 0 || nativeDay === 6,
    };
  });
}

export function describeDate(date, today) {
  const iso = plainDate(date);
  const todayIso = plainDate(today || date);
  const then = Date.UTC(date.year, date.month - 1, date.day);
  const now = Date.UTC((today || date).year, (today || date).month - 1, (today || date).day);
  const diff = Math.round((then - now) / DAY);
  const week = isoWeek(date);
  const ordinal = dayOfYear(date);
  const total = isLeapYear(date.year) ? 366 : 365;
  const relative =
    diff === 0 ? "today" : diff === 1 ? "tomorrow" : diff === -1 ? "yesterday" : diff > 1 ? `in ${diff} days` : `${Math.abs(diff)} days ago`;

  return {
    iso,
    title: fullDateFormatter.format(new Date(Date.UTC(date.year, date.month - 1, date.day))),
    short: shortDateFormatter.format(new Date(Date.UTC(date.year, date.month - 1, date.day))),
    relative,
    dayOfYear: ordinal,
    daysLeft: total - ordinal,
    isoWeek: week,
    today: iso === todayIso,
  };
}

export function readCalendarState(storage) {
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!store) return {};
    const parsed = JSON.parse(store.getItem(CALENDAR_STORAGE_KEY) || "{}");
    const view = parseYearMonth(parsed.view);
    const selected = parsePlainDate(parsed.selected);
    return {
      view: view || null,
      selected: selected ? plainDate(selected) : "",
    };
  } catch (_) {
    return {};
  }
}

function writeCalendarState(state) {
  try {
    localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify({ view: monthKey(state.view), selected: state.selected }));
  } catch (_) {
    // The calendar still works for this visit when storage is blocked.
  }
}

function monthTitle(view) {
  return monthTitleFormatter.format(new Date(Date.UTC(view.year, view.month - 1, 1)));
}

function alternateMonthTitle(view, cells, systemId) {
  const labels = [];
  for (const cell of cells.filter((entry) => entry.inMonth)) {
    const alt = describeInSystem(systemId, cell);
    if (!alt) continue;
    const label = systemId === "bikram" ? `${alt.monthName} ${alt.year} BS` : `${alt.monthName} ${alt.year}`;
    if (!labels.includes(label)) labels.push(label);
  }
  const gregorian = monthTitle(view);
  return labels.length ? `${labels.join(" → ")} · ${gregorian}` : gregorian;
}

function todayInZone(zone, at = new Date()) {
  const parts = partsFor(at, zone || "UTC");
  return { year: parts.year, month: parts.month, day: parts.day };
}

const FALLBACK_PREFERENCES = { weekStart: "monday", calendarSystem: "gregorian", holidays: {} };
const WEEK_START_DAYS = { monday: 1, sunday: 0, saturday: 6 };

export function createCalendar({ elements = {}, getZone = () => "UTC", getPlace = () => ({ city: "your home place" }), getPreferences, notify } = {}) {
  const state = readCalendarState();
  let bound = false;
  let lastToday = "";

  function preferences() {
    try {
      const prefs = typeof getPreferences === "function" ? getPreferences() : null;
      return { ...FALLBACK_PREFERENCES, ...(prefs || {}) };
    } catch (_) {
      return { ...FALLBACK_PREFERENCES };
    }
  }

  function weekStartDay(prefs = preferences()) {
    return WEEK_START_DAYS[prefs.weekStart] ?? 1;
  }

  function ensureState(now = new Date()) {
    const today = todayInZone(getZone(), now);
    if (!state.view) state.view = { year: today.year, month: today.month };
    if (!state.selected) state.selected = plainDate(today);
    return today;
  }

  function systemInfo(prefs = preferences()) {
    const system = calendarSystem(prefs.calendarSystem);
    return { id: system.id, system, active: system.id !== "gregorian" };
  }

  function render(now = new Date()) {
    const today = ensureState(now);
    const todayIso = plainDate(today);
    lastToday = todayIso;

    const prefs = preferences();
    const start = weekStartDay(prefs);
    const second = systemInfo(prefs);

    const selected = parsePlainDate(state.selected) || today;
    const selectedIso = plainDate(selected);
    const cells = buildMonth({ ...state.view, today, selected: selectedIso, weekStart: start });
    const place = getPlace() || {};
    const city = place.city || place.label || "your home place";

    if (elements.month) {
      elements.month.textContent = second.active ? alternateMonthTitle(state.view, cells, second.id) : monthTitle(state.view);
    }
    if (elements.grid) {
      const card = elements.grid.closest(".calendar-card");
      if (card) {
        card.dataset.calendarPrimary = second.active ? second.id : "gregorian";
        card.dataset.calendarLabel = second.active ? second.system.label : "Gregorian";
      }
    }
    if (elements.summary) {
      const todayDetail = describeDate(today, today);
      const todayAlt = second.active ? describeInSystem(second.id, today) : null;
      const weekNote = start === 1 ? "Weeks start on Monday" : `Weeks start on ${start === 0 ? "Sunday" : "Saturday"}`;
      const secondNote = second.active
        ? ` Primary dates: ${second.system.label}${todayAlt ? ` (${todayAlt.monthLabel || todayAlt.monthName} ${todayAlt.day}, ${todayAlt.year})` : ""}. Gregorian dates stay underneath.`
        : " Choose a calendar to put its dates first.";
      elements.summary.textContent = `Today in ${city}: ${todayDetail.title}. ${weekNote}. ${secondNote}`;
    }
    if (elements.todayPill) {
      const todayAlt = second.active ? describeInSystem(second.id, today) : null;
      elements.todayPill.textContent = todayAlt ? `TODAY · ${todayAlt.long}` : `TODAY · ${todayIso}`;
    }
    if (elements.systemBadge) {
      elements.systemBadge.hidden = !second.active;
      elements.systemBadge.textContent = second.active ? `PRIMARY · ${second.system.label}` : "";
    }
    if (elements.grid) {
      const labels = weekdayLabels(start);
      const weekdays = labels.map((day) => `<span class="calendar-weekday" role="columnheader">${day}</span>`).join("");
      const markedCategories = new Set();
      const days = cells
        .map((cell) => {
          const classes = ["calendar-day"];
          if (!cell.inMonth) classes.push("is-outside");
          if (cell.isToday) classes.push("is-today");
          if (cell.isSelected) classes.push("is-selected");
          if (cell.isWeekend) classes.push("is-weekend");

          const events = eventsForDate(cell, prefs.holidays);
          for (const event of events) markedCategories.add(event.category);
          const notes = notesForDate(cell.iso);
          const alt = second.active ? describeInSystem(second.id, cell) : null;
          if (events.length || notes.length) classes.push("is-marked");

          const label = describeDate(cell, today).title;
          const aria = [label];
          if (alt) aria.push(`${alt.label}: ${alt.long}`);
          if (events.length) aria.push(events.map((event) => event.name).join(", "));
          if (notes.length) aria.push(`${notes.length} note${notes.length === 1 ? "" : "s"}`);

          const dots = [];
          for (const event of events.slice(0, 3)) {
            dots.push(`<span class="calendar-dot" data-cat="${escapeHTML(event.category)}"></span>`);
          }
          if (events.length > 3) dots.push(`<span class="calendar-dot-extra">+${events.length - 3}</span>`);
          if (notes.length) dots.push('<span class="calendar-dot calendar-dot-note"></span>');

          const primaryNumber = second.active && alt ? alt.cell : String(cell.day);
          const dateUnderneath = second.active && alt
            ? `<span class="calendar-alt calendar-gregorian-date" title="Gregorian date">${cell.day}</span>`
            : alt
              ? `<span class="calendar-alt" title="${escapeHTML(alt.monthLabel || alt.long)}">${escapeHTML(alt.cell)}</span>`
              : "";
          if (second.active && alt) classes.push("is-calendar-primary");

          return `<button type="button" class="${classes.join(" ")}" role="gridcell" data-date="${escapeHTML(cell.iso)}" aria-pressed="${cell.isSelected}" aria-label="${escapeHTML(aria.join(" — "))}${cell.isToday ? ", today" : ""}">
            <span class="calendar-number" title="${escapeHTML(alt ? (alt.monthLabel || alt.long) : label)}">${escapeHTML(primaryNumber)}</span>
            ${dateUnderneath}
            ${cell.isToday ? '<small class="calendar-day-tag">Today</small>' : ""}
            ${dots.length ? `<span class="calendar-dots">${dots.join("")}</span>` : ""}
          </button>`;
        })
        .join("");
      elements.grid.innerHTML = weekdays + days;
      renderLegend(prefs, markedCategories);
    } else {
      renderLegend(prefs, new Set());
    }

    renderSelected(selected, today, prefs);
  }

  function renderLegend(prefs, markedCategories) {
    if (!elements.legend) return;
    const second = systemInfo(prefs);
    const order = new Map([["world", 0], ["national", 1], ["cultural", 2], ["religious", 3]]);
    const parts = [...markedCategories]
      .sort((a, b) => (order.get(a) ?? 9) - (order.get(b) ?? 9))
      .map((id) => {
        const category = eventCategory(id);
        return `<span class="calendar-legend-item"><span class="calendar-dot" data-cat="${escapeHTML(category.id)}"></span>${escapeHTML(category.label)}</span>`;
      });
    parts.push(`<span class="calendar-legend-item"><span class="calendar-dot calendar-dot-note"></span>Your note</span>`);
    if (second.active) {
      parts.push(`<span class="calendar-legend-item calendar-legend-alt">Primary date: ${escapeHTML(second.system.label)} · Gregorian underneath</span>`);
    }
    elements.legend.innerHTML = parts.join("");
  }

  function renderSelected(selected, today, prefs = preferences()) {
    const detail = describeDate(selected, today);
    const second = systemInfo(prefs);
    const alt = second.active ? describeInSystem(second.id, selected) : null;
    if (elements.selectedTitle) elements.selectedTitle.textContent = alt ? alt.long : detail.title;
    if (elements.selectedMeta) {
      elements.selectedMeta.textContent = alt
        ? `Gregorian: ${detail.title}. ${detail.today ? "This is today in your home place." : `This date is ${detail.relative}.`}`
        : detail.today
          ? "This is today in your home place."
          : `This date is ${detail.relative}.`;
    }
    if (elements.selectedIso) elements.selectedIso.textContent = detail.iso;
    if (elements.selectedWeek) elements.selectedWeek.textContent = `Week ${pad2(detail.isoWeek.week)}, ${detail.isoWeek.year}`;
    if (elements.selectedYearDay) elements.selectedYearDay.textContent = `Day ${detail.dayOfYear}`;
    if (elements.selectedRemaining) elements.selectedRemaining.textContent = `${detail.daysLeft} days left`;

    if (elements.secondary) {
      elements.secondary.hidden = !alt;
      if (alt) {
        const monthNames = alt.monthLabel && alt.system === "bikram" ? ` · ${alt.monthLabel}` : "";
        elements.secondary.textContent = `${second.system.label}: ${alt.long}${monthNames}${alt.approximate ? " (tabular date — may differ locally by a day)" : ""}`;
      }
    }

    renderSelectedEvents(selected, prefs);
    renderNotes(selected);
  }

  function renderSelectedEvents(selected, prefs) {
    const events = eventsForDate(selected, prefs.holidays);
    if (elements.eventsBlock) elements.eventsBlock.hidden = false;
    if (elements.events) {
      elements.events.innerHTML = events.length
        ? events
            .map(
              (event) => `<li class="calendar-event" data-cat="${escapeHTML(event.category)}">
                <span class="calendar-dot" data-cat="${escapeHTML(event.category)}"></span>
                <span class="calendar-event-name">${escapeHTML(event.name)}</span>
                <small>${escapeHTML(eventCategory(event.category).label)}${event.place ? ` · ${escapeHTML(event.place)}` : ""}${event.bs ? ` · ${escapeHTML(event.bs.monthName)} ${event.bs.day}, ${event.bs.year} BS` : ""}${event.approximate ? " · approx." : ""}</small>
              </li>`
            )
            .join("")
        : `<li class="calendar-event-empty">No holidays marked on this date.</li>`;
    }
  }

  function renderNotes(selected) {
    const iso = plainDate(selected);
    const notes = notesForDate(iso);
    if (elements.noteCount) {
      elements.noteCount.textContent = notes.length ? `${notes.length}` : "";
      elements.noteCount.hidden = notes.length === 0;
    }
    if (elements.notesList) {
      elements.notesList.innerHTML = notes.length
        ? notes
            .map(
              (note) => `<li class="calendar-note" data-note-id="${escapeHTML(note.id)}">
                <span class="calendar-note-chip" data-color="${escapeHTML(note.color)}"></span>
                <span class="calendar-note-text">${escapeHTML(note.text)}</span>
                <button type="button" class="calendar-note-remove" data-note-remove="${escapeHTML(note.id)}" aria-label="Delete note">×</button>
              </li>`
            )
            .join("")
        : `<li class="calendar-note-empty">Nothing pinned to this date yet — add a note above.</li>`;
    }
  }

  function selectDate(iso, { silent = false } = {}) {
    const date = parsePlainDate(iso);
    if (!date) return false;
    state.selected = plainDate(date);
    state.view = { year: date.year, month: date.month };
    writeCalendarState(state);
    render();
    if (!silent && typeof notify === "function") notify(`${describeDate(date, ensureState()).short} selected in Calendar.`);
    return true;
  }

  function changeMonth(amount) {
    ensureState();
    const selected = parsePlainDate(state.selected) || { day: 1 };
    state.view = addMonths(state.view, amount);
    state.selected = plainDate({
      year: state.view.year,
      month: state.view.month,
      day: Math.min(selected.day, daysInMonth(state.view.year, state.view.month)),
    });
    writeCalendarState(state);
    render();
  }

  function jumpToToday() {
    const today = ensureState();
    state.view = { year: today.year, month: today.month };
    state.selected = plainDate(today);
    writeCalendarState(state);
    render();
    if (typeof notify === "function") notify("Calendar returned to today.");
  }

  function addNoteFromEditor() {
    ensureState();
    const selected = parsePlainDate(state.selected);
    if (!selected || !elements.noteInput) return;
    const iso = plainDate(selected);
    const text = elements.noteInput.value;
    const color = elements.noteColor ? elements.noteColor.value : "violet";
    if (!text.trim()) {
      if (typeof notify === "function") notify("Write the note first, then pin it to the date.", "!");
      return;
    }
    const note = addNote(iso, { text, color });
    if (!note) {
      if (typeof notify === "function") notify("That date already has all the notes it can hold.", "!");
      return;
    }
    elements.noteInput.value = "";
    render();
    if (typeof notify === "function") notify(`Note pinned to ${describeDate(selected, ensureState()).short}.`);
  }

  function bindEvents() {
    if (bound) return;
    bound = true;
    if (elements.prev) elements.prev.addEventListener("click", () => changeMonth(-1));
    if (elements.next) elements.next.addEventListener("click", () => changeMonth(1));
    if (elements.today) elements.today.addEventListener("click", jumpToToday);
    if (elements.grid) {
      elements.grid.addEventListener("click", (event) => {
        const day = event.target.closest("[data-date]");
        if (!day) return;
        selectDate(day.dataset.date);
      });
    }
    if (elements.noteAdd) elements.noteAdd.addEventListener("click", addNoteFromEditor);
    if (elements.noteInput) {
      elements.noteInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          addNoteFromEditor();
        }
      });
    }
    if (elements.notesList) {
      elements.notesList.addEventListener("click", (event) => {
        const removeButton = event.target.closest("[data-note-remove]");
        if (!removeButton) return;
        ensureState();
        const selected = parsePlainDate(state.selected);
        if (!selected) return;
        const iso = plainDate(selected);
        if (removeNote(iso, removeButton.dataset.noteRemove)) {
          render();
          if (typeof notify === "function") notify("Note removed from that date.");
        }
      });
    }
  }

  return {
    get view() {
      ensureState();
      return { ...state.view };
    },
    get selected() {
      ensureState();
      return state.selected;
    },
    init() {
      render();
      bindEvents();
    },
    render,
    sync(now = new Date()) {
      const today = todayInZone(getZone(), now);
      const iso = plainDate(today);
      if (iso !== lastToday) render(now);
    },
    refreshZone(now = new Date()) {
      ensureState(now);
      render(now);
    },
    /** Re-read preferences (week start, primary calendar, holiday sets) now. */
    refreshPreferences(now = new Date()) {
      render(now);
    },
    selectDate,
    jumpToToday,
  };
}
