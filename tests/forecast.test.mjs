import assert from "node:assert/strict";
import test from "node:test";

import { dayLabel, rangeBar, seriesBounds, summarise } from "../src/forecast.js";
import {
  FORECAST_DAYS,
  FORECAST_HOURS,
  buildForecastSeriesUrl,
  fetchForecastSeries,
  parseForecastSeries,
} from "../src/weather.js";

const HOUR = 3600 * 1000;
const OFFSET = 20700; // Asia/Kathmandu, UTC+05:45

/** An Open-Meteo forecast payload in the place's own wall clock. */
function seriesPayload({ now = Date.UTC(2026, 8, 14, 6, 0, 0), hours = 30, days = 7 } = {}) {
  const wall = (epoch) => new Date(epoch + OFFSET * 1000).toISOString().slice(0, 16);
  const start = now - 2 * HOUR;

  const hourly = { time: [], temperature_2m: [], weather_code: [], precipitation_probability: [], wind_speed_10m: [], is_day: [] };
  for (let i = 0; i < hours; i += 1) {
    const at = start + i * HOUR;
    hourly.time.push(wall(at));
    hourly.temperature_2m.push(20 + (i % 12));
    hourly.weather_code.push(i % 5 === 0 ? 61 : 1);
    hourly.precipitation_probability.push((i * 7) % 100);
    hourly.wind_speed_10m.push(8 + (i % 4));
    hourly.is_day.push(i % 24 < 12 ? 1 : 0);
  }

  const daily = {
    time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [],
    precipitation_probability_max: [], precipitation_sum: [], wind_speed_10m_max: [],
    sunrise: [], sunset: [], uv_index_max: [],
  };
  for (let i = 0; i < days; i += 1) {
    const at = now + i * 24 * HOUR;
    daily.time.push(new Date(at + OFFSET * 1000).toISOString().slice(0, 10));
    daily.weather_code.push(i === 2 || i === 3 ? 63 : 1);
    daily.temperature_2m_max.push(26 + i);
    daily.temperature_2m_min.push(14 + i);
    daily.precipitation_probability_max.push(i === 2 || i === 3 ? 80 : 10);
    daily.precipitation_sum.push(i === 2 ? 12.4 : 0);
    daily.wind_speed_10m_max.push(14 + i);
    daily.sunrise.push(wall(at - 30 * HOUR));
    daily.sunset.push(wall(at - 18 * HOUR));
    daily.uv_index_max.push(6);
  }

  return { latitude: 27.7, longitude: 85.3, utc_offset_seconds: OFFSET, timezone: "Asia/Kathmandu", hourly, daily };
}

test("the forecast request asks for the hourly and daily fields the UI draws", () => {
  const url = new URL(buildForecastSeriesUrl({ lat: 27.7172, lon: 85.324, units: "metric" }));
  assert.equal(url.origin, "https://api.open-meteo.com");
  assert.match(url.searchParams.get("hourly"), /temperature_2m/);
  assert.match(url.searchParams.get("hourly"), /precipitation_probability/);
  assert.match(url.searchParams.get("daily"), /temperature_2m_max/);
  assert.match(url.searchParams.get("daily"), /temperature_2m_min/);
  assert.match(url.searchParams.get("daily"), /sunrise/);
  assert.equal(url.searchParams.get("forecast_days"), String(FORECAST_DAYS));
  assert.equal(url.searchParams.get("timezone"), "auto");

  const imperial = new URL(buildForecastSeriesUrl({ lat: 40, lon: -74, units: "imperial" }));
  assert.equal(imperial.searchParams.get("temperature_unit"), "fahrenheit");
  assert.equal(imperial.searchParams.get("wind_speed_unit"), "mph");
});

test("the payload becomes an hourly strip that starts now", () => {
  const now = Date.UTC(2026, 8, 14, 6, 0, 0);
  const series = parseForecastSeries(seriesPayload({ now }), { now });
  assert.equal(series.ok, true);
  assert.equal(series.timezone, "Asia/Kathmandu");
  assert.equal(series.utcOffsetSeconds, OFFSET);

  // Hours already past are dropped; the strip is capped at a day.
  assert.ok(series.hourly.length <= FORECAST_HOURS);
  assert.ok(series.hourly.length > 12, `got ${series.hourly.length} hours`);
  assert.ok(series.hourly[0].epoch >= now - HOUR, "the strip starts at the current hour");

  const first = series.hourly[0];
  assert.match(first.wall, /^\d{2}:\d{2}$/, "wall-clock time at the place, ready to print");
  assert.ok(Number.isFinite(first.temperature));
  assert.equal(first.temperatureUnit, "°C");
  assert.ok(first.condition.length > 0);
  assert.ok(first.symbol.length > 0);
  assert.equal(typeof first.isDay, "boolean");

  // Epochs must increase by an hour, or the bars are drawn out of order.
  for (let i = 1; i < series.hourly.length; i += 1) {
    assert.equal(series.hourly[i].epoch - series.hourly[i - 1].epoch, HOUR);
  }
});

test("the payload becomes seven days with highs, lows and rain chances", () => {
  const now = Date.UTC(2026, 8, 14, 6, 0, 0);
  const series = parseForecastSeries(seriesPayload({ now }), { now });
  assert.equal(series.daily.length, 7);

  for (const day of series.daily) {
    assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Number.isFinite(day.epoch));
    assert.ok(Number.isFinite(day.max));
    assert.ok(Number.isFinite(day.min));
    assert.ok(day.max >= day.min, "a high is never below its low");
    assert.ok(day.condition.length > 0);
    assert.ok(Number.isFinite(day.sunrise));
    assert.ok(Number.isFinite(day.sunset));
  }
  assert.equal(series.daily[2].precipitationChance, 80);
  assert.equal(series.daily[2].precipitation, 12.4);
});

test("an empty or broken forecast payload is null, not an empty week", () => {
  assert.equal(parseForecastSeries(null), null);
  assert.equal(parseForecastSeries({}), null);
  assert.equal(parseForecastSeries({ hourly: {}, daily: {} }), null);
});

test("fetching a forecast never throws", async () => {
  const payload = seriesPayload();
  const good = await fetchForecastSeries({
    lat: 27.7,
    lon: 85.3,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => payload }),
  });
  assert.equal(good.ok, true);
  assert.ok(good.daily.length > 0);

  assert.equal((await fetchForecastSeries({ lat: NaN, lon: 1 })).reason, "no-location");
  assert.equal((await fetchForecastSeries({ lat: 1, lon: 1, fetchImpl: "nope" })).reason, "unsupported");
  const failed = await fetchForecastSeries({ lat: 1, lon: 1, fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.equal(failed.reason, "http");
  assert.ok(failed.message.includes("500"));
});

/* ------------------------------------------------------------- presentation */

test("days are labelled the way a person says them", () => {
  const now = Date.UTC(2026, 8, 14, 6, 0, 0);
  assert.equal(dayLabel(now, { timeZone: "UTC", now }), "Today");
  assert.equal(dayLabel(now + 24 * HOUR, { timeZone: "UTC", now }), "Tomorrow");
  // Beyond that a weekday and a date is clearer than "in 3 days".
  assert.match(dayLabel(now + 3 * 24 * HOUR, { timeZone: "UTC", now }), /^\w{3} \d+$/);
  assert.equal(dayLabel(NaN), "—");
});

test("the temperature bar is positioned inside the week's own range", () => {
  const days = [
    { min: 10, max: 20 },
    { min: 15, max: 30 },
    { min: 5, max: 12 },
  ];
  const bounds = seriesBounds(days);
  assert.deepEqual(bounds, { min: 5, max: 30 });

  const warm = rangeBar(days[1], bounds);
  const cold = rangeBar(days[2], bounds);
  assert.ok(warm.left > cold.left, "a warmer day sits further right");
  assert.ok(warm.left + warm.width <= 100.01, "and never overflows the track");
  assert.ok(cold.left >= 0);
  // A day with no spread still gets a visible bar rather than a hairline.
  const flat = rangeBar({ min: 20, max: 20 }, bounds);
  assert.ok(flat.width >= 6);

  assert.deepEqual(seriesBounds([]), { min: 0, max: 1 }, "an empty week does not divide by zero");
});

test("the week is summarised in a sentence, not a table", () => {
  const now = Date.UTC(2026, 8, 14, 6, 0, 0);
  const series = parseForecastSeries(seriesPayload({ now }), { now });
  const sentence = summarise(series);
  assert.match(sentence, /Rain likely/, "the wet days are called out");
  assert.match(sentence, /warmest/);
  assert.match(sentence, /\d+°C/);

  const dry = { ok: true, temperatureUnit: "°C", timezone: "UTC", daily: [
    { epoch: now, max: 24, min: 12, precipitationChance: 5 },
    { epoch: now + 24 * HOUR, max: 26, min: 13, precipitationChance: 0 },
  ] };
  assert.match(summarise(dry), /dry week/i);
  assert.equal(summarise(null), "");
  assert.equal(summarise({ ok: false }), "");
});
