import assert from "node:assert/strict";
import test from "node:test";

import {
  WEATHER_CODES,
  buildForecastUrl,
  describeWeatherCode,
  fetchWeather,
  parseForecast,
  preferImperial,
  wallClock,
} from "../src/weather.js";

const HOUR = 3600 * 1000;

function payload(overrides = {}) {
  const now = Date.UTC(2026, 8, 7, 6, 0, 0);
  return {
    latitude: 27.7167,
    longitude: 85.3167,
    utc_offset_seconds: 20700,
    timezone: "Asia/Kathmandu",
    current: {
      time: "2026-09-07T11:45",
      temperature_2m: 21.4,
      apparent_temperature: 24.1,
      relative_humidity_2m: 88,
      precipitation: 0.6,
      weather_code: 61,
      is_day: 1,
      wind_speed_10m: 7.3,
      wind_direction_10m: 210,
    },
    daily: {
      time: ["2026-09-07"],
      sunrise: ["2026-09-07T05:45"],
      sunset: ["2026-09-07T18:18"],
    },
    now,
    ...overrides,
  };
}

test("every WMO code Open-Meteo can send has a label and a mood", () => {
  const codes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
  const moods = new Set(["clear", "cloud", "rain", "snow", "storm", "fog"]);
  for (const code of codes) {
    const described = describeWeatherCode(code, 1);
    assert.equal(described.known, true, `code ${code} is documented`);
    assert.ok(moods.has(described.mood), `code ${code} maps to a palette (${described.mood})`);
    assert.ok(described.label.length >= 3, `code ${code} has a readable label`);
    assert.ok(described.symbol);
    assert.equal(describeWeatherCode(code, 0).mood, described.mood, `night keeps the same mood as day (${code})`);
  }
  assert.equal(Object.keys(WEATHER_CODES).length, codes.length);
  assert.equal(describeWeatherCode(12345, 1).known, false);
});

test("the request asks Open-Meteo for exactly what the card shows", () => {
  const url = new URL(buildForecastUrl({ lat: 27.7167, lon: 85.3167 }));
  assert.equal(url.origin, "https://api.open-meteo.com");
  assert.equal(url.pathname, "/v1/forecast");
  assert.equal(url.searchParams.get("latitude"), "27.7167");
  assert.equal(url.searchParams.get("current").split(",").length, 8);
  assert.match(url.searchParams.get("current"), /weather_code/);
  assert.match(url.searchParams.get("current"), /is_day/);
  assert.equal(url.searchParams.get("daily"), "sunrise,sunset");
  assert.equal(url.searchParams.get("forecast_days"), "1");
  assert.equal(url.searchParams.get("timezone"), "auto");
  assert.equal(url.searchParams.get("wind_speed_unit"), "kmh");
  assert.equal(url.searchParams.has("temperature_unit"), false, "celsius is the default");

  const imperial = new URL(buildForecastUrl({ lat: 40.7, lon: -74, units: "imperial" }));
  assert.equal(imperial.searchParams.get("temperature_unit"), "fahrenheit");
  assert.equal(imperial.searchParams.get("wind_speed_unit"), "mph");
});

test("units follow the home zone's country unless the visitor chose", () => {
  assert.equal(preferImperial(["US"]), true);
  assert.equal(preferImperial(["NP"]), false);
  assert.equal(preferImperial([]), false);
});

test("a forecast payload becomes the snapshot the card renders", () => {
  const snapshot = parseForecast(payload(), { lat: 27.7167, lon: 85.3167, label: "Nepal · Kathmandu" });
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.temperature, 21.4);
  assert.equal(snapshot.temperatureUnit, "°C");
  assert.equal(snapshot.condition, "Light rain");
  assert.equal(snapshot.mood, "rain");
  assert.equal(snapshot.isDay, true);
  assert.equal(snapshot.humidity, 88);
  assert.equal(snapshot.windUnit, "km/h");
  assert.equal(snapshot.timezone, "Asia/Kathmandu");

  // Sunrise is returned as wall-clock time at that place; it must come back as
  // the matching UTC instant, and format as the same wall clock.
  const expectedSunrise = Date.UTC(2026, 8, 7, 5, 45, 0) - 20700 * 1000;
  assert.equal(snapshot.sunrise, expectedSunrise);
  assert.equal(wallClock(snapshot.sunrise, snapshot.utcOffsetSeconds), "05:45");
  assert.equal(wallClock(snapshot.sunset, snapshot.utcOffsetSeconds), "18:18");
});

test("night, snow and storms are read off the payload", () => {
  const night = parseForecast(
    payload({ current: { ...payload().current, weather_code: 71, is_day: 0 } }),
    { lat: 1, lon: 1 }
  );
  assert.equal(night.mood, "snow");
  assert.equal(night.isDay, false);

  const storm = parseForecast(payload({ current: { ...payload().current, weather_code: 99 } }), { lat: 1, lon: 1 });
  assert.equal(storm.mood, "storm");
  assert.equal(storm.symbol, "⛈");
});

test("an unusable payload is rejected rather than half-rendered", () => {
  assert.equal(parseForecast({ current: {} }), null);
  assert.equal(parseForecast(undefined), null);
  assert.equal(parseForecast(payload({ daily: {} }), { lat: 1, lon: 1 }).sunrise, null);
});

test("fetchWeather normalises success, HTTP errors, and offline", async () => {
  const ok = await fetchWeather({
    lat: 27.7167,
    lon: 85.3167,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => payload() }),
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.condition, "Light rain");

  const http = await fetchWeather({
    lat: 1,
    lon: 1,
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  });
  assert.deepEqual({ ok: http.ok, reason: http.reason }, { ok: false, reason: "http" });

  const network = await fetchWeather({
    lat: 1,
    lon: 1,
    fetchImpl: async () => {
      throw new TypeError("Failed to fetch");
    },
  });
  assert.equal(network.ok, false);
  assert.equal(network.reason, "network");

  const missing = await fetchWeather({ lat: undefined, lon: undefined, fetchImpl: async () => ({}) });
  assert.equal(missing.reason, "no-location");

  const format = await fetchWeather({
    lat: 1,
    lon: 1,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ nonsense: true }) }),
  });
  assert.equal(format.reason, "format");
});

test("a slow provider is abandoned instead of hanging the card", async () => {
  const started = Date.now();
  const result = await fetchWeather({
    lat: 1,
    lon: 1,
    timeoutMs: 20,
    fetchImpl: (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
  });
  assert.equal(result.reason, "timeout");
  assert.ok(Date.now() - started < 500);
});

test("sunrise math survives a missing or malformed time", () => {
  assert.equal(wallClock(null, 0), "—");
  assert.equal(wallClock(undefined, 0), "—");
  assert.equal(wallClock(Date.UTC(2026, 0, 1, 0, 0), -5 * 3600), "19:00", "offsets are seconds, not ms");
});
