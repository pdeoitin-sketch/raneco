import assert from "node:assert/strict";
import test from "node:test";

import { EVENT_CATEGORIES, easterSunday, eventsForDate } from "../src/calendar-events.js";

const names = (date, sets) => eventsForDate(date, sets).map((event) => event.name);
const has = (date, name) => names(date).includes(name);

test("the four holiday sets are exactly the ones Settings offers", () => {
  assert.deepEqual(
    EVENT_CATEGORIES.map((category) => category.id),
    ["world", "national", "cultural", "religious"]
  );
});

test("fixed world days and Christmas land where the world expects them", () => {
  assert.ok(has({ year: 2026, month: 1, day: 1 }, "New Year's Day"));
  assert.ok(has({ year: 2026, month: 12, day: 25 }, "Christmas Day"));
  assert.ok(has({ year: 2026, month: 4, day: 22 }, "Earth Day"));
  assert.ok(has({ year: 2026, month: 12, day: 10 }, "Human Rights Day"));
  assert.ok(has({ year: 2026, month: 12, day: 31 }, "New Year's Eve"));
});

test("Easter follows the Western computus, with its Friday and Monday", () => {
  assert.deepEqual(easterSunday(2026), { year: 2026, month: 4, day: 5 });
  assert.deepEqual(easterSunday(2025), { year: 2025, month: 4, day: 20 });
  assert.deepEqual(easterSunday(2024), { year: 2024, month: 3, day: 31 });

  assert.ok(has({ year: 2026, month: 4, day: 5 }, "Easter Sunday"));
  assert.ok(has({ year: 2026, month: 4, day: 3 }, "Good Friday"));
  assert.ok(has({ year: 2026, month: 4, day: 6 }, "Easter Monday"));
});

test("independence and national days cover the globe, sharing dates when history does", () => {
  assert.ok(has({ year: 2026, month: 7, day: 4 }, "Independence Day"), "United States");
  assert.ok(has({ year: 2026, month: 8, day: 15 }, "Independence Day"), "India");
  const aug15 = eventsForDate({ year: 2026, month: 8, day: 15 });
  const places = aug15.map((event) => event.place);
  assert.ok(places.includes("India") && places.includes("South Korea"), "Aug 15 honours both");
  assert.ok(has({ year: 2026, month: 10, day: 1 }, "National Day"), "China");
  assert.ok(has({ year: 2026, month: 2, day: 11 }, "National Foundation Day"), "Japan");
  assert.ok(has({ year: 2026, month: 7, day: 14 }, "Bastille Day"), "France");
});

test("lunar and cultural new years ride their own calendars", () => {
  const cny = eventsForDate({ year: 2026, month: 2, day: 17 });
  assert.ok(cny.some((event) => event.name === "Chinese New Year"), "1/1 in the Chinese calendar");
  assert.ok(cny.some((event) => event.name === "Seollal — Korean New Year"), "1/1 in the Dangi calendar");
  assert.ok(has({ year: 2026, month: 3, day: 21 }, "Nowruz — Persian New Year"));
  assert.ok(has({ year: 2026, month: 4, day: 14 }, "Nepali New Year (Naya Barsha)"), "Baisakh 1, 2083 BS");
});

test("Nepal's national days are counted in Bikram Sambat, and Israel's in Hebrew", () => {
  assert.ok(has({ year: 2026, month: 5, day: 29 }, "Republic Day (Ganatantra Diwas)"), "Jestha 15");
  assert.ok(has({ year: 2026, month: 9, day: 19 }, "Constitution Day (Sambidhan Diwas)"), "Ashwin 3");
  assert.ok(has({ year: 2026, month: 2, day: 19 }, "Democracy Day (Prajatantra Diwas)"), "Falgun 7");
  assert.ok(has({ year: 2026, month: 4, day: 22 }, "Independence Day (Yom Ha'atzmaut)"), "Iyar 5");
});

test("religious feasts from the tabular Hijri and Hebrew calendars appear, honestly labelled", () => {
  assert.ok(has({ year: 2026, month: 2, day: 18 }, "Ramadan begins"));
  const ramadan = eventsForDate({ year: 2026, month: 2, day: 18 }).find((event) => event.name === "Ramadan begins");
  assert.equal(ramadan.approximate, true, "tabular dates say they may differ locally");

  assert.ok(has({ year: 2026, month: 9, day: 12 }, "Rosh Hashanah"));
  assert.ok(has({ year: 2026, month: 9, day: 21 }, "Yom Kippur"));
  assert.ok(has({ year: 2026, month: 4, day: 2 }, "Passover begins"), "Nisan 15 in 5786");
});

test("disabling a set removes its events and only its events", () => {
  const date = { year: 2026, month: 2, day: 17 };
  assert.equal(names(date, { cultural: false }).length, 0, "no cultural marks when the set is off");

  const muted = names({ year: 2026, month: 8, day: 15 }, { national: false });
  assert.equal(muted.length, 0);

  const religiousOnly = names({ year: 2026, month: 12, day: 25 }, { world: false, national: false, cultural: false });
  assert.deepEqual(religiousOnly, ["Christmas Day"]);

  // An unset `sets` argument means everything is on (the default).
  assert.ok(names(date).length >= 2);
});
