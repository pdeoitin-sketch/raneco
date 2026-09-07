import assert from "node:assert/strict";
import test from "node:test";

import {
  SUGGESTED_ZONES,
  allPlaces,
  canonicalZone,
  coordsFor,
  countryNameFor,
  isValidZone,
  pickerRows,
  placeLabel,
  recordFor,
  searchPlaces,
  supportedZones,
  zoneGroups,
} from "../src/tz-places.js";

test("legacy browser ids are folded onto the modern canonical zone", () => {
  assert.equal(canonicalZone("Asia/Katmandu"), "Asia/Kathmandu");
  assert.equal(canonicalZone("Asia/Calcutta"), "Asia/Kolkata");
  assert.equal(canonicalZone("Europe/Kiev"), "Europe/Kyiv");
  assert.equal(canonicalZone("Asia/Saigon"), "Asia/Ho_Chi_Minh");
  assert.equal(canonicalZone("Asia/Rangoon"), "Asia/Yangon");
  assert.equal(canonicalZone("America/Godthab"), "America/Nuuk");
  assert.equal(canonicalZone("Atlantic/Faeroe"), "Atlantic/Faroe");
  assert.equal(canonicalZone("Pacific/Enderbury"), "Pacific/Kanton");
  assert.equal(canonicalZone("America/Porto_Acre"), "America/Rio_Branco");
  assert.equal(canonicalZone("Asia/Kathmandu"), "Asia/Kathmandu", "already modern stays put");
});

test("cities are shown with their real country", () => {
  const expected = {
    "Asia/Katmandu": "Nepal · Kathmandu",
    "Asia/Kolkata": "India · Kolkata",
    "Europe/Kiev": "Ukraine · Kyiv",
    "Asia/Saigon": "Vietnam · Ho Chi Minh City",
    "Asia/Rangoon": "Myanmar · Yangon",
    "America/Argentina/Buenos_Aires": "Argentina · Buenos Aires",
    "America/Sao_Paulo": "Brazil · São Paulo",
  };
  for (const [zone, label] of Object.entries(expected)) {
    assert.equal(placeLabel(zone), label, `label for ${zone}`);
  }
});

test("a legacy id is flagged so the UI can explain the aliasing", () => {
  assert.equal(recordFor("Asia/Katmandu").legacy, true);
  assert.equal(recordFor("Asia/Katmandu").zone, "Asia/Kathmandu");
  assert.equal(recordFor("Asia/Kathmandu").legacy, false);
  assert.ok(recordFor("Asia/Katmandu").aliases.includes("Asia/Katmandu"));
});

test("multi-country zones list the primary country first but keep the rest", () => {
  const brussels = recordFor("Europe/Brussels");
  assert.equal(brussels.countryCode, "BE");
  assert.ok(brussels.countries.length >= 3, "Belgium, Luxembourg, Netherlands");
  assert.ok(brussels.countries.some((country) => country.code === "NL"));
});

test("every zone the engine reports gets a country and a real name", () => {
  const engineZones =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : allPlaces().map((r) => r.zone);
  const described = new Map(allPlaces().map((record) => [record.zone, record]));
  const missing = [];
  for (const zone of engineZones) {
    const canonical = canonicalZone(zone);
    const record = described.get(canonical);
    if (!record) missing.push(zone);
  }
  assert.deepEqual(missing, [], `unlabelled zones: ${missing.join(", ")}`);

  const unnamed = [...described.values()].filter(
    (record) => !record.country && record.zone !== "UTC" && !record.zone.startsWith("Etc/")
  );
  assert.deepEqual(unnamed.map((record) => record.zone), []);
});

test("no legacy alias ever shadows the modern name in the picker", () => {
  const zones = allPlaces().map((record) => record.zone);
  assert.equal(new Set(zones).size, zones.length, "zones are unique");
  assert.ok(!zones.includes("Asia/Calcutta"), "Calcutta is folded into Kolkata");
  assert.ok(zones.includes("Asia/Kolkata"));
});

test("searching by legacy name, country, code or id finds the modern city", () => {
  const byLegacy = searchPlaces("calcutta");
  assert.ok(byLegacy.some((record) => record.zone === "Asia/Kolkata"), "calcutta -> Kolkata");
  assert.ok(searchPlaces("kiev").some((record) => record.zone === "Europe/Kyiv"));
  assert.ok(searchPlaces("saigon").some((record) => record.zone === "Asia/Ho_Chi_Minh"));
  assert.ok(searchPlaces("rangoon").some((record) => record.zone === "Asia/Yangon"));
  assert.ok(searchPlaces("Nepal").every((record) => record.countryCode === "NP"));
  assert.ok(searchPlaces("Nepal").some((record) => record.city === "Kathmandu"));
  assert.ok(searchPlaces("sao paulo").some((record) => record.city === "São Paulo"), "diacritic-insensitive");
  assert.ok(searchPlaces("Asia/Kathmandu").some((record) => record.zone === "Asia/Kathmandu"));
  assert.deepEqual(searchPlaces("zzzznothing"), []);
});

test("the picker is grouped country -> city and covers the whole engine list", () => {
  const groups = zoneGroups();
  const countries = groups.map((group) => group.country);
  assert.ok(groups.length > 150, `expected many country groups, got ${groups.length}`);
  // "Other places" (UTC and friends, i.e. zones with no country) trails the list.
  const alphabetical = countries.slice(0, -1);
  assert.deepEqual(alphabetical, [...alphabetical].sort(new Intl.Collator("en", { sensitivity: "base" }).compare));
  assert.equal(countries[countries.length - 1], "Other places");

  const nepal = groups.find((group) => group.country === "Nepal");
  assert.ok(nepal, "Nepal is a group");
  assert.deepEqual(nepal.entries.map((entry) => entry.city), ["Kathmandu"]);

  const usa = groups.find((group) => group.country === countryNameFor("US"));
  assert.ok(usa.entries.length >= 4, "the United States has several zones");
  assert.equal(usa.entries[0].city, "New York", "most populous zone first");

  const rows = pickerRows();
  assert.ok(rows.filter((row) => row.type === "group").length === groups.length);
  assert.ok(rows.filter((row) => row.type === "place").length === allPlaces().length);
});

test("grouped rows collapse into a flat, labelled search result", () => {
  const rows = pickerRows("australia");
  assert.equal(rows[0].type, "group");
  assert.equal(rows[0].country, "Matching places");
  const places = rows.filter((row) => row.type === "place");
  const cities = places.map((row) => row.record.city);
  assert.ok(cities.includes("Sydney"), "the populous zone is in the results");
  assert.ok(cities.includes("Perth"));
  // tzdb also assigns a few outlying Australian stations to other zones (e.g.
  // Eyre Bird Observatory runs on Asia/Tokyo), so match on any country.
  assert.ok(places.every((row) => row.record.search.includes("australia")));
});

test("suggested zones are canonical and usable", () => {
  for (const zone of SUGGESTED_ZONES) {
    assert.ok(isValidZone(zone), `${zone} formats`);
    assert.equal(canonicalZone(zone), zone, `${zone} is already canonical`);
  }
  assert.ok(SUGGESTED_ZONES.includes("Asia/Kolkata"));
});

test("coordinates come from zone1970.tab for the weather lookup", () => {
  const kathmandu = coordsFor("Asia/Katmandu");
  assert.ok(Math.abs(kathmandu.lat - 27.7) < 0.2, "latitude of Kathmandu");
  assert.ok(Math.abs(kathmandu.lon - 85.3) < 0.2, "longitude of Kathmandu");
  assert.ok(coordsFor("Pacific/Honolulu").lat < 0 === false, "Honolulu is north of the equator");
});

test("unknown zones degrade gracefully", () => {
  assert.equal(recordFor("Mars/Olympus_Mons").zone, "Mars/Olympus_Mons");
  assert.equal(recordFor("Mars/Olympus_Mons").label, "Olympus Mons");
  assert.equal(isValidZone("Mars/Olympus_Mons"), false);
  assert.equal(isValidZone(""), false);
  assert.equal(placeLabel("Etc/GMT+5"), "GMT+5", "Etc zones read as offsets");
  assert.ok(supportedZones().includes("UTC") || !isValidZone("UTC"), "UTC is offered when the engine knows it");
});
