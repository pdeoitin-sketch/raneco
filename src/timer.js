/**
 * The countdown timer — and the alarm that ends it.
 *
 * It owns its own interval so it survives everything else on the page:
 * `remaining` is derived from a wall-clock `endAt`, so a backgrounded tab that
 * throttles its timers still lands on the right number.
 *
 * What changed, and why
 * ---------------------
 * The old ending was a 0.4-second sine wave and a toast. If you had left the
 * desk — the entire reason you set a timer — you missed it. Now, when the
 * countdown reaches zero:
 *
 *   • the chosen alarm **keeps playing** for as long as you chose (or until
 *     you dismiss it), from a catalogue of sixteen sounds, your own audio
 *     file, or a YouTube / Spotify link,
 *   • a **system notification** fires, so it reaches you on another tab or
 *     behind another window,
 *   • the page shows a dismissable "time's up" bar rather than a toast that
 *     disappears after three seconds.
 *
 * Choices persist in `localStorage`, so the alarm you picked is still the
 * alarm next week.
 */

import { pad } from "./ui.js";
import {
  DEFAULT_SOUND_ID,
  MAX_ALARM_MS,
  createAlarmPlayer,
  findSound,
  parseMediaLink,
} from "./alarm-sounds.js";

const KEYS = {
  sound: "tempo-alarm-sound",
  volume: "tempo-alarm-volume",
  duration: "tempo-alarm-duration",
  custom: "tempo-alarm-custom",
  notify: "tempo-alarm-notify",
};

/** How long the alarm keeps sounding, in seconds. 0 = until dismissed. */
export const ALARM_DURATIONS = [
  { value: 5, label: "5 s" },
  { value: 15, label: "15 s" },
  { value: 30, label: "30 s" },
  { value: 60, label: "1 min" },
  { value: 0, label: "Until I stop it" },
];

export const DEFAULT_ALARM_DURATION = 30;

function readStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw;
  } catch (_) {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (_) {
    /* private mode: the choice lasts for this visit only */
  }
}

export function createTimer({ elements = {}, notify, player } = {}) {
  const state = {
    original: 5 * 60 * 1000,
    remaining: 5 * 60 * 1000,
    running: false,
    endAt: 0,
    interval: null,
    ringing: false,
  };

  const alarm = {
    soundId: readStored(KEYS.sound, DEFAULT_SOUND_ID),
    volume: clamp(Number(readStored(KEYS.volume, 0.7)), 0, 1, 0.7),
    duration: durationOrDefault(readStored(KEYS.duration, DEFAULT_ALARM_DURATION)),
    custom: readStored(KEYS.custom, ""),
    notifications: readStored(KEYS.notify, "off") === "on",
  };

  const sounds = player || createAlarmPlayer();

  function clamp(value, min, max, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, value));
  }

  function durationOrDefault(value) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds < 0) return DEFAULT_ALARM_DURATION;
    return ALARM_DURATIONS.some((entry) => entry.value === seconds) ? seconds : DEFAULT_ALARM_DURATION;
  }

  /** The alarm source: a parsed custom link when set, else a catalogue id. */
  function activeSource() {
    if (alarm.soundId === "custom") {
      const parsed = parseMediaLink(alarm.custom);
      if (parsed.kind && parsed.kind !== "none") return parsed;
      return DEFAULT_SOUND_ID;
    }
    return alarm.soundId;
  }

  function alarmDurationMs() {
    return alarm.duration > 0 ? Math.min(alarm.duration * 1000, MAX_ALARM_MS) : MAX_ALARM_MS;
  }

  /* -------------------------------------------------------------- display */

  function formatMilliseconds(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    // Only grow to HH:MM:SS when there is actually an hour to show.
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  }

  function readInputs() {
    if (!elements.minutes || !elements.seconds) return state.original;
    const minutes = Math.max(0, Math.min(999, Number.parseInt(elements.minutes.value, 10) || 0));
    const seconds = Math.max(0, Math.min(59, Number.parseInt(elements.seconds.value, 10) || 0));
    elements.minutes.value = String(minutes);
    elements.seconds.value = String(seconds);
    return (minutes * 60 + seconds) * 1000;
  }

  function lockInputs(disabled) {
    if (elements.minutes) elements.minutes.disabled = disabled;
    if (elements.seconds) elements.seconds.disabled = disabled;
    if (elements.presets) for (const button of elements.presets) button.disabled = disabled;
  }

  function render() {
    const { original, remaining, running } = state;
    const percentage = original > 0 ? Math.max(0, Math.min(1, remaining / original)) : 0;
    const degrees = percentage * 360;
    const foreground = remaining === 0 && original > 0 ? "var(--coral)" : "var(--violet)";

    if (elements.display) elements.display.textContent = formatMilliseconds(remaining);
    if (elements.ring) {
      elements.ring.style.background = `conic-gradient(${foreground} 0deg ${degrees}deg, var(--canvas-soft) ${degrees}deg 360deg)`;
      elements.ring.classList.toggle("is-ringing", state.ringing);
    }
    if (elements.start) {
      elements.start.innerHTML = running
        ? '<span class="play-icon">Ⅱ</span> Pause timer'
        : `<span class="play-icon">▶</span> ${remaining > 0 && remaining !== original ? "Resume timer" : "Start timer"}`;
    }

    let status = "READY";
    if (state.ringing) status = "TIME'S UP";
    else if (running) status = "RUNNING";
    else if (remaining > 0 && remaining !== original) status = "PAUSED";
    else if (remaining === 0 && original > 0) status = "DONE";
    if (elements.status) {
      elements.status.textContent = status;
      elements.status.classList.toggle("running", running);
      elements.status.classList.toggle("ringing", state.ringing);
    }
    if (elements.ringingBar) elements.ringingBar.hidden = !state.ringing;
    lockInputs(running);
  }

  function clearIntervalTimer() {
    if (state.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
  }

  /* ---------------------------------------------------------- the ending */

  /**
   * Reach the user even when the tab is not the one they are looking at.
   * Permission is only ever requested from the settings toggle, never here.
   */
  function systemNotify(title, body) {
    if (!alarm.notifications) return;
    try {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const note = new Notification(title, {
        body,
        tag: "tempo-timer",
        // A timer that has finished should stay on screen until acknowledged.
        requireInteraction: alarm.duration === 0,
        silent: true, // our own alarm is the sound
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

  function finish() {
    state.running = false;
    state.ringing = true;
    clearIntervalTimer();
    render();

    const result = sounds.play(activeSource(), {
      volume: alarm.volume,
      durationMs: alarmDurationMs(),
      repeat: true,
    });
    if (!result || !result.ok) {
      if (result && result.reason === "stream" && notify) {
        notify("Your custom alarm could not start — the browser blocked it.", "!");
      }
    }

    const label = describeActiveSound();
    systemNotify("Time's up", `Your ${formatMilliseconds(state.original)} timer has finished.`);
    if (notify) {
      notify(
        alarm.duration === 0 ? `Time's up — ${label} is playing. Press stop when you're ready.` : `Time's up — ${label}.`,
        "✦",
        alarm.duration === 0 ? 8000 : 5000
      );
    }

    // When the alarm has a fixed length, the page stops calling itself
    // "ringing" the moment the sound ends.
    if (alarm.duration > 0 && typeof window !== "undefined") {
      window.setTimeout(() => {
        if (state.ringing && !sounds.playing) dismiss({ silent: true });
      }, alarm.duration * 1000 + 250);
    }
  }

  function describeActiveSound() {
    if (alarm.soundId === "custom") {
      const parsed = parseMediaLink(alarm.custom);
      return parsed.kind && parsed.kind !== "none" ? parsed.label : "your alarm";
    }
    const entry = findSound(alarm.soundId);
    return entry ? entry.name.toLowerCase() : "the alarm";
  }

  /** Silence a ringing alarm and put the timer back to ready. */
  function dismiss({ silent = false } = {}) {
    const wasRinging = state.ringing;
    sounds.stop();
    state.ringing = false;
    render();
    if (wasRinging && !silent && notify) notify("Alarm stopped.");
    return wasRinging;
  }

  function tick() {
    state.remaining = Math.max(0, state.endAt - Date.now());
    if (state.remaining <= 0) {
      finish();
      return;
    }
    render();
  }

  function setFromInputs() {
    if (state.running) return;
    const duration = readInputs();
    state.original = duration;
    state.remaining = duration;
    if (elements.presets) {
      for (const button of elements.presets) {
        button.classList.toggle("active", Number(button.dataset.seconds) * 1000 === duration);
      }
    }
    render();
  }

  function toggle() {
    // A ringing alarm swallows the first press: "stop that noise" is what
    // anyone means when they hit the big button while it is screaming.
    if (state.ringing) {
      dismiss();
      return;
    }
    if (state.running) {
      state.remaining = Math.max(0, state.endAt - Date.now());
      state.running = false;
      clearIntervalTimer();
      render();
      return;
    }
    if (state.remaining <= 0) setFromInputs();
    if (state.remaining <= 0) {
      if (notify) notify("Set a timer longer than zero first.", "!");
      return;
    }
    state.running = true;
    state.endAt = Date.now() + state.remaining;
    clearIntervalTimer();
    state.interval = setInterval(tick, 100);
    render();
  }

  function reset() {
    dismiss({ silent: true });
    clearIntervalTimer();
    state.running = false;
    state.remaining = readInputs();
    state.original = state.remaining;
    render();
  }

  /* ------------------------------------------------------ alarm settings */

  function setSound(id, { preview = true, quiet = false } = {}) {
    alarm.soundId = id;
    writeStored(KEYS.sound, id);
    renderSoundChoice();
    if (state.ringing) {
      // Changing the sound mid-alarm should change the alarm, not stop it.
      sounds.play(activeSource(), { volume: alarm.volume, durationMs: alarmDurationMs(), repeat: true });
      return;
    }
    if (preview && id !== "custom") sounds.preview(id, { volume: alarm.volume });
    if (!quiet && notify) {
      const entry = id === "custom" ? null : findSound(id);
      notify(entry ? `Alarm set to ${entry.name}.` : "Alarm set to your own music.");
    }
  }

  function setVolume(value) {
    alarm.volume = clamp(Number(value), 0, 1, 0.7);
    writeStored(KEYS.volume, alarm.volume);
    renderSoundChoice();
    if (state.ringing) {
      sounds.play(activeSource(), { volume: alarm.volume, durationMs: alarmDurationMs(), repeat: true });
    }
  }

  function setDuration(seconds) {
    alarm.duration = durationOrDefault(seconds);
    writeStored(KEYS.duration, alarm.duration);
    renderSoundChoice();
  }

  /** Accept a pasted link (YouTube / Spotify / direct audio) or a blob URL. */
  function setCustom(value, { label = "" } = {}) {
    const parsed = parseMediaLink(value);
    if (!parsed.kind || parsed.kind === "none") {
      if (notify) notify(parsed.error || "That link cannot be played.", "!");
      renderSoundChoice();
      return { ok: false, error: parsed.error };
    }
    alarm.custom = String(value);
    writeStored(KEYS.custom, alarm.custom);
    setSound("custom", { preview: false, quiet: true });
    if (notify) notify(`Alarm set to ${label || parsed.label}.`);
    return { ok: true, source: parsed };
  }

  async function enableNotifications(enabled) {
    if (!enabled) {
      alarm.notifications = false;
      writeStored(KEYS.notify, "off");
      renderSoundChoice();
      return false;
    }
    if (typeof Notification === "undefined") {
      if (notify) notify("This browser has no notification support.", "!");
      renderSoundChoice();
      return false;
    }
    let permission = Notification.permission;
    if (permission === "default") {
      try {
        permission = await Notification.requestPermission();
      } catch (_) {
        permission = "denied";
      }
    }
    alarm.notifications = permission === "granted";
    writeStored(KEYS.notify, alarm.notifications ? "on" : "off");
    renderSoundChoice();
    if (!alarm.notifications && notify) {
      notify("Notifications are blocked for this site — the sound still plays.", "!");
    } else if (notify) {
      notify("Tempo will notify you when a timer ends.");
    }
    return alarm.notifications;
  }

  function renderSoundChoice() {
    // The options are rendered from the catalogue after this module is
    // constructed, so they are queried live rather than captured once.
    const options = elements.soundList
      ? Array.from(elements.soundList.querySelectorAll("[data-sound]"))
      : elements.soundButtons || [];
    for (const button of options) {
      const active = button.dataset.sound === alarm.soundId;
      button.classList.toggle("active", active);
      button.setAttribute("aria-checked", String(active));
    }
    if (elements.durationButtons) {
      for (const button of elements.durationButtons) {
        const active = Number(button.dataset.alarmDuration) === alarm.duration;
        button.classList.toggle("active", active);
        button.setAttribute("aria-checked", String(active));
      }
    }
    if (elements.volume && document.activeElement !== elements.volume) {
      elements.volume.value = String(Math.round(alarm.volume * 100));
    }
    if (elements.volumeLabel) elements.volumeLabel.textContent = `${Math.round(alarm.volume * 100)}%`;
    if (elements.notifyToggle) {
      elements.notifyToggle.setAttribute("aria-pressed", String(alarm.notifications));
      elements.notifyToggle.classList.toggle("active", alarm.notifications);
    }
    if (elements.currentSound) {
      elements.currentSound.textContent =
        alarm.soundId === "custom" ? describeActiveSound() : (findSound(alarm.soundId) || {}).name || "Alarm";
    }
    if (elements.customInput && alarm.custom && elements.customInput.value !== alarm.custom) {
      if (document.activeElement !== elements.customInput) elements.customInput.value = alarm.custom;
    }
  }

  /* ---------------------------------------------------------------- bind */

  function bind() {
    if (elements.minutes) elements.minutes.addEventListener("input", setFromInputs);
    if (elements.seconds) elements.seconds.addEventListener("input", setFromInputs);
    if (elements.presets) {
      for (const button of elements.presets) {
        button.addEventListener("click", () => {
          if (state.running) return;
          const totalSeconds = Number(button.dataset.seconds);
          if (elements.minutes) elements.minutes.value = String(Math.floor(totalSeconds / 60));
          if (elements.seconds) elements.seconds.value = String(totalSeconds % 60);
          setFromInputs();
        });
      }
    }
    if (elements.start) elements.start.addEventListener("click", toggle);
    if (elements.reset) elements.reset.addEventListener("click", reset);
    if (elements.dismiss) elements.dismiss.addEventListener("click", () => dismiss());
    if (elements.stopSound) elements.stopSound.addEventListener("click", () => sounds.stop());

    if (elements.soundList) {
      elements.soundList.addEventListener("click", (event) => {
        const previewButton = event.target.closest("[data-preview]");
        if (previewButton) {
          event.stopPropagation();
          const id = previewButton.dataset.preview;
          if (sounds.playing && sounds.soundId === id) sounds.stop();
          else sounds.preview(id, { volume: alarm.volume });
          return;
        }
        const option = event.target.closest("[data-sound]");
        if (!option) return;
        setSound(option.dataset.sound);
      });
    }

    if (elements.durationButtons) {
      for (const button of elements.durationButtons) {
        button.addEventListener("click", () => setDuration(Number(button.dataset.alarmDuration)));
      }
    }
    if (elements.volume) {
      elements.volume.addEventListener("input", () => setVolume(Number(elements.volume.value) / 100));
    }
    if (elements.notifyToggle) {
      elements.notifyToggle.addEventListener("click", () => enableNotifications(!alarm.notifications));
    }
    if (elements.customApply) {
      elements.customApply.addEventListener("click", () => {
        if (elements.customInput) setCustom(elements.customInput.value);
      });
    }
    if (elements.customInput) {
      elements.customInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        setCustom(elements.customInput.value);
      });
    }
    if (elements.customFile) {
      elements.customFile.addEventListener("change", () => {
        const file = elements.customFile.files && elements.customFile.files[0];
        if (!file) return;
        // An object URL only lives as long as the document, so the choice is
        // for this visit; the picker says so.
        const url = URL.createObjectURL(file);
        setCustom(url, { label: file.name });
      });
    }
    if (elements.testAlarm) {
      elements.testAlarm.addEventListener("click", () => {
        if (sounds.playing) {
          sounds.stop();
          if (notify) notify("Preview stopped.");
          return;
        }
        sounds.play(activeSource(), { volume: alarm.volume, durationMs: 6000, repeat: true });
        // "Test the alarm" should test the whole alarm, notification and
        // all — otherwise the only way to find out a system notification is
        // silently blocked is to wait for a real timer to end.
        systemNotify("Testing the alarm", `This is what ${describeActiveSound()} sounds — and looks — like.`);
        if (notify) notify(`Playing ${describeActiveSound()}.`);
      });
    }
  }

  return {
    init() {
      bind();
      setFromInputs();
      renderSoundChoice();
    },
    render,
    toggle,
    reset,
    dismiss,
    setSound,
    setVolume,
    setDuration,
    setCustom,
    enableNotifications,
    get alarm() {
      return { ...alarm };
    },
    get ringing() {
      return state.ringing;
    },
    get running() {
      return state.running;
    },
    get remaining() {
      return state.remaining;
    },
    /** Called when the timer section scrolls back into view. */
    sync() {
      if (state.running) tick();
      else render();
    },
  };
}
