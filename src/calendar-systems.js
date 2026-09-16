/**
 * The calendars a date can wear besides the Gregorian one.
 *
 * The alarm and timer spine remains Gregorian, while the month grid can put
 * another calendar first in each cell and keep Gregorian as the small date
 * underneath: Vikram
 * (Bikram) Sambat for Nepal, the Chinese and Korean lunisolar calendars,
 * Hebrew, Hijri, the Persian and Indian national solar calendars, Thai
 * Buddhist Era years, or the Japanese imperial eras.
 *
 * Two engines live here:
 *
 *   • Everywhere the browser's ICU build reaches, the work is one
 *     `Intl.DateTimeFormat` per system, cached, reading day/month/year
 *     parts back out of a plain UTC date. The Korean calendar is ICU's
 *     `dangi`; availability is feature-detected so an older browser simply
 *     never offers what it cannot compute.
 *
 *   • Bikram Sambat has no ICU support anywhere, so its month lengths are
 *     embedded as a lookup table — the same published month-day data used
 *     by the open-source Nepali date converters — covering BS 2000–2090
 *     (AD 1943-04-14 through 2034-04-13). Outside that span the second date
 *     simply hides instead of guessing at month lengths.
 */

const DAY = 86_400_000;

/* ------------------------------------------------------------------ Vikram Samvat */

/** Baisakh 1, 2000 BS = 1943-04-14 AD. */
export const BS_EPOCH = { year: 1943, month: 4, day: 14 };
export const BS_FIRST_YEAR = 2000;
export const BS_LAST_YEAR = 2090;

export const BS_MONTHS = [
  // `name` is the spelling used in the date sentence. The aliases and
  // Devanagari names are deliberately kept beside it: Nepali month names
  // have several perfectly normal English transliterations.
  { id: "baisakh", name: "Baisakh", aliases: ["Baishakh", "Baisak"], native: "बैशाख", short: "Bai" },
  { id: "jestha", name: "Jestha", aliases: ["Jeth"], native: "जेठ", short: "Jes" },
  { id: "ashadh", name: "Ashadh", aliases: ["Asadh", "Asar"], native: "असार", short: "Asa" },
  { id: "shrawan", name: "Shrawan", aliases: ["Shravan", "Saun"], native: "साउन", short: "Shr" },
  { id: "bhadra", name: "Bhadra", aliases: ["Bhadau"], native: "भदौ", short: "Bha" },
  { id: "ashwin", name: "Ashwin", aliases: ["Ashoj", "Asoj"], native: "असोज", short: "Asw" },
  { id: "kartik", name: "Kartik", aliases: ["Kattik"], native: "कात्तिक", short: "Kar" },
  { id: "mangsir", name: "Mangsir", aliases: ["Margashirsha", "Mansir"], native: "मंसिर", short: "Man" },
  { id: "poush", name: "Poush", aliases: ["Paush", "Push"], native: "पुस", short: "Pou" },
  { id: "magh", name: "Magh", aliases: ["Magha"], native: "माघ", short: "Mag" },
  { id: "falgun", name: "Falgun", aliases: ["Phagun"], native: "फागुन", short: "Fal" },
  { id: "chaitra", name: "Chaitra", aliases: ["Chait"], native: "चैत", short: "Cha" },
];

/**
 * Month lengths per BS year, Baisakh through Chaitra, years 2000–2090.
 * One row per year. (The table is the published Nepali calendar arithmetic
 * also shipped by nepali-date-converter and node-nepali-datetime.)
 */
const BS_ROWS = `30,32,31,32,31,30,30,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 30,32,31,32,31,30,30,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,29,30,30,29,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,29,30,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,29,30,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,30,29,31 31,31,31,32,31,31,30,29,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,30 31,32,31,32,31,30,30,30,29,30,29,31 31,31,31,32,31,31,30,29,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 30,32,31,32,31,30,30,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,31,32,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 30,32,31,32,31,30,30,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 30,32,31,32,31,31,29,30,30,29,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,29,30,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,29,30,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,30,29,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,30 31,32,31,32,31,30,30,30,29,30,29,31 31,31,31,32,31,31,30,29,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,30 31,32,31,32,31,30,30,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,31,32,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 30,32,31,32,31,30,30,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 30,32,31,32,31,31,29,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,29,30,30,29,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,29,30,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,30,29,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,30 31,32,31,32,31,30,30,30,29,30,29,31 31,31,31,32,31,31,30,29,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,30 31,32,31,32,31,30,30,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 30,32,31,32,31,30,30,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,31,31,31,30,30,29,30,30,30 30,31,32,32,30,31,30,30,29,30,30,30 30,32,31,32,31,30,30,30,29,30,30,30 30,32,31,32,31,30,30,30,29,30,30,30`;

const BS_YEAR_MONTHS = BS_ROWS.split(" ").map((row) => row.split(",").map(Number));

/** Days completed before each BS year, for a fast year lookup. */
const BS_YEAR_OFFSETS = (() => {
  const offsets = [];
  let total = 0;
  for (const months of BS_YEAR_MONTHS) {
    offsets.push(total);
    total += months.reduce((sum, days) => sum + days, 0);
  }
  return { offsets, total };
})();

const BS_EPOCH_UTC = Date.UTC(BS_EPOCH.year, BS_EPOCH.month - 1, BS_EPOCH.day);

/**
 * Gregorian {year, month, day} (plain UTC calendar date) → Bikram Sambat
 * {year, month (1–12), day}, or null outside the tabulated span.
 */
export function bikramFromGregorian(date) {
  const stamp = Date.UTC(date.year, date.month - 1, date.day);
  let dayIndex = Math.floor((stamp - BS_EPOCH_UTC) / DAY); // 0-based, day 0 = 2000-01-01 BS
  if (dayIndex < 0 || dayIndex >= BS_YEAR_OFFSETS.total) return null;

  let yearIndex = 0;
  for (let i = 0; i < BS_YEAR_OFFSETS.offsets.length; i += 1) {
    if (dayIndex < BS_YEAR_OFFSETS.offsets[i]) break;
    yearIndex = i;
  }
  dayIndex -= BS_YEAR_OFFSETS.offsets[yearIndex];

  const months = BS_YEAR_MONTHS[yearIndex];
  let month = 0;
  while (month < 11 && dayIndex >= months[month]) {
    dayIndex -= months[month];
    month += 1;
  }
  return { year: BS_FIRST_YEAR + yearIndex, month: month + 1, day: dayIndex + 1 };
}

/** Bikram Sambat → plain Gregorian date, or null outside the table. */
export function gregorianFromBikram({ year, month, day }) {
  const yearIndex = year - BS_FIRST_YEAR;
  if (yearIndex < 0 || yearIndex >= BS_YEAR_MONTHS.length) return null;
  const months = BS_YEAR_MONTHS[yearIndex];
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > months[month - 1]) return null;
  let dayIndex = BS_YEAR_OFFSETS.offsets[yearIndex];
  for (let i = 0; i < month - 1; i += 1) dayIndex += months[i];
  const stamp = BS_EPOCH_UTC + (dayIndex + day - 1) * DAY;
  const out = new Date(stamp);
  return { year: out.getUTCFullYear(), month: out.getUTCMonth() + 1, day: out.getUTCDate() };
}

export function bikramMonthName(month, { short = false } = {}) {
  const entry = BS_MONTHS[month - 1];
  if (!entry) return "";
  return short ? entry.short : entry.name;
}

/**
 * A reader-friendly label that makes the common transliteration visible
 * without making the compact date cell too wide.
 */
export function bikramMonthLabel(month, { includeNative = true } = {}) {
  const entry = BS_MONTHS[month - 1];
  if (!entry) return "";
  const aliases = entry.aliases.filter((alias) => alias !== entry.name);
  const spelling = [entry.name, ...aliases].join(" / ");
  return includeNative ? `${spelling} (${entry.native})` : spelling;
}

/* ------------------------------------------------------------------- ICU calendars */

/**
 * The systems on offer. `intl` systems are computed by the browser's own
 * ICU data — which is exactly what a clock app should trust for calendars,
 * since OS vendors keep those tables maintained — and `bikram` uses the
 * embedded table above.
 */
export const CALENDAR_SYSTEMS = [
  {
    id: "gregorian",
    label: "Gregorian only",
    place: "Worldwide",
    note: "No second date in the cells — the plain calendar.",
    kind: "none",
  },
  {
    id: "bikram",
    label: "Bikram Sambat",
    place: "Nepal",
    note: "Nepal's official solar calendar, about 57 years ahead.",
    kind: "bikram",
  },
  {
    id: "chinese",
    label: "Chinese calendar",
    place: "China & East Asia",
    note: "Lunisolar months, zodiac years — Chinese New Year moves.",
    kind: "intl",
    calendar: "chinese",
    zodiac: true,
  },
  {
    id: "dangi",
    label: "Korean calendar (Dangi)",
    place: "Korea",
    note: "Korea's traditional lunisolar calendar — Seollal, Chuseok.",
    kind: "intl",
    calendar: "dangi",
    zodiac: true,
  },
  {
    id: "hebrew",
    label: "Hebrew calendar",
    place: "Israel & Jewish life",
    note: "Lunisolar; days — and feasts — begin at sundown.",
    kind: "intl",
    calendar: "hebrew",
  },
  {
    id: "islamic",
    label: "Islamic calendar (Hijri)",
    place: "Muslim world",
    note: "Tabular Hijri — local moon sightings may differ by a day.",
    kind: "intl",
    calendar: "islamic",
    approximate: true,
  },
  {
    id: "persian",
    label: "Persian calendar",
    place: "Iran & Afghanistan",
    note: "Solar Hijri; the year turns at the March equinox — Nowruz.",
    kind: "intl",
    calendar: "persian",
  },
  {
    id: "indian",
    label: "Indian national calendar",
    place: "India",
    note: "The civil Śaka calendar used alongside Gregorian in India.",
    kind: "intl",
    calendar: "indian",
  },
  {
    id: "buddhist",
    label: "Thai Buddhist calendar",
    place: "Thailand",
    note: "Gregorian months, Buddhist Era years (543 ahead).",
    kind: "intl",
    calendar: "buddhist",
  },
  {
    id: "japanese",
    label: "Japanese calendar",
    place: "Japan",
    note: "Gregorian months counted in imperial eras — Reiwa now.",
    kind: "intl",
    calendar: "japanese",
    era: true,
  },
];

export function calendarSystem(id) {
  return CALENDAR_SYSTEMS.find((system) => system.id === id) || CALENDAR_SYSTEMS[0];
}

const formatters = new Map();

function intlFormatters(calendar) {
  if (formatters.has(calendar)) return formatters.get(calendar);
  const locale = `en-u-ca-${calendar}`;
  const partsFormatter = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    relatedYear: "numeric",
  });
  const longFormatter = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
    era: "short",
  });
  const monthFormatter = new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "long" });
  const pack = { parts: partsFormatter, long: longFormatter, monthName: monthFormatter };
  formatters.set(calendar, pack);
  return pack;
}

/** True when this browser can actually compute the system. */
export function calendarSystemAvailable(id) {
  const system = calendarSystem(id);
  if (system.kind !== "intl") return true; // gregorian & bikram always work
  try {
    const { parts } = intlFormatters(system.calendar);
    const pieces = parts.formatToParts(new Date(Date.UTC(2026, 0, 1)));
    return pieces.some((part) => part.type === "month") && pieces.some((part) => part.type === "day");
  } catch (_) {
    return false;
  }
}

const ZODIAC = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];
const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th", "13th"];

export function zodiacAnimalFor(relatedYear) {
  return ZODIAC[((relatedYear - 4) % 12 + 12) % 12] || "";
}

/**
 * ICU numbers Hebrew months from Nisan (so Tishri, when the year turns, is
 * month 7) and spells them out even in numeric formats — "Shevat" will not
 * parse as a number. Map the English spellings back to ICU's ordinal.
 */
const HEBREW_MONTHS = [
  "Nisan",
  "Iyar",
  "Sivan",
  "Tamuz",
  "Av",
  "Elul",
  "Tishri",
  "Cheshvan",
  "Kislev",
  "Tevet",
  "Shevat",
  "Adar I",
  "Adar",
  "Adar II",
];

function intlParts(calendar, stamp) {
  const { parts: formatter } = intlFormatters(calendar);
  const out = {};
  for (const part of formatter.formatToParts(new Date(stamp))) {
    if (part.type === "day") out.day = Number(part.value);
    else if (part.type === "month") {
      out.month = Number(part.value);
      if (!Number.isFinite(out.month)) {
        const spelled = HEBREW_MONTHS.findIndex((name) => part.value === name || part.value.startsWith(name));
        if (spelled >= 0) {
          // Heshvan and Cheshvan spell the same 8th month; leap Adars sit at 12+.
          out.month = spelled + 1;
        }
      }
    } else if (part.type === "relatedYear") out.relatedYear = Number(part.value);
    else if (part.type === "year") out.year = part.value;
  }
  return out;
}

const describeCache = new Map();

/**
 * A plain Gregorian date expressed in a second calendar.
 *
 * Returns null for "gregorian" (there is nothing second to show) and for
 * dates a system cannot cover — outside the Vikram Samvat table, or an
 * unsupported ICU calendar. Otherwise:
 *
 *   cell  — the tiny label under the grid number ("14", or "Bai 1" when a
 *           new month begins, so month turns are visible in the grid)
 *   long  — the sentence for the detail card
 */
export function describeInSystem(id, date) {
  const system = calendarSystem(id);
  if (system.kind === "none") return null;

  const key = `${system.id}:${date.year}-${date.month}-${date.day}`;
  if (describeCache.has(key)) return describeCache.get(key);

  let result = null;
  if (system.kind === "bikram") {
    const bs = bikramFromGregorian(date);
    if (bs) {
      const month = BS_MONTHS[bs.month - 1];
      result = {
        system: system.id,
        label: system.label,
        day: bs.day,
        month: bs.month,
        monthName: month.name,
        monthAliases: month.aliases,
        monthNative: month.native,
        monthLabel: bikramMonthLabel(bs.month),
        year: bs.year,
        cell: bs.day === 1 ? `${month.short} 1` : String(bs.day),
        long: `${month.name} ${bs.day}, ${bs.year} BS`,
      };
    }
  } else {
    try {
      const stamp = Date.UTC(date.year, date.month - 1, date.day);
      const { monthName: monthNameFormatter, long: longFormatter } = intlFormatters(system.calendar);
      const parts = intlParts(system.calendar, stamp);
      if (Number.isFinite(parts.day) && Number.isFinite(parts.month)) {
        const relatedYear = parts.relatedYear || date.year;
        const ordinal = ORDINALS[Math.min(Math.max(parts.month - 1, 0), ORDINALS.length - 1)];
        const zodiac = system.zodiac ? zodiacAnimalFor(relatedYear) : "";
        let long;
        if (system.zodiac) {
          long = `${ordinal} month, day ${parts.day} — ${zodiac} year ${relatedYear}`;
        } else {
          long = longFormatter.format(new Date(stamp));
        }
        result = {
          system: system.id,
          label: system.label,
          day: parts.day,
          month: parts.month,
          monthName: monthNameFormatter.format(new Date(stamp)),
          year: relatedYear,
          zodiac,
          cell: parts.day === 1 ? `M${parts.month}·1` : String(parts.day),
          long,
          approximate: system.approximate || undefined,
        };
      }
    } catch (_) {
      result = null;
    }
  }

  if (describeCache.size > 600) describeCache.clear();
  describeCache.set(key, result);
  return result;
}
