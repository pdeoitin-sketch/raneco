/**
 * Reverse geocoding — turning a GPS fix into the name of the place you are
 * actually standing in.
 *
 * Why this file exists
 * --------------------
 * "Use my location" used to answer with the nearest entry in our own 328-city
 * gazetteer. In a capital that reads fine. Anywhere else it is wrong in a way
 * that feels random: stand in Bhaktapur and it says Kathmandu; stand in a
 * small town and it can name a city 200 km away, because that was simply the
 * closest row in the table.
 *
 * So we ask a real gazetteer. BigDataCloud's client-side endpoint is free, has
 * no API key, is CORS-enabled and returns the full administrative hierarchy —
 * locality, city, principal subdivision, country — which is exactly the
 * "locate that particular region and give it out there" answer.
 *
 * Its fair-use policy is that calls must come from the end user's browser,
 * with real-time coordinates the device just produced. That is precisely how
 * Tempo uses it: one call, immediately after a fix the user consented to.
 *
 * If it is unreachable we degrade to the old nearest-city behaviour, so the
 * feature never gets *worse* than it was — only better when the network is up.
 */

export const REVERSE_GEOCODE_ENDPOINT = "https://api.bigdatacloud.net/data/reverse-geocode-client";

/**
 * A fix this coarse did not come from GPS — it came from the IP address, and
 * an IP can put you in the wrong city (or the wrong country, on a VPN). That
 * is the single biggest cause of "it just puts out a random thing".
 */
export const IP_ACCURACY_THRESHOLD_M = 20000;
/** Better than this and we can name a neighbourhood, not just a city. */
export const FINE_ACCURACY_M = 250;

export function buildReverseGeocodeUrl({ lat, lon, language = "en" }) {
  const params = new URLSearchParams({
    latitude: Number(lat).toFixed(5),
    longitude: Number(lon).toFixed(5),
    localityLanguage: language,
  });
  return `${REVERSE_GEOCODE_ENDPOINT}?${params.toString()}`;
}

/**
 * Pull the useful names out of BigDataCloud's payload.
 *
 * The interesting part is `localityInfo.administrative`: an ordered list from
 * country down to the smallest named unit, each with an `adminLevel`. We want
 * the *finest* one that is not just a repeat of the city, because "Thamel,
 * Kathmandu" is a better answer than "Kathmandu" twice.
 */
export function parseReverseGeocode(payload, { lat, lon } = {}) {
  if (!payload || typeof payload !== "object") return null;

  const country = String(payload.countryName || "").trim();
  const countryCode = String(payload.countryCode || "").trim().toUpperCase();
  const city = String(payload.city || "").trim();
  const locality = String(payload.locality || "").trim();
  const region = String(payload.principalSubdivision || "").trim();
  const postcode = String(payload.postcode || "").trim();

  const admin = Array.isArray(payload?.localityInfo?.administrative)
    ? payload.localityInfo.administrative
        .filter((entry) => entry && entry.name)
        .slice()
        .sort((a, b) => Number(a.adminLevel || 0) - Number(b.adminLevel || 0))
    : [];

  // The deepest administrative name that is not already the city or region.
  const finest = admin
    .slice()
    .reverse()
    .map((entry) => String(entry.name).trim())
    .find((name) => name && name !== city && name !== region && name !== country);

  const place = city || locality || finest || region || country;
  if (!place) return null;

  // A neighbourhood only earns its place in the label when it adds something.
  const neighbourhood = [locality, finest].find((name) => name && name !== place) || "";

  const parts = [];
  if (neighbourhood) parts.push(neighbourhood);
  if (place && place !== neighbourhood) parts.push(place);
  if (region && region !== place && region !== neighbourhood) parts.push(region);

  return {
    ok: true,
    source: "bigdatacloud",
    city: place,
    locality: neighbourhood,
    region,
    country,
    countryCode,
    postcode,
    // "Thamel, Kathmandu, Bagmati Province"
    detail: parts.join(", "),
    // Their IP fallback says so itself; we treat that as "not a real fix".
    fromIp: payload.lookupSource === "ipGeolocation",
    lat: Number.isFinite(Number(payload.latitude)) ? Number(payload.latitude) : Number(lat),
    lon: Number.isFinite(Number(payload.longitude)) ? Number(payload.longitude) : Number(lon),
    admin: admin.map((entry) => ({ level: Number(entry.adminLevel || 0), name: String(entry.name) })),
  };
}

/**
 * Name a coordinate pair. Never throws.
 * @returns {Promise<{ok: boolean, …} | {ok: false, reason: string}>}
 */
export async function reverseGeocode({
  lat,
  lon,
  language = "en",
  fetchImpl = globalThis.fetch,
  timeoutMs = 8000,
} = {}) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    return { ok: false, reason: "no-coords" };
  }
  if (typeof fetchImpl !== "function") return { ok: false, reason: "unsupported" };

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller && typeof setTimeout === "function" ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(buildReverseGeocodeUrl({ lat, lon, language }), {
      signal: controller ? controller.signal : undefined,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return { ok: false, reason: response.status === 402 ? "rate-limited" : "http" };
    const parsed = parseReverseGeocode(await response.json(), { lat, lon });
    return parsed || { ok: false, reason: "format" };
  } catch (error) {
    const aborted = error && (error.name === "AbortError" || /abort/i.test(String(error.message)));
    return { ok: false, reason: aborted ? "timeout" : "network" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* --------------------------------------------------------------- accuracy */

/**
 * How much to trust a fix, in words.
 *
 * The browser reports `coords.accuracy` as a radius in metres at 95 %
 * confidence. A GPS chip answers with tens of metres; wifi trilateration with
 * hundreds; an IP lookup with tens of *kilometres* — and it is that last case
 * that people experience as "it picked a random city".
 */
export function describeAccuracy(accuracyM) {
  const value = Number(accuracyM);
  if (!Number.isFinite(value) || value <= 0) return { level: "unknown", label: "accuracy unknown", metres: null };
  if (value <= 50) return { level: "gps", label: `±${Math.round(value)} m — GPS`, metres: value };
  if (value <= FINE_ACCURACY_M) return { level: "fine", label: `±${Math.round(value)} m`, metres: value };
  if (value <= 2000) return { level: "coarse", label: `±${Math.round(value)} m — wifi`, metres: value };
  if (value < IP_ACCURACY_THRESHOLD_M) {
    return { level: "coarse", label: `±${(value / 1000).toFixed(1)} km`, metres: value };
  }
  return {
    level: "ip",
    label: `±${Math.round(value / 1000)} km — network estimate`,
    metres: value,
  };
}

/** True when a fix is too coarse to name a city honestly. */
export function isProbablyIpFix(accuracyM) {
  return describeAccuracy(accuracyM).level === "ip";
}
