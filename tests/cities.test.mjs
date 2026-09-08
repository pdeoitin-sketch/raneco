import assert from "node:assert/strict";
import test from "node:test";

import {
  CITIES,
  CITY_FIELDS,
  citiesInCountry,
  citiesInRegion,
  cityId,
  distanceKm,
  findCity,
  nearestCity,
  REGIONS,
} from "../src/cities.js";
import { isValidZone } from "../src/tz-places.js";

test("every row is well formed", () => {
  assert.deepEqual(CITY_FIELDS, ["city", "countryCode", "lat", "lon", "zone", "region"]);
  for (const row of CITIES) {
    const [city, code, lat, lon, zone, region] = row;
    assert.ok(city && typeof city === "string", `city name: ${city}`);
    assert.match(code, /^[A-Z]{2}$/, `${city} has a country code`);
    assert.ok(Number.isFinite(lat) && Math.abs(lat) <= 90, `${city} latitude ${lat}`);
    assert.ok(Number.isFinite(lon) && Math.abs(lon) <= 180, `${city} longitude ${lon}`);
    assert.ok(isValidZone(zone), `${city} points at a real zone (${zone})`);
    assert.ok(
      REGIONS.some((entry) => entry.code === region),
      `${city} has a known region (${region})`
    );
  }
});

test("no city is listed twice, and ids are unique", () => {
  const ids = new Set();
  const names = new Set();
  for (const [city, code] of CITIES) {
    const id = cityId(city, code);
    assert.equal(ids.has(id), false, `${id} is listed twice`);
    ids.add(id);
    const key = `${city.toLowerCase()}|${code}`;
    assert.equal(names.has(key), false, `${city} (${code}) is listed twice`);
    names.add(key);
  }
  assert.ok(ids.size > 250, `expected a broad gazetteer, got ${ids.size}`);
});

test("ids are stable, lower case and diacritic free", () => {
  assert.equal(cityId("São Paulo", "BR"), "sao-paulo-br");
  assert.equal(cityId("Kraków", "PL"), "krakow-pl");
  assert.equal(cityId("Nukuʻalofa", "TO"), "nukualofa-to");
  assert.equal(findCity("krakow-pl").city, "Kraków");
  assert.equal(findCity("nukualofa-to").city, "Nukuʻalofa");
  assert.equal(findCity("nope-xx"), null);
});

test("India is covered city by city, not as one zone", () => {
  const india = citiesInCountry("IN");
  assert.ok(india.length >= 40, `expected a long list of Indian cities, got ${india.length}`);
  for (const name of ["Delhi", "Mumbai", "Ahmedabad", "Guwahati", "Kochi", "Leh", "Port Blair"]) {
    assert.ok(india.some((city) => city.city === name), `${name} is in the gazetteer`);
  }
  for (const city of india) {
    assert.equal(city.zone, "Asia/Kolkata", `${city.city} keeps India's single clock`);
  }
  // The longitude spread is the reason a national forecast is not enough.
  const lons = india.map((city) => city.lon);
  assert.ok(Math.max(...lons) - Math.min(...lons) > 20, "India spans many degrees of longitude");
});

test("regions cover the world", () => {
  const counts = new Map(REGIONS.map((region) => [region.code, citiesInRegion(region.code).length]));
  for (const region of REGIONS) {
    assert.ok(counts.get(region.code) > 10, `${region.label} has ${counts.get(region.code)} cities`);
  }
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  assert.equal(total, CITIES.length, "every city belongs to exactly one region");
});

test("great-circle distance is right, and nearestCity uses it", () => {
  // Delhi -> Mumbai is about 1,150 km.
  const km = distanceKm(28.6139, 77.209, 19.076, 72.8777);
  assert.ok(km > 1100 && km < 1200, `Delhi–Mumbai is ~1,150 km, got ${Math.round(km)}`);
  assert.equal(distanceKm(0, 0, 0, 0), 0);

  const near = nearestCity(19.076, 72.8777);
  assert.equal(near.city, "Mumbai");
  assert.ok(near.distanceKm < 1);
  // A fix 60 km out still names the nearest city, with the distance.
  const outside = nearestCity(28.1, 77.2);
  assert.equal(outside.city, "Delhi");
  assert.ok(outside.distanceKm > 40);
  // …and a limit can refuse to guess at all.
  assert.equal(nearestCity(0, -140, { maxKm: 50 }), null);
  assert.equal(nearestCity(NaN, NaN), null);
});

test("every city is the city nearest to its own coordinates", () => {
  // A typo in a latitude or longitude usually lands the row on top of another
  // city, so this is the cheapest way to catch a mistyped digit.
  const crowded = new Map();
  for (const [city, code, lat, lon] of CITIES) {
    const near = nearestCity(lat, lon);
    assert.equal(near.id, cityId(city, code), `${city} (${code}) is nearest to ${near.city}`);
    const key = near.id;
    crowded.set(key, (crowded.get(key) || 0) + 1);
  }
});
