import assert from "node:assert/strict";
import { describe, test } from "node:test";

/**
 * The wall-clock alarm engine (src/alarms.js).
 *
 * These tests pin the engine, not the DOM: how a repeat is cleaned, how a
 * stored alarm is washed, and — the part that actually earns its keep — how
 * occurrences are found. Occurrences are epochs computed by walking calendar
 * days in the alarm's zone, which is what makes a Friday-only alarm jump the
 * weekend and a daily 07:00 survive a DST shift at 07:00, wall clock, both
 * sides of the boundary.
 */

import {
  GRACE_MS,
  STORE_KEY,
  describeRepeat,
  dueOccurrence,
  formatOccurrence,
  lastOccurrence,
  nextOccurrence,
  normaliseRepeat,
  parseStoredAlarms,
  relativeWhen,
  sanitiseAlarm,
  wallTimeToEpoch,
} from "../src/alarms.js";
import { ALARM_SOUNDS, DEFAULT_SOUND_ID } from "../src/alarm-sounds.js";
import { clockParts } from "../src/clock-face.js";

const KTM = "Asia/Katmandu"; // UTC+05:45, never DST — the arithmetic stays honest
const NY = "America/New_York"; // two DST corners a year
const hour = (epochMs, zone) => {
  const parts = clockParts(new Date(epochMs), zone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
};

describe("cleaning what gets stored", () => {
  test("a missing repeat is no repeat, not Sunday", () => {
    // Number(null) === 0 — the trap that once turned "no repeat" into
    // "every Sunday morning" — must stay closed.
    assert.equal(normaliseRepeat(null), null);
    assert.equal(normaliseRepeat(undefined), null);
    assert.equal(normaliseRepeat(""), null);
    assert.deepEqual(normaliseRepeat([null, null]), null, "a list of nothings is still nothing");
  });

  test("every weekday form is accepted, sorted and de-duplicated", () => {
    assert.deepEqual(normaliseRepeat(0), [0], "an explicit 0 is Sunday, and that is fine");
    assert.deepEqual(normaliseRepeat("5"), [5]);
    assert.deepEqual(normaliseRepeat([5, 1, 5, "1"]), [1, 5]);
    assert.deepEqual(normaliseRepeat(["0", 6, 3]), [0, 3, 6]);
    assert.deepEqual(normaliseRepeat(7), null, "there is no eighth day");
    assert.deepEqual(normaliseRepeat([8, -1, "next tuesday"]), null, "junk days are dropped");
  });

  test("a dead sound id is reset by membership, not by findSound's fallback", () => {
    // findSound() answers *every* id with a sound — it falls back — so it
    // can never be used to ask "is this id real?". Membership can.
    const washed = sanitiseAlarm({ time: "07:00", sound: "a-sound-that-was-removed" });
    assert.equal(washed.sound, DEFAULT_SOUND_ID, "dead ids die in the wash, not at ring time");
    const kept = sanitiseAlarm({ time: "07:00", sound: "rock-band" });
    assert.equal(kept.sound, "rock-band");
    assert.ok(ALARM_SOUNDS.some((sound) => sound.id === "rock-band"), "and the id really is in the catalogue");
  });

  test("a stored alarm is washed: time required, date validated, copy trimmed", () => {
    assert.equal(sanitiseAlarm({ time: "25:00" }), null, "an impossible time is rejected whole");
    assert.equal(sanitiseAlarm({ time: "7:00" }), null, "as is a lazily formatted one");
    assert.equal(sanitiseAlarm("not an alarm"), null);
    assert.equal(sanitiseAlarm(null), null);

    const washed = sanitiseAlarm({
      time: " 07:30 ",
      date: "2026-13-40",
      label: "  Wake up  ",
      notes: "  kettle first  ",
      enabled: 0,
    });
    assert.deepEqual(
      { time: washed.time, date: washed.date, label: washed.label, notes: washed.notes, enabled: washed.enabled },
      { time: "07:30", date: null, label: "Wake up", notes: "kettle first", enabled: false },
      "an impossible date is dropped, not trusted"
    );
    const dated = sanitiseAlarm({ time: "07:30", date: "2026-09-21" });
    assert.equal(dated.date, "2026-09-21");
  });

  test("a stored list keeps its good rows and drops its junk", () => {
    const clean = parseStoredAlarms([{ time: "06:30", repeat: [1, 5] }, { time: "nope" }, "junk", null]);
    assert.equal(clean.length, 1);
    assert.deepEqual(clean[0].repeat, [1, 5]);
    assert.deepEqual(parseStoredAlarms("nope"), []);
    assert.equal(STORE_KEY, "tempo-alarms");
    assert.equal(GRACE_MS, 90 * 1000, "the grace window for throttled tabs is ninety seconds");
  });
});

describe("finding the next ring", () => {
  test("a daily alarm rings later today, or tomorrow once today's has gone", () => {
    const alarm = { time: "16:30", repeat: null, date: null };
    const before = Date.UTC(2026, 8, 14, 10); // 15:45 in Kathmandu
    assert.equal(nextOccurrence(alarm, before, KTM), Date.UTC(2026, 8, 14, 10, 45), "16:30 KTM is 10:45Z");
    const after = Date.UTC(2026, 8, 14, 10, 46);
    assert.equal(nextOccurrence(alarm, after, KTM), Date.UTC(2026, 8, 15, 10, 45), "tomorrow, same wall time");
  });

  test("a one-time alarm on a date rings on that date — and a past date never rings", () => {
    const ahead = { time: "09:00", date: "2026-09-21", repeat: null };
    const from = Date.UTC(2026, 8, 14);
    assert.equal(nextOccurrence(ahead, from, KTM), Date.UTC(2026, 8, 21, 3, 15), "09:00 KTM is 03:15Z");

    const past = { time: "09:00", date: "2026-09-01", repeat: null };
    assert.equal(nextOccurrence(past, from, KTM), null, "its moment is gone");

    const passedToday = { time: "07:00", date: "2026-09-14", repeat: null };
    assert.equal(nextOccurrence(passedToday, Date.UTC(2026, 8, 14, 10), KTM), null, "even earlier today");
  });

  test("a Friday-only alarm walks straight over the weekend", () => {
    const friday = { time: "07:00", repeat: [5], date: null };
    const saturday = Date.UTC(2026, 8, 12, 12); // Sat 12 Sep, 17:45 KTM
    const next = nextOccurrence(friday, saturday, KTM);
    assert.equal(next, Date.UTC(2026, 8, 18, 1, 15), "next Friday 07:00 KTM");
    assert.ok(Math.abs((next - saturday) / 86400000 - 5.552) < 0.01, "six calendar days forward, not seven");
  });

  test("a pinned repeat skips the days before its date", () => {
    const pinned = { time: "07:00", repeat: [1], date: "2026-09-21" }; // Mondays only, from the 21st
    const thisMonday = Date.UTC(2026, 8, 14, 1); // Mon 14 Sep
    assert.equal(nextOccurrence(pinned, thisMonday, KTM), Date.UTC(2026, 8, 21, 1, 15), "the 14th is before the pin");
  });

  test("a daily alarm keeps its wall time across the spring-forward night", () => {
    const alarm = { time: "07:00", repeat: [0, 1, 2, 3, 4, 5, 6], date: null };
    const friday = Date.UTC(2026, 2, 6, 14); // Fri 6 Mar 2026, 09:00 EST
    const sat = nextOccurrence(alarm, friday, NY);
    const sun = nextOccurrence(alarm, sat, NY); // the night 02:00 jumps to 03:00
    const mon = nextOccurrence(alarm, sun, NY);
    assert.equal(hour(sat, NY), "07:00");
    assert.equal(hour(sun, NY), "07:00", "the clock moved, the alarm did not");
    assert.equal(hour(mon, NY), "07:00");
    assert.equal(sat - friday, 22 * 3600000);
    assert.equal(sun - sat, 23 * 3600000, "07:00 EST to 07:00 EDT is 23 hours");
    assert.equal(mon - sun, 24 * 3600000);
  });

  test("and across the fall-back night, which is twenty-five hours long", () => {
    const alarm = { time: "07:00", repeat: null, date: null };
    const halloween = Date.UTC(2026, 9, 31, 5); // Sat 31 Oct 2026, 01:00 EDT
    const sat = nextOccurrence(alarm, halloween, NY); // 07:00 EDT
    const sun = nextOccurrence(alarm, sat, NY); // 07:00 EST — the night 02:00 falls back
    const mon = nextOccurrence(alarm, sun, NY);
    assert.equal(hour(sat, NY), "07:00");
    assert.equal(hour(sun, NY), "07:00");
    assert.equal(sun - sat, 25 * 3600000, "the wall clock repeats an hour; the alarm rings once");
    assert.equal(mon - sun, 24 * 3600000);
    assert.equal(hour(mon, NY), "07:00");
  });

  test("wall times that DST bends are handled on purpose, not by luck", () => {
    // 02:30 does not exist on 2026-03-08 in New York (02:00 jumps to 03:00):
    // the alarm rings once the clock has moved past it.
    const gap = wallTimeToEpoch({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, NY);
    assert.equal(hour(gap, NY), "03:30", "a nonexistent time shifts forward");
    // 01:30 occurs twice on 2026-11-01: the first occurrence wins.
    const twice = wallTimeToEpoch({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, NY);
    assert.equal(twice, Date.UTC(2026, 10, 1, 5, 30), "01:30 EDT, not 01:30 EST");
    // A zone with a 45-minute offset and no DST stays exact.
    const ktm = wallTimeToEpoch({ year: 2026, month: 9, day: 14, hour: 7, minute: 30 }, KTM);
    assert.equal(ktm, Date.UTC(2026, 8, 14, 1, 45));
  });
});

describe("noticing a ring, including a late one", () => {
  test("an occurrence within the grace window is due; beyond it, it is history", () => {
    const alarm = { time: "07:00", repeat: null, date: null, lastRang: 0 };
    const ring = Date.UTC(2026, 8, 14, 1, 15); // 07:00 KTM
    assert.equal(dueOccurrence(alarm, ring + 45_000, KTM), ring, "45 seconds late: still worth ringing");
    assert.equal(dueOccurrence(alarm, ring + 89_999, KTM), ring, "just inside the window");
    assert.equal(dueOccurrence(alarm, ring + 90_001, KTM), null, "91 seconds late: reschedule, do not ring");
    // A throttled tab catching up is the entire reason the window exists.
    assert.equal(dueOccurrence(alarm, ring + 89_000, KTM, { graceMs: 5000 }), null, "a tighter window rings less");
  });

  test("the engine agrees on what already happened, and does not ring it twice", () => {
    const rang = { time: "07:00", repeat: null, date: null, lastRang: Date.UTC(2026, 8, 14, 1, 15) };
    const justAfter = Date.UTC(2026, 8, 14, 1, 15, 30); // half a minute after the ring
    assert.equal(dueOccurrence(rang, justAfter, KTM), null, "it rang; it does not ring twice");
    assert.equal(lastOccurrence(rang, justAfter, KTM), rang.lastRang);

    const alarm = { time: "07:00", repeat: null, date: null };
    const before = Date.UTC(2026, 8, 14, 1, 14); // 06:59 KTM: today's has not come
    assert.equal(lastOccurrence(alarm, before, KTM), Date.UTC(2026, 8, 13, 1, 15), "yesterday's");
    const after = Date.UTC(2026, 8, 14, 1, 16); // 07:01 KTM
    assert.equal(lastOccurrence(alarm, after, KTM), Date.UTC(2026, 8, 14, 1, 15), "today's");
  });

  test("the wording a reader sees is compact and honest", () => {
    const now = Date.UTC(2026, 8, 14, 10); // 15:45 KTM, Monday
    assert.equal(formatOccurrence(Date.UTC(2026, 8, 14, 10, 45), KTM, now), "Today 16:30");
    assert.equal(formatOccurrence(Date.UTC(2026, 8, 15, 10, 45), KTM, now), "Tomorrow 16:30");
    assert.equal(formatOccurrence(Date.UTC(2026, 8, 18, 1, 15), KTM, now), "Fri 07:00");
    assert.equal(formatOccurrence(Date.UTC(2026, 9, 21, 3, 15), KTM, now), "21 Oct 09:00");

    assert.equal(relativeWhen(now + 20_000, now), "in under a minute");
    assert.equal(relativeWhen(now + 5 * 60_000, now), "in 5 min");
    assert.equal(relativeWhen(now + 90 * 60_000, now), "in 1 h 30 min");
    assert.equal(relativeWhen(now + 2 * 60_000, now), "in 2 min");
    assert.equal(relativeWhen(now + 3 * 86400000, now), "in 3 days");
    assert.equal(relativeWhen(now - 1000, now), "now");

    assert.equal(describeRepeat({ repeat: null, date: null }), "Once");
    assert.equal(describeRepeat({ repeat: null, date: "2026-09-21" }), "Once · 2026-09-21");
    assert.equal(describeRepeat({ repeat: [0, 1, 2, 3, 4, 5, 6] }), "Every day");
    assert.equal(describeRepeat({ repeat: [1, 2, 3, 4, 5] }), "Weekdays");
    assert.equal(describeRepeat({ repeat: [0, 6] }), "Weekends");
    assert.equal(describeRepeat({ repeat: [1, 5] }), "Mon, Fri");
  });
});
