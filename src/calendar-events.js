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
 * begin at sundown the evening before the date shown; and Nepali tithi-based
 * festivals use the published Bikram Sambat festival tables included below.
 * A tithi is not a fixed Gregorian date, so the table is keyed by year rather
 * than pretending that Dashain, Tihar or Holi repeat on the same AD day.
 */

import { bikramFromGregorian, bikramMonthLabel, describeInSystem } from "./calendar-systems.js";

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

/*
 * Nepal's important festivals are not all public holidays, and many are
 * regional or community observances. They still belong on a calendar. The
 * dates below are the published 2082/2083 BS festival tables for the current
 * supported Gregorian season (2025–2027), including the full Dashain, Tihar
 * and Chhath sequences rather than only their headline days.
 *
 * These are Gregorian anchors because the celebrations are tithi-based. Each
 * event is decorated with its Bikram Sambat date at render time, so a user
 * can see both dates and the Nepali month name. Adding another year's table
 * is intentionally a data change, not a calendar algorithm guess.
 */
export const NEPALI_FESTIVAL_DATES = [
  /* 2081/2082 BS — the 2025 festival season. */
  [2025, 1, 14, "Maghe Sankranti (Maghi Parba)", "cultural", "Nepal"],
  [2025, 1, 30, "Sonam Losar (Tamang New Year)", "cultural", "Tamang communities"],
  [2025, 1, 30, "Martyrs' Memorial Day (Sahid Diwas)", "national", "Nepal"],
  [2025, 2, 26, "Maha Shivaratri", "religious", "Nepal"],
  [2025, 2, 28, "Gyalpo Losar (Tibetan New Year)", "cultural", "Himalayan communities"],
  [2025, 3, 13, "Holi — Fagu Purnima (hill regions)", "cultural", "Nepal hill regions"],
  [2025, 3, 14, "Holi — Fagu Purnima (Terai regions)", "cultural", "Nepal Terai"],
  [2025, 3, 29, "Ghode Jatra", "cultural", "Kathmandu Valley"],
  [2025, 4, 6, "Ram Navami", "religious", "Nepal"],
  [2025, 5, 12, "Buddha Jayanti (Buddha Purnima)", "religious", "Lumbini & Nepal"],
  [2025, 5, 12, "Ubhauli / Chandi Purnima", "cultural", "Kirat communities"],
  [2025, 8, 9, "Janai Purnima / Raksha Bandhan", "cultural", "Nepal"],
  [2025, 8, 10, "Gai Jatra (Saparu)", "cultural", "Kathmandu Valley & Newar communities"],
  [2025, 8, 16, "Krishna Janmashtami", "religious", "Nepal"],
  [2025, 8, 25, "Dar Khane Din (Teej eve)", "cultural", "Nepal"],
  [2025, 8, 26, "Haritalika Teej", "cultural", "Nepal"],
  [2025, 8, 30, "Rishi Panchami (Teej conclusion)", "cultural", "Nepal"],
  [2025, 8, 31, "Gaura Parva", "cultural", "Western Nepal"],
  [2025, 9, 6, "Indra Jatra / Yenya begins", "cultural", "Kathmandu Valley"],
  [2025, 9, 15, "Jitiya Parwa", "cultural", "Mithila & Terai communities"],
  [2025, 9, 22, "Ghatasthapana (Dashain begins)", "religious", "Nepal"],
  [2025, 9, 29, "Phulpati (Dashain)", "religious", "Nepal"],
  [2025, 9, 30, "Maha Ashtami (Dashain)", "religious", "Nepal"],
  [2025, 10, 1, "Maha Navami (Dashain)", "religious", "Nepal"],
  [2025, 10, 2, "Vijaya Dashami (Dashain Tika)", "religious", "Nepal"],
  [2025, 10, 3, "Papakunsha Ekadashi (Dashain)", "religious", "Nepal"],
  [2025, 10, 4, "Dwadashi (Dashain)", "religious", "Nepal"],
  [2025, 10, 6, "Kojagrat Purnima (Dashain concludes)", "religious", "Nepal"],
  [2025, 10, 20, "Laxmi Puja (Tihar / Diwali)", "cultural", "Nepal"],
  [2025, 10, 21, "Gai Tihar (Cow Day)", "cultural", "Nepal"],
  [2025, 10, 22, "Goru Tihar & Govardhan Puja", "cultural", "Nepal"],
  [2025, 10, 23, "Bhai Tika (Tihar)", "cultural", "Nepal"],
  [2025, 10, 24, "Tihar closing day", "cultural", "Nepal"],
  [2025, 10, 27, "Chhath Puja — Sandhya Arghya", "religious", "Terai & Nepal"],
  [2025, 11, 5, "Guru Nanak Jayanti", "religious", "Nepal Sikh communities"],
  [2025, 11, 11, "Phalgunanda Jayanti", "cultural", "Kirat communities"],
  [2025, 12, 4, "Udhauli Parva", "cultural", "Kirat communities"],
  [2025, 12, 5, "Yomari Punhi & Dhanya Purnima", "cultural", "Newar communities"],
  [2025, 12, 30, "Tamu Lhosar (Gurung New Year)", "cultural", "Gurung communities"],

  /* 2082 BS — January through April 2026. */
  [2026, 1, 15, "Maghe Sankranti (Maghi Parba)", "cultural", "Nepal"],
  [2026, 1, 19, "Sonam Losar (Tamang New Year)", "cultural", "Tamang communities"],
  [2026, 2, 15, "Maha Shivaratri", "religious", "Nepal"],
  [2026, 2, 18, "Gyalpo Losar (Tibetan New Year)", "cultural", "Himalayan communities"],
  [2026, 3, 2, "Holi — Fagu Purnima (hill regions)", "cultural", "Nepal hill regions"],
  [2026, 3, 3, "Holi — Fagu Purnima (Terai regions)", "cultural", "Nepal Terai"],
  [2026, 3, 18, "Ghode Jatra", "cultural", "Kathmandu Valley"],
  [2026, 3, 26, "Chaitra Dashain (Chaite Dashain)", "religious", "Nepal"],
  [2026, 3, 27, "Ram Navami", "religious", "Nepal"],
  [2026, 4, 14, "Bisket Jatra (Nepali New Year season)", "cultural", "Bhaktapur"],
  [2026, 4, 15, "Sindur Jatra", "cultural", "Thimi, Bhaktapur"],
  [2026, 4, 17, "Mata Tirtha Aunsi (Nepali Mother's Day)", "cultural", "Nepal"],
  [2026, 4, 21, "Rato Machhindranath Jatra begins", "cultural", "Patan, Lalitpur"],
  [2026, 5, 1, "Buddha Jayanti (Buddha Purnima)", "religious", "Lumbini & Nepal"],
  [2026, 5, 1, "Ubhauli / Chandi Purnima", "cultural", "Kirat communities"],
  [2026, 5, 13, "Tiji Festival begins", "cultural", "Upper Mustang"],
  [2026, 6, 29, "Ropain Jatra (Rice Planting Festival)", "cultural", "Nepal"],

  /* 2083 BS — the autumn festival season and the Nepali New Year that
   * follows it. */
  [2026, 8, 14, "Nag Panchami", "religious", "Nepal"],
  [2026, 8, 28, "Janai Purnima / Raksha Bandhan", "cultural", "Nepal"],
  [2026, 8, 29, "Gai Jatra (Saparu)", "cultural", "Kathmandu Valley & Newar communities"],
  [2026, 9, 4, "Gaura Parva", "cultural", "Western Nepal"],
  [2026, 9, 4, "Krishna Janmashtami", "religious", "Nepal"],
  [2026, 9, 13, "Dar Khane Din (Teej eve)", "cultural", "Nepal"],
  [2026, 9, 14, "Haritalika Teej", "cultural", "Nepal"],
  [2026, 9, 16, "Rishi Panchami (Teej conclusion)", "cultural", "Nepal"],
  [2026, 9, 14, "Ganesh Chaturthi", "religious", "Nepal"],
  [2026, 9, 25, "Indra Jatra / Yenya begins", "cultural", "Kathmandu Valley"],
  [2026, 10, 4, "Jitiya Parwa", "cultural", "Mithila & Terai communities"],
  [2026, 10, 11, "Ghatasthapana (Dashain begins)", "religious", "Nepal"],
  [2026, 10, 17, "Phulpati (Dashain)", "religious", "Nepal"],
  [2026, 10, 18, "Maha Ashtami (Dashain)", "religious", "Nepal"],
  [2026, 10, 19, "Maha Navami (Dashain)", "religious", "Nepal"],
  [2026, 10, 20, "Maha Navami observance (Dashain)", "religious", "Nepal"],
  [2026, 10, 21, "Vijaya Dashami (Dashain Tika)", "religious", "Nepal"],
  [2026, 10, 22, "Papakunsha Ekadashi (Dashain)", "religious", "Nepal"],
  [2026, 10, 23, "Dwadashi (Dashain)", "religious", "Nepal"],
  [2026, 10, 25, "Kojagrat Purnima (Dashain concludes)", "religious", "Nepal"],
  [2026, 11, 7, "Kaag Tihar (Crow Day)", "cultural", "Nepal"],
  [2026, 11, 8, "Kukur Tihar & Laxmi Puja (Tihar / Diwali)", "cultural", "Nepal"],
  [2026, 11, 9, "Gai Tihar (Cow Day)", "cultural", "Nepal"],
  [2026, 11, 10, "Goru Tihar, Govardhan Puja & Mha Puja", "cultural", "Nepal & Newar communities"],
  [2026, 11, 10, "Nepal Sambat New Year", "cultural", "Newar communities"],
  [2026, 11, 11, "Bhai Tika (Tihar)", "cultural", "Nepal"],
  [2026, 11, 11, "Phalgunanda Jayanti", "cultural", "Kirat communities"],
  [2026, 11, 12, "Tihar closing day", "cultural", "Nepal"],
  [2026, 11, 13, "Chhath Puja — Nahay Khay", "religious", "Terai & Nepal"],
  [2026, 11, 14, "Chhath Puja — Kharna", "religious", "Terai & Nepal"],
  [2026, 11, 15, "Chhath Puja — Sandhya Arghya", "religious", "Terai & Nepal"],
  [2026, 11, 16, "Chhath Puja — Usha Arghya", "religious", "Terai & Nepal"],
  [2026, 11, 24, "Guru Nanak Jayanti", "religious", "Nepal Sikh communities"],
  [2026, 12, 24, "Udhauli, Dhanya Purnima & Yomari Punhi", "cultural", "Kirat & Newar communities"],
  [2026, 12, 30, "Tamu Lhosar (Gurung New Year)", "cultural", "Gurung communities"],

  /* The opening months of 2083/2084, so navigating forward does not make
   * the festival layer suddenly disappear. */
  [2027, 1, 11, "Prithvi Jayanti / National Unity Day", "national", "Nepal"],
  [2027, 1, 15, "Maghe Sankranti (Maghi Parba)", "cultural", "Nepal"],
  [2027, 1, 30, "Martyrs' Day (Sahid Diwas)", "national", "Nepal"],
  [2027, 2, 7, "Sonam Losar (Tamang New Year)", "cultural", "Tamang communities"],
  [2027, 2, 19, "National Democracy Day (Prajatantra Diwas)", "national", "Nepal"],
  [2027, 3, 6, "Maha Shivaratri", "religious", "Nepal"],
  [2027, 3, 9, "Gyalpo Losar (Tibetan New Year)", "cultural", "Himalayan communities"],
  [2027, 3, 21, "Holi — Fagu Purnima (hill regions)", "cultural", "Nepal hill regions"],
  [2027, 3, 22, "Holi — Fagu Purnima (Terai regions)", "cultural", "Nepal Terai"],
  [2027, 4, 6, "Ghode Jatra", "cultural", "Kathmandu Valley"],
  [2027, 4, 14, "Bisket Jatra (Nepali New Year season)", "cultural", "Bhaktapur"],
  [2027, 5, 12, "Buddha Jayanti (Buddha Purnima)", "religious", "Lumbini & Nepal"],
];

const ALL_SETS = ["world", "national", "cultural", "religious"];

function setEnabled(sets, category) {
  if (!sets) return true;
  return sets[category] !== false;
}

function addNepaliDate(event, bs) {
  return {
    ...event,
    nepali: true,
    bs: bs
      ? {
          year: bs.year,
          month: bs.month,
          day: bs.day,
          monthName: bikramMonthLabel(bs.month),
        }
      : undefined,
  };
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
          events.push(
            addNepaliDate({ id: `bikram-${event.month}-${event.day}`, ...event }, {
              year: bs.year,
              month: bs.month,
              day: bs.day,
            })
          );
        }
      }
    }
  }

  // Tithi-based festivals are read from their published year table. Keeping
  // this separate from the month/day rules above prevents a moving festival
  // from being accidentally treated as a solar anniversary.
  for (const [year, month, day, name, category, place] of NEPALI_FESTIVAL_DATES) {
    if (date.year !== year || date.month !== month || date.day !== day || !setEnabled(sets, category)) continue;
    const bs = bikramFromGregorian(date);
    events.push(
      addNepaliDate(
        { id: `nepal-${year}-${month}-${day}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name, category, place },
        bs
      )
    );
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
