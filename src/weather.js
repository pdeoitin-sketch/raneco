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

/* ---------------------------------------------------------------- forecast */

/** How many days ahead the forecast section shows. */
export const FORECAST_DAYS = 7;
/** How many hours ahead the hourly strip shows. */
export const FORECAST_HOURS = 24;

export function buildForecastSeriesUrl({ lat, lon, units = "metric", timezone = "auto", days = FORECAST_DAYS }) {
  const params = new URLSearchParams({
    latitude: Number(lat).toFixed(4),
    longitude: Number(lon).toFixed(4),
    hourly: ["temperature_2m", "weather_code", "precipitation_probability", "wind_speed_10m", "is_day"].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "precipitation_sum",
      "wind_speed_10m_max",
      "sunrise",
      "sunset",
      "uv_index_max",
    ].join(","),
    current: ["temperature_2m", "weather_code", "is_day"].join(","),
    forecast_days: String(Math.max(1, Math.min(16, days))),
    timezone,
    wind_speed_unit: units === "imperial" ? "mph" : "kmh",
  });
  if (units === "imperial") params.set("temperature_unit", "fahrenheit");
  return `${FORECAST_ENDPOINT}?${params.toString()}`;
}

/**
 * Turn the hourly + daily arrays into the two lists the forecast section
 * renders. Kept pure so the shape can be tested without a network.
 *
 * Open-Meteo returns wall-clock strings for the *location*, which is what we
 * want to display — but we still need epochs to decide which hours are in the
 * past, so every row carries both.
 */
export function parseForecastSeries(payload, { units = "metric", now = Date.now() } = {}) {
  if (!payload || typeof payload !== "object") return null;
  const offsetSeconds = Number(payload.utc_offset_seconds) || 0;
  const degree = units === "imperial" ? "°F" : "°C";

  const hourly = [];
  const h = payload.hourly || {};
  if (Array.isArray(h.time)) {
    for (let i = 0; i < h.time.length; i += 1) {
      const epoch = wallTimeToEpoch(h.time[i], offsetSeconds);
      if (!Number.isFinite(epoch)) continue;
      const isDay = Number(h.is_day?.[i] ?? 1);
      const described = describeWeatherCode(h.weather_code?.[i], isDay);
      hourly.push({
        epoch,
        wall: String(h.time[i]).slice(11, 16),
        temperature: Number(h.temperature_2m?.[i]),
        temperatureUnit: degree,
        code: Number(h.weather_code?.[i]),
        condition: described.label,
        symbol: described.symbol,
        mood: described.mood,
        precipitationChance: Number.isFinite(h.precipitation_probability?.[i])
          ? Number(h.precipitation_probability[i])
          : null,
        windSpeed: Number.isFinite(h.wind_speed_10m?.[i]) ? Number(h.wind_speed_10m[i]) : null,
        isDay: Boolean(isDay),
      });
    }
  }

  const daily = [];
  const d = payload.daily || {};
  if (Array.isArray(d.time)) {
    for (let i = 0; i < d.time.length; i += 1) {
      const described = describeWeatherCode(d.weather_code?.[i], 1);
      daily.push({
        date: String(d.time[i]),
        // Midday, so a "which day is this" label can never slip across a
        // boundary when it is formatted in another zone.
        epoch: wallTimeToEpoch(`${d.time[i]}T12:00`, offsetSeconds),
        code: Number(d.weather_code?.[i]),
        condition: described.label,
        symbol: described.symbol,
        mood: described.mood,
        max: Number(d.temperature_2m_max?.[i]),
        min: Number(d.temperature_2m_min?.[i]),
        temperatureUnit: degree,
        precipitationChance: Number.isFinite(d.precipitation_probability_max?.[i])
          ? Number(d.precipitation_probability_max[i])
          : null,
        precipitation: Number.isFinite(d.precipitation_sum?.[i]) ? Number(d.precipitation_sum[i]) : null,
        windMax: Number.isFinite(d.wind_speed_10m_max?.[i]) ? Number(d.wind_speed_10m_max[i]) : null,
        uvIndex: Number.isFinite(d.uv_index_max?.[i]) ? Number(d.uv_index_max[i]) : null,
        sunrise: wallTimeToEpoch(d.sunrise?.[i], offsetSeconds),
        sunset: wallTimeToEpoch(d.sunset?.[i], offsetSeconds),
      });
    }
  }

  if (!hourly.length && !daily.length) return null;

  return {
    ok: true,
    source: "open-meteo",
    timezone: payload.timezone || "",
    utcOffsetSeconds: offsetSeconds,
    windUnit: units === "imperial" ? "mph" : "km/h",
    temperatureUnit: degree,
    // The strip starts at the current hour, not at midnight.
    hourly: hourly.filter((entry) => entry.epoch >= now - 3600 * 1000).slice(0, FORECAST_HOURS),
    daily,
    observedAt: Date.now(),
  };
}

/** Never rejects. The multi-day forecast behind the "Forecast" section. */
export async function fetchForecastSeries(options = {}) {
  const { lat, lon, units, timezone = "auto", days = FORECAST_DAYS, fetchImpl = globalThis.fetch, timeoutMs = 12000 } =
    options;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    return { ok: false, reason: "no-location", message: "Pick a place to see its forecast." };
  }
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "unsupported", message: "This browser cannot fetch a forecast." };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, reason: "offline", message: "You are offline — the forecast is the last one we loaded." };
  }

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(buildForecastSeriesUrl({ lat, lon, units, timezone, days }), {
      signal: controller ? controller.signal : undefined,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return { ok: false, reason: "http", message: `Forecast service replied ${response.status}.` };
    const parsed = parseForecastSeries(await response.json(), { units });
    if (!parsed) return { ok: false, reason: "format", message: "The forecast came back empty." };
    return parsed;
  } catch (error) {
    const aborted = error && (error.name === "AbortError" || /abort/i.test(String(error.message)));
    return {
      ok: false,
      reason: aborted ? "timeout" : "network",
      message: aborted ? "The forecast request timed out." : "The forecast could not be reached.",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
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

/**
 * Ask the device where it is.
 *
 * The defaults here matter more than they look. The original call used
 * `enableHighAccuracy: false` with a ten-minute `maximumAge`, which tells the
 * browser "a cached, coarse answer is fine" — and a coarse answer is usually
 * derived from the IP address, which is how a laptop in Bhaktapur ends up
 * being told it is somewhere else entirely. That is the "it just puts out a
 * random thing" bug.
 *
 * So: high accuracy on (the GPS/wifi radios are consulted), and a cache window
 * of one minute rather than ten, so pressing the button after you have moved
 * actually moves the answer. `accuracy` is passed back to the caller, which
 * uses it to say how much to trust the fix — and to refuse to name a city off
 * a 40 km IP estimate.
 *
 * @param {number} timeoutMs
 * @param {object} [options]
 *   @param {boolean} [options.highAccuracy=true]
 *   @param {number}  [options.maximumAgeMs=60000]
 */
export function requestPosition(timeoutMs = 12000, { highAccuracy = true, maximumAgeMs = 60 * 1000 } = {}) {
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
        resolve({
          lat: latitude,
          lon: longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          altitude: Number.isFinite(position.coords.altitude) ? position.coords.altitude : null,
          timestamp: position.timestamp || Date.now(),
        });
      },
      (error) => {
        // 1 PERMISSION_DENIED · 2 POSITION_UNAVAILABLE · 3 TIMEOUT. Only 1 is
        // a refusal; conflating 2 with it used to tell people they had denied
        // permission when the radio had simply not found a fix yet.
        const code = error && error.code;
        const reason = code === 1 ? "denied" : code === 3 ? "timeout" : "unavailable";
        reject({
          reason,
          message:
            reason === "denied"
              ? "Location permission was declined."
              : reason === "timeout"
                ? "The location request timed out."
                : "No position fix from the browser.",
        });
      },
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: maximumAgeMs }
    );
  });
}

/**
 * A fix, retried.
 *
 * The first high-accuracy attempt can time out indoors while the GPS radio is
 * still warming up. Rather than failing, fall back to a permissive request —
 * a coarse position that we then *label* as coarse is far more useful than no
 * position at all.
 */
export async function requestBestPosition({ timeoutMs = 12000, fallbackTimeoutMs = 8000 } = {}) {
  try {
    return await requestPosition(timeoutMs, { highAccuracy: true, maximumAgeMs: 60 * 1000 });
  } catch (error) {
    if (error && error.reason === "denied") throw error;
    return requestPosition(fallbackTimeoutMs, { highAccuracy: false, maximumAgeMs: 5 * 60 * 1000 });
  }
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
