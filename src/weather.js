/**
 * Live weather from Open-Meteo — a free, key-less, CORS-enabled API, which is
 * exactly what a static GitHub Pages bundle needs.
 *
 * Nothing here throws: every failure path (offline, blocked, rate limited,
 * geolocation denied) resolves to a `{ ok: false, reason }` snapshot so the UI
 * can explain itself instead of showing a broken card.
 */

export const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
export const REFRESH_MS = 20 * 60 * 1000; // weather moves slower than a clock

/** WMO 4677 weather codes, as reported by Open-Meteo's `weather_code`. */
export const WEATHER_CODES = {
  0: { label: "Clear sky", day: "☀", night: "☾", mood: "clear" },
  1: { label: "Mainly clear", day: "🌤", night: "🌙", mood: "clear" },
  2: { label: "Partly cloudy", day: "⛅", night: "☁", mood: "cloud" },
  3: { label: "Overcast", day: "☁", night: "☁", mood: "cloud" },
  45: { label: "Fog", day: "🌫", night: "🌫", mood: "fog" },
  48: { label: "Freezing fog", day: "🌫", night: "🌫", mood: "fog" },
  51: { label: "Light drizzle", day: "🌦", night: "🌧", mood: "rain" },
  53: { label: "Drizzle", day: "🌦", night: "🌧", mood: "rain" },
  55: { label: "Heavy drizzle", day: "🌧", night: "🌧", mood: "rain" },
  56: { label: "Freezing drizzle", day: "🌧", night: "🌧", mood: "rain" },
  57: { label: "Freezing drizzle", day: "🌧", night: "🌧", mood: "rain" },
  61: { label: "Light rain", day: "🌦", night: "🌧", mood: "rain" },
  63: { label: "Rain", day: "🌧", night: "🌧", mood: "rain" },
  65: { label: "Heavy rain", day: "🌧", night: "🌧", mood: "rain" },
  66: { label: "Freezing rain", day: "🌧", night: "🌧", mood: "rain" },
  67: { label: "Freezing rain", day: "🌧", night: "🌧", mood: "rain" },
  71: { label: "Light snow", day: "🌨", night: "🌨", mood: "snow" },
  73: { label: "Snow", day: "❄", night: "❄", mood: "snow" },
  75: { label: "Heavy snow", day: "❄", night: "❄", mood: "snow" },
  77: { label: "Snow grains", day: "❄", night: "❄", mood: "snow" },
  80: { label: "Light showers", day: "🌦", night: "🌧", mood: "rain" },
  81: { label: "Showers", day: "🌧", night: "🌧", mood: "rain" },
  82: { label: "Violent showers", day: "⛈", night: "⛈", mood: "rain" },
  85: { label: "Snow showers", day: "🌨", night: "🌨", mood: "snow" },
  86: { label: "Heavy snow showers", day: "❄", night: "❄", mood: "snow" },
  95: { label: "Thunderstorm", day: "⛈", night: "⛈", mood: "storm" },
  96: { label: "Thunderstorm with hail", day: "⛈", night: "⛈", mood: "storm" },
  99: { label: "Thunderstorm with hail", day: "⛈", night: "⛈", mood: "storm" },
};

export function describeWeatherCode(code, isDay = 1) {
  const entry = WEATHER_CODES[Number(code)];
  if (!entry) return { label: "Weather unavailable", symbol: "•", mood: "cloud", known: false };
  const symbol = (isDay ? entry.day : entry.night) || entry.day;
  return { label: entry.label, symbol, mood: entry.mood, known: true };
}

/** Countries that still read temperature in °F; everything else gets °C. */
const IMPERIAL_COUNTRIES = new Set(["US", "LR", "MM"]);

export function preferImperial(countryCodes = []) {
  return countryCodes.some((code) => IMPERIAL_COUNTRIES.has(String(code).toUpperCase()));
}

export function buildForecastUrl({ lat, lon, units = "metric", timezone = "auto" }) {
  const params = new URLSearchParams({
    latitude: Number(lat).toFixed(4),
    longitude: Number(lon).toFixed(4),
    current: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "precipitation",
      "weather_code",
      "is_day",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
    ].join(","),
    daily: "sunrise,sunset",
    forecast_days: "1",
    timezone,
    wind_speed_unit: units === "imperial" ? "mph" : "kmh",
  });
  if (units === "imperial") params.set("temperature_unit", "fahrenheit");
  return `${FORECAST_ENDPOINT}?${params.toString()}`;
}

/** Open-Meteo returns wall-clock times at the location; shift by its offset. */
export function wallTimeToEpoch(value, utcOffsetSeconds) {
  if (!value || typeof value !== "string") return null;
  const normalised = value.includes("T") ? value : value.replace(" ", "T");
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalised) ? `${normalised}:00` : normalised;
  const parsed = Date.parse(`${withSeconds}Z`);
  if (Number.isNaN(parsed)) return null;
  return parsed - (Number(utcOffsetSeconds) || 0) * 1000;
}

/**
 * Turn a forecast payload into the flat snapshot the UI renders.
 * Exported separately so it can be tested without any network at all.
 */
export function parseForecast(payload, { lat, lon, units = "metric", label = "" } = {}) {
  const current = payload?.current;
  if (!current || typeof current.temperature_2m !== "number") return null;
  const offsetSeconds = Number(payload.utc_offset_seconds) || 0;
  const daily = payload.daily || {};
  const code = Number(current.weather_code);
  const isDay = Number(current.is_day ?? 1);
  const described = describeWeatherCode(code, isDay);
  const degree = units === "imperial" ? "°F" : "°C";

  return {
    ok: true,
    source: "open-meteo",
    label,
    lat: Number.isFinite(Number(payload.latitude)) ? Number(payload.latitude) : lat,
    lon: Number.isFinite(Number(payload.longitude)) ? Number(payload.longitude) : lon,
    timezone: payload.timezone || "",
    utcOffsetSeconds: offsetSeconds,
    temperature: Number(current.temperature_2m),
    temperatureUnit: degree,
    feelsLike: Number.isFinite(current.apparent_temperature) ? Number(current.apparent_temperature) : null,
    humidity: Number.isFinite(current.relative_humidity_2m) ? Number(current.relative_humidity_2m) : null,
    precipitation: Number.isFinite(current.precipitation) ? Number(current.precipitation) : null,
    windSpeed: Number.isFinite(current.wind_speed_10m) ? Number(current.wind_speed_10m) : null,
    windUnit: units === "imperial" ? "mph" : "km/h",
    windDirection: Number.isFinite(current.wind_direction_10m) ? Number(current.wind_direction_10m) : null,
    windGust: Number.isFinite(current.wind_gusts_10m) ? Number(current.wind_gusts_10m) : null,
    code,
    condition: described.label,
    symbol: described.symbol,
    mood: described.mood,
    isDay: Boolean(isDay),
    sunrise: wallTimeToEpoch(daily.sunrise?.[0], offsetSeconds),
    sunset: wallTimeToEpoch(daily.sunset?.[0], offsetSeconds),
    dayKey: typeof daily.time?.[0] === "string" ? daily.time[0] : "",
    observedAt: Date.now(),
  };
}

/** Never rejects: failures resolve to `{ ok: false, reason, message }`. */
export async function fetchWeather(options = {}) {
  const { lat, lon, units, label, timezone, fetchImpl = globalThis.fetch, timeoutMs = 12000 } = options;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    return { ok: false, reason: "no-location", message: "Pick a city clock to see its weather." };
  }
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "unsupported", message: "This browser cannot fetch weather." };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, reason: "offline", message: "You are offline — showing the last known look." };
  }

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(buildForecastUrl({ lat, lon, units, timezone }), {
      signal: controller ? controller.signal : undefined,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return { ok: false, reason: "http", message: `Weather service replied ${response.status}.` };
    }
    const payload = await response.json();
    const snapshot = parseForecast(payload, { lat, lon, units, label });
    if (!snapshot) return { ok: false, reason: "format", message: "Weather service sent something unexpected." };
    return snapshot;
  } catch (error) {
    const aborted = error && (error.name === "AbortError" || /abort/i.test(String(error.message)));
    return {
      ok: false,
      reason: aborted ? "timeout" : "network",
      message: aborted ? "The weather request timed out." : "Weather could not be reached right now.",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------- mood */

/**
 * "What does it *feel* like out there?" — the mood the theme engine paints
 * with. It starts from the WMO code but lets the wind have its say: a gale
 * under a blue sky is a windy day, not a "clear" one, and that used to be the
 * one sky the page got wrong.
 *
 * @param {object|null} snapshot parsed weather (see `parseForecast`)
 * @returns {string} one of storm · snow · rain · fog · wind · cloud · sunny
 */
export function effectiveMood(snapshot, { windKph = 26, gustKph = 48 } = {}) {
  if (!snapshot || !snapshot.ok) return (snapshot && snapshot.mood) || "cloud";
  const mood = snapshot.mood || "cloud";
  if (mood === "storm") return "storm";
  const speed = Number(snapshot.windSpeed);
  const gust = Number(snapshot.windGust);
  const breezy =
    (Number.isFinite(speed) && speed >= windKph) || (Number.isFinite(gust) && gust >= gustKph);
  // Precipitation and low cloud still own the look; only fair skies hand
  // themselves over to the wind.
  if (breezy && ["clear", "cloud", "fog"].includes(mood)) return "wind";
  if (mood === "clear") return "sunny";
  return mood;
}

/** "12 km/h SW", "gusting 48 km/h" — the wind in words. */
export function windDescription(snapshot) {
  const has = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));
  if (!snapshot || !has(snapshot.windSpeed)) return "";
  const speed = Math.round(Number(snapshot.windSpeed));
  const unit = snapshot.windUnit || "km/h";
  const gust = has(snapshot.windGust) ? Math.round(Number(snapshot.windGust)) : null;
  const arrow = has(snapshot.windDirection) ? ` ${compass(snapshot.windDirection)}` : "";
  const gusting = gust && gust >= 30 ? `, gusting ${gust}` : "";
  return `${speed} ${unit}${arrow}${gusting}`;
}

/** 210° -> "SW". Eight points is plenty for a weather card. */
export function compass(degrees) {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round((((Number(degrees) % 360) + 360) % 360) / 45) % 8;
  return points[index];
}

/* ------------------------------------------------------------ geolocation */

/** "granted" | "denied" | "prompt" | "unknown" without ever prompting. */
export async function readLocationPermission() {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions || !navigator.permissions.query) return "unknown";
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state || "unknown";
  } catch (_) {
    return "unknown";
  }
}

export function requestPosition(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject({ reason: "unsupported", message: "This browser has no location support." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords || {};
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          reject({ reason: "unreadable", message: "The browser could not read a position." });
          return;
        }
        resolve({ lat: latitude, lon: longitude, accuracy: position.coords.accuracy || null });
      },
      (error) => {
        const denied = error && (error.code === 1 || error.code === 2);
        reject({
          reason: denied ? "denied" : "unavailable",
          message: denied ? "Location permission was declined." : "No position fix from the browser.",
        });
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 10 * 60 * 1000 }
    );
  });
}

/**
 * UTC epoch -> "HH:MM" on the wall clock of the place the data came from,
 * using the UTC offset Open-Meteo reported for that location.
 */
export function wallClock(epoch, utcOffsetSeconds = 0) {
  if (!Number.isFinite(epoch)) return "—";
  const date = new Date(epoch + (Number(utcOffsetSeconds) || 0) * 1000);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

/** Minutes before/after an event for it to still feel like that moment. */
export function minutesUntil(epoch, now = Date.now()) {
  if (!Number.isFinite(epoch)) return null;
  return (epoch - now) / 60000;
}
