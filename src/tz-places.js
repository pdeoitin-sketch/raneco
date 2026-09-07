/**
 * Human names for IANA time zones.
 *
 * Browsers (and their bundled ICU snapshots) disagree about which id is
 * "current": older ones report `Asia/Katmandu`, `Asia/Calcutta`, `Europe/Kiev`,
 * `Asia/Saigon` or `Asia/Rangoon`. This module folds every id onto the modern
 * canonical zone using the IANA `backward` links, then labels it with the real
 * country from `zone1970.tab` / `zone.tab` and a localized country name from
 * `Intl.DisplayNames`, so the UI always reads "Nepal · Kathmandu".
 *
 * It is deliberately free of DOM references so it can be unit tested in plain
 * Node (see tests/tz-places.test.mjs).
 */

import { TZ_ROWS, TZ_LINKS, TZ_DATA_VERSION } from "./tz-places.generated.js";

/* ------------------------------------------------------------------ tables */

/** canonical zone id -> { zone, countries, lat, lon, note, order } */
const table = new Map();
TZ_ROWS.forEach((row, index) => {
  const [zone, countries, lat, lon, note] = row;
  table.set(zone, {
    zone,
    countries: countries ? countries.split(",") : [],
    lat: typeof lat === "number" ? lat : null,
    lon: typeof lon === "number" ? lon : null,
    note: note || "",
    order: index,
  });
});

/** canonical zone id -> legacy ids that point at it (Asia/Kolkata <- Calcutta) */
const aliasesByZone = new Map();
for (const [alias, canonical] of Object.entries(TZ_LINKS)) {
  if (!aliasesByZone.has(canonical)) aliasesByZone.set(canonical, []);
  aliasesByZone.get(canonical).push(alias);
}

const SPECIAL_NAMES = {
  UTC: "UTC",
  "Etc/UTC": "UTC",
  "Etc/GMT": "GMT",
  "Etc/Greenwich": "Greenwich",
  "Etc/Universal": "UTC",
  "Etc/Zulu": "UTC",
  "Etc/Unknown": "Unknown",
};

// Cities whose tzdb segment is not the name people use in English: the id
// carries "Saigon" era spellings, missing words and stripped diacritics.
const CITY_OVERRIDES = {
  "Asia/Ho_Chi_Minh": "Ho Chi Minh City",
  "America/Sao_Paulo": "São Paulo",
  "America/Shiprock": "Denver",
  "Arctic/Longyearbyen": "Longyearbyen",
  "Antarctica/DumontDUrville": "Dumont d’Urville",
};

/* ------------------------------------------------------------- localisation */

function browserLocales() {
  const stored = typeof navigator === "undefined" ? [] : [navigator.language, ...(navigator.languages || [])];
  const list = stored.filter(Boolean);
  return list.length ? list : ["en"];
}

function createDisplayNames(type) {
  if (typeof Intl === "undefined" || typeof Intl.DisplayNames !== "function") return null;
  try {
    return new Intl.DisplayNames(browserLocales(), { type });
  } catch (_) {
    try {
      return new Intl.DisplayNames(["en"], { type });
    } catch (__) {
      return null;
    }
  }
}

const regionNames = createDisplayNames("region");
const collator = (() => {
  try {
    return new Intl.Collator(browserLocales(), { sensitivity: "base", numeric: true });
  } catch (_) {
    return { compare: (a, b) => String(a).localeCompare(String(b)) };
  }
})();

export const PLACE_NAME_SOURCE = TZ_DATA_VERSION;

/**
 * CLDR sometimes hands back a long-form country name with an alternate in
 * parentheses ("Myanmar (Burma)", "Iran (Islamic Republic of)"). The clock
 * labels read better without it, and the meaning is unchanged.
 */
function simplifyRegionName(name) {
  return String(name)
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Localised country name for an ISO 3166 alpha-2 code, e.g. "NP" -> "Nepal". */
export function countryNameFor(code) {
  if (!code) return "";
  if (regionNames) {
    try {
      const name = regionNames.of(code);
      if (name && name.toUpperCase() !== code.toUpperCase()) return simplifyRegionName(name);
    } catch (_) {
      // Unknown / retired code: fall through to the raw code.
    }
  }
  return code;
}

/* ------------------------------------------------------- zone normalisation */

const validityCache = new Map();

/** Can this engine format a date in `zone`? (aliases included, so both work) */
export function isValidZone(zone) {
  if (typeof zone !== "string" || !zone) return false;
  if (validityCache.has(zone)) return validityCache.get(zone);
  let ok = false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date(0));
    ok = true;
  } catch (_) {
    ok = false;
  }
  validityCache.set(zone, ok);
  return ok;
}

/** Legacy or unusual id -> modern canonical zone id when we know the mapping. */
export function canonicalZone(zone) {
  const raw = typeof zone === "string" ? zone.trim() : "";
  if (!raw) return raw;
  if (table.has(raw)) return raw;
  const linked = TZ_LINKS[raw];
  if (linked && table.has(linked)) return linked;
  // Some engines report a differently cased or "Etc/"-prefixed variant.
  const lowered = raw.toLowerCase();
  for (const known of table.keys()) {
    if (known.toLowerCase() === lowered) return known;
  }
  return raw;
}

export function prettifyZoneSegment(zone) {
  const segment = String(zone).split("/").pop() || String(zone);
  return segment.replace(/_/g, " ").replace(/\b(\d)(\d\d)(\D|$)/g, "$1:$2");
}

/**
 * Everything the UI needs to know about one zone id.
 *
 * `id`      the value to actually pass to Intl (canonical when supported)
 * `zone`    the modern canonical IANA id
 * `city`    Kathmandu
 * `country` Nepal (localized)
 * `label`   "Nepal · Kathmandu"
 */
const recordCache = new Map();
export function recordFor(zone) {
  if (recordCache.has(zone)) return recordCache.get(zone);
  const requested = typeof zone === "string" && zone.trim() ? zone.trim() : "UTC";
  const canonical = canonicalZone(requested);
  const row = table.get(canonical) || table.get(requested) || null;
  const id = isValidZone(canonical) ? canonical : requested;

  const city =
    SPECIAL_NAMES[canonical] ||
    CITY_OVERRIDES[canonical] ||
    (canonical === "UTC" ? "UTC" : prettifyZoneSegment(canonical));
  const codes = row ? row.countries : [];
  const country = codes.length ? countryNameFor(codes[0]) : "";
  const legacy = requested !== canonical;
  const aliases = (aliasesByZone.get(canonical) || []).concat(legacy ? [requested] : []);

  const record = {
    id,
    zone: canonical,
    city,
    country,
    countryCode: codes[0] || "",
    countries: codes.map((code) => ({ code, name: countryNameFor(code) })),
    note: row ? row.note : "",
    lat: row ? row.lat : null,
    lon: row ? row.lon : null,
    order: row ? row.order : Number.MAX_SAFE_INTEGER,
    legacy,
    aliases: [...new Set(aliases)],
    label: country ? `${country} · ${city}` : city,
    search: [
      city,
      country,
      ...codes,
      ...codes.map((code) => countryNameFor(code)),
      canonical,
      canonical.replace(/_/g, " ").replace(/\//g, " "),
      row ? row.note : "",
      ...(aliasesByZone.get(canonical) || []).map((alias) => alias.replace(/_/g, " ")),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
  recordCache.set(zone, record);
  return record;
}

export function placeLabel(zone) {
  return recordFor(zone).label;
}

/** Coordinates of the zone's principal location — used as the weather fallback. */
export function coordsFor(zone) {
  const record = recordFor(zone);
  return record.lat === null || record.lon === null ? null : { lat: record.lat, lon: record.lon };
}

/* ------------------------------------------------------------ picker index */

export const SUGGESTED_ZONES = [
  "America/New_York",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
].map((zone) => canonicalZone(zone));

/** Every zone this browser can use, canonicalised and de-duplicated. */
export function supportedZones() {
  let engineZones = [];
  try {
    if (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function") {
      engineZones = Intl.supportedValuesOf("timeZone");
    }
  } catch (_) {
    engineZones = [];
  }

  const deviceZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (_) {
      return "";
    }
  })();

  const seen = new Set();
  const zones = [];
  const push = (zone) => {
    const record = recordFor(zone);
    if (seen.has(record.zone) || !isValidZone(record.id)) return;
    seen.add(record.zone);
    zones.push(record.id);
  };

  // Modern canonical ids first, so a legacy id never shadows the current name.
  for (const zone of table.keys()) push(zone);
  for (const zone of engineZones) push(zone);
  if (deviceZone) push(deviceZone);
  // Engine ids we could not describe at all still belong in the list.
  for (const zone of engineZones) {
    if (!seen.has(canonicalZone(zone)) && isValidZone(zone)) {
      seen.add(canonicalZone(zone));
      zones.push(zone);
    }
  }
  return zones;
}

/**
 * Country -> cities index for the picker. Countries are alphabetical in the
 * reader's language; cities keep tzdb's own order (most populous first).
 */
let groupCache = null;
export function zoneGroups() {
  if (groupCache) return groupCache;
  const others = "Other places";
  const groups = new Map();
  for (const zone of supportedZones()) {
    const record = recordFor(zone);
    const key = record.country || others;
    if (!groups.has(key)) groups.set(key, { country: key, code: record.countryCode, entries: [] });
    groups.get(key).entries.push(record);
  }
  const list = [...groups.values()];
  for (const group of list) {
    group.entries.sort((a, b) => (a.order === b.order ? collator.compare(a.city, b.city) : a.order - b.order));
    group.cities = group.entries.map((entry) => entry.city).join(", ");
  }
  list.sort((a, b) => {
    if (a.country === others) return 1;
    if (b.country === others) return -1;
    return collator.compare(a.country, b.country);
  });
  groupCache = list;
  return list;
}

export function allPlaces() {
  return zoneGroups().flatMap((group) => group.entries);
}

const normalize = (value) =>
  String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();

/**
 * Search over city, country, zone id and tzdb's own annotations.
 * "calcutta", "kolkata", "IN", "Asia/Kolkata" and "india time" all match.
 */
export function searchPlaces(query, options = {}) {
  const pool = options.zones
    ? options.zones.map((zone) => recordFor(zone))
    : allPlaces().filter((record) => !options.filter || options.filter(record));
  const tokens = normalize(query).split(" ").filter(Boolean);
  if (!tokens.length) return pool;

  const scored = [];
  for (const record of pool) {
    const city = normalize(record.city);
    const country = normalize(record.country);
    const id = normalize(record.zone);
    const haystack = `${city} ${country} ${id} ${normalize(record.search)}`;
    if (!tokens.every((token) => haystack.includes(token))) continue;

    let score = 0;
    for (const token of tokens) {
      if (city.startsWith(token)) score += 12;
      else if (city.includes(token)) score += 8;
      if (country.startsWith(token)) score += 6;
      else if (country.includes(token)) score += 3;
      if (id.includes(token)) score += 2;
      if (record.note && normalize(record.note).includes(token)) score += 1;
    }
    scored.push({ record, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.record.order !== b.record.order) return a.record.order - b.record.order;
    return collator.compare(a.record.city, b.record.city);
  });
  return scored.map((item) => item.record);
}

/** Flat, grouped rendering list: `[{type:"group"}, {type:"place", record}]`. */
export function pickerRows(query = "", options = {}) {
  const trimmed = normalize(query);
  if (!trimmed) {
    const groups = options.filter
      ? zoneGroups()
          .map((group) => ({ ...group, entries: group.entries.filter(options.filter) }))
          .filter((group) => group.entries.length)
      : zoneGroups();
    return groups.flatMap((group) => [
      { type: "group", key: group.country, country: group.country, code: group.code, count: group.entries.length },
      ...group.entries.map((record) => ({ type: "place", record, country: group.country })),
    ]);
  }
  const matches = searchPlaces(query, options);
  if (!matches.length) return [];
  return [
    { type: "group", key: "Results", country: "Matching places", code: "", count: matches.length },
    ...matches.map((record) => ({ type: "place", record, country: record.country })),
  ];
}
