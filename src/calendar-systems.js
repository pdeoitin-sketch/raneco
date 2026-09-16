/**
 * The calendars a date can wear besides the Gregorian one.
 *
 * The alarm and timer spine remains Gregorian, while the calendar view
 * and month grid provide genuine month-wise calendars — showing one full
 * month duration of the selected calendar system (e.g. Bhadra 1–31,
 * Ashwin 1–30, Ramadan 1–30, Tishri 1–30, Shahrivar 1–31) with Gregorian
 * dates underneath.
 *
 * Supported calendar systems:
 *   1. Gregorian (International standard ISO 8601)
 *   2. Bikram Sambat (Nepal's official solar calendar, ~57 years ahead)
 *   3. Chinese calendar (Nongli — traditional East Asian lunisolar)
 *   4. Korean calendar (Dangi — traditional Korean lunisolar)
 *   5. Hebrew calendar (Lunisolar calendar of Jewish tradition & Israel)
 *   6. Islamic calendar (Tabular Hijri — lunar calendar of the Muslim world)
 *   7. Persian calendar (Solar Hijri / Jalali — astronomical solar of Iran & Afghanistan)
 *   8. Indian national calendar (Śaka Samvat — official civil solar calendar of India)
 *   9. Thai Buddhist calendar (Solar calendar counted in Buddhist Era, 543 ahead)
 *  10. Japanese calendar (Wareki — solar months counted in Imperial eras, Reiwa now)
 */

const DAY = 86_400_000;

/* ------------------------------------------------------------------ Vikram Samvat */

/** Baisakh 1, 2000 BS = 1943-04-14 AD. */
export const BS_EPOCH = { year: 1943, month: 4, day: 14 };
export const BS_FIRST_YEAR = 2000;
export const BS_LAST_YEAR = 2090;

export const BS_MONTHS = [
  { id: "baisakh", name: "Baisakh", aliases: ["Baishakh", "Baisak"], native: "बैशाख", short: "Bai", days: "30–31", season: "Spring (Basanta) · New Year" },
  { id: "jestha", name: "Jestha", aliases: ["Jeth"], native: "जेठ", short: "Jes", days: "31–32", season: "Summer (Grishma) · Republic Day" },
  { id: "ashadh", name: "Ashadh", aliases: ["Asadh", "Asar"], native: "असार", short: "Asa", days: "31–32", season: "Monsoon (Varsha) · Rice Planting" },
  { id: "shrawan", name: "Shrawan", aliases: ["Shravan", "Saun"], native: "साउन", short: "Shr", days: "31–32", season: "Monsoon (Varsha) · Holy Shiva month" },
  { id: "bhadra", name: "Bhadra", aliases: ["Bhadau"], native: "भदौ", short: "Bha", days: "31–32", season: "Monsoon / Autumn · Teej & Indra Jatra" },
  { id: "ashwin", name: "Ashwin", aliases: ["Ashoj", "Asoj"], native: "असोज", short: "Asw", days: "30–31", season: "Autumn (Sharad) · Dashain & Constitution Day" },
  { id: "kartik", name: "Kartik", aliases: ["Kattik"], native: "कात्तिक", short: "Kar", days: "29–30", season: "Autumn (Sharad) · Tihar, Diwali & Chhath" },
  { id: "mangsir", name: "Mangsir", aliases: ["Margashirsha", "Mansir"], native: "मंसिर", short: "Man", days: "29–30", season: "Late Autumn (Hemanta) · Harvest" },
  { id: "poush", name: "Poush", aliases: ["Paush", "Push"], native: "पुस", short: "Pou", days: "29–30", season: "Winter (Shishir) · National Unity Day" },
  { id: "magh", name: "Magh", aliases: ["Magha"], native: "माघ", short: "Mag", days: "29–30", season: "Winter (Shishir) · Maghe Sankranti & Martyrs' Day" },
  { id: "falgun", name: "Falgun", aliases: ["Phagun"], native: "फागुन", short: "Fal", days: "29–30", season: "Late Winter / Spring · Democracy Day & Holi" },
  { id: "chaitra", name: "Chaitra", aliases: ["Chait"], native: "चैत", short: "Cha", days: "30–31", season: "Spring (Basanta) · Chaite Dashain & Ghode Jatra" },
];

/**
 * Month lengths per BS year, Baisakh through Chaitra, years 2000–2090.
 * One row per year. (The table is the published Nepali calendar arithmetic
 * also shipped by nepali-date-converter and node-nepali-datetime.)
 */
const BS_ROWS = `30,32,31,32,31,30,30,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 30,32,31,32,31,30,30,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,29,30,30,29,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,29,30,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,29,30,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,30,29,31 31,31,31,32,31,31,30,29,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,30 31,32,31,32,31,30,30,30,29,30,29,31 31,31,31,32,31,31,30,29,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 30,32,31,32,31,30,30,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,31,32,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 30,32,31,32,31,30,30,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 30,32,31,32,31,31,29,30,30,29,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,29,30,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,29,30,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,30,29,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,30 31,32,31,32,31,30,30,30,29,30,29,31 31,31,31,32,31,31,30,29,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,30 31,32,31,32,31,30,30,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,31,32,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 30,32,31,32,31,30,30,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 30,32,31,32,31,31,29,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,29,30,30,29,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,29,30,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 31,31,31,32,31,31,30,29,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,30 31,32,31,32,31,30,30,30,29,30,29,31 31,31,31,32,31,31,30,29,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,30 31,32,31,32,31,30,30,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,31,31,31,30,29,30,29,30,30 31,32,31,32,31,30,30,30,29,29,30,31 30,32,31,32,31,30,30,30,29,30,29,31 31,31,32,31,31,31,30,29,30,29,30,30 31,31,32,31,31,31,30,30,29,30,30,30 30,31,32,32,30,31,30,30,29,30,30,30 30,32,31,32,31,30,30,30,29,30,30,30 30,32,31,32,31,30,30,30,29,30,30,30`;

export const BS_YEAR_MONTHS = BS_ROWS.split(" ").map((row) => row.split(",").map(Number));

/** Days completed before each BS year, for a fast year lookup. */
export const BS_YEAR_OFFSETS = (() => {
  const offsets = [];
  let total = 0;
  for (const months of BS_YEAR_MONTHS) {
    offsets.push(total);
    total += months.reduce((sum, days) => sum + days, 0);
  }
  return { offsets, total };
})();

export const BS_EPOCH_UTC = Date.UTC(BS_EPOCH.year, BS_EPOCH.month - 1, BS_EPOCH.day);

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

/* ------------------------------------------------------------------- Month catalogues for all calendars */

export const GREGORIAN_MONTHS = [
  { ordinal: 1, name: "January", short: "Jan", days: 31, season: "Winter (Northern) / Summer (Southern)" },
  { ordinal: 2, name: "February", short: "Feb", days: "28–29", season: "Leap year every 4 years" },
  { ordinal: 3, name: "March", short: "Mar", days: 31, season: "Spring Equinox (Northern)" },
  { ordinal: 4, name: "April", short: "Apr", days: 30, season: "Spring (Northern) / Earth Day" },
  { ordinal: 5, name: "May", short: "May", days: 31, season: "Workers' Day & Spring" },
  { ordinal: 6, name: "June", short: "Jun", days: 30, season: "Summer Solstice (Northern)" },
  { ordinal: 7, name: "July", short: "Jul", days: 31, season: "Midsummer & Independence Days" },
  { ordinal: 8, name: "August", short: "Aug", days: 31, season: "Late Summer & Liberation Days" },
  { ordinal: 9, name: "September", short: "Sep", days: 30, season: "Autumn Equinox & Democracy Day" },
  { ordinal: 10, name: "October", short: "Oct", days: 31, season: "Autumn & UN Day" },
  { ordinal: 11, name: "November", short: "Nov", days: 30, season: "Late Autumn & Peace Days" },
  { ordinal: 12, name: "December", short: "Dec", days: 31, season: "Winter Solstice & Human Rights Day" },
];

export const ISLAMIC_MONTHS = [
  { ordinal: 1, name: "Muharram", native: "مُحَرَّم", short: "Muh", days: 30, note: "Islamic New Year & Ashura" },
  { ordinal: 2, name: "Safar", native: "صَفَر", short: "Saf", days: 29, note: "Second lunar month" },
  { ordinal: 3, name: "Rabi' al-Awwal", native: "رَبِيع الأوّل", short: "Rb1", days: 30, note: "Mawlid — Prophet's Birthday" },
  { ordinal: 4, name: "Rabi' al-Thani", native: "رَبِيع الآخِر", short: "Rb2", days: 29, note: "Fourth lunar month" },
  { ordinal: 5, name: "Jumada al-Awwal", native: "جُمَادَى الأُولَى", short: "Jm1", days: 30, note: "Fifth lunar month" },
  { ordinal: 6, name: "Jumada al-Thani", native: "جُمَادَى الآخِرَة", short: "Jm2", days: 29, note: "Sixth lunar month" },
  { ordinal: 7, name: "Rajab", native: "رَجَب", short: "Raj", days: 30, note: "Isra and Mi'raj · Sacred month" },
  { ordinal: 8, name: "Sha'ban", native: "شَعْبَان", short: "Sha", days: 29, note: "Mid-Sha'ban / Laylat al-Bara'at" },
  { ordinal: 9, name: "Ramadan", native: "رَمَضَان", short: "Ram", days: 30, note: "Holy Fasting month & Laylat al-Qadr" },
  { ordinal: 10, name: "Shawwal", native: "شَوَّال", short: "Shw", days: 29, note: "Eid al-Fitr (Festival of Breaking the Fast)" },
  { ordinal: 11, name: "Dhu al-Qi'dah", native: "ذُو القَعْدَة", short: "Qid", days: 30, note: "Month before Hajj · Sacred month" },
  { ordinal: 12, name: "Dhu al-Hijjah", native: "ذُو الحِجَّة", short: "Hij", days: "29–30", note: "Hajj, Day of Arafah & Eid al-Adha" },
];

export const HEBREW_MONTHS_CATALOGUE = [
  { ordinal: 1, name: "Nisan", native: "נִיסָן", short: "Nis", days: 30, note: "Passover / Pesach · Biblical first month" },
  { ordinal: 2, name: "Iyar", native: "אִיָּר", short: "Iya", days: 29, note: "Yom Ha'atzmaut (Israel Independence) & Lag BaOmer" },
  { ordinal: 3, name: "Sivan", native: "סִיוָן", short: "Siv", days: 30, note: "Shavuot (Feast of Weeks / Giving of Torah)" },
  { ordinal: 4, name: "Tammuz", native: "תַּמּוּז", short: "Tam", days: 29, note: "Fast of Tammuz" },
  { ordinal: 5, name: "Av", native: "אָב", short: "Av", days: 30, note: "Tisha B'Av & Tu B'Av" },
  { ordinal: 6, name: "Elul", native: "אֱלוּל", short: "Elu", days: 29, note: "Month of Repentance & preparation" },
  { ordinal: 7, name: "Tishri", native: "תִּשְׁרֵי", short: "Tis", days: 30, note: "Rosh Hashanah, Yom Kippur, Sukkot, Simchat Torah" },
  { ordinal: 8, name: "Cheshvan", native: "חֶשְׁוָן", short: "Che", days: "29–30", note: "Marcheshvan · Autumn month" },
  { ordinal: 9, name: "Kislev", native: "כִּסְלֵו", short: "Kis", days: "29–30", note: "Hanukkah (Festival of Lights)" },
  { ordinal: 10, name: "Tevet", native: "טֵבֵת", short: "Tev", days: 29, note: "Fast of 10th of Tevet" },
  { ordinal: 11, name: "Shevat", native: "שְׁבָט", short: "She", days: 30, note: "Tu BiShvat (New Year for Trees)" },
  { ordinal: 12, name: "Adar I", native: "אֲדָר א׳", short: "Ad1", days: 30, note: "Intercalary leap month in 19-year cycle" },
  { ordinal: 13, name: "Adar / Adar II", native: "אֲדָר ב׳", short: "Ad2", days: 29, note: "Purim (Feast of Lots)" },
];

export const PERSIAN_MONTHS = [
  { ordinal: 1, name: "Farvardin", native: "فروردین", short: "Far", days: 31, season: "Nowruz (New Year) & Spring Equinox" },
  { ordinal: 2, name: "Ordibehesht", native: "اردیبهشت", short: "Ord", days: 31, season: "Mid-Spring" },
  { ordinal: 3, name: "Khordad", native: "خرداد", short: "Kho", days: 31, season: "Late Spring" },
  { ordinal: 4, name: "Tir", native: "تیر", short: "Tir", days: 31, season: "Summer Solstice & Tirgan" },
  { ordinal: 5, name: "Mordad", native: "مرداد", short: "Mor", days: 31, season: "Mid-Summer (Amordad)" },
  { ordinal: 6, name: "Shahrivar", native: "شهریور", short: "Sha", days: 31, season: "Late Summer" },
  { ordinal: 7, name: "Mehr", native: "مهر", short: "Meh", days: 30, season: "Autumn Equinox & Mehregan festival" },
  { ordinal: 8, name: "Aban", native: "آبان", short: "Aba", days: 30, season: "Mid-Autumn" },
  { ordinal: 9, name: "Azar", native: "آذر", short: "Aza", days: 30, season: "Shab-e Yalda (Winter Solstice)" },
  { ordinal: 10, name: "Dey", native: "دی", short: "Dey", days: 30, season: "Early Winter" },
  { ordinal: 11, name: "Bahman", native: "بهمن", short: "Bah", days: 30, season: "Mid-Winter & Sadeh fire festival" },
  { ordinal: 12, name: "Esfand", native: "اسفند", short: "Esf", days: "29–30", season: "Chaharshanbe Suri & Year End" },
];

export const INDIAN_MONTHS = [
  { ordinal: 1, name: "Chaitra", native: "चैत्र", short: "Cha", days: "30–31", season: "Saka New Year (Mar 22 / 21) & Spring" },
  { ordinal: 2, name: "Vaishakha", native: "वैशाख", short: "Vai", days: 31, season: "Buddha Purnima & Mid-Spring" },
  { ordinal: 3, name: "Jyeshtha", native: "ज्येष्ठ", short: "Jye", days: 31, season: "Summer" },
  { ordinal: 4, name: "Ashadha", native: "आषाढ", short: "Ash", days: 31, season: "Monsoon onset · Guru Purnima" },
  { ordinal: 5, name: "Shravana", native: "श्रावण", short: "Shr", days: 31, season: "Monsoon · Independence Day (24 Shravana)" },
  { ordinal: 6, name: "Bhadrapada", native: "भाद्रपद", short: "Bha", days: 31, season: "Ganesh Chaturthi & Janmashtami" },
  { ordinal: 7, name: "Ashvina", native: "आश्विन", short: "Asw", days: 30, season: "Navratri, Dussehra & Gandhi Jayanti" },
  { ordinal: 8, name: "Kartika", native: "कार्तिक", short: "Kar", days: 30, season: "Diwali & National Unity Day" },
  { ordinal: 9, name: "Agrahayana", native: "अग्रहायण", short: "Agr", days: 30, season: "Margashirsha · Constitution Day" },
  { ordinal: 10, name: "Pausha", native: "पौष", short: "Pau", days: 30, season: "Makar Sankranti / Pongal" },
  { ordinal: 11, name: "Magha", native: "माघ", short: "Mag", days: 30, season: "Republic Day (6 Magha) & Vasant Panchami" },
  { ordinal: 12, name: "Phalguna", native: "फाल्गुन", short: "Pha", days: 30, season: "Holi & National Science Day" },
];

export const CHINESE_MONTHS = [
  { ordinal: 1, name: "1st Lunar Month", native: "正月 (Zhengyue)", short: "M1", days: "29–30", note: "Spring Festival & Chinese New Year" },
  { ordinal: 2, name: "2nd Lunar Month", native: "二月 (Eryue)", short: "M2", days: "29–30", note: "Longtaitou (Dragon Head Raising)" },
  { ordinal: 3, name: "3rd Lunar Month", native: "三月 (Sanyue)", short: "M3", days: "29–30", note: "Qingming Festival (Tomb Sweeping)" },
  { ordinal: 4, name: "4th Lunar Month", native: "四月 (Siyue)", short: "M4", days: "29–30", note: "Early Summer" },
  { ordinal: 5, name: "5th Lunar Month", native: "五月 (Wuyue)", short: "M5", days: "29–30", note: "Dragon Boat Festival (Duanwu)" },
  { ordinal: 6, name: "6th Lunar Month", native: "六月 (Liuyue)", short: "M6", days: "29–30", note: "Midsummer" },
  { ordinal: 7, name: "7th Lunar Month", native: "七月 (Qiyue)", short: "M7", days: "29–30", note: "Qixi (Double Seventh) & Ghost Festival" },
  { ordinal: 8, name: "8th Lunar Month", native: "八月 (Bayue)", short: "M8", days: "29–30", note: "Mid-Autumn Moon Festival" },
  { ordinal: 9, name: "9th Lunar Month", native: "九月 (Jiuyue)", short: "M9", days: "29–30", note: "Double Ninth Festival (Chongyang)" },
  { ordinal: 10, name: "10th Lunar Month", native: "十月 (Shiyue)", short: "M10", days: "29–30", note: "Winter onset" },
  { ordinal: 11, name: "11th Lunar Month", native: "冬月 (Dongyue)", short: "M11", days: "29–30", note: "Dongzhi (Winter Solstice)" },
  { ordinal: 12, name: "12th Lunar Month", native: "腊月 (Layue)", short: "M12", days: "29–30", note: "Laba Festival & Kitchen God day" },
];

export const DANGI_MONTHS = [
  { ordinal: 1, name: "1st Lunar Month", native: "정월 (Jeongwol)", short: "M1", days: "29–30", note: "Seollal (Korean New Year) & Daeboreum" },
  { ordinal: 2, name: "2nd Lunar Month", native: "이월 (Iwol)", short: "M2", days: "29–30", note: "Spring onset" },
  { ordinal: 3, name: "3rd Lunar Month", native: "삼월 (Samwol)", short: "M3", days: "29–30", note: "Samjinnal (Swallow return)" },
  { ordinal: 4, name: "4th Lunar Month", native: "사월 (Sawol)", short: "M4", days: "29–30", note: "Chopail (Buddha's Birthday)" },
  { ordinal: 5, name: "5th Lunar Month", native: "오월 (Owol)", short: "M5", days: "29–30", note: "Surit-nal / Dano festival" },
  { ordinal: 6, name: "6th Lunar Month", native: "유월 (Yuwol)", short: "M6", days: "29–30", note: "Yudu water festival" },
  { ordinal: 7, name: "7th Lunar Month", native: "칠월 (Chilwol)", short: "M7", days: "29–30", note: "Chilseok & Baekjung" },
  { ordinal: 8, name: "8th Lunar Month", native: "팔월 (Palwol)", short: "M8", days: "29–30", note: "Chuseok (Korean Harvest Thanksgiving)" },
  { ordinal: 9, name: "9th Lunar Month", native: "구월 (Guwol)", short: "M9", days: "29–30", note: "Jungyangjeol (Chrysanthemum festival)" },
  { ordinal: 10, name: "10th Lunar Month", native: "시월 (Siwol)", short: "M10", days: "29–30", note: "Gaecheonjeol & Autumn harvest" },
  { ordinal: 11, name: "11th Lunar Month", native: "동짓달 (Dongjitdal)", short: "M11", days: "29–30", note: "Dongji (Winter Solstice patjuk)" },
  { ordinal: 12, name: "12th Lunar Month", native: "섣달 (Seotdal)", short: "M12", days: "29–30", note: "Year-end preparation" },
];

export const THAI_MONTHS = [
  { ordinal: 1, name: "January", native: "มกราคม (Makarakhom)", short: "Jan", days: 31, season: "Cool season" },
  { ordinal: 2, name: "February", native: "กุมภาพันธ์ (Kumphaphan)", short: "Feb", days: "28–29", season: "Makha Bucha Day" },
  { ordinal: 3, name: "March", native: "มีนาคม (Minakhom)", short: "Mar", days: 31, season: "Hot season" },
  { ordinal: 4, name: "April", native: "เมษายน (Mesayon)", short: "Apr", days: 30, season: "Chakri Day & Songkran (Thai New Year)" },
  { ordinal: 5, name: "May", native: "พฤษภาคม (Phruetsaphakhom)", short: "May", days: 31, season: "Coronation Day & Visakha Bucha" },
  { ordinal: 6, name: "June", native: "มิถุนายน (Mithunayon)", short: "Jun", days: 30, season: "Rainy season onset" },
  { ordinal: 7, name: "July", native: "กรกฎาคม (Karakadakhom)", short: "Jul", days: 31, season: "Asahna Bucha & King's Birthday" },
  { ordinal: 8, name: "August", native: "สิงหาคม (Singhakhom)", short: "Aug", days: 31, season: "Queen Mother's Birthday / Mother's Day" },
  { ordinal: 9, name: "September", native: "กันยายน (Kanyayon)", short: "Sep", days: 30, season: "Monsoon peak" },
  { ordinal: 10, name: "October", native: "ตุลาคม (Tulakhom)", short: "Oct", days: 31, season: "King Chulalongkorn Day" },
  { ordinal: 11, name: "November", native: "พฤศจิกายน (Phruetsachikayon)", short: "Nov", days: 30, season: "Loy Krathong festival" },
  { ordinal: 12, name: "December", native: "ธันวาคม (Thanwakhom)", short: "Dec", days: 31, season: "King Bhumibol / National Day & Constitution Day" },
];

export const JAPANESE_MONTHS = [
  { ordinal: 1, name: "January", native: "睦月 (Mutsuki / 1月)", short: "Jan", days: 31, season: "Shogatsu (New Year) & Coming of Age Day" },
  { ordinal: 2, name: "February", native: "如月 (Kisaragi / 2月)", short: "Feb", days: "28–29", season: "Setsubun, Foundation Day & Emperor's Birthday" },
  { ordinal: 3, name: "March", native: "弥生 (Yayoi / 3月)", short: "Mar", days: 31, season: "Hinamatsuri & Vernal Equinox Day" },
  { ordinal: 4, name: "April", native: "卯月 (Uzuki / 4月)", short: "Apr", days: 30, season: "Hanami & Showa Day" },
  { ordinal: 5, name: "May", native: "皐月 (Satsuki / 5月)", short: "May", days: 31, season: "Constitution Memorial Day, Greenery & Children's Day" },
  { ordinal: 6, name: "June", native: "水無月 (Minazuki / 6月)", short: "Jun", days: 30, season: "Early Summer rain (Tsuyu)" },
  { ordinal: 7, name: "July", native: "文月 (Fumizuki / 7月)", short: "Jul", days: 31, season: "Tanabata & Marine Day" },
  { ordinal: 8, name: "August", native: "葉月 (Hazuki / 8月)", short: "Aug", days: 31, season: "Mountain Day & Obon festival" },
  { ordinal: 9, name: "September", native: "長月 (Nagatsuki / 9月)", short: "Sep", days: 30, season: "Respect for the Aged & Autumnal Equinox" },
  { ordinal: 10, name: "October", native: "神無月 (Kannazuki / 10月)", short: "Oct", days: 31, season: "Sports Day & Autumn foliage" },
  { ordinal: 11, name: "November", native: "霜月 (Shimotsuki / 11月)", short: "Nov", days: 30, season: "Culture Day, Shichi-Go-San & Labor Thanksgiving" },
  { ordinal: 12, name: "December", native: "師走 (Shiwasu / 12月)", short: "Dec", days: 31, season: "Omisoka (Year End Eve)" },
];

/* ------------------------------------------------------------------- Calendar Systems Catalogue */

export const CALENDAR_SYSTEMS = [
  {
    id: "gregorian",
    label: "No secondary calendar",
    shortLabel: "GREG",
    nativeLabel: "Gregorian",
    place: "Worldwide",
    type: "Solar civil calendar",
    epoch: "1 CE (Anno Domini)",
    rule: "365 days, leap year every 4 years (century rule: divisible by 400). Standard ISO 8601.",
    note: "The international standard calendar with 12 months.",
    kind: "none",
    months: GREGORIAN_MONTHS,
  },
  {
    id: "bikram",
    label: "Bikram Sambat",
    shortLabel: "BS",
    nativeLabel: "विक्रम संवत्",
    place: "Nepal",
    type: "Solar sidereal calendar",
    epoch: "57 BCE (King Vikramaditya era)",
    rule: "12 months with 29–32 days determined by Sankranti (solar ingress into zodiac signs). About 56.7 years ahead of Gregorian.",
    note: "Nepal's official national calendar; year turns at Baisakh 1 (mid-April).",
    kind: "bikram",
    months: BS_MONTHS,
  },
  {
    id: "chinese",
    label: "Chinese calendar",
    shortLabel: "CHN",
    nativeLabel: "农历 / 漢曆",
    place: "China & East Asia",
    type: "Lunisolar calendar",
    epoch: "2637 BCE (Yellow Emperor Huangdi)",
    rule: "Months start on astronomical new moon (29–30 days). Leap months inserted periodically; 60-year sexagenary zodiac cycle.",
    note: "Lunisolar months and zodiac years — Spring Festival, Dragon Boat, Mid-Autumn.",
    kind: "intl",
    calendar: "chinese",
    zodiac: true,
    months: CHINESE_MONTHS,
  },
  {
    id: "dangi",
    label: "Korean calendar (Dangi)",
    shortLabel: "DANGI",
    nativeLabel: "단기 / 음력",
    place: "Korea",
    type: "Lunisolar calendar",
    epoch: "2333 BCE (Dangun founding of Gojoseon)",
    rule: "Lunisolar months (29–30 days) synchronized to Seoul meridian; 24 solar terms (Jeolgi).",
    note: "Korea's traditional lunisolar calendar — Seollal, Chuseok, Daeboreum.",
    kind: "intl",
    calendar: "dangi",
    zodiac: true,
    months: DANGI_MONTHS,
  },
  {
    id: "hebrew",
    label: "Hebrew calendar",
    shortLabel: "HEB",
    nativeLabel: "הלוח העברי",
    place: "Israel & Jewish life",
    type: "Lunisolar calendar",
    epoch: "3761 BCE (Anno Mundi — Creation)",
    rule: "19-year Metonic cycle with 7 leap years adding Adar I (13 months). Days begin and end at sundown.",
    note: "Lunisolar calendar of Jewish tradition — Rosh Hashanah, Yom Kippur, Passover, Hanukkah.",
    kind: "intl",
    calendar: "hebrew",
    months: HEBREW_MONTHS_CATALOGUE,
  },
  {
    id: "islamic",
    label: "Islamic calendar (Hijri)",
    shortLabel: "AH",
    nativeLabel: "التقويم الهجري",
    place: "Muslim world",
    type: "Purely lunar calendar",
    epoch: "622 CE (Hijra to Medina)",
    rule: "12 lunar months of 29–30 days (~354 days/year). Tabular arithmetic; moon sighting may differ by a day.",
    note: "Lunar Hijri calendar — Ramadan, Eid al-Fitr, Eid al-Adha, Mawlid, Islamic New Year.",
    kind: "intl",
    calendar: "islamic",
    approximate: true,
    months: ISLAMIC_MONTHS,
  },
  {
    id: "persian",
    label: "Persian calendar",
    shortLabel: "AP",
    nativeLabel: "گاه‌شماری هجری خورشیدی",
    place: "Iran & Afghanistan",
    type: "Astronomical solar calendar",
    epoch: "622 CE (Hijra)",
    rule: "Starts exactly at vernal equinox (Farvardin 1 / Nowruz). 6 months of 31 days, 5 of 30, last 29/30.",
    note: "Solar Hijri calendar — Nowruz, Sizdah Be-dar, Mehregan, Shab-e Yalda, Sadeh.",
    kind: "intl",
    calendar: "persian",
    months: PERSIAN_MONTHS,
  },
  {
    id: "indian",
    label: "Indian national calendar",
    shortLabel: "ŚAKA",
    nativeLabel: "भारतीय राष्ट्रीय पंचांग (शक संवत्)",
    place: "India",
    type: "Solar civil calendar",
    epoch: "78 CE (Śaka Era)",
    rule: "Starts on Chaitra 1 (March 22 / 21 in leap year). Months 1–6 have 31 days, 7–12 have 30 days.",
    note: "The civil Śaka calendar used alongside Gregorian in India.",
    kind: "intl",
    calendar: "indian",
    months: INDIAN_MONTHS,
  },
  {
    id: "buddhist",
    label: "Thai Buddhist calendar",
    shortLabel: "BE",
    nativeLabel: "ปฏิทินสุริยคติไทย (พุทธศักราช)",
    place: "Thailand",
    type: "Solar Buddhist Era calendar",
    epoch: "543 BCE (Parinirvana of Buddha)",
    rule: "Solar months aligned with Gregorian; years counted in Buddhist Era (BE = CE + 543).",
    note: "Thailand's official calendar — Songkran, Visakha Bucha, Loy Krathong, Chakri Day.",
    kind: "intl",
    calendar: "buddhist",
    months: THAI_MONTHS,
  },
  {
    id: "japanese",
    label: "Japanese calendar",
    shortLabel: "JP",
    nativeLabel: "和暦 (元号)",
    place: "Japan",
    type: "Solar imperial era calendar",
    epoch: "Reiwa era (令和, 2019 CE)",
    rule: "Gregorian solar months counted in imperial eras (Reiwa 8 = 2026).",
    note: "Japan's imperial era system — Shogatsu, Setsubun, Tanabata, Obon, Constitution Day.",
    kind: "intl",
    calendar: "japanese",
    era: true,
    months: JAPANESE_MONTHS,
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
    era: "short",
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

const HEBREW_MONTH_PATTERNS = [
  { pattern: /^nis/i, ordinal: 1, name: "Nisan", native: "נִיסָן" },
  { pattern: /^iya/i, ordinal: 2, name: "Iyar", native: "אִיָּר" },
  { pattern: /^siv/i, ordinal: 3, name: "Sivan", native: "סִיוָן" },
  { pattern: /^tam/i, ordinal: 4, name: "Tammuz", native: "תַּמּוּז" },
  { pattern: /^av|^men/i, ordinal: 5, name: "Av", native: "אָב" },
  { pattern: /^elu/i, ordinal: 6, name: "Elul", native: "אֱלוּל" },
  { pattern: /^tis/i, ordinal: 7, name: "Tishri", native: "תִּשְׁרֵי" },
  { pattern: /^che|^hes|^mar/i, ordinal: 8, name: "Cheshvan", native: "חֶשְׁוָן" },
  { pattern: /^kis/i, ordinal: 9, name: "Kislev", native: "כִּסְלֵו" },
  { pattern: /^tev/i, ordinal: 10, name: "Tevet", native: "טֵבֵת" },
  { pattern: /^she/i, ordinal: 11, name: "Shevat", native: "שְׁבָט" },
  { pattern: /^adar\s*(i\b|1\b|r)/i, ordinal: 12, name: "Adar I", native: "אֲדָר א׳" },
  { pattern: /^adar\s*(ii\b|2\b|s)/i, ordinal: 13, name: "Adar II", native: "אֲדָר ב׳" },
  { pattern: /^adar/i, ordinal: 12, name: "Adar", native: "אֲדָר" },
];

function intlParts(calendar, stamp) {
  const { parts: formatter } = intlFormatters(calendar);
  const out = {};
  for (const part of formatter.formatToParts(new Date(stamp))) {
    if (part.type === "day") {
      out.day = Number(part.value);
    } else if (part.type === "month") {
      out.month = Number(part.value);
      if (!Number.isFinite(out.month)) {
        const digitsOnly = Number(part.value.replace(/\D/g, ""));
        if (Number.isFinite(digitsOnly) && digitsOnly > 0) {
          out.month = digitsOnly;
        } else {
          const match = HEBREW_MONTH_PATTERNS.find((entry) => entry.pattern.test(part.value));
          if (match) {
            out.month = match.ordinal;
            out.hebrewMonthName = match.name;
            out.hebrewMonthNative = match.native;
          }
        }
      }
    } else if (part.type === "relatedYear") {
      out.relatedYear = Number(part.value);
    } else if (part.type === "year") {
      out.year = Number(part.value) || part.value;
    } else if (part.type === "era") {
      out.era = part.value;
    }
  }
  return out;
}

const describeCache = new Map();

/**
 * A plain Gregorian date expressed in a second calendar.
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
        const displayYear = parts.year || relatedYear;
        const ordinal = ORDINALS[Math.min(Math.max(parts.month - 1, 0), ORDINALS.length - 1)];
        const zodiac = system.zodiac ? zodiacAnimalFor(relatedYear) : "";
        let long;
        let monthName = "";

        if (system.id === "persian") {
          const pm = PERSIAN_MONTHS[parts.month - 1];
          monthName = pm ? pm.name : monthNameFormatter.format(new Date(stamp));
          long = `${monthName} ${parts.day}, ${displayYear} AP`;
        } else if (system.id === "islamic") {
          const im = ISLAMIC_MONTHS[parts.month - 1];
          monthName = im ? im.name : monthNameFormatter.format(new Date(stamp));
          long = `${monthName} ${parts.day}, ${displayYear} AH`;
        } else if (system.id === "hebrew") {
          const hm = HEBREW_MONTHS_CATALOGUE[parts.month - 1] || HEBREW_MONTH_PATTERNS.find((p) => p.ordinal === parts.month);
          monthName = hm ? hm.name : (parts.hebrewMonthName || monthNameFormatter.format(new Date(stamp)));
          long = `${parts.day} ${monthName} ${displayYear} AM`;
        } else if (system.id === "indian") {
          const inm = INDIAN_MONTHS[parts.month - 1];
          monthName = inm ? inm.name : monthNameFormatter.format(new Date(stamp));
          long = `${monthName} ${parts.day}, ${displayYear} Śaka`;
        } else if (system.id === "buddhist") {
          const gm = GREGORIAN_MONTHS[parts.month - 1];
          monthName = gm ? gm.name : monthNameFormatter.format(new Date(stamp));
          long = `${monthName} ${parts.day}, ${displayYear} BE`;
        } else if (system.id === "japanese") {
          const gm = GREGORIAN_MONTHS[parts.month - 1];
          monthName = gm ? gm.name : monthNameFormatter.format(new Date(stamp));
          long = `${monthName} ${parts.day}, ${displayYear} ${parts.era || "Reiwa"}`;
        } else if (system.zodiac) {
          const cm = system.id === "dangi" ? DANGI_MONTHS[parts.month - 1] : CHINESE_MONTHS[parts.month - 1];
          monthName = cm ? cm.name : `${ordinal} Month`;
          long = `${ordinal} month, day ${parts.day} — ${zodiac} year ${relatedYear}`;
        } else {
          monthName = monthNameFormatter.format(new Date(stamp));
          long = longFormatter.format(new Date(stamp));
        }

        result = {
          system: system.id,
          label: system.label,
          day: parts.day,
          month: parts.month,
          monthName,
          year: displayYear,
          relatedYear,
          era: parts.era,
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

  if (describeCache.size > 800) describeCache.clear();
  describeCache.set(key, result);
  return result;
}

/* ------------------------------------------------------------------- Month Boundaries & Stepping */

/**
 * Given a target calendar system and an anchor Gregorian date, finds Day 1
 * in Gregorian UTC and the exact duration of that month in days.
 */
export function findSystemMonthBounds(systemId, anchorGregDate) {
  const system = calendarSystem(systemId);
  const anchorStamp = Date.UTC(anchorGregDate.year, anchorGregDate.month - 1, anchorGregDate.day);

  if (system.kind === "none" || system.id === "gregorian" || system.id === "buddhist" || system.id === "japanese") {
    const day1Greg = { year: anchorGregDate.year, month: anchorGregDate.month, day: 1 };
    const totalDays = new Date(Date.UTC(anchorGregDate.year, anchorGregDate.month, 0)).getUTCDate();
    const endGreg = { year: anchorGregDate.year, month: anchorGregDate.month, day: totalDays };
    const desc = describeInSystem(systemId, day1Greg);
    return {
      systemId: system.id,
      day1Greg,
      totalDays,
      endGreg,
      desc: desc || { month: anchorGregDate.month, year: anchorGregDate.year, monthName: GREGORIAN_MONTHS[anchorGregDate.month - 1]?.name || "" },
    };
  }

  if (system.id === "bikram") {
    const bs = bikramFromGregorian(anchorGregDate);
    if (bs) {
      const day1Greg = gregorianFromBikram({ year: bs.year, month: bs.month, day: 1 }) || anchorGregDate;
      const yearIdx = bs.year - BS_FIRST_YEAR;
      const totalDays = (BS_YEAR_MONTHS[yearIdx] && BS_YEAR_MONTHS[yearIdx][bs.month - 1]) || 30;
      const endGreg = gregorianFromBikram({ year: bs.year, month: bs.month, day: totalDays }) || anchorGregDate;
      const desc = describeInSystem("bikram", day1Greg);
      return { systemId: "bikram", day1Greg, totalDays, endGreg, desc };
    }
  }

  // ICU systems (persian, islamic, hebrew, indian, chinese, dangi)
  const desc = describeInSystem(systemId, anchorGregDate);
  if (desc && Number.isFinite(desc.day)) {
    const day1Stamp = anchorStamp - (desc.day - 1) * DAY;
    const d1 = new Date(day1Stamp);
    const day1Greg = { year: d1.getUTCFullYear(), month: d1.getUTCMonth() + 1, day: d1.getUTCDate() };
    const d1Desc = describeInSystem(systemId, day1Greg) || desc;

    // Determine month length by counting days until day number becomes 1 again or month advances
    let len = 0;
    let curr = day1Stamp;
    while (len < 36) {
      const curDate = new Date(curr);
      const curDesc = describeInSystem(systemId, {
        year: curDate.getUTCFullYear(),
        month: curDate.getUTCMonth() + 1,
        day: curDate.getUTCDate(),
      });
      if (!curDesc || curDesc.month !== d1Desc.month) break;
      len += 1;
      curr += DAY;
    }
    const totalDays = len > 0 ? len : 30;
    const endStamp = day1Stamp + (totalDays - 1) * DAY;
    const endD = new Date(endStamp);
    const endGreg = { year: endD.getUTCFullYear(), month: endD.getUTCMonth() + 1, day: endD.getUTCDate() };

    return { systemId: system.id, day1Greg, totalDays, endGreg, desc: d1Desc };
  }

  // Fallback to Gregorian
  const day1Greg = { year: anchorGregDate.year, month: anchorGregDate.month, day: 1 };
  const totalDays = new Date(Date.UTC(anchorGregDate.year, anchorGregDate.month, 0)).getUTCDate();
  const endGreg = { year: anchorGregDate.year, month: anchorGregDate.month, day: totalDays };
  return { systemId: system.id, day1Greg, totalDays, endGreg, desc: null };
}

/**
 * Steps forward or backward by `amount` months in the given calendar system,
 * starting from `currentDay1Greg`. Returns the new month's Day 1 in Gregorian.
 */
export function stepSystemMonth(systemId, currentDay1Greg, amount) {
  if (amount === 0) return currentDay1Greg;
  const system = calendarSystem(systemId);

  if (system.kind === "none" || system.id === "gregorian" || system.id === "buddhist" || system.id === "japanese") {
    const base = new Date(Date.UTC(currentDay1Greg.year, currentDay1Greg.month - 1 + amount, 1));
    return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: 1 };
  }

  if (system.id === "bikram") {
    const curBS = bikramFromGregorian(currentDay1Greg);
    if (curBS) {
      let totalMonths = (curBS.year - BS_FIRST_YEAR) * 12 + (curBS.month - 1) + amount;
      const maxMonths = (BS_LAST_YEAR - BS_FIRST_YEAR + 1) * 12 - 1;
      totalMonths = Math.max(0, Math.min(maxMonths, totalMonths));
      const targetYear = BS_FIRST_YEAR + Math.floor(totalMonths / 12);
      const targetMonth = (totalMonths % 12) + 1;
      return gregorianFromBikram({ year: targetYear, month: targetMonth, day: 1 }) || currentDay1Greg;
    }
  }

  // Generic stepping for ICU calendars
  let stamp = Date.UTC(currentDay1Greg.year, currentDay1Greg.month - 1, currentDay1Greg.day);
  const steps = Math.abs(amount);
  const forward = amount > 0;

  for (let s = 0; s < steps; s += 1) {
    if (forward) {
      // Step forward 32 days, then snap to day 1
      const targetStamp = stamp + 32 * DAY;
      const targetD = new Date(targetStamp);
      const targetDesc = describeInSystem(systemId, {
        year: targetD.getUTCFullYear(),
        month: targetD.getUTCMonth() + 1,
        day: targetD.getUTCDate(),
      });
      if (!targetDesc) break;
      stamp = targetStamp - (targetDesc.day - 1) * DAY;
    } else {
      // Step back 2 days into previous month, then snap to day 1
      const targetStamp = stamp - 2 * DAY;
      const targetD = new Date(targetStamp);
      const targetDesc = describeInSystem(systemId, {
        year: targetD.getUTCFullYear(),
        month: targetD.getUTCMonth() + 1,
        day: targetD.getUTCDate(),
      });
      if (!targetDesc) break;
      stamp = targetStamp - (targetDesc.day - 1) * DAY;
    }
  }

  const res = new Date(stamp);
  return { year: res.getUTCFullYear(), month: res.getUTCMonth() + 1, day: res.getUTCDate() };
}
