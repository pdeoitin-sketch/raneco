import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PREFERENCES,
  HOLIDAY_SETS,
  WEEK_STARTS,
  readAlarmDuration,
  readAlarmVolumePercent,
  readNotificationsEnabled,
  readPreferences,
  readWeatherUnits,
  weekStartOption,
  writeAlarmDuration,
  writeAlarmVolumePercent,
  writeNotificationsEnabled,
  writePreferences,
  writeWeatherUnits,
} from "../src/preferences.js";

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("week starts are the three the world actually uses, with Sundays and Saturdays honoured", () => {
  assert.deepEqual(
    WEEK_STARTS.map((start) => [start.id, start.jsDay]),
    [
      ["monday", 1],
      ["sunday", 0],
      ["saturday", 6],
    ]
  );
  assert.equal(weekStartOption("SUNDAY").jsDay, 0);
  assert.equal(weekStartOption("junk").id, "monday");
});

test("preferences default sensibly and survive a corrupt blob", () => {
  const empty = memoryStorage();
  assert.deepEqual(readPreferences(empty), DEFAULT_PREFERENCES);

  const corrupt = memoryStorage({ "tempo-preferences": "{not json" });
  assert.deepEqual(readPreferences(corrupt), DEFAULT_PREFERENCES);

  const odd = memoryStorage({
    "tempo-preferences": JSON.stringify({ weekStart: "funday", calendarSystem: "martian", holidays: "all", geo: "yes" }),
  });
  const prefs = readPreferences(odd);
  assert.equal(prefs.weekStart, "monday", "unknown week starts fall back");
  assert.equal(prefs.calendarSystem, "gregorian", "unknown calendars fall back");
  for (const set of HOLIDAY_SETS) assert.equal(prefs.holidays[set.id], true, "holiday sets default to on");
  assert.equal(prefs.geo, true);
});

test("patches merge, normalise and persist one key at a time", () => {
  const store = memoryStorage();
  writePreferences({ weekStart: "sunday" }, store);
  let prefs = readPreferences(store);
  assert.equal(prefs.weekStart, "sunday");

  prefs = writePreferences({ holidays: { religious: false } }, store);
  assert.equal(prefs.holidays.religious, false);
  assert.equal(prefs.holidays.world, true, "other sets untouched");
  assert.equal(prefs.weekStart, "sunday", "earlier patches survive later ones");

  prefs = writePreferences({ geo: false, calendarSystem: "bikram" }, store);
  assert.equal(prefs.geo, false);
  assert.equal(prefs.calendarSystem, "bikram");

  prefs = writePreferences({ calendarSystem: "pluto" }, store);
  assert.equal(prefs.calendarSystem, "bikram", "unrecognised systems keep the old value");
});

test("shared alarm and unit keys read and write the shapes the tools understand", () => {
  const store = memoryStorage();

  assert.equal(readWeatherUnits(store), "auto");
  writeWeatherUnits("IMPERIAL", store);
  assert.equal(store.values.get("tempo-weather-units"), "imperial");
  assert.equal(readWeatherUnits(store), "imperial");
  writeWeatherUnits("kelvin", store);
  assert.equal(readWeatherUnits(store), "auto", "unknown units fall back to auto");

  assert.equal(readAlarmVolumePercent(store), 70);
  writeAlarmVolumePercent(45, store);
  assert.equal(store.values.get("tempo-alarm-volume"), "0.45", "volume is stored as a 0–1 gain");
  assert.equal(readAlarmVolumePercent(store), 45);
  writeAlarmVolumePercent(900, store);
  assert.equal(readAlarmVolumePercent(store), 100, "outrageous sliders are clamped");

  assert.equal(readAlarmDuration(store), 30);
  writeAlarmDuration(0, store);
  assert.equal(store.values.get("tempo-alarm-duration"), "0", "zero still means 'until dismissed'");
  assert.equal(readAlarmDuration(store), 0);

  assert.equal(readNotificationsEnabled(store), false);
  writeNotificationsEnabled(true, store);
  assert.equal(store.values.get("tempo-alarm-notify"), "on");
  assert.equal(readNotificationsEnabled(store), true);
});
