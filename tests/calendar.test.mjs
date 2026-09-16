import assert from "node:assert/strict";
import test from "node:test";

import {
  WEEKDAYS,
  addMonths,
  buildMonth,
  dayOfYear,
  describeDate,
  isoWeek,
  parsePlainDate,
  parseYearMonth,
  plainDate,
  weekdayLabels,
} from "../src/calendar.js";

test("plain calendar dates parse and format without using the device zone", () => {
  assert.deepEqual(parsePlainDate("2026-09-16"), { year: 2026, month: 9, day: 16 });
  assert.equal(plainDate({ year: 2026, month: 9, day: 6 }), "2026-09-06");
  assert.deepEqual(parseYearMonth("2026-09"), { year: 2026, month: 9 });
  assert.equal(parsePlainDate("2026-02-30"), null);
  assert.equal(parseYearMonth("2026-13"), null);
});

test("a month grid is Monday-first, six weeks tall, and marks today and selected", () => {
  assert.deepEqual(WEEKDAYS, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  const cells = buildMonth({ year: 2026, month: 9, today: { year: 2026, month: 9, day: 16 }, selected: "2026-09-20" });
  assert.equal(cells.length, 42);
  assert.equal(cells[0].iso, "2026-08-31", "September 2026 starts on a Tuesday, so Monday is Aug 31");
  assert.equal(cells[0].weekday, "Mon");
  assert.equal(cells[1].iso, "2026-09-01");
  assert.equal(cells.find((cell) => cell.iso === "2026-09-16").isToday, true);
  assert.equal(cells.find((cell) => cell.iso === "2026-09-20").isSelected, true);
  assert.equal(cells.find((cell) => cell.iso === "2026-09-20").isWeekend, true);
  assert.equal(cells.filter((cell) => cell.inMonth).length, 30);
});

test("date facts include ISO week, day-of-year and relative copy", () => {
  assert.deepEqual(isoWeek({ year: 2026, month: 1, day: 1 }), { year: 2026, week: 1 });
  assert.deepEqual(isoWeek({ year: 2026, month: 12, day: 31 }), { year: 2026, week: 53 });
  assert.equal(dayOfYear({ year: 2026, month: 9, day: 16 }), 259);
  assert.equal(dayOfYear({ year: 2024, month: 12, day: 31 }), 366, "leap years are counted");

  const today = { year: 2026, month: 9, day: 16 };
  const tomorrow = describeDate({ year: 2026, month: 9, day: 17 }, today);
  assert.equal(tomorrow.relative, "tomorrow");
  assert.equal(tomorrow.daysLeft, 105);
  assert.equal(tomorrow.iso, "2026-09-17");

  const past = describeDate({ year: 2026, month: 9, day: 10 }, today);
  assert.equal(past.relative, "6 days ago");
});

test("month navigation crosses year boundaries", () => {
  assert.deepEqual(addMonths({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  assert.deepEqual(addMonths({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.deepEqual(addMonths({ year: 2026, month: 9 }, 5), { year: 2027, month: 2 });
});

test("weekday labels rotate for Sunday- and Saturday-first weeks", () => {
  assert.deepEqual(weekdayLabels(1), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], "ISO default");
  assert.deepEqual(weekdayLabels(0), ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  assert.deepEqual(weekdayLabels(6), ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]);
  assert.deepEqual(weekdayLabels(99), weekdayLabels(1), "nonsense falls back to Monday");
  assert.deepEqual(weekdayLabels(), weekdayLabels(1));
});

test("the grid honours the chosen week start without moving the dates", () => {
  // September 2026 starts on a Tuesday.
  const monday = buildMonth({ year: 2026, month: 9, weekStart: 1 });
  assert.equal(monday[0].iso, "2026-08-31", "Monday-first: the prior Monday leads");

  const sunday = buildMonth({ year: 2026, month: 9, weekStart: 0 });
  assert.equal(sunday[0].iso, "2026-08-30", "Sunday-first adds one more leading day");
  assert.equal(sunday.filter((cell) => cell.inMonth).length, 30);
  assert.equal(sunday[2].iso, "2026-09-01");

  const saturday = buildMonth({ year: 2026, month: 9, weekStart: 6 });
  assert.equal(saturday[0].iso, "2026-08-29", "Saturday-first adds two");
  assert.equal(saturday[3].iso, "2026-09-01");

  assert.equal(sunday.find((cell) => cell.iso === "2026-09-05").isWeekend, true, "weekends still follow the real day");
  assert.equal(monday.length, 42, "six weeks whatever the start");
});
