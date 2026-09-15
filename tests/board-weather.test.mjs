import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  BOARD_REFRESH_MS,
  MAX_BATCH,
  buildBoardUrl,
  celsiusToFahrenheit,
  fetchBoardTemperatures,
  parseBoardPayload,
  temperatureFor,
  unitForRecord,
} from "../src/board-weather.js";

/**
 * Temperatures for the world board (src/board-weather.js).
 *
 * Two promises the rest of the app leans on: the whole board is **one**
 * request, and **nothing here ever throws** — a clock must not be taken down
 * by the weather. Both are pinned below with no network at all.
 */

const point = (id, lat, lon, units = "metric") => ({ id, lat, lon, units });

function boardPayload(temps) {
  return temps.map((temperature) => ({
    current: temperature === null ? {} : { temperature_2m: temperature, weather_code: 1, is_day: 1 },
  }));
}

describe("units and conversion", () => {
  test("Fahrenheit is only for the three countries that still read it", () => {
    assert.equal(unitForRecord({ countries: [{ code: "US" }] }), "imperial");
    assert.equal(unitForRecord({ countries: [{ code: "LR" }] }), "imperial");
    assert.equal(unitForRecord({ countries: [{ code: "MM" }] }), "imperial");
    assert.equal(unitForRecord({ countries: [{ code: "IN" }] }), "metric");
    assert.equal(unitForRecord({ countries: [{ code: "GB" }] }), "metric");
    // A bare zone or a fix at sea has no country at all; Celsius is the
    // honest default rather than a crash.
    assert.equal(unitForRecord({ countries: [] }), "metric");
    assert.equal(unitForRecord({}), "metric");
    assert.equal(unitForRecord(null), "metric");
  });

  test("the conversion is the real one, and the card rounds it", () => {
    assert.equal(celsiusToFahrenheit(0), 32);
    assert.equal(celsiusToFahrenheit(100), 212);
    assert.equal(celsiusToFahrenheit(-40), -40, "the one temperature both scales agree on");

    assert.deepEqual(temperatureFor(21.4, "metric"), { value: 21, unit: "°C", units: "metric" });
    assert.deepEqual(temperatureFor(21.4, "imperial"), { value: 71, unit: "°F", units: "imperial" });
    assert.deepEqual(temperatureFor(-3.6, "metric"), { value: -4, unit: "°C", units: "metric" });
    assert.equal(temperatureFor(null), null, "no reading is null, not NaN°C");
    assert.equal(temperatureFor("warm"), null);
  });
});

describe("one request for the whole board", () => {
  test("the URL carries every coordinate in one comma-separated pair of lists", () => {
    const url = new URL(buildBoardUrl([point("a", 28.6139, 77.209), point("b", 51.5074, -0.1278)]));
    assert.equal(url.origin + url.pathname, "https://api.open-meteo.com/v1/forecast");
    assert.equal(url.searchParams.get("latitude"), "28.6139,51.5074");
    assert.equal(url.searchParams.get("longitude"), "77.2090,-0.1278");
    assert.match(url.searchParams.get("current"), /temperature_2m/);
    assert.match(url.searchParams.get("current"), /is_day/);
    // One fixed timezone: the board formats its own clocks and only wants
    // a number back.
    assert.equal(url.searchParams.get("timezone"), "UTC");
  });

  test("the reply is keyed back to the places that were asked about", () => {
    const points = [point("city:delhi-in", 28.6, 77.2), point("zone:America/Chicago", 41.9, -87.6, "imperial")];
    const readings = parseBoardPayload(boardPayload([31.4, 21.1]), points);

    assert.deepEqual(Object.keys(readings), ["city:delhi-in", "zone:America/Chicago"]);
    assert.equal(readings["city:delhi-in"].temperature, 31);
    assert.equal(readings["city:delhi-in"].temperatureUnit, "°C");
    // Same request, different unit per card — which is the whole point.
    assert.equal(readings["zone:America/Chicago"].temperature, 70);
    assert.equal(readings["zone:America/Chicago"].temperatureUnit, "°F");
    assert.equal(readings["zone:America/Chicago"].celsius, 21.1, "the source reading is kept, unrounded");
    assert.equal(readings["city:delhi-in"].condition, "Mainly clear");
    assert.ok(readings["city:delhi-in"].symbol, "a card has something to draw");
  });

  test("one location comes back as an object, not an array — both are read", () => {
    const readings = parseBoardPayload(
      { current: { temperature_2m: 12.2, weather_code: 3, is_day: 0 } },
      [point("zone:Europe/London", 51.5, -0.12)]
    );
    assert.equal(readings["zone:Europe/London"].temperature, 12);
    assert.equal(readings["zone:Europe/London"].isDay, false);
  });

  test("a location with no reading is skipped, not filled with a guess", () => {
    const points = [point("a", 1, 1), point("b", 2, 2), point("c", 3, 3)];
    const readings = parseBoardPayload(boardPayload([20, null, 25]), points);
    assert.deepEqual(Object.keys(readings), ["a", "c"], "the empty one is absent, not zero degrees");
    assert.deepEqual(parseBoardPayload({}, points), {});
    assert.deepEqual(parseBoardPayload(null, points), {});
  });
});

describe("failure is always a value, never a throw", () => {
  const ok = (body) => async () => ({ ok: true, status: 200, json: async () => body });

  test("a good answer resolves with readings", async () => {
    const result = await fetchBoardTemperatures([point("a", 1, 1)], { fetchImpl: ok(boardPayload([19])) });
    assert.equal(result.ok, true);
    assert.equal(result.readings.a.temperature, 19);
    assert.ok(result.observedAt > 0);
  });

  test("no places, no coordinates, no fetch — each is a reason, not a crash", async () => {
    assert.equal((await fetchBoardTemperatures([])).reason, "no-places");
    assert.equal((await fetchBoardTemperatures([{ id: "a" }])).reason, "no-places", "a place with no coordinates");
    assert.equal((await fetchBoardTemperatures([point("a", 1, 1)], { fetchImpl: null })).reason, "unsupported");
  });

  test("an HTTP error, a broken body and a thrown network error all resolve", async () => {
    const http = await fetchBoardTemperatures([point("a", 1, 1)], {
      fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }),
    });
    assert.equal(http.ok, false);
    assert.equal(http.reason, "http");
    assert.match(http.message, /429/);

    const empty = await fetchBoardTemperatures([point("a", 1, 1)], { fetchImpl: ok([{ current: {} }]) });
    assert.equal(empty.reason, "format");

    const broken = await fetchBoardTemperatures([point("a", 1, 1)], {
      fetchImpl: async () => {
        throw new Error("connection reset");
      },
    });
    assert.equal(broken.ok, false);
    assert.equal(broken.reason, "network");
    assert.ok(broken.message, "and it says something a person can read");
  });

  test("the batch is capped, and the refresh is slower than a clock", async () => {
    const many = Array.from({ length: 30 }, (_, index) => point(`p${index}`, index, index));
    let asked = "";
    await fetchBoardTemperatures(many, {
      fetchImpl: async (url) => {
        asked = String(url);
        return { ok: true, status: 200, json: async () => boardPayload(many.map(() => 10)) };
      },
    });
    assert.equal(new URL(asked).searchParams.get("latitude").split(",").length, MAX_BATCH);
    assert.ok(BOARD_REFRESH_MS >= 5 * 60 * 1000, "a temperature is not a second hand");
  });
});
