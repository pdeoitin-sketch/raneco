/**
 * Zone-aware date maths and formatting, in one place.
 *
 * Everything here takes an IANA zone id and never touches the DOM, so the
 * calculator, the clocks and the tests can all share exactly one
 * implementation. (Time zone bugs love to live in the second copy.)
 */

const formatterCache = new Map();

export function getFormatter(locale, options) {
  const key = `${locale}|${JSON.stringify(options)}`;
  if (!formatterCache.has(key)) formatterCache.set(key, new Intl.DateTimeFormat(locale, options));
  return formatterCache.get(key);
}

function toParts(date, zone, options, locale = "en-CA") {
  const parts = {};
  for (const item of getFormatter(locale, { timeZone: zone, ...options }).formatToParts(date)) {
    if (item.type !== "literal") parts[item.type] = item.value;
  }
  return parts;
}

/** `{year, month, day, hour, minute, second}` on the wall clock of `zone`. */
export function partsFor(date, zone) {
  const parts = toParts(date, zone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Tuesday, September 8, 2026 */
export function formatLongDate(date, zone) {
  return getFormatter("en-US", { timeZone: zone, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date);
}

/** Tuesday, September 8 — uppercased by callers for the eyebrow line. */
export function formatMediumDate(date, zone) {
  return getFormatter("en-US", { timeZone: zone, weekday: "long", month: "long", day: "numeric" }).format(date);
}

/** Sep 8, 9:41 AM */
export function formatShortDateTime(date, zone) {
  return getFormatter("en-US", {
    timeZone: zone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Value for an `<input type="datetime-local">` in `zone`: "2026-09-08T09:41". */
export function formatDateTimeLocal(date, zone) {
  const parts = toParts(date, zone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * Turn the wall-clock string from a `datetime-local` input into a real
 * instant, interpreted in `zone`.
 *
 * The trick is a two-pass correction: guess that the wall clock *is* UTC, then
 * ask what wall clock that instant produces in the zone, and shift by the
 * difference. It converges in one step for fixed zones and within a couple for
 * the first minute of a DST transition.
 */
export function zonedDateTimeToUTC(localDateTime, zone) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(localDateTime || ""));
  if (!match) return null;

  const [, y, m, d, h, min, s] = match;
  const desired = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(s || 0));
  let guess = desired;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = partsFor(new Date(guess), zone);
    const actualWallTime = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const adjustment = desired - actualWallTime;
    if (adjustment === 0) break;
    guess += adjustment;
  }
  return new Date(guess);
}

/** Midnight tonight (start of the next day) in `zone`. */
export function nextMidnight(date, zone) {
  const parts = partsFor(date, zone);
  const todayUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  return zonedDateTimeToUTC(
    `${new Date(todayUtc + 86400000).toISOString().slice(0, 10)}T00:00`,
    zone
  ) || new Date(todayUtc + 86400000);
}

/** Seconds since local midnight in `zone`. */
export function secondsIntoDay(date, zone) {
  const parts = partsFor(date, zone);
  return parts.hour * 3600 + parts.minute * 60 + parts.second;
}

/** "2 days, 4 hours, 30 minutes" from a whole number of seconds. */
export function formatDurationWords(totalSeconds) {
  const values = [
    ["day", Math.floor(totalSeconds / 86400)],
    ["hour", Math.floor((totalSeconds % 86400) / 3600)],
    ["minute", Math.floor((totalSeconds % 3600) / 60)],
    ["second", totalSeconds % 60],
  ];
  const meaningful = values.filter(([, amount]) => amount > 0);
  if (!meaningful.length) return "0 seconds";
  return meaningful
    .slice(0, 3)
    .map(([unit, amount]) => `${amount} ${unit}${amount === 1 ? "" : "s"}`)
    .join(", ");
}
