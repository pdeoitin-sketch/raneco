/**
 * Theme engine: Auto plus fixed light, dark and weather-mood themes.
 *
 * "Auto" (the default) derives the whole look from the *local* time of the home
 * zone plus the live weather: sunrise turns the page warm, a bright day is very
 * clean white, cloud is soft grey, rain goes blue-slate, a thunderstorm turns
 * dark and stormy, and night is dark with a starfield. The chosen palette is
 * applied as a `data-appearance` attribute on <body>; styles.css owns the
 * colours and animates the palette's custom properties, so switching mood is a
 * smooth cross-fade rather than a jarring repaint.
 *
 * This module is mostly pure logic (the colour literals are palette metadata
 * for the pre-paint hint), so the decision table is unit tested in
 * tests/theme.test.mjs.
 */

import { effectiveMood, wallClock, windDescription } from "./weather.js";

export const MODE_STORAGE_KEY = "tempo-theme-mode";
export const LAST_STORAGE_KEY = "tempo-theme-last";

/** Theme modes exposed in Settings. Auto is computed; the rest lock an appearance. */
export const THEME_CHOICES = [
  { id: "auto", label: "Auto", icon: "☼", kind: "automatic", summary: "Follows your home place: daylight, night and live weather choose the palette." },
  { id: "light", label: "Light", icon: "☀", kind: "fixed", summary: "The original bright Tempo look, independent of the sky." },
  { id: "dark", label: "Dark", icon: "☾", kind: "fixed", summary: "The original dark Tempo look, independent of the sky." },
  { id: "sunny", label: "Sunny", icon: "☀", kind: "weather", summary: "Warm daylight tones, even when the forecast says otherwise." },
  { id: "cloud", label: "Cloudy", icon: "☁", kind: "weather", summary: "Soft overcast greys with low glare." },
  { id: "rain", label: "Rainy", icon: "☂", kind: "weather", summary: "Cool slate blues and a rainy page atmosphere." },
  { id: "snow", label: "Snowy", icon: "❄", kind: "weather", summary: "Clean winter whites with a colder blue cast." },
  { id: "storm", label: "Thunderous", icon: "⛈", kind: "weather", summary: "A dark, electric storm palette with rain in the background." },
  { id: "wind", label: "Windy", icon: "🍃", kind: "weather", summary: "Airy green-blues with motion in the sky layer." },
  { id: "fog", label: "Foggy", icon: "🌫", kind: "weather", summary: "Muted mist tones for a quiet, low-contrast page." },
  { id: "dawn", label: "Sunrise", icon: "🌅", kind: "time", summary: "Peach and apricot tones from the early morning window." },
  { id: "dusk", label: "Sunset", icon: "🌇", kind: "time", summary: "Amber evening light, fixed until you change it." },
  { id: "night", label: "Night", icon: "✦", kind: "time", summary: "A deep clear-night palette with stars." },
];

export const MODES = THEME_CHOICES.map((choice) => choice.id);

export function themeChoice(mode) {
  return THEME_CHOICES.find((choice) => choice.id === mode) || THEME_CHOICES[0];
}

/** Every appearance, with the words used in captions and the <meta> colour. */
export const APPEARANCES = {
  light: { label: "Light", icon: "☀", dark: false, canvas: "#f7f7fb", kind: "fixed" },
  dark: { label: "Dark", icon: "☾", dark: true, canvas: "#191923", kind: "fixed" },
  dawn: { label: "Sunrise", icon: "🌅", dark: false, canvas: "#fdeadb", kind: "sunrise" },
  sunny: { label: "Sunny day", icon: "☀", dark: false, canvas: "#fffdf3", kind: "sunny" },
  cloud: { label: "Overcast", icon: "☁", dark: false, canvas: "#eceef2", kind: "cloud" },
  fog: { label: "Foggy", icon: "🌫", dark: false, canvas: "#e9eef1", kind: "fog" },
  wind: { label: "Windy", icon: "🍃", dark: false, canvas: "#eaf6f1", kind: "wind" },
  rain: { label: "Rainy", icon: "☂", dark: false, canvas: "#e3ecf6", kind: "rain" },
  snow: { label: "Snowy", icon: "❄", dark: false, canvas: "#edf4fa", kind: "snow" },
  dusk: { label: "Sunset", icon: "🌇", dark: false, canvas: "#ffd97a", kind: "sunset" },
  storm: { label: "Day storm", icon: "⛈", dark: true, canvas: "#14161f", kind: "storm" },
  night: { label: "Clear night", icon: "✦", dark: true, canvas: "#0d1020", kind: "night" },
  "night-cloud": { label: "Cloudy night", icon: "☁", dark: true, canvas: "#11182a", kind: "cloud" },
  "night-fog": { label: "Foggy night", icon: "🌫", dark: true, canvas: "#151c2a", kind: "fog" },
  "night-rain": { label: "Rainy night", icon: "☂", dark: true, canvas: "#0c1528", kind: "rain" },
  "night-snow": { label: "Snowy night", icon: "❄", dark: true, canvas: "#111b30", kind: "snow" },
  "night-wind": { label: "Windy night", icon: "🍃", dark: true, canvas: "#0d1c29", kind: "wind" },
  "night-storm": { label: "Night storm", icon: "⛈", dark: true, canvas: "#090d19", kind: "storm" },
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
 *   @param {string} mode          "auto" or one of THEME_CHOICES
 *   @param {number} hour          local hour (0-23) in the home zone
 *   @param {object|null} weather   parsed Open-Meteo snapshot, or null
 *   @param {number} now            epoch ms
 */
export function resolveAppearance({ mode = "auto", hour = 12, weather = null, now = Date.now(), minute = 0 } = {}) {
  if (mode !== "auto" && APPEARANCES[mode]) {
    const choice = themeChoice(mode);
    return {
      appearance: mode,
      reason: `${choice.label || APPEARANCES[mode].label} theme locked in`,
      manual: true,
    };
  }

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

  // Night does not erase the weather. Rain beneath moonlight, a cloudy night,
  // and a night thunderstorm each keep both parts of the story.
  if (!isDay) {
    const nightMood = isBreezy(code) && ["sunny", "cloud"].includes(mood) ? "wind" : mood;
    const nightAppearances = {
      storm: "night-storm",
      rain: "night-rain",
      snow: "night-snow",
      cloud: "night-cloud",
      fog: "night-fog",
      wind: "night-wind",
    };
    const appearance = nightAppearances[nightMood] || "night";
    return {
      appearance,
      reason: `${code.condition || "Night sky"} · nighttime`,
      weather: code,
      clock,
    };
  }
  if (mood === "storm") return { appearance: "storm", reason: `${code.condition || "Thunderstorm"} overhead · daytime`, weather: code, clock };
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
  if (mode && mode !== "auto") {
    const choice = themeChoice(mode);
    return `${choice.label || info.label} theme · fixed`;
  }
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
    const raw = store.getItem(MODE_STORAGE_KEY) || store.getItem("tempo-theme");
    // The old build stored only "light"/"dark" here — both still work.
    // A very early weather palette called clear is the sunny palette now.
    if (raw === "clear") return "sunny";
    return MODES.includes(raw) ? raw : "auto";
  } catch (_) {
    return "auto";
  }
}

export function writeMode(mode) {
  const next = MODES.includes(mode) ? mode : "auto";
  try {
    localStorage.setItem(MODE_STORAGE_KEY, next);
  } catch (_) {
    // Preference lives for this visit only when storage is blocked.
  }
  return next;
}
