import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  DEFAULT_STANDARDS,
  STANDARD_IDS,
  STANDARD_REGIONS,
  TIME_STANDARDS,
  findStandard,
  offsetDifferenceLabel,
  offsetDifferenceSentence,
  searchStandards,
  standardByAbbr,
  standardClock,
  standardGroups,
  standardOffsetLabel,
  standardsInRegion,
} from "../src/time-standards.js";

/**
 * The named clocks (src/time-standards.js).
 *
 * A standard is a fixed offset with a short form and a full form, which is
 * exactly why the tests below care about the ambiguous abbreviations: IST is
 * claimed by India and Israel, AST by Arabia and Atlantic Canada, CST by
 * China and Chicago, BST by Britain and Bangladesh. Getting those wrong is
 * the whole failure mode of a feature like this.
 */

describe("the record set", () => {
  test("every standard is complete, and every id is unique", () => {
    assert.ok(TIME_STANDARDS.length >= 45, `a real spread of standards, got ${TIME_STANDARDS.length}`);
    assert.equal(new Set(STANDARD_IDS).size, STANDARD_IDS.length, "ids are unique");
    const regions = new Set(STANDARD_REGIONS.map((region) => region.id));
    for (const standard of TIME_STANDARDS) {
      assert.ok(standard.abbr.length >= 1 && standard.abbr === standard.abbr.toUpperCase(), `${standard.id} short form`);
      assert.ok(standard.name.length > 6, `${standard.id} has a full form`);
      assert.ok(standard.note.length > 10, `${standard.id} explains itself`);
      assert.ok(regions.has(standard.region), `${standard.id} sits in a real region`);
      assert.ok(Number.isInteger(standard.offsetMinutes), `${standard.id} has a whole-minute offset`);
      assert.ok(Math.abs(standard.offsetMinutes) <= 14 * 60, `${standard.id} is a plausible offset`);
      assert.match(standard.zone, /^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/, `${standard.id} names a zone`);
    }
  });

  test("the ambiguous short forms are kept apart, not merged", () => {
    // IST is three different clocks; the ids say which.
    assert.equal(findStandard("ist-in").offsetMinutes, 330, "India Standard Time is +05:30");
    assert.equal(findStandard("ist-il").offsetMinutes, 120, "Israel Standard Time is +02:00");
    // AST likewise.
    assert.equal(findStandard("ast-sa").offsetMinutes, 180, "Arabia Standard Time is +03:00");
    assert.equal(findStandard("ast-ca").offsetMinutes, -240, "Atlantic Standard Time is −04:00");
    // CST and BST too.
    assert.equal(findStandard("cst-cn").offsetMinutes, 480);
    assert.equal(findStandard("cst-us").offsetMinutes, -360);
    assert.equal(findStandard("bst").offsetMinutes, 60, "British Summer Time");
    assert.equal(findStandard("bst-bd").offsetMinutes, 360, "Bangladesh Standard Time");

    const abbrs = TIME_STANDARDS.map((standard) => standard.abbr);
    assert.equal(abbrs.filter((abbr) => abbr === "IST").length, 2, "both ISTs are present");
  });

  test("the quarter- and half-hour clocks are right, because they are the ones people get wrong", () => {
    assert.equal(findStandard("npt").offsetMinutes, 345, "Nepal is +05:45");
    assert.equal(findStandard("aft").offsetMinutes, 270, "Afghanistan is +04:30");
    assert.equal(findStandard("irst").offsetMinutes, 210, "Iran is +03:30");
    assert.equal(findStandard("mmt").offsetMinutes, 390, "Myanmar is +06:30");
    assert.equal(findStandard("acst").offsetMinutes, 570, "Adelaide is +09:30");
    // The only negative half-hour clock in the set: Newfoundland.
    assert.equal(findStandard("nst").offsetMinutes, -210, "St John's is −03:30");
  });

  test("a daylight standard is a separate clock, one hour off its standard", () => {
    for (const [standard, daylight] of [["est", "edt"], ["cst-us", "cdt"], ["mst", "mdt"], ["pst", "pdt"], ["cet", "cest"], ["eet", "eest"], ["aest", "aedt"], ["nzst", "nzdt"]]) {
      assert.equal(
        findStandard(daylight).offsetMinutes - findStandard(standard).offsetMinutes,
        60,
        `${daylight} is one hour ahead of ${standard}`
      );
    }
  });

  test("lookup never guesses: unknown ids are null, not a silent default", () => {
    assert.equal(findStandard("utc").abbr, "UTC");
    assert.equal(findStandard("UTC").abbr, "UTC", "case does not matter");
    assert.equal(findStandard("not-a-standard"), null);
    assert.equal(findStandard(""), null);
    assert.equal(findStandard(null), null);
    assert.equal(standardByAbbr("jst").id, "jst");
    assert.equal(standardByAbbr("  gst  ").id, "gst");
    assert.equal(standardByAbbr("nope"), null);
  });
});

describe("regions and search", () => {
  test("every standard belongs to exactly one shown group", () => {
    const groups = standardGroups();
    assert.deepEqual(groups.map((group) => group.id), STANDARD_REGIONS.map((region) => region.id));
    const counted = groups.reduce((total, group) => total + group.standards.length, 0);
    assert.equal(counted, TIME_STANDARDS.length, "no standard is orphaned or double-counted");
    for (const group of groups) assert.ok(group.standards.length > 0, `${group.id} is not an empty tab`);
    assert.ok(standardsInRegion("middle-east").some((standard) => standard.abbr === "GST"));
    assert.ok(standardsInRegion("asia").some((standard) => standard.abbr === "JST"));
    assert.deepEqual(standardsInRegion("not-a-region"), []);
  });

  test("search reads the short form, the full form and the note", () => {
    assert.ok(searchStandards("GST").some((standard) => standard.id === "gst"));
    assert.ok(searchStandards("japan").some((standard) => standard.id === "jst"));
    assert.ok(searchStandards("gulf").some((standard) => standard.id === "gst"));
    assert.ok(searchStandards("kathmandu").some((standard) => standard.id === "npt"), "the zone is searchable too");
    assert.equal(searchStandards("").length, TIME_STANDARDS.length, "an empty query is everything");
    assert.deepEqual(searchStandards("zzzzz"), []);
    // The ambiguous one returns both, which is the honest answer.
    assert.equal(searchStandards("IST").filter((standard) => standard.abbr === "IST").length, 2);
  });

  test("the default selection is a real, resolvable shortlist", () => {
    assert.ok(DEFAULT_STANDARDS.length >= 8);
    for (const id of DEFAULT_STANDARDS) assert.ok(findStandard(id), `${id} resolves`);
    assert.ok(DEFAULT_STANDARDS.includes("utc"), "UTC leads the list");
    assert.equal(new Set(DEFAULT_STANDARDS).size, DEFAULT_STANDARDS.length, "no duplicates");
  });
});

describe("what a standard reads", () => {
  test("the offset label spells itself the way a timestamp does", () => {
    assert.equal(standardOffsetLabel(0), "UTC");
    assert.equal(standardOffsetLabel(330), "UTC+05:30");
    assert.equal(standardOffsetLabel(345), "UTC+05:45");
    assert.equal(standardOffsetLabel(-480), "UTC−08:00");
    assert.equal(standardOffsetLabel(-210), "UTC−03:30");
    assert.equal(standardOffsetLabel(600), "UTC+10:00");
  });

  test("the clock is the offset applied to the instant, nothing else", () => {
    // 2026-09-15 18:20:05 UTC.
    const at = new Date(Date.UTC(2026, 8, 15, 18, 20, 5));
    assert.equal(standardClock(findStandard("utc"), at).time24, "18:20");
    assert.equal(standardClock(findStandard("ist-in"), at).time24, "23:50");
    assert.equal(standardClock(findStandard("npt"), at).time24, "00:05", "Nepal is already tomorrow");
    assert.equal(standardClock(findStandard("npt"), at).dayShift, 1);
    assert.equal(standardClock(findStandard("pst"), at).time24, "10:20");
    assert.equal(standardClock(findStandard("pst"), at).dayShift, 0);
    assert.equal(standardClock(findStandard("jst"), at).time24, "03:20");
    assert.equal(standardClock(findStandard("jst"), at).dayShift, 1);

    // And a clock that falls back into yesterday.
    const earlyUTC = new Date(Date.UTC(2026, 8, 15, 2, 0, 0));
    assert.equal(standardClock(findStandard("pst"), earlyUTC).time24, "18:00");
    assert.equal(standardClock(findStandard("pst"), earlyUTC).dayShift, -1);
  });

  test("the 12-hour reading names its half of the day", () => {
    const at = new Date(Date.UTC(2026, 8, 15, 18, 20, 5));
    const utc = standardClock(findStandard("utc"), at);
    assert.equal(utc.time12, "6:20");
    assert.equal(utc.period, "PM");
    assert.equal(utc.hour12, 6);

    const midnight = standardClock(findStandard("utc"), new Date(Date.UTC(2026, 8, 15, 0, 5)));
    assert.equal(midnight.time12, "12:05", "midnight is twelve, not zero");
    assert.equal(midnight.period, "AM");

    const noon = standardClock(findStandard("utc"), new Date(Date.UTC(2026, 8, 15, 12, 0)));
    assert.equal(noon.time12, "12:00");
    assert.equal(noon.period, "PM", "noon is PM");
  });
});

describe("the distance from your own clock", () => {
  test("the short label reads the way a person would say it", () => {
    assert.equal(offsetDifferenceLabel(345, 345), "same time");
    assert.equal(offsetDifferenceLabel(330, 0), "+5h 30m");
    assert.equal(offsetDifferenceLabel(0, 345), "−5h 45m");
    assert.equal(offsetDifferenceLabel(540, 480), "+1h");
    assert.equal(offsetDifferenceLabel(345, 330), "+15m");
    assert.equal(offsetDifferenceLabel(330, 345), "−15m");
  });

  test("the sentence names the place, and never says '0h ahead'", () => {
    assert.equal(offsetDifferenceSentence(345, 345, "Kathmandu"), "Same time as Kathmandu");
    assert.equal(offsetDifferenceSentence(345, 345), "Same time");
    assert.equal(offsetDifferenceSentence(540, 345, "Kathmandu"), "3h 15m ahead of Kathmandu");
    assert.equal(offsetDifferenceSentence(-480, 345, "Kathmandu"), "13h 45m behind Kathmandu");
    assert.equal(offsetDifferenceSentence(60, 0), "1h ahead of you");
    assert.equal(offsetDifferenceSentence(-30, 0, "Delhi"), "30m behind Delhi");
  });
});
