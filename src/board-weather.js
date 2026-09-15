/**
 * Temperatures for the world clock board.
 *
 * The board can hold twelve places, and twelve separate weather requests to
 * draw twelve small numbers would be rude to a free API and slow for the
 * reader. Open-Meteo accepts **comma-separated coordinate lists** and answers
 * with one array per location, so the whole board is a single request.
 *
 * Two rules the rest of the app depends on:
 *
 *   • **Nothing here throws.** Offline, blocked, rate limited or malformed,
 *     every path resolves to `{ ok: false, reason }` and the cards simply keep
 *     the last temperature they had (or show none at all). A clock must never
 *     be taken down by the weather.
 *   • **Units are per card, not per page.** A clock on Chicago should read °F
 *     and one on Chennai °C, because that is what each city's own forecast
 *     says. The fetcher therefore asks for Celsius once and converts on the
 *     way out, rather than issuing two requests.
 *
 * Pure-ish: the parsing and conversion are exported separately and unit tested
 * in tests/board-weather.test.mjs with no network at all.
 */

import { FORECAST_ENDPOINT, describeWeatherCode, preferImperial } from "./weather.js";

/** Board temperatures move slowly; a quarter of an hour is plenty. */
export const BOARD_REFRESH_MS = 15 * 60 * 1000;

/** Open-Meteo answers a batch request in one go; keep the batch sane anyway. */
export const MAX_BATCH = 12;

export function celsiusToFahrenheit(celsius) {
  return (Number(celsius) * 9) / 5 + 32;
}

/**
 * Which unit a place reads its temperature in. The United States, Liberia and
 * Myanmar say Fahrenheit; everyone else says Celsius. A place with no country
 * (a bare zone, a GPS fix at sea) falls back to Celsius, which is what the
 * rest of the world and every dataset behind this app uses.
 */
export function unitForRecord(record) {
  const codes = record && Array.isArray(record.countries) ? record.countries.map((entry) => entry.code) : [];
  return preferImperial(codes) ? "imperial" : "metric";
}

/** A temperature in the unit a card wants, rounded the way a card shows it. */
export function temperatureFor(celsius, units = "metric") {
  // `Number(null)` is 0 and `Number("")` is 0, so an absent reading would
  // otherwise render as a confident 0°C. Only a real number counts.
  if (typeof celsius !== "number" || !Number.isFinite(celsius)) return null;
  const value = units === "imperial" ? celsiusToFahrenheit(celsius) : Number(celsius);
  return { value: Math.round(value), unit: units === "imperial" ? "°F" : "°C", units };
}

/** The one URL that covers the whole board. */
export function buildBoardUrl(points) {
  const params = new URLSearchParams({
    latitude: points.map((point) => Number(point.lat).toFixed(4)).join(","),
    longitude: points.map((point) => Number(point.lon).toFixed(4)).join(","),
    current: ["temperature_2m", "weather_code", "is_day"].join(","),
    timezone: "UTC",
  });
  return `${FORECAST_ENDPOINT}?${params.toString()}`;
}

/**
 * Open-Meteo returns a bare object for one location and an array for many.
 * Normalise both into `{ [placeId]: reading }`, in the order asked.
 */
export function parseBoardPayload(payload, points) {
  const list = Array.isArray(payload) ? payload : [payload];
  const readings = {};
  points.forEach((point, index) => {
    const entry = list[index];
    const current = entry && entry.current;
    if (!current || !Number.isFinite(Number(current.temperature_2m))) return;
    const isDay = Number(current.is_day ?? 1);
    const described = describeWeatherCode(current.weather_code, isDay);
    const units = point.units || "metric";
    const temperature = temperatureFor(current.temperature_2m, units);
    readings[point.id] = {
      id: point.id,
      celsius: Number(current.temperature_2m),
      temperature: temperature ? temperature.value : null,
      temperatureUnit: temperature ? temperature.unit : "°C",
      units,
      code: Number(current.weather_code),
      condition: described.label,
      symbol: described.symbol,
      mood: described.mood,
      isDay: Boolean(isDay),
      observedAt: Date.now(),
    };
  });
  return readings;
}

/**
 * Fetch every board temperature in one request. Never rejects.
 *
 * @param {Array<{id: string, lat: number, lon: number, units?: string}>} points
 * @returns {Promise<{ok: boolean, readings?: object, reason?: string, message?: string}>}
 */
export async function fetchBoardTemperatures(points = [], { fetchImpl = globalThis.fetch, timeoutMs = 12000 } = {}) {
  const usable = points
    .filter((point) => point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)))
    .slice(0, MAX_BATCH);
  if (!usable.length) return { ok: false, reason: "no-places", message: "No clocks to look up." };
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "unsupported", message: "This browser cannot fetch temperatures." };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, reason: "offline", message: "You are offline — these are the last temperatures we saw." };
  }

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(buildBoardUrl(usable), {
      signal: controller ? controller.signal : undefined,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return { ok: false, reason: "http", message: `Weather service replied ${response.status}.` };
    const readings = parseBoardPayload(await response.json(), usable);
    if (!Object.keys(readings).length) return { ok: false, reason: "format", message: "No temperatures came back." };
    return { ok: true, readings, observedAt: Date.now() };
  } catch (error) {
    const aborted = error && (error.name === "AbortError" || /abort/i.test(String(error.message)));
    return {
      ok: false,
      reason: aborted ? "timeout" : "network",
      message: aborted ? "The temperature request timed out." : "Temperatures could not be reached.",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
