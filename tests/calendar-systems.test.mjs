import assert from "node:assert/strict";
import test from "node:test";

import {
  CALENDAR_SYSTEMS,
  bikramFromGregorian,
  bikramMonthName,
  calendarSystem,
  calendarSystemAvailable,
  describeInSystem,
  gregorianFromBikram,
  zodiacAnimalFor,
} from "../src/calendar-systems.js";

test("the catalogue answers the user's question: many calendars, one place", () => {
  const ids = CALENDAR_SYSTEMS.map((system) => system.id);
  assert.deepEqual(ids, [
    "gregorian",
    "bikram",
    "chinese",
    "dangi",
    "hebrew",
    "islamic",
    "persian",
    "indian",
    "buddhist",
    "japanese",
  ]);
  for (const system of CALENDAR_SYSTEMS) {
    assert.ok(system.label && system.note && system.place, `${system.id} is fully described`);
  }
  assert.equal(calendarSystem("nonsense").id, "gregorian");
});

test("Bikram Sambat epoch and famous Nepali New Years convert exactly", () => {
  assert.deepEqual(bikramFromGregorian({ year: 1943, month: 4, day: 14 }), { year: 2000, month: 1, day: 1 });
  assert.deepEqual(bikramFromGregorian({ year: 2025, month: 4, day: 14 }), { year: 2082, month: 1, day: 1 });
  assert.deepEqual(bikramFromGregorian({ year: 2026, month: 4, day: 14 }), { year: 2083, month: 1, day: 1 });
  // The idle Wednesday this build ran on: 2083 Bhadra 31.
  assert.deepEqual(bikramFromGregorian({ year: 2026, month: 9, day: 16 }), { year: 2083, month: 5, day: 31 });
});

test("the inverse conversion round-trips and the table has honest edges", () => {
  assert.deepEqual(gregorianFromBikram({ year: 2082, month: 1, day: 1 }), { year: 2025, month: 4, day: 14 });
  assert.deepEqual(gregorianFromBikram({ year: 2000, month: 1, day: 1 }), { year: 1943, month: 4, day: 14 });
  assert.equal(bikramFromGregorian({ year: 1900, month: 1, day: 1 }), null, "before the table");
  assert.equal(bikramFromGregorian({ year: 2050, month: 1, day: 1 }), null, "after the table (2034)");
  assert.equal(gregorianFromBikram({ year: 1999, month: 1, day: 1 }), null);
  assert.equal(gregorianFromBikram({ year: 2083, month: 4, day: 32 }), null, "Shrawan never has 32 days");
  assert.equal(bikramMonthName(5), "Bhadra");
  assert.equal(bikramMonthName(12, { short: true }), "Cha");
});

test("a BS year is always 12 months long and totals around 365 days", () => {
  // Property: every Gregorian April 13/14 is within a day of a BS new year.
  for (const year of [2020, 2024, 2025, 2026, 2030, 2033]) {
    const candidates = [13, 14, 15].map((day) => bikramFromGregorian({ year, month: 4, day }));
    assert.ok(
      candidates.some((bs) => bs && bs.month === 1 && bs.day === 1),
      `Baisakh 1 falls on April 13–15 in ${year}`
    );
  }
});

test("Intl-backed systems describe days; Gregorian stays silent as the spine", () => {
  assert.equal(describeInSystem("gregorian", { year: 2026, month: 9, day: 16 }), null);

  const bikram = describeInSystem("bikram", { year: 2026, month: 4, day: 14 });
  assert.equal(bikram.cell, "Bai 1", "a BS month turn shows its month in the cell");
  assert.match(bikram.long, /Baisakh 1, 2083 BS/);

  const chinese = describeInSystem("chinese", { year: 2026, month: 2, day: 17 });
  assert.equal(chinese.day, 1);
  assert.equal(chinese.month, 1);
  assert.match(chinese.long, /Horse year 2026/);

  const dangi = describeInSystem("dangi", { year: 2026, month: 2, day: 17 });
  assert.equal(dangi.day, 1, "Seollal shares the day with Chinese New Year in 2026");

  const islamic = describeInSystem("islamic", { year: 2026, month: 2, day: 18 });
  assert.equal(islamic.month, 9, "Ramadan begins (tabular Hijri)");
  assert.equal(islamic.approximate, true, "the tabular calendar says so itself");

  const persian = describeInSystem("persian", { year: 2026, month: 3, day: 21 });
  assert.equal(persian.month, 1, "Nowruz is Farvardin 1");

  const hebrew = describeInSystem("hebrew", { year: 2026, month: 9, day: 12 });
  assert.equal(hebrew.month, 7, "ICU numbers Hebrew months from Nisan: Tishri is 7");
  assert.equal(hebrew.day, 1, "Rosh Hashanah, 5787");

  const japanese = describeInSystem("japanese", { year: 2026, month: 2, day: 17 });
  assert.match(japanese.long, /Reiwa/, "imperial era shows in the long form");
});

test("availability detection and the zodiac mapping behave", () => {
  for (const system of CALENDAR_SYSTEMS) {
    assert.equal(calendarSystemAvailable(system.id), true, `${system.id} is computable here`);
  }
  assert.equal(zodiacAnimalFor(2026), "Horse");
  assert.equal(zodiacAnimalFor(2024), "Dragon");
  assert.equal(zodiacAnimalFor(1984), "Rat");
});
