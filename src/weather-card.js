/**
 * The weather card inside "Right now", plus the little bit of state it needs:
 * where to look (browser GPS when allowed, otherwise the home-zone city) and
 * which units to use. Data comes from Open-Meteo; no key, no account.
 */

import { coordsFor, recordFor } from "./tz-places.js";
import {
  REFRESH_MS,
  fetchWeather,
  preferImperial,
  readLocationPermission,
  requestPosition,
  wallClock,
} from "./weather.js";

const PLACE_KEY = "tempo-weather-place";
const UNITS_KEY = "tempo-weather-units";

export function createWeatherCard({ elements = {}, getHomeZone, notify, onSnapshot } = {}) {
  const card = elements.card;
  let snapshot = null;
  let source = null;
  let busy = false;
  let refreshTimer = 0;
  let clockTimer = 0;

  const show = (id, value) => {
    const node = elements[id];
    if (node && node.textContent !== value) node.textContent = value;
  };

  const set = (id, value, attribute) => {
    const node = elements[id];
    if (node) node.setAttribute(attribute || "data-state", String(value));
  };

  function storedUnits() {
    try {
      const raw = localStorage.getItem(UNITS_KEY);
      return raw === "metric" || raw === "imperial" ? raw : "auto";
    } catch (_) {
      return "auto";
    }
  }

  function unitsFor(source) {
    const preference = storedUnits();
    if (preference !== "auto") return preference;
    const codes = source && source.zone ? recordFor(source.zone).countries.map((country) => country.code) : [];
    return preferImperial(codes) ? "imperial" : "metric";
  }

  function readStoredSource() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PLACE_KEY));
      if (parsed && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon)) return parsed;
    } catch (_) {
      // A broken preference is just no preference.
    }
    return null;
  }

  function persistSource(next) {
    try {
      localStorage.setItem(PLACE_KEY, JSON.stringify(next));
    } catch (_) {
      // Location choice resets on the next visit when storage is blocked.
    }
  }

  function homeZoneSource() {
    const zone = getHomeZone ? getHomeZone() : "UTC";
    const coords = coordsFor(zone);
    const record = recordFor(zone);
    if (!coords) return null;
    return { kind: "zone", zone, lat: coords.lat, lon: coords.lon, label: record.label };
  }

  async function resolveSource(force) {
    const stored = readStoredSource();
    const homeZone = getHomeZone ? getHomeZone() : "UTC";

    // An explicit "use my location" choice always wins until it is undone.
    if (stored && stored.kind === "gps") return stored;
    if (stored && stored.kind === "zone" && stored.zone === homeZone && !force) return stored;
    if (stored && stored.kind === "zone") {
      // The home zone moved, so the weather place moves with it.
      const moved = homeZoneSource();
      if (moved) {
        persistSource(moved);
        return moved;
      }
    }

    const permission = await readLocationPermission();
    if (permission === "granted") {
      try {
        const position = await requestPosition();
        const found = { kind: "gps", lat: position.lat, lon: position.lon, label: "Your location" };
        persistSource(found);
        return found;
      } catch (_) {
        // Permission may have been granted once and then fail to fix; fall back.
      }
    }
    const fallback = homeZoneSource();
    if (fallback) persistSource(fallback);
    return fallback || stored || null;
  }

  /* ------------------------------------------------------------ rendering */

  function relativeTime(epoch) {
    if (!epoch) return "not updated yet";
    const minutes = Math.max(0, Math.round((Date.now() - epoch) / 60000));
    if (minutes < 1) return "updated just now";
    if (minutes < 60) return `updated ${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return `updated ${hours} h ago`;
  }

  function daylightText() {
    if (!snapshot || !snapshot.ok || !snapshot.sunset) return "";
    const minutesLeft = Math.round((snapshot.sunset - Date.now()) / 60000);
    if (minutesLeft <= 0) return "the sun is down";
    const hours = Math.floor(minutesLeft / 60);
    const minutes = minutesLeft % 60;
    return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m of light left` : `${minutes} min of light left`;
  }

  function render() {
    set("card", snapshot && snapshot.ok ? "ready" : snapshot ? "error" : busy ? "loading" : "idle");
    if (!snapshot) {
      show("temp", "--");
      show("unit", "°");
      show("symbol", "☂");
      show("condition", busy ? "Checking the sky…" : "Weather not loaded");
      show("place", source ? source.label : recordFor(getHomeZone ? getHomeZone() : "UTC").label);
      show("source", "Live weather from Open-Meteo — no account, no key.");
      show("sunrise", "--:--");
      show("sunset", "--:--");
      show("daylight", "");
      show("details", "");
      show("updated", busy ? "one moment…" : "Tap refresh to try again.");
      renderControls();
      return;
    }

    if (!snapshot.ok) {
      show("symbol", "!");
      show("condition", snapshot.message || "Weather unavailable");
      show("temp", "--");
      show("unit", "°");
      show("sunrise", "--:--");
      show("sunset", "--:--");
      show("daylight", "");
      show("details", "");
      show("updated", relativeTime(snapshot.attemptedAt));
      show("source", "Weather comes from Open-Meteo, so a blocked network shows up here.");
      renderControls();
      return;
    }

    const homeZone = getHomeZone ? getHomeZone() : "UTC";
    const label =
      snapshot.label || (source && source.label) || recordFor(homeZone).label;
    show("place", label);
    show("symbol", snapshot.symbol || "☂");
    show("temp", String(Math.round(snapshot.temperature)));
    show("unit", snapshot.temperatureUnit || "°C");
    show("condition", snapshot.condition);
    show(
      "source",
      source && source.kind === "gps"
        ? `From your browser’s location, rounded to ${snapshot.timezone || "your zone"}.`
        : `From your home zone (${snapshot.timezone || homeZone}).`
    );
    show("sunrise", wallClock(snapshot.sunrise, snapshot.utcOffsetSeconds));
    show("sunset", wallClock(snapshot.sunset, snapshot.utcOffsetSeconds));
    show("daylight", daylightText());
    const details = [];
    if (Number.isFinite(snapshot.feelsLike)) details.push(`feels ${Math.round(snapshot.feelsLike)}${snapshot.temperatureUnit}`);
    if (Number.isFinite(snapshot.humidity)) details.push(`${Math.round(snapshot.humidity)}% humidity`);
    if (Number.isFinite(snapshot.windSpeed))
      details.push(`wind ${formatWind(snapshot.windSpeed)} ${snapshot.windUnit}`);
    if (Number.isFinite(snapshot.precipitation) && snapshot.precipitation > 0)
      details.push(`${snapshot.precipitation.toFixed(1)} mm`);
    show("details", details.join(" · "));
    show("updated", relativeTime(snapshot.observedAt));
    renderControls();
  }

  function formatWind(value) {
    return value >= 10 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
  }

  function renderControls() {
    const usingGps = Boolean(source && source.kind === "gps");
    const homeLabel = recordFor(getHomeZone ? getHomeZone() : "UTC").city;
    if (elements.useLocation) {
      elements.useLocation.textContent = usingGps ? `Use ${homeLabel} instead` : "Use my location";
      elements.useLocation.hidden = false;
    }
    if (elements.units) {
      const active = unitsFor(source) === "imperial" ? "°F" : "°C";
      elements.units.textContent = active === "°C" ? "°F" : "°C";
      elements.units.title = `Switch to ${active === "°C" ? "°F" : "°C"}`;
    }
    if (elements.retry) elements.retry.disabled = busy;
    if (card) card.setAttribute("aria-busy", String(busy));
  }

  /* ---------------------------------------------------------------- fetch */

  async function refresh({ force = false } = {}) {
    if (!card) return null;
    if (busy) return snapshot;
    if (snapshot && snapshot.ok && !force && Date.now() - snapshot.observedAt < REFRESH_MS) return snapshot;

    busy = true;
    render();
    source = await resolveSource(force);
    if (!source) {
      busy = false;
      snapshot = { ok: false, message: "This zone has no coordinates — pick a city as your home zone.", attemptedAt: Date.now() };
      render();
      emit();
      return null;
    }

    const next = await fetchWeather({
      lat: source.lat,
      lon: source.lon,
      label: source.label,
      units: unitsFor(source),
      // "auto" lets Open-Meteo answer in the place's own clock, which is what
      // the sunrise and sunset numbers below are.
      timezone: "auto",
    });
    busy = false;
    snapshot = next;
    if (next && next.ok) show("place", next.label || source.label);
    render();
    emit();
    return next;
  }

  function emit() {
    if (typeof onSnapshot === "function") onSnapshot(snapshot);
  }

  /* --------------------------------------------------------------- events */

  async function useMyLocation() {
    if (source && source.kind === "gps") {
      const fallback = homeZoneSource();
      source = fallback;
      if (fallback) persistSource(fallback);
      await refresh({ force: true });
      if (notify && fallback) notify(`Weather now follows ${fallback.label}.`);
      return;
    }
    try {
      const position = await requestPosition();
      source = { kind: "gps", lat: position.lat, lon: position.lon, label: "Your location" };
      persistSource(source);
      await refresh({ force: true });
      if (notify) notify("Weather is now using your browser’s location.");
    } catch (error) {
      if (notify) notify((error && error.message) || "Your browser would not share a location.", "!");
      source = homeZoneSource();
      if (source) persistSource(source);
      await refresh({ force: true });
    }
  }

  function toggleUnits() {
    const next = unitsFor(source) === "imperial" ? "metric" : "imperial";
    try {
      localStorage.setItem(UNITS_KEY, next);
    } catch (_) {
      // Units revert on reload when storage is blocked.
    }
    refresh({ force: true });
  }

  function init() {
    if (!card) return;
    elements.useLocation && elements.useLocation.addEventListener("click", useMyLocation);
    elements.retry && elements.retry.addEventListener("click", () => refresh({ force: true }));
    elements.units && elements.units.addEventListener("click", toggleUnits);
    render();
    refresh();
    refreshTimer = window.setInterval(() => refresh(), REFRESH_MS);
    clockTimer = window.setInterval(() => {
      if (snapshot && snapshot.ok) {
        show("updated", relativeTime(snapshot.observedAt));
        show("daylight", daylightText());
      }
    }, 60 * 1000);
  }

  return {
    init,
    refresh,
    get snapshot() {
      return snapshot;
    },
    /** Called by the app when the home zone changes. */
    followHomeZone() {
      const fallback = homeZoneSource();
      const stored = readStoredSource();
      if (!stored || stored.kind === "zone") {
        source = fallback;
        if (fallback) persistSource(fallback);
      }
      return refresh({ force: true });
    },
    stop() {
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    },
  };
}
