import assert from "node:assert/strict";
import { describe, test } from "node:test";

/**
 * The line under every heading (src/phrases.js).
 *
 * Phrases rotate by day number, never randomly: the same reader sees the
 * same line all day, and tomorrow's is tomorrow's. Clock sections draw from
 * the time pool, the weather sections from the sky pool, and the forecast
 * gets a seasonal line that flips with the hemisphere — September is autumn
 * in Kathmandu and spring in Sydney, and the page knows which it is looking
 * at because it knows the home place's latitude.
 */

import {
  PHRASE_POOLS,
  PHRASE_SECTIONS,
  SECTION_ORDER,
  dayNumber,
  phraseFor,
  seasonFor,
} from "../src/phrases.js";

describe("the phrase under every heading", () => {
  test("the day number is stable all day and moves at midnight", () => {
    const morning = new Date(2026, 8, 14, 6, 30);
    const night = new Date(2026, 8, 14, 23, 59);
    const pastMidnight = new Date(2026, 8, 15, 0, 1);
    assert.equal(dayNumber(night), dayNumber(morning), "the same local day is the same number");
    assert.equal(dayNumber(pastMidnight), dayNumber(morning) + 1, "and midnight moves it on by one");
    assert.equal(dayNumber(new Date(2026, 8, 15, 12)) - dayNumber(new Date(2026, 8, 14, 12)), 1);
  });

  test("every section gets a phrase, and it is one of its own", () => {
    assert.deepEqual(SECTION_ORDER, [
      "now", "alarms", "timer", "stopwatch", "clocks", "standards", "clock", "calculator", "weather", "forecast", "about",
    ]);
    for (const section of SECTION_ORDER) {
      const phrase = phraseFor(section, { date: new Date(2026, 8, 14, 9), latitude: 27 });
      assert.equal(typeof phrase, "string");
      assert.ok(phrase.length > 12, `${section} carries a real sentence, got "${phrase}"`);
      const category = PHRASE_SECTIONS[section];
      const pool = category === "season" ? Object.values(PHRASE_POOLS.season).flat() : PHRASE_POOLS[category];
      assert.ok(pool.includes(phrase), `${section}'s line comes from the ${category} pool`);
    }
  });

  test("clock sections talk about time; the weather section talks about the sky", () => {
    const date = new Date(2026, 8, 14, 9);
    for (const section of ["now", "alarms", "timer", "stopwatch", "clocks", "standards", "clock", "calculator", "about"]) {
      assert.ok(
        PHRASE_POOLS.time.includes(phraseFor(section, { date })),
        `${section} draws from the time pool`
      );
    }
    assert.ok(PHRASE_POOLS.sky.includes(phraseFor("weather", { date })), "weather draws from the sky pool");
    // The pools are disjoint, so the categories are real, not cosmetic.
    for (const line of PHRASE_POOLS.sky) assert.ok(!PHRASE_POOLS.time.includes(line));
  });

  test("the forecast line is seasonal, and flips with the hemisphere", () => {
    const september = new Date(2026, 8, 14, 9);
    const north = phraseFor("forecast", { date: september, latitude: 27.7 }); // Kathmandu
    const south = phraseFor("forecast", { date: september, latitude: -33.9 }); // Sydney
    assert.ok(PHRASE_POOLS.season.autumn.includes(north), "September in the north is autumn");
    assert.ok(PHRASE_POOLS.season.spring.includes(south), "the same month in the south is spring");
    assert.notEqual(north, south, "the line really does flip with latitude");

    const june = new Date(2026, 5, 14, 9);
    assert.ok(PHRASE_POOLS.season.summer.includes(phraseFor("forecast", { date: june, latitude: 51.5 })));
    assert.ok(PHRASE_POOLS.season.winter.includes(phraseFor("forecast", { date: june, latitude: -33.9 })));
  });

  test("seasonFor knows both ends of the year, both ways up", () => {
    assert.equal(seasonFor(11, 27), "winter"); // December, north
    assert.equal(seasonFor(0, 27), "winter");
    assert.equal(seasonFor(2, 27), "spring");
    assert.equal(seasonFor(5, 27), "summer");
    assert.equal(seasonFor(8, 27), "autumn");
    assert.equal(seasonFor(11, -33.9), "summer"); // December, south
    assert.equal(seasonFor(0, -33.9), "summer");
    assert.equal(seasonFor(8, -33.9), "spring");
    assert.equal(seasonFor(5, -33.9), "winter");
    // At the equator the page must pick something, and does: the northern name.
    assert.equal(seasonFor(8, 0), "autumn");
    assert.equal(seasonFor(8, null), "autumn");
  });

  test("rotation is by day, sections differ, and an unknown section still gets a line", () => {
    const today = new Date(2026, 8, 14, 9);
    const evening = new Date(2026, 8, 14, 22);
    const tomorrow = new Date(2026, 8, 15, 9);
    assert.equal(phraseFor("clocks", { date: evening }), phraseFor("clocks", { date: today }), "stable within the day");
    assert.notEqual(
      phraseFor("clocks", { date: tomorrow }),
      phraseFor("clocks", { date: today }),
      "tomorrow's line is tomorrow's"
    );

    // The offset by section means eleven headings do not all surface the same
    // index of their pools on the same day.
    const lines = new Set(SECTION_ORDER.map((section) => phraseFor(section, { date: today, latitude: 27 })));
    assert.ok(lines.size >= 3, `sections read differently, got ${lines.size} distinct lines`);

    // An unknown id falls back to the time pool rather than an empty heading.
    assert.ok(PHRASE_POOLS.time.includes(phraseFor("not-a-section", { date: today })));
  });
});
