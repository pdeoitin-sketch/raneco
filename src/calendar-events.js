/**
 * Holidays and observances, computed the way the calendars are.
 *
 * Four sets, each switchable in Settings:
 *
 *   world      — the UN-style international days that fall on fixed dates.
 *   national   — independence and national days. Mostly fixed Gregorian
 *                dates; Israel's follows the Hebrew calendar and Nepal's
 *                follow Bikram Sambat, because that is how those countries
 *                actually count them.
 *   cultural   — lunar and traditional new years and festivals: Chinese,
 *                Korean (Dangi), Nepali, Persian — plus fixed solar ones
 *                like Songkran.
 *   religious  — Christmas, the Easter cycle (worked out by the Western
 *                computus), the major Islamic feasts on the tabular Hijri
 *                calendar, and the major Hebrew feasts.
 *
 * Honest edges, stated up front: Islamic dates use the tabular calendar, so
 * a local moon sighting may celebrate a day earlier or later; Hebrew feasts
 * begin at sundown the evening before the date shown; and tithi-based feasts
 * (Dashain, Tihar, Diwali, Losar) need published tables this file does not
 * try to fake — so they simply are not here.
 */

import { bikramFromGregorian, describeInSystem } from "./calendar-systems.js";

export const EVENT_CATEGORIES = [
  { id: "world", label: "International day" },
  { id: "national", label: "National day" },
  { id: "cultural", label: "Cultural festival" },
  { id: "religious", label: "Religious observance" },
];

export function eventCategory(id) {
  return EVENT_CATEGORIES.find((category) => category.id === id) || EVENT_CATEGORIES[0];
}

/* ------------------------------------------------------------- fixed dates */

/** [month, day, name, category] — [m, d, name, category, place?] */
const FIXED_EVENTS = [
  [1, 1, "New Year's Day", "world"],
  [2, 14, "Valentine's Day", "world"],
  [3, 8, "International Women's Day", "world"],
  [4, 7, "World Health Day", "world"],
  [4, 22, "Earth Day", "world"],
  [5, 1, "International Workers' Day", "world"],
  [6, 5, "World Environment Day", "world"],
  [6, 21, "International Day of Yoga", "world"],
  [8, 12, "International Youth Day", "world"],
  [9, 21, "International Day of Peace", "world"],
  [10, 5, "World Teachers' Day", "world"],
  [10, 16, "World Food Day", "world"],
  [10, 24, "United Nations Day", "world"],
  [10, 31, "Halloween", "world"],
  [11, 20, "World Children's Day", "world"],
  [12, 1, "World AIDS Day", "world"],
  [12, 10, "Human Rights Day", "world"],
  [12, 31, "New Year's Eve", "world"],

  [4, 13, "Songkran", "cultural", "Thailand"],

  [1, 6, "Epiphany", "religious"],
  [1, 7, "Orthodox Christmas Day", "religious"],
  [12, 24, "Christmas Eve", "religious"],
  [12, 25, "Christmas Day", "religious"],

  /* National & independence days — fixed Gregorian dates. */
  [1, 4, "Independence Day", "national", "Myanmar"],
  [1, 26, "Republic Day", "national", "India"],
  [1, 26, "Australia Day", "national", "Australia"],
  [2, 4, "Independence Day", "national", "Sri Lanka"],
  [2, 6, "Waitangi Day", "national", "New Zealand"],
  [2, 11, "National Foundation Day", "national", "Japan"],
  [2, 11, "Revolution Day", "national", "Iran"],
  [2, 15, "Statehood Day", "national", "Serbia"],
  [2, 23, "The Emperor's Birthday", "national", "Japan"],
  [3, 1, "Independence Movement Day", "national", "South Korea"],
  [3, 3, "Liberation Day", "national", "Bulgaria"],
  [3, 6, "Independence Day", "national", "Ghana"],
  [3, 17, "Saint Patrick's Day", "national", "Ireland"],
  [3, 25, "Independence Day", "national", "Greece"],
  [3, 26, "Independence Day", "national", "Bangladesh"],
  [4, 27, "Freedom Day", "national", "South Africa"],
  [4, 27, "King's Day", "national", "Netherlands"],
  [5, 3, "Constitution Day", "national", "Poland"],
  [5, 17, "Constitution Day", "national", "Norway"],
  [5, 28, "National Day", "national", "Ethiopia"],
  [5, 30, "Statehood Day", "national", "Croatia"],
  [6, 2, "Republic Day", "national", "Italy"],
  [6, 5, "Constitution Day", "national", "Denmark"],
  [6, 6, "National Day", "national", "Sweden"],
  [6, 12, "Russia Day", "national", "Russia"],
  [6, 12, "Independence Day", "national", "Philippines"],
  [6, 17, "National Day", "national", "Iceland"],
  [7, 1, "Canada Day", "national", "Canada"],
  [7, 4, "Independence Day", "national", "United States"],
  [7, 5, "Independence Day", "national", "Venezuela"],
  [7, 9, "Independence Day", "national", "Argentina"],
  [7, 14, "Bastille Day", "national", "France"],
  [7, 20, "Independence Day", "national", "Colombia"],
  [7, 21, "National Day", "national", "Belgium"],
  [7, 23, "Revolution Day", "national", "Egypt"],
  [7, 28, "Independence Day", "national", "Peru"],
  [8, 1, "National Day", "national", "Switzerland"],
  [8, 9, "National Day", "national", "Singapore"],
  [8, 14, "Independence Day", "national", "Pakistan"],
  [8, 15, "Independence Day", "national", "India"],
  [8, 15, "Liberation Day", "national", "South Korea"],
  [8, 17, "Independence Day", "national", "Indonesia"],
  [8, 19, "Independence Day", "national", "Afghanistan"],
  [8, 24, "Independence Day", "national", "Ukraine"],
  [8, 31, "Independence Day", "national", "Malaysia"],
  [9, 2, "National Day", "national", "Vietnam"],
  [9, 7, "Independence Day", "national", "Brazil"],
  [9, 9, "National Day", "national", "North Korea"],
  [9, 16, "Independence Day", "national", "Mexico"],
  [9, 18, "Independence Day", "national", "Chile"],
  [9, 23, "National Day", "national", "Saudi Arabia"],
  [10, 1, "National Day", "national", "China"],
  [10, 1, "Independence Day", "national", "Nigeria"],
  [10, 3, "Unity Day", "national", "Germany"],
  [10, 12, "National Day", "national", "Spain"],
  [10, 26, "National Day", "national", "Austria"],
  [10, 28, "Statehood Day", "national", "Czechia"],
  [10, 29, "Republic Day", "national", "Turkey"],
  [11, 9, "Independence Day", "national", "Cambodia"],
  [11, 11, "Independence Day", "national", "Poland"],
  [11, 18, "Proclamation Day", "national", "Latvia"],
  [12, 1, "Great Union Day", "national", "Romania"],
  [12, 2, "National Day", "national", "United Arab Emirates"],
  [12, 5, "The King's Birthday", "national", "Thailand"],
  [12, 6, "Independence Day", "national", "Finland"],
  [12, 12, "Jamhuri Day", "national", "Kenya"],
];

/* -------------------------------------------- movable feasts, Western Easter */

/**
 * Easter Sunday for a Gregorian year by the Meeus/Jones/Butcher computus —
 * the algorithm that has matched the Western church calendar since 1583.
 */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

/** offsets from Easter Sunday, in days: Good Friday −2, Easter Monday +1. */
const EASTER_EVENTS = [
  { offset: -2, name: "Good Friday" },
  { offset: 0, name: "Easter Sunday" },
  { offset: 1, name: "Easter Monday" },
];

function easterEventsFor(date) {
  const DAY = 86_400_000;
  const stamp = Date.UTC(date.year, date.month - 1, date.day);
  const events = [];
  for (const { offset, name } of EASTER_EVENTS) {
    const target = new Date(stamp - offset * DAY);
    const easter = easterSunday(target.getUTCFullYear());
    if (target.getUTCMonth() + 1 === easter.month && target.getUTCDate() === easter.day && target.getUTCFullYear() === easter.year) {
      events.push({ id: `easter-${offset}`, name, category: "religious" });
    }
  }
  return events;
}

/* ---------------------------------- feasts counted in other calendars */

/**
 * Rules checked inside the calendar system the feast lives in — the same
 * engine that prints the second date in the grid cells.
 *   system: an id from calendar-systems.js ("islamic" is tabular Hijri)
 *   month/day: that calendar's numbering
 */
const SYSTEM_EVENTS = [
  /* Cultural — the new years and festivals the user asked for. */
  { system: "chinese", month: 1, day: 1, name: "Chinese New Year", category: "cultural", place: "China & East Asia" },
  { system: "chinese", month: 1, day: 15, name: "Lantern Festival", category: "cultural", place: "China & East Asia" },
  { system: "chinese", month: 5, day: 5, name: "Dragon Boat Festival", category: "cultural", place: "China & East Asia" },
  { system: "chinese", month: 8, day: 15, name: "Mid-Autumn Festival", category: "cultural", place: "China & East Asia" },
  { system: "dangi", month: 1, day: 1, name: "Seollal — Korean New Year", category: "cultural", place: "Korea" },
  { system: "dangi", month: 8, day: 15, name: "Chuseok — Korean harvest festival", category: "cultural", place: "Korea" },
  { system: "persian", month: 1, day: 1, name: "Nowruz — Persian New Year", category: "cultural", place: "Iran, Afghanistan & Central Asia" },

  /* Religious — tabular Hijri; local sightings may celebrate a day off. */
  { system: "islamic", month: 1, day: 1, name: "Islamic New Year", category: "religious", approximate: true },
  { system: "islamic", month: 3, day: 12, name: "Mawlid — the Prophet's Birthday", category: "religious", approximate: true },
  { system: "islamic", month: 9, day: 1, name: "Ramadan begins", category: "religious", approximate: true },
  { system: "islamic", month: 10, day: 1, name: "Eid al-Fitr", category: "religious", approximate: true },
  { system: "islamic", month: 12, day: 10, name: "Eid al-Adha", category: "religious", approximate: true },

  /* Religious — Hebrew (ICU numbers months from Nisan: Tishri is 7). */
  { system: "hebrew", month: 7, day: 1, name: "Rosh Hashanah", category: "religious" },
  { system: "hebrew", month: 7, day: 10, name: "Yom Kippur", category: "religious" },
  { system: "hebrew", month: 7, day: 15, name: "Sukkot begins", category: "religious" },
  { system: "hebrew", month: 9, day: 25, name: "Hanukkah begins", category: "religious" },
  { system: "hebrew", month: 1, day: 15, name: "Passover begins", category: "religious" },

  /* National — Israel counts its independence on the Hebrew calendar. */
  { system: "hebrew", month: 2, day: 5, name: "Independence Day (Yom Ha'atzmaut)", category: "national", place: "Israel" },
];

/** Nepal counts its national days in Bikram Sambat directly. */
const BIKRAM_EVENTS = [
  { month: 1, day: 1, name: "Nepali New Year (Naya Barsha)", category: "cultural", place: "Nepal" },
  { month: 2, day: 15, name: "Republic Day (Ganatantra Diwas)", category: "national", place: "Nepal" },
  { month: 6, day: 3, name: "Constitution Day (Sambidhan Diwas)", category: "national", place: "Nepal" },
  { month: 11, day: 7, name: "Democracy Day (Prajatantra Diwas)", category: "national", place: "Nepal" },
];

const ALL_SETS = ["world", "national", "cultural", "religious"];

function setEnabled(sets, category) {
  if (!sets) return true;
  return sets[category] !== false;
}

/**
 * Every event landing on a plain Gregorian date, filtered by the enabled
 * sets ({world, national, cultural, religious} → booleans; missing = all on).
 */
export function eventsForDate(date, sets) {
  const events = [];
  for (const [month, day, name, category, place] of FIXED_EVENTS) {
    if (date.month !== month || date.day !== day) continue;
    if (!setEnabled(sets, category)) continue;
    events.push({ id: `fixed-${month}-${day}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name, category, place });
  }

  if (setEnabled(sets, "religious")) events.push(...easterEventsFor(date));

  if (setEnabled(sets, "cultural") || setEnabled(sets, "national")) {
    const bs = bikramFromGregorian(date);
    if (bs) {
      for (const event of BIKRAM_EVENTS) {
        if (bs.month === event.month && bs.day === event.day && setEnabled(sets, event.category)) {
          events.push({ id: `bikram-${event.month}-${event.day}`, ...event });
        }
      }
    }
  }

  // Only consult the ICU calendars that at least one enabled rule needs.
  const systemsNeeded = new Set(
    SYSTEM_EVENTS.filter((rule) => setEnabled(sets, rule.category)).map((rule) => rule.system)
  );
  for (const system of systemsNeeded) {
    const desc = describeInSystem(system, date);
    if (!desc) continue;
    for (const rule of SYSTEM_EVENTS) {
      if (rule.system === system && desc.month === rule.month && desc.day === rule.day) {
        events.push({ id: `${rule.system}-${rule.month}-${rule.day}-${rule.name}`, ...rule });
      }
    }
  }

  // Deterministic order for dots and lists: category, then name.
  const order = new Map(EVENT_CATEGORIES.map((category, index) => [category.id, index]));
  return events.sort((a, b) => order.get(a.category) - order.get(b.category) || a.name.localeCompare(b.name));
}

export const HOLIDAY_SET_IDS = ALL_SETS;
