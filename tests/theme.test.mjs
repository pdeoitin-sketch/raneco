import assert from "node:assert/strict";
import test from "node:test";

import {
  APPEARANCES,
  dayPartFromClock,
  isDarkAppearance,
  readMode,
  resolveAppearance,
  themeCaption,
} from "../src/theme.js";

const HOUR = 3600 * 1000;
const NOW = Date.UTC(2026, 8, 7, 6, 0, 0); // 06:00 UTC

const sky = (overrides = {}) => ({
  ok: true,
  temperature: 20,
  temperatureUnit: "°C",
  condition: "Clear sky",
  symbol: "☀",
  mood: "clear",
  isDay: true,
  code: 0,
  sunrise: NOW - 4 * HOUR,
  sunset: NOW + 4 * HOUR,
  utcOffsetSeconds: 0,
  windSpeed: 3,
  windGust: 6,
  windUnit: "km/h",
  ...overrides,
});

test("Auto follows the sun: sunrise, day, sunset, night", () => {
  assert.equal(resolveAppearance({ mode: "auto", hour: 6, now: NOW, weather: sky({ sunrise: NOW - 20 * 60000 }) }).appearance, "dawn");
  assert.equal(resolveAppearance({ mode: "auto", hour: 12, now: NOW, weather: sky() }).appearance, "sunny");
  assert.equal(
    resolveAppearance({ mode: "auto", hour: 18, now: NOW, weather: sky({ sunset: NOW + 10 * 60000 }) }).appearance,
    "dusk",
    "sunset brings the amber sunset palette"
  );
  assert.equal(resolveAppearance({ mode: "auto", hour: 22, now: NOW, weather: sky({ isDay: false }) }).appearance, "night");
});

test("Auto follows the sky: cloud, rain, snow, fog, storms", () => {
  const cases = [
    ["cloud", "Overcast"],
    ["rain", "Light rain"],
    ["snow", "Snow"],
    ["fog", "Fog"],
    ["storm", "Thunderstorm"],
  ];
  for (const [mood, condition] of cases) {
    const result = resolveAppearance({ mode: "auto", hour: 13, now: NOW, weather: sky({ mood, condition }) });
    assert.equal(result.appearance, mood, `${mood} from ${condition}`);
    assert.match(result.reason, new RegExp(condition.split(" ")[0], "i"));
  }
});

test("a windy fair day is its own palette, not a clear one", () => {
  const breezy = resolveAppearance({
    mode: "auto",
    hour: 13,
    now: NOW,
    weather: sky({ mood: "clear", condition: "Mainly clear", windSpeed: 38, windUnit: "km/h" }),
  });
  assert.equal(breezy.appearance, "wind", "a steady wind outranks a blue sky");
  assert.match(breezy.reason, /wind 38 km\/h/);

  const gusty = resolveAppearance({
    mode: "auto",
    hour: 13,
    now: NOW,
    weather: sky({ mood: "cloud", condition: "Overcast", windSpeed: 14, windGust: 62, windUnit: "km/h" }),
  });
  assert.equal(gusty.appearance, "wind", "strong gusts count too");

  // Rain still wins over the wind: the sky that is falling matters more.
  const stormyRain = resolveAppearance({
    mode: "auto",
    hour: 13,
    now: NOW,
    weather: sky({ mood: "rain", condition: "Heavy rain", windSpeed: 60, windUnit: "km/h" }),
  });
  assert.equal(stormyRain.appearance, "rain");

  const calm = resolveAppearance({
    mode: "auto",
    hour: 13,
    now: NOW,
    weather: sky({ mood: "clear", windSpeed: 6, windUnit: "km/h" }),
  });
  assert.equal(calm.appearance, "sunny", "a calm clear day stays sunny");
});

test("a thunderstorm wins over everything, and night wins over drizzle", () => {
  const stormAtSunrise = resolveAppearance({
    mode: "auto",
    hour: 6,
    now: NOW,
    weather: sky({ mood: "storm", condition: "Thunderstorm with hail", sunrise: NOW }),
  });
  assert.equal(stormAtSunrise.appearance, "storm");

  const rainyNight = resolveAppearance({
    mode: "auto",
    hour: 2,
    now: NOW,
    weather: sky({ mood: "rain", isDay: false }),
  });
  assert.equal(rainyNight.appearance, "night");
});

test("without weather the clock alone picks a readable look", () => {
  assert.equal(resolveAppearance({ mode: "auto", hour: 5, now: NOW, weather: null }).appearance, "dawn");
  assert.equal(resolveAppearance({ mode: "auto", hour: 11, now: NOW, weather: null }).appearance, "sunny");
  assert.equal(resolveAppearance({ mode: "auto", hour: 19, now: NOW, weather: null }).appearance, "dusk");
  assert.equal(resolveAppearance({ mode: "auto", hour: 23, now: NOW, weather: null }).appearance, "night");
  assert.equal(dayPartFromClock(0), "night");
  assert.equal(dayPartFromClock(12), "sunny");
  // A failed weather fetch is not an error state, just no data.
  assert.equal(
    resolveAppearance({ mode: "auto", hour: 12, now: NOW, weather: { ok: false, reason: "offline" } }).appearance,
    "sunny"
  );
});

test("missing sunrise data does not invent a sunrise", () => {
  const result = resolveAppearance({ mode: "auto", hour: 6, now: NOW, weather: sky({ sunrise: null, sunset: null }) });
  assert.notEqual(result.appearance, "dawn");
  assert.equal(result.appearance, "sunny");
});

test("Light and Dark are honoured over the live conditions", () => {
  const stormy = sky({ mood: "storm", condition: "Thunderstorm" });
  assert.equal(resolveAppearance({ mode: "light", hour: 23, now: NOW, weather: stormy }).appearance, "light");
  assert.equal(resolveAppearance({ mode: "dark", hour: 12, now: NOW, weather: stormy }).appearance, "dark");
  assert.equal(resolveAppearance({ mode: "light", hour: 23, now: NOW, weather: null }).appearance, "light");
});

test("only the dark palettes flip the dark UI flag", () => {
  // Sunset stays a *light*, amber palette — the sky is yellow, not black.
  const dark = ["storm", "night", "dark"];
  const light = Object.keys(APPEARANCES).filter((name) => !dark.includes(name));
  for (const name of dark) assert.equal(isDarkAppearance(name), true, `${name} is dark`);
  for (const name of light) assert.equal(isDarkAppearance(name), false, `${name} is light`);
  assert.equal(APPEARANCES.night.dark, true);
  assert.equal(APPEARANCES.rain.dark, false, "rain stays a light, readable slate");
  assert.equal(APPEARANCES.dusk.dark, false, "sunset is yellow, not dark");
  assert.equal(APPEARANCES.wind.dark, false, "wind is bright and airy");
});

test("every appearance is described, coloured and known", () => {
  for (const [name, info] of Object.entries(APPEARANCES)) {
    assert.ok(info.label, `${name} has a label`);
    assert.match(info.canvas, /^#[0-9a-f]{6}$/i, `${name} has a canvas colour`);
    assert.equal(typeof info.dark, "boolean");
  }
  assert.ok(Object.keys(APPEARANCES).length >= 10, "sunrise through storms are all covered");
});

test("captions explain what Auto is doing", () => {
  assert.equal(
    themeCaption({ mode: "auto", appearance: "rain", place: "Kathmandu", reason: "Light rain · daytime" }),
    "Auto · Rainy in Kathmandu — Light rain · daytime"
  );
  assert.equal(
    themeCaption({ mode: "auto", appearance: "dusk", place: "Delhi", reason: "Sunset at 19:04" }),
    "Auto · Sunset in Delhi — Sunset at 19:04"
  );
  assert.equal(themeCaption({ mode: "auto", appearance: "night", place: "Kathmandu" }), "Auto · Night sky in Kathmandu");
  assert.equal(themeCaption({ mode: "light", appearance: "light", place: "Kathmandu" }), "Light theme · fixed");
  assert.equal(themeCaption({ mode: "dark", appearance: "dark" }), "Dark theme · fixed");
});

test("the stored mode survives old values and bad storage", () => {
  const memory = (value) => ({ getItem: () => value });
  assert.equal(readMode(memory("auto")), "auto");
  assert.equal(readMode(memory("dark")), "dark", "values from the old toggle still work");
  assert.equal(readMode(memory("light")), "light");
  assert.equal(readMode(memory("neon")), "auto");
  assert.equal(readMode(memory(null)), "auto");
  assert.equal(readMode({ getItem: () => { throw new Error("blocked"); } }), "auto");
});

test("the whole look differs between palettes", () => {
  // Guard against a palette being copy-pasted onto another one.
  const canvases = new Map();
  for (const [name, info] of Object.entries(APPEARANCES)) {
    if (["light", "dark"].includes(name)) continue;
    const seen = canvases.get(info.canvas);
    assert.equal(seen, undefined, `${name} reuses ${seen}'s canvas colour`);
    canvases.set(info.canvas, name);
  }
  assert.ok(canvases.size >= 8);
});
