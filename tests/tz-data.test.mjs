import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { TZ_DATA_VERSION, TZ_LINKS, TZ_ROWS } from "../src/tz-places.generated.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

/**
 * The committed bundle data must stay faithful to the IANA files it was
 * generated from, otherwise a hand edit could quietly rename a capital.
 */
test("the generated place data matches the vendored tzdb files", () => {
  // zone1970.tab wins where a zone appears in both files, matching the
  // generator's own merge order.
  const table = new Map();
  for (const file of ["zone1970.tab", "zone.tab"]) {
    for (const line of readFileSync(resolve(root, "tzdata", file), "utf8").split("\n")) {
      if (!line.trim() || line.startsWith("#")) continue;
      const [countries, coordinates, zone, comment] = line.split(/\t+/);
      const id = zone.trim();
      if (table.has(id)) continue;
      table.set(id, { countries: countries.trim(), coordinates, comment: (comment || "").trim() });
    }
  }
  assert.ok(table.size > 400, "tzdb source rows were parsed");

  const generated = new Map(TZ_ROWS.map((row) => [row[0], row]));
  assert.equal(generated.size, TZ_ROWS.length, "no duplicated zone rows");

  for (const [zone, row] of generated) {
    const source = table.get(zone);
    assert.ok(source, `${zone} exists in tzdb`);
    assert.equal(row[1], source.countries, `${zone} keeps tzdb's country list`);
    assert.equal(row[4] || "", source.comment, `${zone} keeps tzdb's comment`);
  }
  for (const zone of table.keys()) assert.ok(generated.has(zone), `${zone} is not missing`);
});

test("every row is shaped like a place", () => {
  for (const [zone, countries, lat, lon, comment] of TZ_ROWS) {
    assert.match(zone, /^[A-Za-z]+\/[A-Za-z0-9_+/-]+$/, `${zone} looks like an IANA id`);
    assert.match(countries, /^[A-Z]{2}(,[A-Z]{2})*$/, `${zone} has ISO 3166 alpha-2 codes`);
    assert.ok(lat >= -90 && lat <= 90, `${zone} latitude`);
    assert.ok(lon >= -180 && lon <= 180, `${zone} longitude`);
    assert.ok(Number.isFinite(lat) && Number.isFinite(lon));
    if (comment) assert.ok(comment.length < 90, `${zone} comment is short`);
  }
});

test("every alias points at a real, modern zone", () => {
  const zones = new Set(TZ_ROWS.map((row) => row[0]));
  for (const [alias, canonical] of Object.entries(TZ_LINKS)) {
    assert.ok(zones.has(canonical), `${canonical} (target of ${alias}) is a known zone`);
    assert.ok(!zones.has(alias), `${alias} is an alias, not a current zone`);
    assert.notEqual(alias, canonical);
  }
  // The names the bug report called out must be present.
  for (const alias of ["Asia/Katmandu", "Asia/Calcutta", "Europe/Kiev", "Asia/Saigon", "Asia/Rangoon"]) {
    assert.ok(TZ_LINKS[alias], `${alias} is folded onto ${TZ_LINKS[alias]}`);
    assert.ok(zones.has(TZ_LINKS[alias]));
  }
});

test("the data records where it came from", () => {
  assert.match(TZ_DATA_VERSION, /IANA tzdb/);
  assert.match(TZ_DATA_VERSION, /generated \d{4}-\d{2}-\d{2}/);
  assert.match(TZ_DATA_VERSION, /\d+ zones \/ \d+ aliases/);
});

test("the generated file is not hand-edited", () => {
  const source = readFileSync(resolve(root, "src", "tz-places.generated.js"), "utf8");
  assert.match(source, /GENERATED FILE — do not edit by hand/);
  assert.match(source, /scripts\/build-tz-data\.mjs/);
});
