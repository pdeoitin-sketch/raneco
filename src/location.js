/**
 * "Where am I, really?"
 *
 * Two questions get asked a lot in this app, and they have different answers:
 *
 *   1. What clock should follow me?        -> a *time zone*
 *   2. What sky is above me?               -> a *coordinate pair*
 *
 * Both start from the browser's geolocation permission, which we never ask for
 * unprompted: `permissionState()` peeks without triggering the dialog, and the
 * buttons are what actually request it.
 *
 * Given coordinates we can answer (2) directly. For (1) we ask Open-Meteo for
 * the zone it thinks covers that point (it answers with the IANA id and the
 * current UTC offset, which is authoritative — borders move, and a phone in
 * the field is more trustworthy than our own guess). When the network is away
 * we fall back to the nearest place in our own gazetteer.
 *
 * Every failure is a value, not an exception: `{ ok: false, reason, message }`.
 */

import { geoPlace, nearestZone, placeRecord, placeZone } from "./places.js";
import { requestPosition, readLocationPermission } from "./weather.js";

export { requestPosition, readLocationPermission };

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
 * `geoPlace()` alone would guess the zone from the nearest city in our
 * gazetteer, which is right in almost every case but wrong at borders — and
 * borders are exactly where the "my region is 15 minutes off" complaint lives.
 * So when we can, we confirm the zone with the network first.
 */
export async function placeFromCoords({ lat, lon, lookup = true, fetchImpl = globalThis.fetch } = {}) {
  const coords = { lat: Number(lat), lon: Number(lon) };
  if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lon)) {
    return { ok: false, reason: "no-coords", message: "No coordinates to look up." };
  }

  let zone = null;
  let offsetSeconds = null;
  if (lookup) {
    const found = await lookupZoneByCoords({ lat: coords.lat, lon: coords.lon, fetchImpl });
    if (found.ok) {
      zone = found.zone;
      offsetSeconds = found.utcOffsetSeconds;
    }
  }

  const record = geoPlace(coords.lat, coords.lon, { fresh: true });
  if (zone) {
    // Keep our own name for the fix, but use the service's zone for the clock.
    const confirmed = placeRecord(`${"zone:"}${zone}`);
    if (confirmed && !confirmed.unknown) {
      record.zone = confirmed.zone;
      if (!record.country && confirmed.country) record.country = confirmed.country;
    }
  }
  if (!record.zone || record.zone === "UTC") {
    const guessed = nearestZone(coords.lat, coords.lon);
    if (guessed) record.zone = guessed;
  }

  return {
    ok: true,
    place: record,
    zoneConfirmed: Boolean(zone),
    utcOffsetSeconds: offsetSeconds,
  };
}

/**
 * The whole "use my location" flow: ask for permission, resolve a place.
 * Never throws; `{ ok: false, reason, message }` on any refusal.
 */
export async function currentLocation({ lookup = true, timeoutMs = 9000, fetchImpl = globalThis.fetch } = {}) {
  try {
    const position = await requestPosition(timeoutMs);
    const resolved = await placeFromCoords({ lat: position.lat, lon: position.lon, lookup, fetchImpl });
    if (!resolved.ok) return { ok: false, reason: resolved.reason, message: "Could not read that position." };
    return { ok: true, place: resolved.place, accuracy: position.accuracy, zoneConfirmed: resolved.zoneConfirmed };
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
    timeout: "The location request timed out.",
    "no-coords": "Your browser did not return usable coordinates.",
  };
  return messages[result.reason] || result.message || "Location is unavailable right now.";
}

/** The IANA zone id for a place, safe for `Intl`. */
export function zoneForPlaceId(id) {
  return placeZone(id);
}
