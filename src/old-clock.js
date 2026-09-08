/**
 * The Old clock page: one big clock with hands, a place of its own, and a few
 * honest controls (numerals, tick vs sweep, an hourly chime).
 *
 * It keeps its own animation loop rather than riding the app's one-second
 * tick, because a sweep second hand wants a frame callback — and because the
 * loop stops completely when you leave the page.
 */

import { createClockFace } from "./clock-face.js";
import { placeRecord, sunNote, zoneOffsetLabel } from "./places.js";
import { beep, pad } from "./ui.js";

const STORE_KEY = "tempo-old-clock";

const defaults = { numerals: "roman", motion: "sweep", chime: false, placeId: "" };

function readStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
    if (parsed && typeof parsed === "object") return { ...defaults, ...parsed };
  } catch (_) {
    /* first visit, or storage blocked */
  }
  return { ...defaults };
}

export function createOldClock({ elements = {}, getPlaceId, notify, onPickPlace } = {}) {
  const prefs = readStored();
  const face = createClockFace(elements.face, {
    numerals: prefs.numerals,
    seconds: true,
    smooth: prefs.motion === "sweep",
  });

  let placeId = prefs.placeId || (typeof getPlaceId === "function" ? getPlaceId() : "");
  let frame = 0;
  let running = false;
  let lastHour = null;

  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ ...prefs, placeId }));
    } catch (_) {
      /* preferences are a nicety */
    }
  }

  function currentPlace() {
    return placeRecord(placeId || (typeof getPlaceId === "function" ? getPlaceId() : "UTC"));
  }

  function renderPlace() {
    const place = currentPlace();
    if (elements.placeName) elements.placeName.textContent = place.label || place.city;
    if (elements.placeLabel) elements.placeLabel.textContent = place.city || "Choose a place";
    if (elements.meta) {
      elements.meta.textContent = `${zoneOffsetLabel(place.zone)} · ${place.zone}`;
    }
    if (elements.sun) elements.sun.textContent = sunNote(place);
    if (elements.eyebrow) elements.eyebrow.textContent = "SHOWING";
  }

  function render() {
    const now = new Date();
    const place = currentPlace();
    const parts = partsInZone(now, place.zone);
    face.update(now, { hour: parts.hour, minute: parts.minute, second: parts.second, ms: now.getMilliseconds() });

    if (elements.digital) {
      elements.digital.textContent = `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
    }
    if (prefs.chime && Number.isFinite(parts.hour) && lastHour !== null && parts.hour !== lastHour) {
      beep({ frequency: 660, duration: 0.5, gain: 0.035 });
      if (notify) notify(`${place.city} just turned ${((parts.hour % 12) || 12)}.`, "🔔");
    }
    lastHour = Number.isFinite(parts.hour) ? parts.hour : lastHour;

    if (running && typeof requestAnimationFrame === "function") {
      frame = requestAnimationFrame(render);
    }
  }

  function partsInZone(date, zone) {
    // The face is decoration; the numbers only need the wall clock, which the
    // shared formatter gives us without a second formatter instance.
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        hourCycle: "h23",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).formatToParts(date);
      const found = {};
      for (const item of parts) if (item.type !== "literal") found[item.type] = item.value;
      return { hour: Number(found.hour), minute: Number(found.minute), second: Number(found.second) };
    } catch (_) {
      return { hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() };
    }
  }

  /* ------------------------------------------------------------- controls */

  function setNumerals(style) {
    prefs.numerals = style;
    face.setNumerals(style);
    syncSegments();
    persist();
  }

  function setMotion(mode) {
    prefs.motion = mode;
    face.setSmooth(mode === "sweep");
    syncSegments();
    persist();
  }

  function setChime(on) {
    prefs.chime = Boolean(on);
    if (elements.chime) {
      elements.chime.setAttribute("aria-pressed", String(prefs.chime));
      elements.chime.classList.toggle("active", prefs.chime);
    }
    persist();
    if (prefs.chime && notify) notify("The clock will chime on the hour.", "🔔");
  }

  function syncSegments() {
    if (elements.numeralsGroup) {
      for (const button of elements.numeralsGroup.querySelectorAll("[data-numerals]")) {
        const active = button.dataset.numerals === prefs.numerals;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      }
    }
    if (elements.motionGroup) {
      for (const button of elements.motionGroup.querySelectorAll("[data-motion]")) {
        const active = button.dataset.motion === prefs.motion;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      }
    }
  }

  function bindEvents() {
    if (elements.numeralsGroup) {
      elements.numeralsGroup.addEventListener("click", (event) => {
        const button = event.target.closest("[data-numerals]");
        if (button) setNumerals(button.dataset.numerals);
      });
    }
    if (elements.motionGroup) {
      elements.motionGroup.addEventListener("click", (event) => {
        const button = event.target.closest("[data-motion]");
        if (button) setMotion(button.dataset.motion);
      });
    }
    if (elements.chime) {
      elements.chime.addEventListener("click", () => setChime(!prefs.chime));
    }
    if (elements.placeButton) {
      elements.placeButton.addEventListener("click", () => {
        if (typeof onPickPlace === "function") onPickPlace(placeId);
      });
    }
    if (elements.fullscreen) {
      elements.fullscreen.addEventListener("click", () => toggleFullscreen());
    }
  }

  function toggleFullscreen() {
    const target = elements.wrap || elements.face;
    if (!target) return;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (target.requestFullscreen) target.requestFullscreen();
    } catch (_) {
      if (notify) notify("This browser would not go full screen.", "!");
    }
  }

  return {
    init() {
      bindEvents();
      syncSegments();
      setChime(prefs.chime);
      renderPlace();
      render();
    },
    /** Called by the router when the page is shown / hidden. */
    start() {
      if (running) return;
      running = true;
      lastHour = null;
      render();
    },
    stop() {
      running = false;
      if (frame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      frame = 0;
    },
    setPlace(id) {
      placeId = id;
      persist();
      renderPlace();
      render();
    },
    get placeId() {
      return placeId;
    },
    renderPlace,
  };
}
