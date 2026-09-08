/**
 * Theme engine: Auto / Light / Dark.
 *
 * "Auto" (the default) derives the whole look from the *local* time of the home
 * zone plus the live weather: sunrise turns the page warm, a bright day is very
 * clean white, cloud is soft grey, rain goes blue-slate, a thunderstorm turns
 * dark and stormy, and night is dark with a starfield. The chosen palette is
 * applied as a `data-appearance` attribute on <body>; styles.css owns the
 * colours and animates the palette's custom properties, so switching mood is a
 * smooth cross-fade rather than a jarring repaint.
 *
 * This module is pure logic (no colour literals beyond the pre-paint hint), so
 * the decision table is unit tested in tests/theme.test.mjs.
 */

import { effectiveMood, wallClock, windDescription } from "./weather.js";

export const MODE_STORAGE_KEY = "tempo-theme-mode";
export const LAST_STORAGE_KEY = "tempo-theme-last";
export const MODES = ["auto", "light", "dark"];

/** Every appearance, with the words used in captions and the <meta> colour. */
export const APPEARANCES = {
  light: { label: "Light", icon: "☀", dark: false, canvas: "#f7f7fb", kind: "fixed" },
  dark: { label: "Dark", icon: "☾", dark: true, canvas: "#191923", kind: "fixed" },
  dawn: { label: "Sunrise", icon: "🌅", dark: false, canvas: "#fdeadb", kind: "sunrise" },
  sunny: { label: "Sunny day", icon: "☀", dark: false, canvas: "#fffbe9", kind: "sunny" },
  cloud: { label: "Overcast", icon: "☁", dark: false, canvas: "#eceef2", kind: "cloud" },
  fog: { label: "Foggy", icon: "🌫", dark: false, canvas: "#e9eef1", kind: "fog" },
  wind: { label: "Windy", icon: "🍃", dark: false, canvas: "#eaf6f1", kind: "wind" },
  rain: { label: "Rainy", icon: "☂", dark: false, canvas: "#e3ecf6", kind: "rain" },
  snow: { label: "Snowy", icon: "❄", dark: false, canvas: "#edf4fa", kind: "snow" },
  dusk: { label: "Sunset", icon: "🌇", dark: false, canvas: "#ffd97a", kind: "sunset" },
  storm: { label: "Stormy", icon: "⛈", dark: true, canvas: "#14161f", kind: "storm" },
  night: { label: "Night sky", icon: "✦", dark: true, canvas: "#0d1020", kind: "night" },
};

/** Wind speeds (km/h) at which a plain sky is better described as "windy". */
export const WINDY_SPEED_KMH = 26;
export const WINDY_GUST_KMH = 48;


/** Windows around the sun's own moments, in minutes. */
export const SUNRISE_WINDOW = { before: 25, after: 60 };
export const SUNSET_WINDOW = { before: 40, after: 30 };

export function isDarkAppearance(appearance) {
  return Boolean(APPEARANCES[appearance] && APPEARANCES[appearance].dark);
}

/** Rough day part when there is no weather (or no sunrise data) to lean on. */
export function dayPartFromClock(hour) {
  if (hour >= 5 && hour < 7) return "dawn";
  if (hour >= 7 && hour < 17) return "sunny";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

/**
 * Decide the appearance.
 *
 * @param {object} input
 *   @param {"auto"|"light"|"dark"} mode
 *   @param {number} hour          local hour (0-23) in the home zone
 *   @param {object|null} weather   parsed Open-Meteo snapshot, or null
 *   @param {number} now            epoch ms
 */
export function resolveAppearance({ mode = "auto", hour = 12, weather = null, now = Date.now(), minute = 0 } = {}) {
  if (mode === "light") return { appearance: "light", reason: "Light theme locked in", manual: true };
  if (mode === "dark") return { appearance: "dark", reason: "Dark theme locked in", manual: true };

  const code = weather && weather.ok ? weather : null;
  const clock = `${String(hour).padStart(2, "0")}:${String(Math.max(0, Math.min(59, Number(minute) || 0))).padStart(2, "0")}`;

  if (!code) {
    const part = dayPartFromClock(hour);
    const labels = {
      dawn: "Sunrise hours",
      sunny: "Clear daytime look",
      dusk: "Sunset hours",
      night: "Night hours",
    };
    return { appearance: part, reason: `${labels[part]} · no weather yet`, weather: null, clock };
  }

  const mood = effectiveMood(code);
  const isDay = code.isDay !== false;
  const toSunrise = minutesUntilEpoch(code.sunrise, now);
  const toSunset = minutesUntilEpoch(code.sunset, now);

  // A thunderstorm owns the page, day or night.
  if (mood === "storm") return { appearance: "storm", reason: `${code.condition || "Thunderstorm"} overhead`, weather: code, clock };
  if (!isDay) return { appearance: "night", reason: "Sun is down", weather: code, clock };
  if (toSunrise !== null && toSunrise >= -SUNRISE_WINDOW.before && toSunrise <= SUNRISE_WINDOW.after) {
    return { appearance: "dawn", reason: `Sunrise at ${wallClock(code.sunrise, code.utcOffsetSeconds)}`, weather: code, clock };
  }
  if (toSunset !== null && toSunset >= -SUNSET_WINDOW.before && toSunset <= SUNSET_WINDOW.after) {
    return { appearance: "dusk", reason: `Sunset at ${wallClock(code.sunset, code.utcOffsetSeconds)}`, weather: code, clock };
  }
  const allowed = new Set(["sunny", "cloud", "rain", "snow", "fog", "wind"]);
  const appearance = allowed.has(mood) ? mood : "sunny";
  const windNote = isBreezy(code)
    ? ` · wind ${Math.round(Number(code.windSpeed) || 0)} ${code.windUnit || "km/h"}`
    : "";
  return {
    appearance,
    reason: `${code.condition || "Live weather"} · ${isDay ? "daytime" : "night"}${windNote}`,
    weather: code,
    clock,
  };
}

/** True when the air itself is part of the story, whatever the clouds say. */
export function isBreezy(weather) {
  if (!weather || !weather.ok) return false;
  const speed = Number(weather.windSpeed);
  const gust = Number(weather.windGust);
  return (Number.isFinite(speed) && speed >= WINDY_SPEED_KMH) || (Number.isFinite(gust) && gust >= WINDY_GUST_KMH);
}

/** One word for the wind, used in captions and the weather card. */
export function windWord(weather) {
  return windDescription(weather);
}

function minutesUntilEpoch(epoch, now) {
  if (!Number.isFinite(epoch)) return null;
  return (epoch - now) / 60000;
}

/**
 * Caption under the switch: what Auto is doing and why.
 * e.g. "Auto · Rainy in Kathmandu" or "Auto · Sunrise at 05:45".
 */
export function themeCaption({ mode, appearance, place = "", reason = "" }) {
  const info = APPEARANCES[appearance] || APPEARANCES.light;
  if (mode === "light") return "Light theme · fixed";
  if (mode === "dark") return "Dark theme · fixed";
  const where = place ? ` in ${place}` : "";
  return `Auto · ${info.label}${where}${reason ? ` — ${reason}` : ""}`;
}

/**
 * Paint the choice onto the document.
 *
 * `body.dark` keeps the component rules that already exist in styles.css in
 * play, while `data-appearance` selects the palette block. `data-ui` is the
 * generic hook for anything that hard-codes a light-mode colour.
 */
export function applyAppearance(target, { mode, appearance }) {
  const body = target.body || target;
  const root = target.documentElement || target;
  const info = APPEARANCES[appearance] || APPEARANCES.light;
  const dark = info.dark;

  body.dataset.appearance = appearance;
  body.dataset.mode = mode;
  body.dataset.ui = dark ? "dark" : "light";
  body.classList.toggle("dark", dark);
  if (root && root !== body) {
    root.dataset.appearance = appearance;
    root.dataset.mode = mode;
    root.style.colorScheme = dark ? "dark" : "light";
  }

  const meta = typeof document !== "undefined" ? document.querySelector('meta[name="theme-color"]') : null;
  if (meta) meta.setAttribute("content", info.canvas);

  try {
    localStorage.setItem(LAST_STORAGE_KEY, `${appearance}|${info.canvas}`);
  } catch (_) {
    // The pre-paint hint is a nicety; nothing breaks without it.
  }

  return { appearance, dark, label: info.label, icon: info.icon };
}

export function readMode(storage) {
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!store) return "auto";
    const raw = store.getItem(MODE_STORAGE_KEY);
    // The old build stored "light"/"dark" here — both still work.
    if (raw === "dark" || raw === "light") return raw;
    return MODES.includes(raw) ? raw : "auto";
  } catch (_) {
    return "auto";
  }
}

export function writeMode(mode) {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch (_) {
    // Preference lives for this visit only when storage is blocked.
  }
}
