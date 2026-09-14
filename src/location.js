/**
 * "Where am I, really?"
 *
 * Three questions get asked here, and they have three different answers:
 *
 *   1. What clock should follow me?   -> a *time zone*
 *   2. What sky is above me?          -> a *coordinate pair*
 *   3. What is this place called?     -> a *name*, from a real gazetteer
 *
 * (3) is the one that used to be wrong. The old flow named a fix after the
 * nearest of our own 328 curated cities, so standing in a town we had never
 * heard of produced the name of the nearest big city — sometimes hundreds of
 * kilometres away. It looked random because, from the user's point of view,
 * it was. Now we ask BigDataCloud's key-less client endpoint (see
 * `src/geocode.js`) for the real administrative hierarchy, and only fall back
 * to the gazetteer when the network is unavailable.
 *
 * The fix itself got stricter too: `requestBestPosition()` asks for high
 * accuracy with a short cache window, and we report `coords.accuracy` back to
 * the UI so a 40 km network estimate can be labelled as one instead of being
 * passed off as a street address.
 *
 * Every failure is a value, not an exception: `{ ok: false, reason, message }`.
 */

import { geoPlace, nearestZone, placeRecord, placeZone } from "./places.js";
import { requestPosition, requestBestPosition, readLocationPermission } from "./weather.js";
import { describeAccuracy, isProbablyIpFix, reverseGeocode } from "./geocode.js";

export { requestPosition, requestBestPosition, readLocationPermission };
export { describeAccuracy, isProbablyIpFix, reverseGeocode };

/** Open-Meteo is already our weather source; it also reports the zone. */
export const ZONE_LOOKUP_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

export function buildZoneLookupUrl({ lat, lon }) {
  const params = new URLSearchParams({
    latitude: Number(lat).toFixed(4),
    longitude: Number(lon).toFixed(4),
    current: "temperature_2m",
    timezone: "auto",
  });
  return `${ZONE_LOOKUP_ENDPOINT}?${params.toString()}`;
}

/**
 * Ask the weather service which time zone covers a coordinate pair.
 * @returns {Promise<{ok: boolean, zone?: string, utcOffsetSeconds?: number, label?: string, reason?: string}>}
 */
export async function lookupZoneByCoords({ lat, lon, fetchImpl = globalThis.fetch, timeoutMs = 9000 } = {}) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    return { ok: false, reason: "no-coords" };
  }
  if (typeof fetchImpl !== "function") return { ok: false, reason: "unsupported" };

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(buildZoneLookupUrl({ lat, lon }), {
      signal: controller ? controller.signal : undefined,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return { ok: false, reason: "http" };
    const payload = await response.json();
    if (!payload || typeof payload.timezone !== "string" || !payload.timezone) return { ok: false, reason: "format" };
    return {
      ok: true,
      zone: payload.timezone,
      utcOffsetSeconds: Number(payload.utc_offset_seconds) || 0,
      label: payload.timezone_abbreviation || "",
      source: "open-meteo",
    };
  } catch (error) {
    const aborted = error && (error.name === "AbortError" || /abort/i.test(String(error.message)));
    return { ok: false, reason: aborted ? "timeout" : "network" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * A full place for a coordinate pair.
 *
 * Two network calls, in parallel because neither depends on the other:
 *
 *   • the **zone** from Open-Meteo — authoritative, and right at borders where
 *     our own guess is wrong,
 *   • the **name** from BigDataCloud — the actual town, district and region,
 *     instead of the nearest row in a 328-entry table.
 *
 * Both are optional. With no network at all this still returns a usable place,
 * exactly as it did before; it is just named less precisely, and says so.
 */
export async function placeFromCoords({
  lat,
  lon,
  lookup = true,
  geocode = true,
  accuracy = null,
  fetchImpl = globalThis.fetch,
} = {}) {
  const coords = { lat: Number(lat), lon: Number(lon) };
  if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lon)) {
    return { ok: false, reason: "no-coords", message: "No coordinates to look up." };
  }

  const [zoneResult, namedResult] = await Promise.all([
    lookup ? lookupZoneByCoords({ lat: coords.lat, lon: coords.lon, fetchImpl }) : Promise.resolve({ ok: false }),
    geocode ? reverseGeocode({ lat: coords.lat, lon: coords.lon, fetchImpl }) : Promise.resolve({ ok: false }),
  ]);

  const record = geoPlace(coords.lat, coords.lon, { fresh: true });

  // 1. The zone the service says legally covers this point beats our guess.
  if (zoneResult.ok && zoneResult.zone) {
    const confirmed = placeRecord(`zone:${zoneResult.zone}`);
    if (confirmed && !confirmed.unknown) {
      record.zone = confirmed.zone;
      if (!record.country && confirmed.country) record.country = confirmed.country;
    }
  }
  if (!record.zone || record.zone === "UTC") {
    const guessed = nearestZone(coords.lat, coords.lon);
    if (guessed) record.zone = guessed;
  }

  // 2. The real name of the place, when we could get one.
  const named = namedResult && namedResult.ok ? namedResult : null;
  if (named) {
    record.city = named.city;
    record.country = named.country || record.country;
    record.countryCode = named.countryCode || record.countryCode;
    record.region = named.region || record.region;
    record.locality = named.locality || "";
    record.postcode = named.postcode || "";
    record.detail = named.detail || "";
    record.label = named.country ? `${named.country} · ${named.city}` : named.city;
    record.shortLabel = named.city;
    record.geocoded = true;
    record.countries = named.countryCode ? [{ code: named.countryCode, name: named.country }] : record.countries;
    // The note is what the card shows underneath the name: the finer detail
    // if we have it, otherwise how far the fix landed from a known city.
    record.note = named.detail && named.detail !== named.city ? named.detail : record.note;
    record.search = [named.city, named.locality, named.region, named.country, "your location", "gps", "current"]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  const precision = describeAccuracy(accuracy);

  return {
    ok: true,
    place: record,
    zoneConfirmed: Boolean(zoneResult.ok && zoneResult.zone),
    geocoded: Boolean(named),
    geocodeReason: named ? "" : (namedResult && namedResult.reason) || "skipped",
    utcOffsetSeconds: zoneResult.ok ? zoneResult.utcOffsetSeconds : null,
    accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
    precision,
    coarse: precision.level === "ip",
  };
}

/**
 * The whole "use my location" flow: ask for permission, resolve a place.
 * Never throws; `{ ok: false, reason, message }` on any refusal.
 */
export async function currentLocation({
  lookup = true,
  geocode = true,
  timeoutMs = 12000,
  fetchImpl = globalThis.fetch,
} = {}) {
  try {
    const position = await requestBestPosition({ timeoutMs });
    const resolved = await placeFromCoords({
      lat: position.lat,
      lon: position.lon,
      lookup,
      geocode,
      accuracy: position.accuracy,
      fetchImpl,
    });
    if (!resolved.ok) return { ok: false, reason: resolved.reason, message: "Could not read that position." };
    return {
      ok: true,
      place: resolved.place,
      accuracy: position.accuracy,
      precision: resolved.precision,
      coarse: resolved.coarse,
      zoneConfirmed: resolved.zoneConfirmed,
      geocoded: resolved.geocoded,
    };
  } catch (error) {
    return {
      ok: false,
      reason: (error && error.reason) || "unavailable",
      message: (error && error.message) || "Your browser would not share a location.",
    };
  }
}

/** Short human sentence for a refusal, shown in a toast. */
export function locationErrorMessage(result) {
  if (!result || result.ok) return "";
  const messages = {
    denied: "Location permission was declined — pick a city instead.",
    unavailable: "No position fix yet. Try again outdoors or pick a city.",
    unsupported: "This browser has no location support.",
    timeout: "The location request timed out — try again, or pick a city.",
    "no-coords": "Your browser did not return usable coordinates.",
  };
  return messages[result.reason] || result.message || "Location is unavailable right now.";
}

/**
 * What to tell the user after a *successful* fix.
 *
 * Success is not binary here: a 30 metre GPS fix and a 40 km network estimate
 * both "work", and pretending they are the same is what made the old feature
 * feel unreliable. So the sentence says which one it was.
 */
export function locationSuccessMessage(result) {
  if (!result || !result.ok || !result.place) return "";
  const place = result.place;
  const where = place.detail || (place.country ? `${place.city}, ${place.country}` : place.city);
  if (result.coarse) {
    return `Approximate only — your browser placed you near ${where} (${result.precision.label}). Pick a city for an exact clock.`;
  }
  const precision = result.precision && result.precision.metres ? ` · ${result.precision.label}` : "";
  return `You are in ${where}${precision}.`;
}

/** The IANA zone id for a place, safe for `Intl`. */
export function zoneForPlaceId(id) {
  return placeZone(id);
}
