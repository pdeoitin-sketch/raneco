/**
 * The Old clock: one big clock with hands, a place of its own, a sky behind
 * it, and a few honest controls (face, tick vs sweep, an hourly chime).
 *
 * Two things grew in this section:
 *
 *   • the three numeral styles became **eight faces** — Roman, Modern,
 *     Minimal, Railway, Pocket watch, Neon, Brutalist, Botanical
 *     (src/clock-themes.js). A saved `numerals` preference from an older
 *     Tempo is upgraded to the matching face, so nobody's clock changes.
 *
 *   • the dial now sits on a **stage** that shows the live sky behind the
 *     hands — a thunderstorm with lightning, drifting clouds, snow, a starry
 *     night with the moon in its real phase (src/sky-scenes.js). The scene
 *     is *chosen from the weather snapshot the page already has*, never from
 *     a menu: it is the sky, not a screensaver. No scene without weather.
 *
 * It keeps its own animation loop rather than riding the app's one-second
 * tick, because a sweep second hand wants a frame callback — and because the
 * loop stops completely when you leave the page.
 */

import { createClockFace } from "./clock-face.js";
import { placeRecord, sunNote, zoneOffsetLabel } from "./places.js";
import { beep, pad } from "./ui.js";
import { CLOCK_THEME_IDS, DEFAULT_CLOCK_THEME, findClockTheme, themeFromLegacyNumerals } from "./clock-themes.js";
import { moonPhase, moonShadowShift, sceneFor, sceneParticles } from "./sky-scenes.js";

const STORE_KEY = "tempo-old-clock";

const defaults = { theme: DEFAULT_CLOCK_THEME, motion: "sweep", chime: false, placeId: "" };

/** One honest line per scene, for the note beside the clock. */
const SCENE_NOTES = {
  thunderstorm: "a thunderstorm, lightning and all",
  windstorm: "a windstorm, streaks and all",
  rain: "steady rain",
  rainbow: "a sunlit shower with a rainbow",
  snowfall: "falling snow",
  fog: "fog thick enough to lose a hand in",
  "dark-cloud-noon": "a dark cloud at noon",
  cloudy: "drifting clouds",
  breeze: "a gentle breeze",
  "starry-night": "a starry night with the moon",
  "moonless-night": "a moonless night",
};

function readStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
    if (parsed && typeof parsed === "object") {
      const prefs = { ...defaults, ...parsed };
      // A save from the numeral-styles era: upgrade it to a face.
      const upgraded = themeFromLegacyNumerals(parsed.numerals);
      if (upgraded) prefs.theme = upgraded;
      if (!CLOCK_THEME_IDS.includes(prefs.theme)) prefs.theme = DEFAULT_CLOCK_THEME;
      return prefs;
    }
  } catch (_) {
    /* first visit, or storage blocked */
  }
  return { ...defaults };
}

export function createOldClock({ elements = {}, getPlaceId, getWeather, notify, onPickPlace } = {}) {
  const prefs = readStored();
  const face = createClockFace(elements.face, {
    theme: prefs.theme,
    seconds: true,
    smooth: prefs.motion === "sweep",
  });

  let placeId = prefs.placeId || (typeof getPlaceId === "function" ? getPlaceId() : "");
  let frame = 0;
  let running = false;
  let lastHour = null;
  let sceneId = null;

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

  /* --------------------------------------------------------------- scene */

  /**
   * Repaint the sky behind the dial from the live weather snapshot. Called
   * whenever the app has a new one; with no weather the stage goes quiet,
   * because a made-up sky is worse than none.
   */
  function updateScene() {
    const stage = elements.stage;
    if (!stage) return;
    const weather = typeof getWeather === "function" ? getWeather() : null;
    const next = sceneFor(weather, { now: new Date() });

    if (next === sceneId) return;
    sceneId = next;
    stage.dataset.scene = next || "none";

    if (elements.sceneNote) {
      if (next) {
        elements.sceneNote.hidden = false;
        elements.sceneNote.textContent = `Behind the dial: ${SCENE_NOTES[next] || "the live sky"}.`;
      } else {
        elements.sceneNote.hidden = true;
      }
    }

    const layer = stage.querySelector(".scene");
    if (layer) {
      layer.innerHTML = "";
      if (!next) return;
      const phase = moonPhase();
      for (const particle of sceneParticles(next)) {
        const node = document.createElement("i");
        node.className = particle.className;
        for (const [name, value] of Object.entries(particle.style)) node.style.setProperty(name, value);
        if (particle.className.includes("p-moon")) node.style.setProperty("--moon-shift", `${moonShadowShift(phase)}%`);
        layer.appendChild(node);
      }
    }
  }

  /* ------------------------------------------------------------- controls */

  function setTheme(themeId) {
    prefs.theme = findClockTheme(themeId).id;
    face.setTheme(prefs.theme);
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
    // Each face explains itself (src/clock-themes.js); that line was written
    // and never shown, so the picker was eight unlabelled words.
    if (elements.faceNote) elements.faceNote.textContent = findClockTheme(prefs.theme).note;
    if (elements.facesGroup) {
      for (const button of elements.facesGroup.querySelectorAll("[data-clock-face]")) {
        const active = button.dataset.clockFace === prefs.theme;
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
    if (elements.facesGroup) {
      elements.facesGroup.addEventListener("click", (event) => {
        const button = event.target.closest("[data-clock-face]");
        if (button) setTheme(button.dataset.clockFace);
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
      updateScene();
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
    /** Called by the app whenever the weather snapshot changes. */
    updateScene,
    get placeId() {
      return placeId;
    },
    get themeId() {
      return prefs.theme;
    },
    get sceneId() {
      return sceneId;
    },
    renderPlace,
  };
}
