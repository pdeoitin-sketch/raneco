/**
 * Time standards — the clocks that are named rather than placed.
 *
 * A world clock answers "what time is it in Delhi?". It cannot answer "what
 * is IST?", and people ask that constantly: a meeting invite says 14:00 UTC,
 * a server log is in GMT, a colleague writes "09:00 GST", a flight is booked
 * in JST. Those are **time standards**, not cities — they are defined by an
 * offset and a name, and they keep that offset whatever the calendar says.
 *
 * So each standard here is a flat record:
 *
 *   { id, abbr, name, offsetMinutes, region, note, zone }
 *
 *   • `abbr` is the short form people actually type — UTC, IST, GST, JST.
 *   • `name` is the full form, spelled out, because "IST" alone is ambiguous
 *     (India, Israel and Ireland all claim it — hence separate ids).
 *   • `offsetMinutes` is fixed. A standard *is* its offset: EST is −05:00 all
 *     year, and the summer clock in New York is a different standard (EDT),
 *     not a shifted EST. That is why nothing here consults a DST table.
 *   • `zone` is a representative IANA zone, only so the UI can say where the
 *     standard is kept and hand the reader a real city.
 *
 * Pure data and arithmetic, no DOM: unit tested in tests/time-standards.test.mjs.
 */

/** The groups the picker shows, in the order it shows them. */
export const STANDARD_REGIONS = [
  { id: "universal", label: "Universal", note: "The clocks the rest of the world is measured against." },
  { id: "europe", label: "Europe", note: "Western, central and eastern Europe, winter and summer." },
  { id: "middle-east", label: "Middle East", note: "The Gulf, the Levant, Türkiye and Iran." },
  { id: "asia", label: "Asia", note: "From Karachi to Tokyo, including the half-hour and quarter-hour clocks." },
  { id: "africa", label: "Africa", note: "West, central, east and southern Africa." },
  { id: "americas", label: "Americas", note: "North America's standard and daylight clocks." },
  { id: "oceania", label: "Oceania", note: "Australia and New Zealand, standard and daylight." },
];

const h = (hours, minutes = 0) => Math.round(hours * 60 + Math.sign(hours || 1) * minutes);

/**
 * Every standard Tempo knows. Ids are unique even where abbreviations are
 * not: `ist-in` and `ist-il` are both written "IST" by somebody.
 */
export const TIME_STANDARDS = [
  /* ----------------------------------------------------------- universal */
  {
    id: "utc",
    abbr: "UTC",
    name: "Coordinated Universal Time",
    offsetMinutes: 0,
    region: "universal",
    zone: "UTC",
    note: "The reference every other clock is an offset from. Written Z in timestamps.",
  },
  {
    id: "gmt",
    abbr: "GMT",
    name: "Greenwich Mean Time",
    offsetMinutes: 0,
    region: "universal",
    zone: "Europe/London",
    note: "UTC's older sibling: the same instant, measured at the Greenwich meridian.",
  },
  {
    id: "zulu",
    abbr: "Z",
    name: "Zulu Time",
    offsetMinutes: 0,
    region: "universal",
    zone: "UTC",
    note: "Aviation and the military say Zulu for what everyone else calls UTC.",
  },

  /* -------------------------------------------------------------- europe */
  { id: "wet", abbr: "WET", name: "Western European Time", offsetMinutes: 0, region: "europe", zone: "Europe/Lisbon", note: "Portugal, Ireland and the Canaries in winter." },
  { id: "bst", abbr: "BST", name: "British Summer Time", offsetMinutes: h(1), region: "europe", zone: "Europe/London", note: "The United Kingdom from late March to late October." },
  { id: "cet", abbr: "CET", name: "Central European Time", offsetMinutes: h(1), region: "europe", zone: "Europe/Paris", note: "Paris, Berlin, Rome and Madrid in winter." },
  { id: "cest", abbr: "CEST", name: "Central European Summer Time", offsetMinutes: h(2), region: "europe", zone: "Europe/Paris", note: "The same countries from late March to late October." },
  { id: "eet", abbr: "EET", name: "Eastern European Time", offsetMinutes: h(2), region: "europe", zone: "Europe/Athens", note: "Greece, Finland, Romania and Ukraine in winter." },
  { id: "eest", abbr: "EEST", name: "Eastern European Summer Time", offsetMinutes: h(3), region: "europe", zone: "Europe/Athens", note: "Eastern Europe's summer clock." },
  { id: "msk", abbr: "MSK", name: "Moscow Standard Time", offsetMinutes: h(3), region: "europe", zone: "Europe/Moscow", note: "Russia west of the Urals — no summer change since 2014." },

  /* --------------------------------------------------------- middle east */
  { id: "trt", abbr: "TRT", name: "Türkiye Time", offsetMinutes: h(3), region: "middle-east", zone: "Europe/Istanbul", note: "Istanbul and Ankara, held at +03:00 all year since 2016." },
  { id: "ast-sa", abbr: "AST", name: "Arabia Standard Time", offsetMinutes: h(3), region: "middle-east", zone: "Asia/Riyadh", note: "Saudi Arabia, Iraq, Kuwait, Bahrain, Qatar and Yemen." },
  { id: "ist-il", abbr: "IST", name: "Israel Standard Time", offsetMinutes: h(2), region: "middle-east", zone: "Asia/Jerusalem", note: "Israel in winter — one of three standards written IST." },
  { id: "irst", abbr: "IRST", name: "Iran Standard Time", offsetMinutes: h(3, 30), region: "middle-east", zone: "Asia/Tehran", note: "Tehran, on a half-hour offset, with no summer change since 2022." },
  { id: "gst", abbr: "GST", name: "Gulf Standard Time", offsetMinutes: h(4), region: "middle-east", zone: "Asia/Dubai", note: "The United Arab Emirates and Oman." },

  /* ---------------------------------------------------------------- asia */
  { id: "azt", abbr: "AZT", name: "Azerbaijan Time", offsetMinutes: h(4), region: "asia", zone: "Asia/Baku", note: "Baku and the Caucasus." },
  { id: "aft", abbr: "AFT", name: "Afghanistan Time", offsetMinutes: h(4, 30), region: "asia", zone: "Asia/Kabul", note: "Kabul, half an hour off its neighbours on either side." },
  { id: "pkt", abbr: "PKT", name: "Pakistan Standard Time", offsetMinutes: h(5), region: "asia", zone: "Asia/Karachi", note: "Karachi, Lahore and Islamabad." },
  { id: "ist-in", abbr: "IST", name: "India Standard Time", offsetMinutes: h(5, 30), region: "asia", zone: "Asia/Kolkata", note: "One clock for the whole subcontinent — 29 degrees of longitude wide." },
  { id: "npt", abbr: "NPT", name: "Nepal Time", offsetMinutes: h(5, 45), region: "asia", zone: "Asia/Kathmandu", note: "The only quarter-hour national clock on earth." },
  { id: "bst-bd", abbr: "BST", name: "Bangladesh Standard Time", offsetMinutes: h(6), region: "asia", zone: "Asia/Dhaka", note: "Dhaka — the other BST, and nothing to do with Britain." },
  { id: "mmt", abbr: "MMT", name: "Myanmar Time", offsetMinutes: h(6, 30), region: "asia", zone: "Asia/Yangon", note: "Yangon, on a half-hour offset." },
  { id: "ict", abbr: "ICT", name: "Indochina Time", offsetMinutes: h(7), region: "asia", zone: "Asia/Bangkok", note: "Thailand, Vietnam, Cambodia and Laos." },
  { id: "wib", abbr: "WIB", name: "Western Indonesian Time", offsetMinutes: h(7), region: "asia", zone: "Asia/Jakarta", note: "Jakarta and Sumatra." },
  { id: "cst-cn", abbr: "CST", name: "China Standard Time", offsetMinutes: h(8), region: "asia", zone: "Asia/Shanghai", note: "One clock from Kashgar to Shanghai — and not America's CST." },
  { id: "sgt", abbr: "SGT", name: "Singapore Time", offsetMinutes: h(8), region: "asia", zone: "Asia/Singapore", note: "Singapore, Malaysia and Brunei in practice." },
  { id: "hkt", abbr: "HKT", name: "Hong Kong Time", offsetMinutes: h(8), region: "asia", zone: "Asia/Hong_Kong", note: "Hong Kong and Macau." },
  { id: "jst", abbr: "JST", name: "Japan Standard Time", offsetMinutes: h(9), region: "asia", zone: "Asia/Tokyo", note: "Japan, all of it, with no summer change." },
  { id: "kst", abbr: "KST", name: "Korea Standard Time", offsetMinutes: h(9), region: "asia", zone: "Asia/Seoul", note: "Seoul, sharing Japan's offset." },

  /* -------------------------------------------------------------- africa */
  { id: "wat", abbr: "WAT", name: "West Africa Time", offsetMinutes: h(1), region: "africa", zone: "Africa/Lagos", note: "Lagos, Kinshasa and Algiers." },
  { id: "cat", abbr: "CAT", name: "Central Africa Time", offsetMinutes: h(2), region: "africa", zone: "Africa/Harare", note: "Harare, Lusaka and Khartoum." },
  { id: "sast", abbr: "SAST", name: "South Africa Standard Time", offsetMinutes: h(2), region: "africa", zone: "Africa/Johannesburg", note: "Johannesburg and Cape Town." },
  { id: "eat", abbr: "EAT", name: "East Africa Time", offsetMinutes: h(3), region: "africa", zone: "Africa/Nairobi", note: "Nairobi, Addis Ababa and Dar es Salaam." },

  /* ------------------------------------------------------------ americas */
  { id: "nst", abbr: "NST", name: "Newfoundland Standard Time", offsetMinutes: h(-3, 30), region: "americas", zone: "America/St_Johns", note: "St John's — North America's only half-hour clock." },
  { id: "ast-ca", abbr: "AST", name: "Atlantic Standard Time", offsetMinutes: h(-4), region: "americas", zone: "America/Halifax", note: "Halifax and the Caribbean — not Arabia's AST." },
  { id: "est", abbr: "EST", name: "Eastern Standard Time", offsetMinutes: h(-5), region: "americas", zone: "America/New_York", note: "New York and Toronto in winter." },
  { id: "edt", abbr: "EDT", name: "Eastern Daylight Time", offsetMinutes: h(-4), region: "americas", zone: "America/New_York", note: "The same cities from March to November." },
  { id: "cst-us", abbr: "CST", name: "Central Standard Time", offsetMinutes: h(-6), region: "americas", zone: "America/Chicago", note: "Chicago and Mexico City in winter." },
  { id: "cdt", abbr: "CDT", name: "Central Daylight Time", offsetMinutes: h(-5), region: "americas", zone: "America/Chicago", note: "Chicago's summer clock." },
  { id: "mst", abbr: "MST", name: "Mountain Standard Time", offsetMinutes: h(-7), region: "americas", zone: "America/Denver", note: "Denver in winter — and Phoenix all year." },
  { id: "mdt", abbr: "MDT", name: "Mountain Daylight Time", offsetMinutes: h(-6), region: "americas", zone: "America/Denver", note: "Denver's summer clock." },
  { id: "pst", abbr: "PST", name: "Pacific Standard Time", offsetMinutes: h(-8), region: "americas", zone: "America/Los_Angeles", note: "Los Angeles and Vancouver in winter." },
  { id: "pdt", abbr: "PDT", name: "Pacific Daylight Time", offsetMinutes: h(-7), region: "americas", zone: "America/Los_Angeles", note: "The west coast from March to November." },
  { id: "akst", abbr: "AKST", name: "Alaska Standard Time", offsetMinutes: h(-9), region: "americas", zone: "America/Anchorage", note: "Anchorage in winter." },
  { id: "hst", abbr: "HST", name: "Hawaii–Aleutian Standard Time", offsetMinutes: h(-10), region: "americas", zone: "Pacific/Honolulu", note: "Honolulu, which never changes its clocks." },

  /* ------------------------------------------------------------- oceania */
  { id: "awst", abbr: "AWST", name: "Australian Western Standard Time", offsetMinutes: h(8), region: "oceania", zone: "Australia/Perth", note: "Perth, with no summer change." },
  { id: "acst", abbr: "ACST", name: "Australian Central Standard Time", offsetMinutes: h(9, 30), region: "oceania", zone: "Australia/Adelaide", note: "Adelaide and Darwin, half an hour behind the east." },
  { id: "aest", abbr: "AEST", name: "Australian Eastern Standard Time", offsetMinutes: h(10), region: "oceania", zone: "Australia/Sydney", note: "Sydney, Melbourne and Brisbane in winter." },
  { id: "aedt", abbr: "AEDT", name: "Australian Eastern Daylight Time", offsetMinutes: h(11), region: "oceania", zone: "Australia/Sydney", note: "Sydney and Melbourne in summer — Brisbane stays on AEST." },
  { id: "nzst", abbr: "NZST", name: "New Zealand Standard Time", offsetMinutes: h(12), region: "oceania", zone: "Pacific/Auckland", note: "Auckland in winter." },
  { id: "nzdt", abbr: "NZDT", name: "New Zealand Daylight Time", offsetMinutes: h(13), region: "oceania", zone: "Pacific/Auckland", note: "Auckland in summer — among the first clocks into a new day." },
];

export const STANDARD_IDS = TIME_STANDARDS.map((standard) => standard.id);

/** The standards shown before the reader picks a region. */
export const DEFAULT_STANDARDS = ["utc", "gmt", "cet", "ast-sa", "gst", "ist-in", "cst-cn", "jst", "est", "pst"];

export function findStandard(id) {
  const key = String(id || "").toLowerCase();
  return TIME_STANDARDS.find((standard) => standard.id === key) || null;
}

/**
 * Look a standard up the way a person types it: "utc", "IST", "japan",
 * "gulf standard". Ambiguous abbreviations return the first match in list
 * order, which is why `searchStandards` exists for anything that matters.
 */
export function standardByAbbr(abbr) {
  const key = String(abbr || "").trim().toUpperCase();
  return TIME_STANDARDS.find((standard) => standard.abbr === key) || null;
}

export function standardsInRegion(region) {
  return TIME_STANDARDS.filter((standard) => standard.region === region);
}

/** Every region with its standards attached, in display order. */
export function standardGroups() {
  return STANDARD_REGIONS.map((region) => ({ ...region, standards: standardsInRegion(region.id) }));
}

/** Free-text search over the short form, the full form and the note. */
export function searchStandards(query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return [...TIME_STANDARDS];
  return TIME_STANDARDS.filter((standard) =>
    `${standard.abbr} ${standard.name} ${standard.zone} ${standard.note}`.toLowerCase().includes(needle)
  );
}

/** "UTC+05:45", "UTC−08:00", "UTC" — the sign is a real minus, not a hyphen. */
export function standardOffsetLabel(offsetMinutes) {
  const total = Math.round(Number(offsetMinutes) || 0);
  if (total === 0) return "UTC";
  const sign = total < 0 ? "−" : "+";
  const abs = Math.abs(total);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/**
 * The wall clock a standard is showing at an instant.
 *
 * @returns {{hour: number, minute: number, second: number, hour12: number,
 *            period: "AM"|"PM", time24: string, time12: string, dayShift: -1|0|1}}
 *          `dayShift` is the standard's date relative to UTC's date, which is
 *          how a card can say "tomorrow already" without a second formatter.
 */
export function standardClock(standard, date = new Date()) {
  const offset = Number(standard && standard.offsetMinutes) || 0;
  const shifted = new Date(date.getTime() + offset * 60000);
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  const second = shifted.getUTCSeconds();
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const pad = (value) => String(value).padStart(2, "0");
  const utcDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const localDay = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return {
    hour,
    minute,
    second,
    hour12,
    period: hour < 12 ? "AM" : "PM",
    time24: `${pad(hour)}:${pad(minute)}`,
    time12: `${hour12}:${pad(minute)}`,
    dayShift: Math.sign(Math.round((localDay - utcDay) / 86400000)),
  };
}

/**
 * How far a standard sits from a reference offset, spelled the way a person
 * would say it: "+5h 45m", "−3h", "same time". Used for the small line under
 * a clock, where the reference is the reader's own home place.
 */
export function offsetDifferenceLabel(standardMinutes, referenceMinutes = 0) {
  const delta = Math.round((Number(standardMinutes) || 0) - (Number(referenceMinutes) || 0));
  if (delta === 0) return "same time";
  const sign = delta < 0 ? "−" : "+";
  const abs = Math.abs(delta);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  if (!hours) return `${sign}${minutes}m`;
  if (!minutes) return `${sign}${hours}h`;
  return `${sign}${hours}h ${minutes}m`;
}

/**
 * The same difference, as a sentence: "5h 45m ahead of Kathmandu".
 * `place` is optional; without it the sentence just says "ahead".
 */
export function offsetDifferenceSentence(standardMinutes, referenceMinutes = 0, place = "") {
  const delta = Math.round((Number(standardMinutes) || 0) - (Number(referenceMinutes) || 0));
  const where = place ? ` ${place}` : "";
  if (delta === 0) return place ? `Same time as${where}` : "Same time";
  const abs = Math.abs(delta);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const amount = [hours ? `${hours}h` : "", minutes ? `${minutes}m` : ""].filter(Boolean).join(" ");
  return `${amount} ${delta > 0 ? "ahead of" : "behind"}${where || " you"}`;
}
