import assert from "node:assert/strict";
import test from "node:test";

import {
  allPlaceRecords,
  cityPlaceId,
  clockVsSunMinutes,
  DEFAULT_BOARD,
  formatOffset,
  geoPlace,
  geoPlaceId,
  nearestZone,
  parseGeoValue,
  parsePlaceId,
  placeCoords,
  placeGroups,
  placeRecord,
  placeZone,
  POPULAR_PLACES,
  searchPlacesAny,
  solarOffsetMinutes,
  solarTimeLabel,
  sunNote,
  zoneOffsetLabel,
  zoneOffsetMinutes,
  zonePlace,
  zonePlaceId,
} from "../src/places.js";

const NAME = "India";

test("place ids round-trip for zones, cities and coordinates", () => {
  assert.equal(zonePlaceId("Asia/Kolkata"), "zone:Asia/Kolkata");
  assert.equal(cityPlaceId("Delhi", "IN"), "city:delhi-in");
  assert.equal(geoPlaceId(28.61394, 77.20902), "geo:28.6139,77.209");

  assert.deepEqual(parsePlaceId("zone:Europe/Kyiv"), { kind: "zone", value: "Europe/Kyiv" });
  assert.deepEqual(parsePlaceId("city:delhi-in"), { kind: "city", value: "delhi-in" });
  // A bare zone id from an older save is still a zone.
  assert.deepEqual(parsePlaceId("Asia/Calcutta"), { kind: "zone", value: "Asia/Calcutta" });
  assert.deepEqual(parseGeoValue("28.61,77.21"), { lat: 28.61, lon: 77.21 });
  assert.equal(parseGeoValue("banana"), null);
  assert.equal(parseGeoValue("999,999"), null);
});

test("a zone place and a city place look the same to the UI", () => {
  const zone = placeRecord("zone:Asia/Kolkata");
  const city = placeRecord("city:delhi-in");

  for (const record of [zone, city]) {
    assert.equal(record.zone, "Asia/Kolkata", "both keep India's clock");
    assert.equal(record.country, NAME);
    assert.equal(record.countryCode, "IN");
    assert.ok(Number.isFinite(record.lat) && Number.isFinite(record.lon), "and both have coordinates");
    assert.match(record.label, /^India · /);
  }
  assert.equal(zone.city, "Kolkata");
  assert.equal(city.city, "Delhi");
  assert.notEqual(zone.lat, city.lat, "but they are different points on the map");
});

test("legacy zone ids are folded onto the modern place", () => {
  assert.equal(placeRecord("Asia/Calcutta").id, "zone:Asia/Kolkata");
  assert.equal(placeRecord("Asia/Kolkata").city, "Kolkata");
  assert.equal(placeRecord("Europe/Kiev").city, "Kyiv");
  assert.equal(placeRecord("Asia/Saigon").city, "Ho Chi Minh City");
  // Zones named after a country read as their capital city instead.
  assert.equal(placeRecord("zone:Asia/Qatar").city, "Doha");
  assert.equal(placeRecord("zone:Europe/Malta").city, "Valletta");
});

test("an unknown place id degrades instead of exploding", () => {
  const unknown = placeRecord("city:atlantis-xx");
  assert.equal(unknown.unknown, true);
  assert.equal(unknown.city, "Atlantis Xx");
  assert.equal(unknown.zone, "UTC");
  assert.equal(placeCoords("city:atlantis-xx"), null);
});

test("the picker list has one entry per place: no city duplicates its zone", () => {
  const places = allPlaceRecords();
  assert.ok(places.length > 700, `expected zones + cities, got ${places.length}`);
  assert.ok(places.some((place) => place.id === "city:delhi-in"), "cities are in the list");
  assert.ok(places.some((place) => place.id === "zone:Asia/Kolkata"), "and so are zones");

  const seen = new Set();
  for (const place of places) {
    const key = `${place.city.toLowerCase()}|${place.countryCode}`;
    assert.equal(seen.has(key), false, `${place.city} appears twice in ${place.country}`);
    seen.add(key);
  }
  // Toronto is a zone *and* would be a city: it must appear once.
  assert.equal(places.filter((place) => place.city === "Toronto").length, 1);
});

test("searching finds cities that have no time zone of their own", () => {
  assert.equal(searchPlacesAny("ahmedabad")[0].id, "city:ahmedabad-in");
  assert.equal(searchPlacesAny("manchester")[0].city, "Manchester");
  assert.equal(searchPlacesAny("dallas")[0].city, "Dallas");
  // Legacy spellings still land on the modern place.
  assert.equal(searchPlacesAny("kiev")[0].id, "zone:Europe/Kyiv");
  assert.equal(searchPlacesAny("calcutta")[0].id, "zone:Asia/Kolkata");
  assert.equal(searchPlacesAny("saigon")[0].id, "zone:Asia/Ho_Chi_Minh");
  // A country code is a deliberate query and outranks a city that contains it.
  assert.equal(searchPlacesAny("IN")[0].country, "India");
  assert.match(searchPlacesAny("india")[0].label, /^India · /);
  assert.equal(searchPlacesAny("zzzzzz").length, 0);
});

test("countries group every place, cities included", () => {
  const groups = placeGroups();
  const india = groups.find((group) => group.country === "India");
  assert.ok(india, "India is a group");
  assert.ok(india.entries.length > 40, `India should list many cities, got ${india.entries.length}`);
  assert.ok(india.entries.some((entry) => entry.city === "Delhi"));
  assert.ok(india.entries.some((entry) => entry.city === "Ahmedabad"));
  // Countries are alphabetical, with "Other places" last.
  const names = groups.map((group) => group.country);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)).filter((n) => n !== "Other places").concat(
    names.includes("Other places") ? ["Other places"] : []
  ));
});

test("coordinates come along, so weather and solar time can use them", () => {
  assert.deepEqual(placeCoords("city:ahmedabad-in"), { lat: 23.0225, lon: 72.5714 });
  assert.equal(placeZone("city:ahmedabad-in"), "Asia/Kolkata");
  const zone = placeRecord("zone:Pacific/Auckland");
  assert.ok(Math.abs(zone.lat + 36.85) < 1, "Auckland keeps its tzdb coordinates");
});

test("solar time explains why one country can feel an hour wide", () => {
  // India runs one clock (UTC+05:30) across 68°E–97°E.
  const east = placeRecord("city:guwahati-in");
  const west = placeRecord("city:ahmedabad-in");
  const easternDrift = clockVsSunMinutes(east);
  const westernDrift = clockVsSunMinutes(west);

  assert.ok(easternDrift < -20, `the east is behind the sun by ${easternDrift} min`);
  assert.ok(westernDrift > 20, `the west is ahead of the sun by ${westernDrift} min`);
  assert.ok(westernDrift - easternDrift > 60, "a full hour of sun across the country");

  // The sun's own clock is a real time of day.
  assert.match(solarTimeLabel(east.lon), /^\d{2}:\d{2}$/);
  assert.match(sunNote(east), /Sun time \d{2}:\d{2} · clock \d+ min (ahead of|behind) the sun/);
  // On the zone's own meridian the clock and the sun agree.
  assert.equal(solarOffsetMinutes(82.5), 330);
});

test("offsets are formatted the way clocks say them", () => {
  assert.equal(formatOffset(330), "UTC+05:30");
  assert.equal(formatOffset(-210), "UTC-03:30");
  assert.equal(formatOffset(0), "UTC+00:00");
  assert.equal(formatOffset(20700 / 60), "UTC+05:45");
  assert.match(zoneOffsetLabel("Asia/Kolkata"), /^UTC\+05:30$/);
  assert.equal(zoneOffsetMinutes("UTC"), 0);
});

test("a GPS fix becomes a place with a name and a zone", () => {
  const place = geoPlace(28.6139, 77.209);
  assert.equal(place.id, "geo:28.6139,77.209");
  assert.equal(place.kind, "geo");
  assert.equal(place.city, "Delhi", "a fix inside a city is that city");
  assert.equal(place.zone, "Asia/Kolkata");
  assert.match(place.note, /km from Delhi/);

  const middleOfNowhere = geoPlace(0, -140);
  assert.ok(middleOfNowhere.city, "and a fix at sea still gets a label");
  assert.ok(middleOfNowhere.zone, "and a zone");
});

test("the nearest zone to a coordinate pair is a real zone", () => {
  assert.equal(nearestZone(51.5, -0.12), "Europe/London");
  assert.equal(nearestZone(35.68, 139.69), "Asia/Tokyo");
  assert.equal(nearestZone(22.57, 88.36), "Asia/Kolkata");
  // Nearest *zone* is a coarse fallback measured to each zone's own principal
  // city, so Delhi falls toward Kathmandu; the curated city list is what gets
  // a real city right, and `geoPlace()` tries that first.
  assert.equal(typeof nearestZone(28.6139, 77.209), "string");
  assert.equal(geoPlace(28.6139, 77.209).zone, "Asia/Kolkata", "the city list wins for a real city");
});

test("the popular and default lists are real, resolvable places", () => {
  for (const id of [...POPULAR_PLACES, ...DEFAULT_BOARD]) {
    const record = placeRecord(id);
    assert.equal(record.unknown, undefined, `${id} must resolve`);
    assert.equal(record.id, id, `${id} must be canonical`);
  }
  assert.ok(new Set(POPULAR_PLACES).size >= 12, "a spread of continents");
  assert.ok(DEFAULT_BOARD.length >= 4);
  assert.equal(new Set(DEFAULT_BOARD).size, DEFAULT_BOARD.length, "no duplicates on the default board");
});

test("zone records remember the legacy id a browser reported", () => {
  assert.equal(zonePlace("Asia/Katmandu").id, "zone:Asia/Kathmandu");
  assert.equal(zonePlace("Asia/Kathmandu").legacyZone, "");
});
