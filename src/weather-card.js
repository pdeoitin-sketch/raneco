/**
 * The weather card — and, more importantly, *where* it is looking.
 *
 * Location is a first-class choice here, because a country is not a place:
 * "India" spans 29 degrees of longitude, so one national forecast is wrong for
 * almost everybody in it. The card can follow
 *
 *   • your home place      (updated whenever you change it),
 *   • any city you pick    (with that city's own coordinates),
 *   • your device          (browser geolocation, whenever you allow it),
 *
 * and it says which one it is using, with the coordinates, so the number on
 * the card can be trusted. Data comes from Open-Meteo: free, key-less, and
 * happy to be called from a static page.
 */

import { placeCoords, placeRecord, sunNote } from "./places.js";
import {
  REFRESH_MS,
  fetchWeather,
  preferImperial,
  readLocationPermission,
  requestPosition,
  wallClock,
  windDescription,
} from "./weather.js";

const PLACE_KEY = "tempo-weather-place";
const UNITS_KEY = "tempo-weather-units";

export function createWeatherCard({ elements = {}, getHomeId, notify, onSnapshot } = {}) {
  const card = elements.card;
  let snapshot = null;
  let source = null;
  let busy = false;
  let refreshTimer = 0;

  const show = (id, value) => {
    const node = elements[id];
    if (node && node.textContent !== value) node.textContent = value;
  };

  const set = (id, value, attribute = "data-state") => {
    const node = elements[id];
    if (node) node.setAttribute(attribute, String(value));
  };

  /* ------------------------------------------------------------ location */

  function storedUnits() {
    try {
      const raw = localStorage.getItem(UNITS_KEY);
      return raw === "metric" || raw === "imperial" ? raw : "auto";
    } catch (_) {
      return "auto";
    }
  }

  function unitsFor(current) {
    const preference = storedUnits();
    if (preference !== "auto") return preference;
    const codes = current && current.placeId ? placeRecord(current.placeId).countries.map((c) => c.code) : [];
    return preferImperial(codes) ? "imperial" : "metric";
  }

  function readStoredSource() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PLACE_KEY));
      if (parsed && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon)) return parsed;
    } catch (_) {
      /* a broken preference is just no preference */
    }
    return null;
  }

  function persistSource(next) {
    try {
      localStorage.setItem(PLACE_KEY, JSON.stringify(next));
    } catch (_) {
      /* the choice resets next visit when storage is blocked */
    }
  }

  function homeId() {
    return typeof getHomeId === "function" ? getHomeId() : "zone:UTC";
  }

  /** Follow the home place: the default, and the thing that keeps working. */
  function homeSource() {
    const id = homeId();
    const coords = placeCoords(id);
    if (!coords) return null;
    const record = placeRecord(id);
    return { kind: "place", placeId: id, lat: coords.lat, lon: coords.lon, label: record.label };
  }

  async function resolveSource(force) {
    const stored = readStoredSource();
    const home = homeId();

    // An explicit device choice wins until it is undone.
    if (stored && stored.kind === "gps") return stored;
    if (stored && stored.kind === "place") {
      if (stored.followHome) {
        // Tracking the home place: follow it wherever it moved to.
        const moved = homeSource();
        if (moved) {
          persistSource({ ...moved, followHome: true });
          return moved;
        }
        return stored;
      }
      // A place you picked yourself (city:ahmedabad-in) is a decision, not a
      // default — a forced refresh must not quietly give it back to the home
      // place. Only "follow my home place" or "use my location" change it.
      return stored;
    }

    const permission = await readLocationPermission();
    if (permission === "granted") {
      try {
        const position = await requestPosition();
        const found = {
          kind: "gps",
          lat: position.lat,
          lon: position.lon,
          label: "Your location",
        };
        persistSource(found);
        return found;
      } catch (_) {
        /* granted once, but no fix right now: fall through */
      }
    }
    const fallback = homeSource();
    if (fallback) persistSource({ ...fallback, followHome: true });
    return fallback || stored || null;
  }

  /* ------------------------------------------------------------ rendering */

  function relativeTime(epoch) {
    if (!epoch) return "not updated yet";
    const minutes = Math.max(0, Math.round((Date.now() - epoch) / 60000));
    if (minutes < 1) return "updated just now";
    if (minutes < 60) return `updated ${minutes} min ago`;
    return `updated ${Math.round(minutes / 60)} h ago`;
  }

  function daylightText() {
    if (!snapshot || !snapshot.ok || !snapshot.sunset) return "";
    const minutesLeft = Math.round((snapshot.sunset - Date.now()) / 60000);
    if (minutesLeft <= 0) return "the sun is down";
    const hours = Math.floor(minutesLeft / 60);
    const minutes = minutesLeft % 60;
    return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m of light left` : `${minutes} min of light left`;
  }

  function coordsText() {
    if (!source) return "";
    const lat = Number(source.lat);
    const lon = Number(source.lon);
    const ns = lat >= 0 ? "N" : "S";
    const ew = lon >= 0 ? "E" : "W";
    return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`;
  }

  function renderSunArc() {
    const dot = elements.sunArcDot;
    if (!dot) return;
    if (!snapshot || !snapshot.ok || !snapshot.sunrise || !snapshot.sunset) {
      dot.style.setProperty("--sun-pos", "50%");
      dot.dataset.state = "unknown";
      return;
    }
    const ratio = (Date.now() - snapshot.sunrise) / (snapshot.sunset - snapshot.sunrise);
    dot.style.setProperty("--sun-pos", `${Math.max(0, Math.min(1, ratio)) * 100}%`);
    dot.dataset.state = snapshot.isDay ? "day" : "night";
  }

  function render() {
    set("card", snapshot && snapshot.ok ? "ready" : snapshot ? "error" : busy ? "loading" : "idle");
    renderSunArc();

    const homeLabel = placeRecord(homeId()).city;

    if (!snapshot || !snapshot.ok) {
      const message = snapshot && !snapshot.ok ? snapshot.message || "Weather unavailable" : "Weather not loaded";
      show("temp", "--");
      show("unit", "°");
      show("symbol", snapshot ? "!" : "☂");
      show("condition", busy ? "Checking the sky…" : message);
      show("place", (source && source.label) || homeLabel);
      show("coords", coordsText());
      show("sunrise", "--:--");
      show("sunset", "--:--");
      show("daylight", "");
      show("details", "");
      show("updated", busy ? "one moment…" : relativeTime(snapshot && snapshot.attemptedAt));
      show("source", "Live weather from Open-Meteo — no account, no key.");
      renderControls(homeLabel);
      return;
    }

    show("place", snapshot.label || (source && source.label) || homeLabel);
    show("symbol", snapshot.symbol || "☂");
    show("temp", String(Math.round(snapshot.temperature)));
    show("unit", snapshot.temperatureUnit || "°C");
    show("condition", snapshot.condition);
    show("coords", coordsText());
    show("sunrise", wallClock(snapshot.sunrise, snapshot.utcOffsetSeconds));
    show("sunset", wallClock(snapshot.sunset, snapshot.utcOffsetSeconds));
    show("daylight", daylightText());

    const details = [];
    if (Number.isFinite(snapshot.feelsLike)) details.push(`feels ${Math.round(snapshot.feelsLike)}${snapshot.temperatureUnit}`);
    if (Number.isFinite(snapshot.humidity)) details.push(`${Math.round(snapshot.humidity)}% humidity`);
    const wind = windDescription(snapshot);
    if (wind) details.push(`wind ${wind}`);
    if (Number.isFinite(snapshot.precipitation) && snapshot.precipitation > 0) {
      details.push(`${snapshot.precipitation.toFixed(1)} mm`);
    }
    show("details", details.join(" · "));
    show("updated", relativeTime(snapshot.observedAt));
    show(
      "source",
      source && source.kind === "gps"
        ? `Measured at your browser's location · ${snapshot.timezone || "local zone"} time.`
        : `Measured at ${coordsText()} · ${snapshot.timezone || placeRecord(homeId()).zone} time.`
    );
    renderControls(homeLabel);
  }

  function renderControls(homeLabel) {
    const usingGps = Boolean(source && source.kind === "gps");
    if (elements.useLocation) {
      elements.useLocation.textContent = usingGps ? `Use ${homeLabel} instead` : "📍 Use my location";
    }
    if (elements.setLocation) {
      elements.setLocation.textContent = usingGps ? "Choose a place…" : "📍 Choose another place…";
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
    const resolved = await resolveSource(force);
    if (!resolved) {
      busy = false;
      snapshot = {
        ok: false,
        message: "This place has no coordinates — pick a city to see its weather.",
        attemptedAt: Date.now(),
      };
      source = null;
      render();
      emit();
      return null;
    }
    source = resolved;

    const next = await fetchWeather({
      lat: source.lat,
      lon: source.lon,
      label: source.label,
      units: unitsFor(source),
      // "auto" answers in the place's own clock, which is what the sunrise
      // and sunset numbers below are.
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
      const fallback = homeSource();
      source = fallback;
      if (fallback) persistSource({ ...fallback, followHome: true });
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
      source = homeSource();
      if (source) persistSource({ ...source, followHome: true });
      await refresh({ force: true });
    }
  }

  /** Pick any place (city or zone) as the weather location. */
  async function setPlace(placeId) {
    const record = placeRecord(placeId);
    const coords = placeCoords(placeId);
    if (!coords) {
      if (notify) notify(`${record.city} has no coordinates we can look up.`, "!");
      return false;
    }
    source = { kind: "place", placeId: record.id, lat: coords.lat, lon: coords.lon, label: record.label };
    persistSource(source);
    await refresh({ force: true });
    if (notify) notify(`Weather now follows ${record.label}.`);
    return true;
  }

  function toggleUnits() {
    const next = unitsFor(source) === "imperial" ? "metric" : "imperial";
    try {
      localStorage.setItem(UNITS_KEY, next);
    } catch (_) {
      /* the unit lasts for this visit only */
    }
    return refresh({ force: true });
  }

  function bind() {
    if (elements.useLocation) elements.useLocation.addEventListener("click", useMyLocation);
    if (elements.retry) elements.retry.addEventListener("click", () => refresh({ force: true }));
    if (elements.units) elements.units.addEventListener("click", toggleUnits);
    if (elements.setLocation) elements.setLocation.addEventListener("click", () => hookOpenPicker());
  }

  let openPicker = null;
  function hookOpenPicker() {
    if (typeof openPicker === "function") openPicker();
  }

  function init() {
    bind();
    refresh();
    // Weather moves slowly, but "10 minutes ago" should never be on screen.
    if (typeof window !== "undefined") {
      refreshTimer = window.setInterval(() => {
        refresh();
        render();
      }, 60 * 1000);
    }
  }

  return {
    init,
    refresh,
    render,
    useMyLocation,
    setPlace,
    /** The app calls this when the home place changes. */
    followHomeZone() {
      const stored = readStoredSource();
      if (!stored || stored.kind !== "gps") {
        source = homeSource();
        if (source) persistSource({ ...source, followHome: true });
      }
      return refresh({ force: true });
    },
    /** Wire the "choose a place" button to the shared picker. */
    onPickPlace(fn) {
      openPicker = fn;
    },
    get snapshot() {
      return snapshot;
    },
    get source() {
      return source;
    },
    get label() {
      return (source && source.label) || placeRecord(homeId()).label;
    },
    coordsText,
    stop() {
      if (typeof window !== "undefined") window.clearInterval(refreshTimer);
    },
  };
}

/** Exposed for the app's "solar note" panel: the sun line for a place. */
export function sunLineFor(placeId) {
  return sunNote(placeRecord(placeId));
}
