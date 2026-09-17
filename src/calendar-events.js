/**
 * Holidays, observances, festivals, and freedom / independence / democracy
 * celebration dates across all supported calendar systems.
 *
 * Four categories, each switchable in Settings:
 *
 *   world      — International days (UN, UNESCO, WHO, human rights, democracy,
 *                freedom, workers, environment, education, peace).
 *   national   — Independence, liberation, constitution, republic, democracy,
 *                statehood, revolution, and national days worldwide.
 *   cultural   — Lunar, traditional, and seasonal festivals and celebrations:
 *                Nepali, Chinese, Korean (Dangi), Persian, Thai (Songkran),
 *                Indian, and Japanese.
 *   religious  — Major holy days across world faiths: Christmas, Western Easter
 *                computus, Islamic feasts on the tabular Hijri calendar, Hebrew
 *                feasts, Hindu holy days, Buddhist observances, and Sikh celebrations.
 */

import { bikramFromGregorian, bikramMonthLabel, describeInSystem } from "./calendar-systems.js";

export const EVENT_CATEGORIES = [
  { id: "world", label: "International day" },
  { id: "national", label: "National & freedom day" },
  { id: "cultural", label: "Cultural festival" },
  { id: "religious", label: "Religious observance" },
];

export function eventCategory(id) {
  return EVENT_CATEGORIES.find((category) => category.id === id) || EVENT_CATEGORIES[0];
}

/* ------------------------------------------------------------- Fixed Gregorian Dates */

/** [month, day, name, category, place?] */
export const FIXED_EVENTS = [
  /* International / UN Days */
  [1, 1, "New Year's Day", "world"],
  [1, 24, "International Day of Education", "world"],
  [1, 27, "International Holocaust Remembrance Day", "world"],
  [2, 4, "World Cancer Day", "world"],
  [2, 14, "Valentine's Day", "world"],
  [2, 20, "World Day of Social Justice", "world"],
  [2, 21, "International Mother Language Day", "world"],
  [3, 8, "International Women's Day", "world"],
  [3, 20, "International Day of Happiness", "world"],
  [3, 21, "Day for the Elimination of Racial Discrimination", "world"],
  [3, 22, "World Water Day", "world"],
  [4, 7, "World Health Day", "world"],
  [4, 22, "Earth Day", "world"],
  [4, 23, "World Book Day", "world"],
  [5, 1, "International Workers' Day (May Day)", "world"],
  [5, 3, "World Press Freedom Day", "world"],
  [5, 8, "World Red Cross Day", "world"],
  [5, 21, "World Day for Cultural Diversity", "world"],
  [6, 5, "World Environment Day", "world"],
  [6, 8, "World Oceans Day", "world"],
  [6, 20, "World Refugee Day", "world"],
  [6, 21, "International Day of Yoga", "world"],
  [7, 18, "Nelson Mandela International Day", "world"],
  [7, 30, "International Day of Friendship", "world"],
  [8, 12, "International Youth Day", "world"],
  [8, 19, "World Humanitarian Day", "world"],
  [9, 5, "International Day of Charity", "world"],
  [9, 8, "International Literacy Day", "world"],
  [9, 15, "International Day of Democracy", "world"],
  [9, 21, "International Day of Peace", "world"],
  [10, 5, "World Teachers' Day", "world"],
  [10, 11, "International Day of the Girl Child", "world"],
  [10, 16, "World Food Day", "world"],
  [10, 24, "United Nations Day", "world"],
  [10, 31, "World Cities Day / Halloween", "world"],
  [11, 10, "World Science Day for Peace", "world"],
  [11, 16, "International Day for Tolerance", "world"],
  [11, 20, "World Children's Day", "world"],
  [12, 1, "World AIDS Day", "world"],
  [12, 3, "International Day of Persons with Disabilities", "world"],
  [12, 5, "World Soil Day", "world"],
  [12, 9, "International Anti-Corruption Day", "world"],
  [12, 10, "Human Rights Day", "world"],
  [12, 18, "International Migrants Day", "world"],
  [12, 20, "International Human Solidarity Day", "world"],
  [12, 31, "New Year's Eve", "world"],

  /* Fixed Cultural & Solar New Years */
  [4, 13, "Songkran (Thai New Year)", "cultural", "Thailand"],
  [4, 14, "Songkran Water Festival", "cultural", "Thailand & Southeast Asia"],
  [4, 14, "Pôhela Boishakh (Bengali New Year)", "cultural", "Bangladesh & India"],
  [4, 14, "Puthandu (Tamil New Year)", "cultural", "India & Sri Lanka"],
  [4, 14, "Vishu / Baisakhi", "cultural", "India & Punjab"],

  /* Fixed Religious Days */
  [1, 6, "Epiphany", "religious"],
  [1, 7, "Orthodox Christmas Day", "religious"],
  [12, 24, "Christmas Eve", "religious"],
  [12, 25, "Christmas Day", "religious"],

  /* National, Freedom, Independence & Democracy Days */
  [1, 4, "Independence Day", "national", "Myanmar"],
  [1, 11, "Prithvi Jayanti / National Unity Day", "national", "Nepal"],
  [1, 15, "Martin Luther King Jr. Day", "national", "United States"],
  [1, 23, "Netaji Jayanti / Parakram Diwas", "national", "India"],
  [1, 26, "Republic Day", "national", "India"],
  [1, 26, "Australia Day", "national", "Australia"],
  [1, 30, "Martyrs' Memorial Day (Sahid Diwas)", "national", "Nepal"],
  [2, 4, "Independence Day", "national", "Sri Lanka"],
  [2, 5, "Constitution Day", "national", "Mexico"],
  [2, 6, "Waitangi Day", "national", "New Zealand"],
  [2, 11, "National Foundation Day", "national", "Japan"],
  [2, 11, "Revolution Day", "national", "Iran"],
  [2, 12, "Union Day", "national", "Myanmar"],
  [2, 15, "Statehood Day", "national", "Serbia"],
  [2, 19, "National Democracy Day (Prajatantra Diwas)", "national", "Nepal"],
  [2, 22, "Founding Day", "national", "Saudi Arabia"],
  [2, 23, "The Emperor's Birthday", "national", "Japan"],
  [2, 25, "People Power Revolution Day", "national", "Philippines"],
  [3, 1, "Independence Movement Day", "national", "South Korea"],
  [3, 3, "Liberation Day", "national", "Bulgaria"],
  [3, 6, "Independence Day", "national", "Ghana"],
  [3, 17, "Saint Patrick's Day", "national", "Ireland"],
  [3, 21, "Human Rights Day (Sharpeville Memorial)", "national", "South Africa"],
  [3, 21, "Benito Juárez Day", "national", "Mexico"],
  [3, 23, "Pakistan Day (Resolution Day)", "national", "Pakistan"],
  [3, 24, "Day of Remembrance for Truth and Justice", "national", "Argentina"],
  [3, 25, "Independence Day", "national", "Greece"],
  [3, 26, "Independence Day", "national", "Bangladesh"],
  [4, 6, "Chakri Memorial Day", "national", "Thailand"],
  [4, 14, "Dr. B.R. Ambedkar Jayanti (Equality Day)", "national", "India"],
  [4, 21, "Tiradentes Day", "national", "Brazil"],
  [4, 23, "National Sovereignty & Children's Day", "national", "Turkey"],
  [4, 24, "Loktantra Diwas (Democracy Day)", "national", "Nepal"],
  [4, 25, "Liberation Day (Festa della Liberazione)", "national", "Italy"],
  [4, 25, "Freedom Day", "national", "Portugal"],
  [4, 25, "ANZAC Day", "national", "Australia & New Zealand"],
  [4, 27, "Freedom Day", "national", "South Africa"],
  [4, 27, "King's Day", "national", "Netherlands"],
  [4, 30, "Reunification Day / Liberation Day", "national", "Vietnam"],
  [5, 3, "Constitution Day", "national", "Poland"],
  [5, 3, "Constitution Memorial Day", "national", "Japan"],
  [5, 4, "Coronation Day", "national", "Thailand"],
  [5, 8, "Liberation Day (Victory in Europe)", "national", "Czechia & Europe"],
  [5, 17, "Constitution Day", "national", "Norway"],
  [5, 19, "Commemoration of Atatürk & Youth Day", "national", "Turkey"],
  [5, 25, "May Revolution Day", "national", "Argentina"],
  [5, 28, "National Day", "national", "Ethiopia"],
  [5, 28, "Republic Day", "national", "Azerbaijan"],
  [5, 29, "Republic Day (Ganatantra Diwas)", "national", "Nepal"],
  [5, 30, "Statehood Day", "national", "Croatia"],
  [6, 1, "Madaraka Day (Self-Governance)", "national", "Kenya"],
  [6, 1, "Pancasila Day", "national", "Indonesia"],
  [6, 2, "Republic Day", "national", "Italy"],
  [6, 5, "Constitution Day", "national", "Denmark"],
  [6, 6, "National Day", "national", "Sweden"],
  [6, 12, "Russia Day", "national", "Russia"],
  [6, 12, "Independence Day", "national", "Philippines"],
  [6, 12, "Democracy Day", "national", "Nigeria"],
  [6, 16, "Youth Day", "national", "South Africa"],
  [6, 17, "National Day", "national", "Iceland"],
  [6, 19, "Juneteenth (Freedom Day)", "national", "United States"],
  [6, 28, "Constitution Day", "national", "Ukraine"],
  [7, 1, "Canada Day", "national", "Canada"],
  [7, 4, "Independence Day", "national", "United States"],
  [7, 5, "Independence Day", "national", "Venezuela"],
  [7, 9, "Independence Day", "national", "Argentina"],
  [7, 14, "Bastille Day", "national", "France"],
  [7, 17, "Constitution Day (Jeheonjeol)", "national", "South Korea"],
  [7, 20, "Independence Day", "national", "Colombia"],
  [7, 21, "National Day", "national", "Belgium"],
  [7, 23, "Revolution Day", "national", "Egypt"],
  [7, 26, "Kargil Vijay Diwas", "national", "India"],
  [7, 28, "Independence Day", "national", "Peru"],
  [7, 28, "King Vajiralongkorn's Birthday", "national", "Thailand"],
  [8, 1, "National Day", "national", "Switzerland"],
  [8, 9, "National Day", "national", "Singapore"],
  [8, 12, "Queen Mother's Birthday (Mother's Day)", "national", "Thailand"],
  [8, 14, "Independence Day", "national", "Pakistan"],
  [8, 15, "Independence Day", "national", "India"],
  [8, 15, "Liberation Day", "national", "South Korea"],
  [8, 17, "Independence Day", "national", "Indonesia"],
  [8, 19, "Independence Day", "national", "Afghanistan"],
  [8, 24, "Independence Day", "national", "Ukraine"],
  [8, 30, "Victory Day", "national", "Turkey"],
  [8, 31, "Independence Day", "national", "Malaysia"],
  [9, 2, "National Day", "national", "Vietnam"],
  [9, 7, "Independence Day", "national", "Brazil"],
  [9, 9, "National Day", "national", "North Korea"],
  [9, 16, "Independence Day", "national", "Mexico"],
  [9, 16, "Malaysia Day", "national", "Malaysia"],
  [9, 17, "Constitution Day & Citizenship Day", "national", "United States"],
  [9, 18, "Independence Day", "national", "Chile"],
  [9, 19, "Constitution Day (Sambidhan Diwas)", "national", "Nepal"],
  [9, 23, "National Day", "national", "Saudi Arabia"],
  [9, 24, "National Heritage Day", "national", "South Africa"],
  [9, 28, "Statehood Day", "national", "Czechia"],
  [9, 30, "National Day for Truth and Reconciliation", "national", "Canada"],
  [10, 1, "National Day", "national", "China"],
  [10, 1, "Independence Day", "national", "Nigeria"],
  [10, 1, "Defenders of Ukraine Day", "national", "Ukraine"],
  [10, 2, "Gandhi Jayanti (Non-Violence Day)", "national", "India"],
  [10, 3, "Unity Day", "national", "Germany"],
  [10, 3, "National Foundation Day (Gaecheonjeol)", "national", "South Korea"],
  [10, 5, "Republic Day", "national", "Portugal"],
  [10, 9, "Hangul Day (Korean Alphabet Day)", "national", "South Korea"],
  [10, 12, "National Day", "national", "Spain"],
  [10, 20, "Mashujaa Day (Heroes' Day)", "national", "Kenya"],
  [10, 23, "King Chulalongkorn Memorial Day", "national", "Thailand"],
  [10, 26, "National Day", "national", "Austria"],
  [10, 28, "Statehood Day", "national", "Czechia"],
  [10, 28, "Ohi Day", "national", "Greece"],
  [10, 29, "Republic Day", "national", "Turkey"],
  [10, 31, "National Unity Day (Rashtriya Ekta Diwas)", "national", "India"],
  [11, 3, "Culture Day (Bunka no Hi)", "national", "Japan"],
  [11, 9, "Independence Day", "national", "Cambodia"],
  [11, 9, "Iqbal Day", "national", "Pakistan"],
  [11, 11, "Independence Day", "national", "Poland"],
  [11, 11, "Veterans Day / Remembrance Day", "national", "United States & Commonwealth"],
  [11, 15, "Republic Proclamation Day", "national", "Brazil"],
  [11, 17, "Struggle for Freedom & Democracy Day (Velvet Revolution)", "national", "Czechia & Slovakia"],
  [11, 18, "Proclamation Day", "national", "Latvia"],
  [11, 20, "Revolution Day", "national", "Mexico"],
  [11, 23, "Labor Thanksgiving Day", "national", "Japan"],
  [11, 26, "Constitution Day (Samvidhan Divas)", "national", "India"],
  [11, 30, "Commemoration Day", "national", "United Arab Emirates"],
  [12, 1, "Great Union Day", "national", "Romania"],
  [12, 2, "National Day", "national", "United Arab Emirates"],
  [12, 5, "The King's Birthday", "national", "Thailand"],
  [12, 6, "Independence Day", "national", "Finland"],
  [12, 6, "Constitution Day", "national", "Spain"],
  [12, 10, "Constitution Day", "national", "Thailand"],
  [12, 12, "Jamhuri Day", "national", "Kenya"],
  [12, 16, "Victory Day (Bijoy Dibos)", "national", "Bangladesh"],
  [12, 16, "Day of Reconciliation", "national", "South Africa"],
  [12, 25, "Quaid-e-Azam Day", "national", "Pakistan"],
];

/* -------------------------------------------- Movable Feasts, Western Easter */

/**
 * Easter Sunday for a Gregorian year by the Meeus/Jones/Butcher computus.
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

const EASTER_EVENTS = [
  { offset: -46, name: "Ash Wednesday", category: "religious" },
  { offset: -7, name: "Palm Sunday", category: "religious" },
  { offset: -2, name: "Good Friday", category: "religious" },
  { offset: 0, name: "Easter Sunday", category: "religious" },
  { offset: 1, name: "Easter Monday", category: "religious" },
  { offset: 39, name: "Ascension Day", category: "religious" },
  { offset: 49, name: "Pentecost (Whit Sunday)", category: "religious" },
];

function easterEventsFor(date) {
  const DAY = 86_400_000;
  const stamp = Date.UTC(date.year, date.month - 1, date.day);
  const events = [];
  for (const { offset, name, category } of EASTER_EVENTS) {
    const target = new Date(stamp - offset * DAY);
    const easter = easterSunday(target.getUTCFullYear());
    if (target.getUTCMonth() + 1 === easter.month && target.getUTCDate() === easter.day && target.getUTCFullYear() === easter.year) {
      events.push({ id: `easter-${offset}`, name, category: category || "religious" });
    }
  }
  return events;
}

/* ---------------------------------- Feasts Counted in Other Calendars */

/**
 * Rules checked inside the calendar system the celebration belongs to.
 */
export const SYSTEM_EVENTS = [
  /* Chinese Lunisolar Calendar */
  { system: "chinese", month: 1, day: 1, name: "Chinese New Year", category: "cultural", place: "China & East Asia" },
  { system: "chinese", month: 1, day: 15, name: "Lantern Festival", category: "cultural", place: "China & East Asia" },
  { system: "chinese", month: 2, day: 2, name: "Longtaitou (Dragon Head Raising)", category: "cultural", place: "China" },
  { system: "chinese", month: 5, day: 5, name: "Dragon Boat Festival", category: "cultural", place: "China & East Asia" },
  { system: "chinese", month: 7, day: 7, name: "Qixi Festival", category: "cultural", place: "China & East Asia" },
  { system: "chinese", month: 7, day: 15, name: "Ghost Festival", category: "cultural", place: "China & East Asia" },
  { system: "chinese", month: 8, day: 15, name: "Mid-Autumn Festival", category: "cultural", place: "China & East Asia" },
  { system: "chinese", month: 9, day: 9, name: "Double Ninth Festival", category: "cultural", place: "China & East Asia" },
  { system: "chinese", month: 12, day: 8, name: "Laba Festival", category: "cultural", place: "China" },
  { system: "chinese", month: 12, day: 23, name: "Little New Year (Kitchen God)", category: "cultural", place: "China" },

  /* Korean Lunisolar Calendar (Dangi) */
  { system: "dangi", month: 1, day: 1, name: "Seollal — Korean New Year", category: "cultural", place: "Korea" },
  { system: "dangi", month: 1, day: 15, name: "Daeboreum (First Full Moon)", category: "cultural", place: "Korea" },
  { system: "dangi", month: 3, day: 3, name: "Samjinnal (Spring Return)", category: "cultural", place: "Korea" },
  { system: "dangi", month: 5, day: 5, name: "Dano / Surit-nal Festival", category: "cultural", place: "Korea" },
  { system: "dangi", month: 6, day: 15, name: "Yudu Water Festival", category: "cultural", place: "Korea" },
  { system: "dangi", month: 7, day: 7, name: "Chilseok Festival", category: "cultural", place: "Korea" },
  { system: "dangi", month: 7, day: 15, name: "Baekjung Festival", category: "cultural", place: "Korea" },
  { system: "dangi", month: 8, day: 15, name: "Chuseok — Korean harvest festival", category: "cultural", place: "Korea" },
  { system: "dangi", month: 9, day: 9, name: "Jungyangjeol Festival", category: "cultural", place: "Korea" },

  /* Persian Solar Hijri Calendar */
  { system: "persian", month: 1, day: 1, name: "Nowruz — Persian New Year", category: "cultural", place: "Iran, Afghanistan & Central Asia" },
  { system: "persian", month: 1, day: 12, name: "Islamic Republic Day", category: "national", place: "Iran" },
  { system: "persian", month: 1, day: 13, name: "Sizdah Be-dar (Nature Day)", category: "cultural", place: "Iran & Persianate world" },
  { system: "persian", month: 3, day: 15, name: "Khordad 15 Uprising", category: "national", place: "Iran" },
  { system: "persian", month: 4, day: 13, name: "Tirgan (Midsummer Festival)", category: "cultural", place: "Iran" },
  { system: "persian", month: 5, day: 28, name: "Independence Day (Asad 28)", category: "national", place: "Afghanistan" },
  { system: "persian", month: 7, day: 16, name: "Mehregan (Autumn Festival of Light)", category: "cultural", place: "Iran" },
  { system: "persian", month: 9, day: 30, name: "Shab-e Yalda (Winter Solstice Eve)", category: "cultural", place: "Iran & Persianate world" },
  { system: "persian", month: 11, day: 10, name: "Sadeh (Mid-Winter Fire Festival)", category: "cultural", place: "Iran" },
  { system: "persian", month: 11, day: 22, name: "Revolution Day (22 Bahman)", category: "national", place: "Iran" },
  { system: "persian", month: 12, day: 29, name: "Oil Nationalization Day", category: "national", place: "Iran" },

  /* Islamic Tabular Hijri Calendar */
  { system: "islamic", month: 1, day: 1, name: "Islamic New Year", category: "religious", approximate: true },
  { system: "islamic", month: 1, day: 10, name: "Day of Ashura", category: "religious", approximate: true },
  { system: "islamic", month: 3, day: 12, name: "Mawlid — the Prophet's Birthday", category: "religious", approximate: true },
  { system: "islamic", month: 7, day: 27, name: "Isra and Mi'raj", category: "religious", approximate: true },
  { system: "islamic", month: 8, day: 15, name: "Mid-Sha'ban (Laylat al-Bara'at)", category: "religious", approximate: true },
  { system: "islamic", month: 9, day: 1, name: "Ramadan begins", category: "religious", approximate: true },
  { system: "islamic", month: 9, day: 27, name: "Laylat al-Qadr (Night of Power)", category: "religious", approximate: true },
  { system: "islamic", month: 10, day: 1, name: "Eid al-Fitr", category: "religious", approximate: true },
  { system: "islamic", month: 10, day: 2, name: "Eid al-Fitr (Day 2)", category: "religious", approximate: true },
  { system: "islamic", month: 12, day: 9, name: "Day of Arafah", category: "religious", approximate: true },
  { system: "islamic", month: 12, day: 10, name: "Eid al-Adha", category: "religious", approximate: true },
  { system: "islamic", month: 12, day: 11, name: "Eid al-Adha (Day 2)", category: "religious", approximate: true },

  /* Hebrew Lunisolar Calendar */
  { system: "hebrew", month: 7, day: 1, name: "Rosh Hashanah", category: "religious" },
  { system: "hebrew", month: 7, day: 2, name: "Rosh Hashanah (Day 2)", category: "religious" },
  { system: "hebrew", month: 7, day: 3, name: "Fast of Gedaliah", category: "religious" },
  { system: "hebrew", month: 7, day: 10, name: "Yom Kippur", category: "religious" },
  { system: "hebrew", month: 7, day: 15, name: "Sukkot begins", category: "religious" },
  { system: "hebrew", month: 7, day: 21, name: "Hoshana Rabbah", category: "religious" },
  { system: "hebrew", month: 7, day: 22, name: "Shemini Atzeret & Simchat Torah", category: "religious" },
  { system: "hebrew", month: 9, day: 25, name: "Hanukkah begins", category: "religious" },
  { system: "hebrew", month: 10, day: 10, name: "Fast of 10th of Tevet", category: "religious" },
  { system: "hebrew", month: 11, day: 15, name: "Tu BiShvat", category: "religious" },
  { system: "hebrew", month: 12, day: 14, name: "Purim", category: "religious" },
  { system: "hebrew", month: 13, day: 14, name: "Purim (in leap years)", category: "religious" },
  { system: "hebrew", month: 1, day: 15, name: "Passover begins", category: "religious" },
  { system: "hebrew", month: 1, day: 21, name: "Passover (Seventh Day)", category: "religious" },
  { system: "hebrew", month: 1, day: 27, name: "Yom HaShoah (Holocaust Remembrance)", category: "national", place: "Israel" },
  { system: "hebrew", month: 2, day: 4, name: "Yom HaZikaron (Fallen Soldiers Day)", category: "national", place: "Israel" },
  { system: "hebrew", month: 2, day: 5, name: "Independence Day (Yom Ha'atzmaut)", category: "national", place: "Israel" },
  { system: "hebrew", month: 2, day: 18, name: "Lag BaOmer", category: "religious" },
  { system: "hebrew", month: 2, day: 28, name: "Jerusalem Day (Yom Yerushalayim)", category: "national", place: "Israel" },
  { system: "hebrew", month: 3, day: 6, name: "Shavuot", category: "religious" },
  { system: "hebrew", month: 5, day: 9, name: "Tisha B'Av", category: "religious" },

  /* Indian National Calendar (Śaka) */
  { system: "indian", month: 1, day: 1, name: "Saka New Year (Chaitra 1)", category: "cultural", place: "India" },
  { system: "indian", month: 1, day: 24, name: "Dr. Ambedkar Jayanti (24 Chaitra)", category: "national", place: "India" },
  { system: "indian", month: 5, day: 4, name: "Kargil Vijay Diwas (4 Shravana)", category: "national", place: "India" },
  { system: "indian", month: 5, day: 24, name: "Independence Day (24 Shravana)", category: "national", place: "India" },
  { system: "indian", month: 7, day: 10, name: "Gandhi Jayanti (10 Ashvina)", category: "national", place: "India" },
  { system: "indian", month: 8, day: 9, name: "National Unity Day (9 Kartika)", category: "national", place: "India" },
  { system: "indian", month: 9, day: 5, name: "Constitution Day (5 Agrahayana)", category: "national", place: "India" },
  { system: "indian", month: 11, day: 3, name: "Netaji Jayanti (3 Magha)", category: "national", place: "India" },
  { system: "indian", month: 11, day: 6, name: "Republic Day (6 Magha)", category: "national", place: "India" },
  { system: "indian", month: 12, day: 9, name: "National Science Day (9 Phalguna)", category: "national", place: "India" },
];

/** Nepal counts its national days in Bikram Sambat directly. */
export const BIKRAM_EVENTS = [
  { month: 1, day: 1, name: "Nepali New Year (Naya Barsha)", category: "cultural", place: "Nepal" },
  { month: 1, day: 11, name: "Loktantra Diwas (Democracy Day)", category: "national", place: "Nepal" },
  { month: 2, day: 15, name: "Republic Day (Ganatantra Diwas)", category: "national", place: "Nepal" },
  { month: 6, day: 3, name: "Constitution Day (Sambidhan Diwas)", category: "national", place: "Nepal" },
  { month: 9, day: 27, name: "National Unity Day (Prithvi Jayanti)", category: "national", place: "Nepal" },
  { month: 10, day: 16, name: "Martyrs' Memorial Day (Sahid Diwas)", category: "national", place: "Nepal" },
  { month: 11, day: 7, name: "Democracy Day (Prajatantra Diwas)", category: "national", place: "Nepal" },
];

/*
 * Nepal's published festival tables for 2081–2084 BS (2025–2027 Gregorian).
 */
export const NEPALI_FESTIVAL_DATES = [
  /* 2081/2082 BS — 2025 Season */
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

  /* 2082 BS — 2026 Spring Season */
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

  /* 2083 BS — 2026 Autumn Festival Season */
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

  /* 2083/2084 BS — 2027 Season */
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

/**
 * When a specific calendar system is the active one (anything but Gregorian),
 * its national/cultural/religious events are scoped to that calendar's own
 * home place — Nepal for Bikram Sambat, China for the Chinese calendar, and
 * so on. International-day observances (the "world" set) stay visible under
 * every calendar, since they are dated by convention rather than owned by
 * one culture. Gregorian keeps the full, unscoped worldwide table — it is
 * the "everything" civil calendar most dashboards already show.
 */
export const SYSTEM_HOME_PLACES = {
  bikram: ["Nepal"],
  chinese: ["China"],
  dangi: ["Korea", "South Korea", "North Korea"],
  hebrew: ["Israel"],
  islamic: [],
  persian: ["Iran", "Afghanistan"],
  indian: ["India"],
  buddhist: ["Thailand"],
  japanese: ["Japan"],
};

function placeMatches(place, allowedPlaces) {
  if (!allowedPlaces || allowedPlaces.length === 0) return false;
  if (!place) return false;
  return allowedPlaces.some((allowed) => place.includes(allowed));
}

function addNepaliDate(event, bs) {
  return {
    ...event,
    nepali: true,
    system: "bikram",
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
 * Which calendar system "owns" an event: the one whose own dates and
 * culture it belongs to. Events computed straight off a calendar system
 * (Chinese New Year, Ramadan, Rosh Hashanah, Nepali festivals…) already
 * carry that system's id. Fixed Gregorian-dated national and cultural days
 * are attributed by their place. Anything left over (Christmas, Easter,
 * generic international days) has no single owning calendar — it only
 * shows on the unscoped Gregorian view.
 */
function ownerSystem(event) {
  if (event.system) return event.system;
  if (event.place) {
    for (const [systemId, places] of Object.entries(SYSTEM_HOME_PLACES)) {
      if (placeMatches(event.place, places)) return systemId;
    }
  }
  return null;
}

/**
 * When a specific calendar is active, keep only that calendar's own
 * national/cultural/religious dates plus the always-shared international
 * days. The unscoped Gregorian view keeps every event, exactly as before.
 */
function scopeToSystem(events, systemId) {
  if (!systemId || systemId === "gregorian") return events;
  return events.filter((event) => event.category === "world" || ownerSystem(event) === systemId);
}

/**
 * Every event landing on a plain Gregorian date, filtered by the enabled
 * sets and — when a calendar system other than Gregorian is active — scoped
 * to that calendar's own specification (its own national days, festivals,
 * and religious observances only).
 */
export function eventsForDate(date, sets, systemId) {
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
        if (!setEnabled(sets, rule.category)) continue;
        events.push({ id: `${rule.system}-${rule.month}-${rule.day}-${rule.name}`, ...rule });
      }
    }
  }

  // Nepal's national days are published both as a fixed Gregorian date and
  // as their true Bikram Sambat date; when both rules land on the same day
  // they describe the same holiday. Keep the Bikram Sambat-tagged copy —
  // it carries the BS month/day the specification card and detail view show.
  const deduped = [];
  const seen = new Map();
  for (const event of events) {
    const key = `${event.category}:${event.name}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, event);
      deduped.push(event);
    } else if (event.bs && !existing.bs) {
      const index = deduped.indexOf(existing);
      deduped[index] = event;
      seen.set(key, event);
    }
  }

  const order = new Map(EVENT_CATEGORIES.map((category, index) => [category.id, index]));
  const sorted = deduped.sort((a, b) => order.get(a.category) - order.get(b.category) || a.name.localeCompare(b.name));
  return scopeToSystem(sorted, systemId);
}

export const HOLIDAY_SET_IDS = ALL_SETS;
