/**
 * A line under every heading.
 *
 * A dashboard of clocks is a page people glance at dozens of times a day, and
 * a heading that always says exactly the same thing stops being read after the
 * second visit. So every section carries a short phrase:
 *
 *   • the clock sections get lines about *time*,
 *   • the weather sections get lines about the *sky*,
 *   • the forecast gets a *seasonal* line that flips with the hemisphere —
 *     September is autumn in Kathmandu and spring in Sydney, and a page that
 *     knows your latitude has no excuse for getting that wrong.
 *
 * Phrases rotate **by day number**, never randomly: the same reader sees the
 * same line all day (a phrase that changed on every glance is just noise),
 * and tomorrow's line is tomorrow's. Each section is offset by its place in
 * the page so the ten headings do not all surface the same index of their
 * pools on the same day.
 */

/** The sections of the page, in scroll order — also the phrase offset. */
export const SECTION_ORDER = [
  "now",
  "alarms",
  "timer",
  "stopwatch",
  "clocks",
  "standards",
  "clock",
  "calculator",
  "weather",
  "forecast",
  "about",
];

/** Which pool a section draws from. */
export const PHRASE_SECTIONS = {
  now: "time",
  alarms: "time",
  timer: "time",
  stopwatch: "time",
  clocks: "time",
  standards: "time",
  clock: "time",
  calculator: "time",
  about: "time",
  weather: "sky",
  forecast: "season",
};

const TIME_PHRASES = [
  "Time is the one thing you spend without ever knowing your balance.",
  "The clock does not hurry and it does not wait; it only walks.",
  "Small hours, well kept, make large lives.",
  "You cannot save time — only spend it somewhere that matters.",
  "Every minute you plan buys a minute you own.",
  "The future is purchased in the present.",
  "Late is a decision made many small moments earlier.",
  "The day has exactly enough hours, if nothing borrows them.",
  "Time flies, but you are the pilot.",
  "A watched pot boils; an unwatched afternoon vanishes.",
  "Counting time is not the same as making it count.",
  "Mornings are borrowed from tomorrow — spend them carefully.",
  "Punctuality is the politeness of people with buses to catch.",
  "An hour ahead of the clock is an hour the day owes you.",
];

const SKY_PHRASES = [
  "The sky does not hurry its weather, and it never apologises.",
  "Every forecast is a promise made with honest uncertainty.",
  "Rain is just the sky returning what it borrowed.",
  "There is no bad weather, only the wrong coat.",
  "Clouds are the sky thinking.",
  "Sunlight is the oldest clock, and it never needs winding.",
  "A sky watched closely is never boring.",
  "Weather happens somewhere; this is where it happens to you.",
  "The sky changes its mind, so you need not feel bad about changing yours.",
  "The atmosphere is honest — it shows you everything it is doing.",
];

const SEASON_PHRASES = {
  spring: [
    "Spring: everything that waited all winter is allowed to begin.",
    "The year is saying yes.",
    "Growth is quiet before it is green.",
    "A season of first tries.",
    "The days are lengthening their promises.",
  ],
  summer: [
    "Summer: time at its most generous.",
    "Long days are an invitation, not an obligation.",
    "Heat slows the clock; let it.",
    "Light late enough to finish what you started.",
    "The year at full volume.",
  ],
  autumn: [
    "Autumn: the year exhales.",
    "Letting go, one leaf at a time, is a skill.",
    "Harvest what you planted in spring.",
    "Shorter days, sharper intentions.",
    "The year turns golden and thoughtful.",
  ],
  winter: [
    "Winter: the year catching its breath.",
    "Rest is a season, not a weakness.",
    "Cold mornings are tests you pass by getting up.",
    "The days are short; the hours are still hours.",
    "Under the frost, the ground is getting ready.",
  ],
};

/** All the pools, exported for the tests (and for anyone adding a line). */
export const PHRASE_POOLS = { time: TIME_PHRASES, sky: SKY_PHRASES, season: SEASON_PHRASES };

/**
 * The day number of a date, on the reader's own calendar.
 *
 * Deliberately local: "the phrase for today" must not flip at UTC midnight
 * while the reader is still up. Two moments on the same local day share a
 * number; midnight moves it on by exactly one.
 */
export function dayNumber(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  return Math.floor(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86400000);
}

/**
 * Which season a month is, honouring the hemisphere.
 *
 * @param {number} month 0–11 (January is 0)
 * @param {number|null} latitude positive north; negative south; null/0 default
 *        to the northern naming, because a page must pick something at the
 *        equator and the tropics barely notice the difference anyway.
 */
export function seasonFor(month, latitude = null) {
  const index = Math.round(month) % 12;
  const northern = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
  const season = northern[index];
  if (Number.isFinite(Number(latitude)) && Number(latitude) < 0) {
    const flipped = { winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" };
    return flipped[season];
  }
  return season;
}

function poolFor(sectionId) {
  const pool = PHRASE_SECTIONS[sectionId];
  if (pool === "time") return { list: TIME_PHRASES, seasonal: false };
  if (pool === "sky") return { list: SKY_PHRASES, seasonal: false };
  if (pool === "season") return { list: null, seasonal: true };
  // Unknown sections still get a line; an empty heading helps nobody.
  return { list: TIME_PHRASES, seasonal: false };
}

/**
 * The phrase for a section, on a given day.
 *
 * @param {string} sectionId one of SECTION_ORDER (anything else falls back to
 *        the time pool rather than returning an empty string)
 * @param {object} [options]
 *   @param {Date} [options.date] the day to phrase for (default: today)
 *   @param {number|null} [options.latitude] used only by the seasonal line
 */
export function phraseFor(sectionId, { date = new Date(), latitude = null } = {}) {
  const offset = Math.max(0, SECTION_ORDER.indexOf(sectionId));
  const day = dayNumber(date);

  if (PHRASE_SECTIONS[sectionId] === "season") {
    const season = seasonFor(date.getMonth(), latitude);
    const list = SEASON_PHRASES[season] || SEASON_PHRASES.spring;
    return list[(day + offset) % list.length];
  }

  const { list } = poolFor(sectionId);
  return list[(day + offset) % list.length];
}
