/**
 * One place model for the whole app.
 *
 * Tempo used to think entirely in IANA zone ids. That works for a clock, but
 * not for a *person*: your city may have no zone of its own (Ahmedabad,
 * Manchester, Dallas), and two places in the same zone are still two places —
 * which is exactly why a watch in Guwahati and a watch in Delhi, both on
 * `Asia/Kolkata`, feel nothing alike. The sun is up almost an hour earlier in
 * the east of India than the clock admits.
 *
 * So a place is one of three kinds, all addressed by a small string id:
 *
 *   zone:Asia/Kolkata      a time zone's principal city (from tzdb)
 *   city:ahmedabad-in      a real city with its own coordinates
 *   geo:28.6139,77.209     an exact coordinate pair (a GPS fix)
 *
 * Every kind resolves to the same record — `{ id, zone, city, country, lat,
 * lon, … }` — so the clock board, the picker and the weather card can treat
 * them alike. The zone id still drives the *clock*; the coordinates drive the
 * *weather* and the *solar time*.
 *
 * Pure data + maths, no DOM: unit tested in tests/places.test.mjs.
 */

import { allCities, cityId, distanceKm, nearestCity, CITIES } from "./cities.js";
import { canonicalZone, countryNameFor, isValidZone, recordFor, supportedZones } from "./tz-places.js";

export const ZONE = "zone";
export const CITY = "city";
export const GEO = "geo";

export const ZONE_PREFIX = "zone:";
export const CITY_PREFIX = "city:";
export const GEO_PREFIX = "geo:";

/**
 * A handful of zones are named after their *country* rather than a city
 * (`Asia/Qatar`, `Europe/Malta`), which reads oddly on a clock. This maps them
 * to the city people actually say.
 */
export const ZONE_CITY_OVERRIDES = {
  "Asia/Qatar": "Doha",
  "Asia/Kuwait": "Kuwait City",
  "Asia/Bahrain": "Manama",
  "Asia/Brunei": "Bandar Seri Begawan",
  "Europe/Malta": "Valletta",
  "Europe/Andorra": "Andorra la Vella",
  "Europe/Vatican": "Vatican City",
  "Europe/Isle_of_Man": "Douglas",
  "Europe/Guernsey": "Saint Peter Port",
  "Europe/Jersey": "Saint Helier",
  "Europe/Gibraltar": "Gibraltar",
  "America/Costa_Rica": "San José",
  "America/Belize": "Belize City",
  "America/Guatemala": "Guatemala City",
  "America/Panama": "Panama City",
  "America/Jamaica": "Kingston",
  "America/Antigua": "Saint John's",
  "America/Dominica": "Roseau",
  "America/Grenada": "Saint George's",
  "America/St_Kitts": "Basseterre",
  "America/St_Lucia": "Castries",
  "America/St_Vincent": "Kingstown",
  "America/St_Barthelemy": "Gustavia",
  "America/Montserrat": "Plymouth",
  "America/Tortola": "Road Town",
  "America/St_Thomas": "Charlotte Amalie",
  "America/Lower_Princes": "Philipsburg",
  "America/Aruba": "Oranjestad",
  "America/Curacao": "Willemstad",
  "America/Cayman": "George Town",
  "America/Miquelon": "Saint-Pierre",
  "Atlantic/Bermuda": "Hamilton",
  "Atlantic/Faroe": "Tórshavn",
  "Atlantic/St_Helena": "Jamestown",
  "Atlantic/Cape_Verde": "Praia",
  "Indian/Mauritius": "Port Louis",
  "Indian/Maldives": "Malé",
  "Indian/Mahe": "Victoria",
  "Indian/Reunion": "Saint-Denis",
  "Indian/Mayotte": "Mamoudzou",
  "Indian/Comoro": "Moroni",
  "Indian/Cocos": "Cocos Islands",
  "Indian/Christmas": "Christmas Island",
  "Pacific/Fiji": "Suva",
  "Pacific/Tongatapu": "Nukuʻalofa",
  "Pacific/Palau": "Ngerulmud",
  "Pacific/Nauru": "Yaren",
  "Pacific/Niue": "Alofi",
  "Pacific/Wallis": "Mata-Utu",
  "Pacific/Easter": "Hanga Roa",
  "Pacific/Midway": "Midway Atoll",
  "Africa/Sao_Tome": "São Tomé",
  "Africa/Malabo": "Malabo",
  "Antarctica/McMurdo": "McMurdo Station",
  "Antarctica/Troll": "Troll Station",
};

const slug = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\u02b0-\u02ff\u2018\u2019]/g, "")   // glottal + curly apostrophes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalize = (value) => slug(value).replace(/\s+/g, " ");

/**
 * Lower-cased, diacritic-free haystack for a record. Built once and stored, so
 * that typing "sao paulo", "krakow" or "nukualofa" matches the accented name.
 */
function withSearch(record) {
  record.searchNormalized = normalize(record.search);
  return record;
}

/* -------------------------------------------------------------- id helpers */

export function zonePlaceId(zone) {
  return `${ZONE_PREFIX}${canonicalZone(zone)}`;
}

export function cityPlaceId(city, countryCode) {
  return `${CITY_PREFIX}${cityId(city, countryCode)}`;
}

export function geoPlaceId(lat, lon) {
  const round = (value) => Number(Number(value).toFixed(4));
  return `${GEO_PREFIX}${round(lat)},${round(lon)}`;
}

export function parsePlaceId(id) {
  const raw = String(id || "").trim();
  if (raw.startsWith(ZONE_PREFIX)) return { kind: ZONE, value: raw.slice(ZONE_PREFIX.length) };
  if (raw.startsWith(CITY_PREFIX)) return { kind: CITY, value: raw.slice(CITY_PREFIX.length) };
  if (raw.startsWith(GEO_PREFIX)) return { kind: GEO, value: raw.slice(GEO_PREFIX.length) };
  // Bare strings from older saves are always zone ids.
  return { kind: ZONE, value: raw };
}

/** "geo:28.61,77.20" -> { lat, lon }; anything else -> null. */
export function parseGeoValue(value) {
  const [lat, lon] = String(value || "").split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/* ------------------------------------------------------------- zone lookup */

const zoneRecords = new Map();

/** `@param {string} zone` an IANA id (canonical or legacy). */
export function zonePlace(zone) {
  const canonical = canonicalZone(zone);
  const key = `zone:${canonical}`;
  if (zoneRecords.has(key)) return zoneRecords.get(key);

  const base = recordFor(canonical);
  const city = ZONE_CITY_OVERRIDES[canonical] || base.city;
  const country = base.country || countryNameFor(base.countryCode);
  const record = {
    id: key,
    kind: ZONE,
    zone: canonical,
    legacyZone: base.legacy ? base.id : "",
    city,
    country,
    countryCode: base.countryCode,
    countries: base.countries,
    lat: base.lat,
    lon: base.lon,
    note: base.note || "",
    region: "",
    label: country ? `${country} · ${city}` : city,
    shortLabel: city,
    // A zone is one of many cities in its country, so say which country's
    // clock this is when the city alone could be ambiguous. Legacy ids
    // (`Asia/Calcutta`, `Europe/Kiev`, `Asia/Saigon`) are indexed too, so the
    // old spelling still finds the modern place.
    search: [
      city,
      country,
      ...base.countries.map((entry) => entry.name),
      ...base.countries.map((entry) => entry.code),
      canonical,
      canonical.replace(/_/g, " ").replace(/\//g, " "),
      base.note,
      ...base.aliases.map((alias) => alias.replace(/_/g, " ").replace(/\//g, " ")),
      ...base.aliases,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
  zoneRecords.set(key, withSearch(record));
  return record;
}

/* ------------------------------------------------------------- city lookup */

const cityRecords = new Map();

export function cityPlace(id) {
  const key = String(id || "").startsWith(CITY_PREFIX) ? String(id) : `${CITY_PREFIX}${id}`;
  if (cityRecords.has(key)) return cityRecords.get(key);
  const row = allCities().find((city) => city.id === key.slice(CITY_PREFIX.length));
  if (!row) return null;
  const country = countryNameFor(row.countryCode) || row.countryCode;
  const record = {
    id: key,
    kind: CITY,
    zone: canonicalZone(row.zone),
    legacyZone: "",
    city: row.city,
    country,
    countryCode: row.countryCode,
    countries: [{ code: row.countryCode, name: country }],
    lat: row.lat,
    lon: row.lon,
    note: "",
    region: row.region,
    label: `${country} · ${row.city}`,
    shortLabel: row.city,
    search: [row.city, country, row.countryCode, row.region, row.zone].filter(Boolean).join(" ").toLowerCase(),
  };
  cityRecords.set(key, withSearch(record));
  return record;
}

/* --------------------------------------------------------- geo (GPS) lookup */

const geoRecords = new Map();

/**
 * A raw coordinate pair. The zone comes from the nearest city in our
 * gazetteer (falling back to the nearest tzdb zone), and the label says how
 * far from that city the fix landed, so "Your location" is never a mystery.
 */
export function geoPlace(lat, lon, options = {}) {
  const id = geoPlaceId(lat, lon);
  if (geoRecords.has(id) && !options.fresh) return geoRecords.get(id);
  const near = nearestCity(lat, lon);
  const zone = near ? canonicalZone(near.zone) : nearestZone(lat, lon) || "UTC";
  const country = near ? countryNameFor(near.countryCode) : "";
  const distance = near ? Math.round(near.distanceKm) : null;
  const city =
    near && distance <= 25 ? near.city : near ? `near ${near.city}` : "Your location";
  const record = {
    id,
    kind: GEO,
    zone,
    legacyZone: "",
    city,
    country: country || "Your location",
    countryCode: near ? near.countryCode : "",
    countries: near ? [{ code: near.countryCode, name: country }] : [],
    lat: Number(Number(lat).toFixed(4)),
    lon: Number(Number(lon).toFixed(4)),
    note: near ? `${distance} km from ${near.city}` : "",
    gps: true,
    region: near ? near.region : "",
    label: near ? `${country} · ${city}` : "Your location",
    shortLabel: city,
    distanceKm: distance,
    search: [city, country, near ? near.city : "", "your location", "gps", "current"]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
  geoRecords.set(id, withSearch(record));
  return record;
}

/**
 * Nearest tzdb zone to a coordinate pair, by great-circle distance.
 * Used when no curated city is close enough to imply a zone.
 */
export function nearestZone(lat, lon) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
  let best = null;
  for (const zone of supportedZones()) {
    const record = zonePlace(zone);
    if (record.lat === null || record.lon === null) continue;
    const km = distanceKm(Number(lat), Number(lon), record.lat, record.lon);
    if (!best || km < best.km) best = { zone: record.zone, km };
  }
  return best ? best.zone : null;
}

/* ------------------------------------------------------------- main record */

/**
 * Resolve any place id — `zone:…`, `city:…`, `geo:…` or a bare zone id — to a
 * full record. Unknown input falls back to UTC rather than exploding, because
 * a clock that shows something beats a blank page.
 */
export function placeRecord(id) {
  const parsed = parsePlaceId(id);
  if (parsed.kind === CITY) {
    const found = cityPlace(parsed.value);
    if (found) return found;
    // A city id this build does not know (saved on a newer/older release) is
    // still shown, just without coordinates, rather than silently becoming UTC.
    return unknownPlace(id, parsed.value);
  }
  if (parsed.kind === GEO) {
    const coords = parseGeoValue(parsed.value);
    if (coords) return geoPlace(coords.lat, coords.lon);
  }
  if (!parsed.value) return zonePlace("UTC");
  return zonePlace(parsed.value);
}

const unknownCache = new Map();

/** A place id we cannot resolve: keep the id, label it, don't crash. */
function unknownPlace(id, value) {
  const key = String(id);
  if (unknownCache.has(key)) return unknownCache.get(key);
  const pretty = String(value || "")
    .replace(/^\w+:/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const record = {
    id: key,
    kind: CITY,
    zone: "UTC",
    legacyZone: "",
    city: pretty || "Unknown place",
    country: "",
    countryCode: "",
    countries: [],
    lat: null,
    lon: null,
    note: "",
    region: "",
    label: pretty || "Unknown place",
    shortLabel: pretty || "Unknown place",
    unknown: true,
    search: [pretty, value].filter(Boolean).join(" ").toLowerCase(),
  };
  unknownCache.set(key, withSearch(record));
  return record;
}

export function placeLabel(id) {
  return placeRecord(id).label;
}

export function placeCoords(id) {
  const record = placeRecord(id);
  return Number.isFinite(record.lat) && Number.isFinite(record.lon) ? { lat: record.lat, lon: record.lon } : null;
}

/** The zone to hand to `Intl` for a place id — always a real IANA id. */
export function placeZone(id) {
  const record = placeRecord(id);
  return isValidZone(record.zone) ? record.zone : "UTC";
}

/* ------------------------------------------------------------ merged index */

let mergedCache = null;

/**
 * Every place the picker can offer: one entry per time zone, plus every
 * curated city that is not already that zone's own city. (So Delhi and
 * Ahmedabad appear next to `Asia/Kolkata`, while Toronto does not appear
 * twice next to `America/Toronto`.)
 */
export function allPlaceRecords() {
  if (mergedCache) return mergedCache;
  const zones = supportedZones().map((zone) => zonePlace(zone));
  const seen = new Set(
    zones.map((record) => `${normalize(record.city)}|${String(record.countryCode || "").toLowerCase()}`)
  );
  const cities = [];
  for (const row of allCities()) {
    const key = `${normalize(row.city)}|${String(row.countryCode).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const record = cityPlace(row.id);
    if (record) cities.push(record);
  }
  mergedCache = [...zones, ...cities];
  return mergedCache;
}

/**
 * Places worth offering first: a spread of continents, mixing real cities
 * (which carry their own coordinates) with zone capitals.
 */
export const POPULAR_PLACES = [
  "city:delhi-in",
  "city:mumbai-in",
  "zone:Asia/Kathmandu",
  "zone:Asia/Dubai",
  "zone:Europe/London",
  "zone:Europe/Paris",
  "zone:Europe/Berlin",
  "zone:Africa/Johannesburg",
  "zone:America/New_York",
  "zone:America/Los_Angeles",
  "zone:America/Toronto",
  "zone:America/Sao_Paulo",
  "zone:Asia/Singapore",
  "zone:Asia/Tokyo",
  "zone:Asia/Shanghai",
  "zone:Australia/Sydney",
  "zone:Pacific/Auckland",
].map((id) => placeRecord(id).id);

/** The board a first-time visitor sees. */
export const DEFAULT_BOARD = [
  "city:delhi-in",
  "zone:Europe/London",
  "zone:America/New_York",
  "zone:Asia/Tokyo",
  "zone:Australia/Sydney",
  "zone:Asia/Dubai",
].map((id) => placeRecord(id).id);

/* ----------------------------------------------------------------- search  */

/**
 * Search across cities, countries, region names, zone ids and tzdb notes.
 * "delhi", "india", "IN", "kolkata" and "calcutta" all land somewhere useful.
 */
export function searchPlacesAny(query, options = {}) {
  const pool = options.pool || allPlaceRecords();
  const tokens = normalize(query).split(" ").filter(Boolean);
  if (!tokens.length) return pool;

  const scored = [];
  for (const record of pool) {
    const haystack = record.searchNormalized || normalize(record.search);
    if (!tokens.every((token) => haystack.includes(token))) continue;

    const city = normalize(record.city);
    const country = normalize(record.country);
    // Word-anchored prefix: "india" must not hoist Indianapolis above India.
    const startsWithWord = (text, token) => text === token || text.split(" ").some((word) => word.startsWith(token));
    let score = 0;
    for (const token of tokens) {
      if (city === token) score += 40;
      else if (startsWithWord(city, token)) score += 12;
      else if (city.includes(token)) score += 6;
      if (country === token) score += 18;
      else if (startsWithWord(country, token)) score += 10;
      else if (country.includes(token)) score += 5;
      if (record.zone.toLowerCase().includes(token)) score += 3;
      // An exact country code ("IN", "NP") is a deliberate query: trust it.
      if (record.countryCode && record.countryCode.toLowerCase() === token) score += 25;
    }
    // Real cities sort above bare zones when both match equally well.
    if (record.kind === CITY) score += 2;
    scored.push({ record, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.record.label.localeCompare(b.record.label);
  });
  return scored.map((item) => item.record);
}

/** Country -> places, alphabetical, "Other places" last (as before). */
let groupCache = null;
export function placeGroups() {
  if (groupCache) return groupCache;
  const others = "Other places";
  const groups = new Map();
  for (const record of allPlaceRecords()) {
    const key = record.country || others;
    if (!groups.has(key)) groups.set(key, { country: key, code: record.countryCode, entries: [] });
    groups.get(key).entries.push(record);
  }
  const list = [...groups.values()];
  for (const group of list) {
    group.entries.sort((a, b) => a.label.localeCompare(b.label));
    group.cities = group.entries.map((entry) => entry.city).join(", ");
  }
  list.sort((a, b) => {
    if (a.country === others) return 1;
    if (b.country === others) return -1;
    return a.country.localeCompare(b.country);
  });
  groupCache = list;
  return list;
}

/* ------------------------------------------------------------ solar time  */

const MINUTES_PER_DEGREE = 4; // 24 h / 360°

const offsetFormatters = new Map();
function partsFor(date, zone) {
  const key = zone;
  if (!offsetFormatters.has(key)) {
    offsetFormatters.set(
      key,
      new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
    );
  }
  const parts = {};
  for (const item of offsetFormatters.get(key).formatToParts(date)) {
    if (item.type !== "literal") parts[item.type] = item.value;
  }
  return parts;
}

/** Zone offset from UTC, in minutes, at a given instant (DST aware). */
export function zoneOffsetMinutes(zone, date = new Date()) {
  try {
    const parts = partsFor(date, zone);
    const asUTC = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    const utcNow = Math.floor(date.getTime() / 1000) * 1000;
    return Math.round((asUTC - utcNow) / 60000);
  } catch (_) {
    return 0;
  }
}

export function formatOffset(minutes) {
  const total = Math.round(minutes);
  const sign = total < 0 ? "-" : "+";
  const abs = Math.abs(total);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `UTC${sign}${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** "UTC+05:30" for a zone at an instant. */
export function zoneOffsetLabel(zone, date = new Date()) {
  return formatOffset(zoneOffsetMinutes(zone, date));
}

/**
 * Local mean (solar) time offset for a longitude: the offset a place would
 * keep if clocks followed the sun instead of a political border.
 */
export function solarOffsetMinutes(lon) {
  return Number(lon) * MINUTES_PER_DEGREE;
}

/**
 * How far a place's clock has drifted from its own sun, in minutes.
 * Positive = the clock runs ahead of the sun (late sunrise, late sunset).
 * `Asia/Kolkata` covers 68°E–97°E, so this is −48 min in Guwahati and
 * +55 min in Ahmedabad: the "one region is 15 minutes earlier" effect.
 */
export function clockVsSunMinutes(record, date = new Date()) {
  if (!record || !Number.isFinite(record.lon)) return null;
  return Math.round(zoneOffsetMinutes(record.zone, date) - solarOffsetMinutes(record.lon));
}

/** The sun's own clock at a longitude: "11:42". */
export function solarTimeLabel(lon, date = new Date()) {
  if (!Number.isFinite(Number(lon))) return "—";
  const shifted = new Date(date.getTime() + solarOffsetMinutes(lon) * 60000);
  return `${String(shifted.getUTCHours()).padStart(2, "0")}:${String(shifted.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * One readable sentence about the sun, e.g.
 * "Sun time 11:42 · clock 42 min ahead of the sun".
 */
export function sunNote(record, date = new Date()) {
  if (!record || !Number.isFinite(record.lon)) return "";
  const drift = clockVsSunMinutes(record, date);
  const time = solarTimeLabel(record.lon, date);
  if (drift === null) return "";
  if (Math.abs(drift) < 3) return `Sun time ${time} · clock and sun agree here`;
  const amount = Math.abs(drift);
  const direction = drift > 0 ? "ahead of" : "behind";
  return `Sun time ${time} · clock ${amount} min ${direction} the sun`;
}
