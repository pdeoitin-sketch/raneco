#!/usr/bin/env node
/**
 * Regenerates `src/tz-places.generated.js` from the IANA time zone database
 * files vendored in `tzdata/`.
 *
 *   npm run build:tz-data     # regenerate from tzdata/
 *   npm run fetch:tz-data     # refresh tzdata/ from the tzdb repository first
 *
 * Why the data is committed instead of fetched at runtime: the site is a
 * static GitHub Pages bundle, so every byte it needs has to be part of the
 * build (no API keys, no CORS surprises, works offline once cached).
 *
 * Sources (public domain, per their own headers):
 *   tzdata/zone1970.tab  one row per zone whose civil time has agreed since 1970
 *                        — countries, coordinates and the *canonical* zone id
 *   tzdata/zone.tab      one row per zone id, which adds the many zones that
 *                        zone1970.tab merges together (Africa/Accra, ...)
 *   tzdata/backward      `Link  <canonical>  <alias>` rows, i.e. the legacy ids
 *                        old browsers keep reporting (Asia/Katmandu, Europe/Kiev)
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "tzdata");
const outFile = join(root, "src", "tz-places.generated.js");

const SOURCES = ["zone1970.tab", "zone.tab", "backward"];

function fetchVendoredFiles() {
  mkdirSync(dataDir, { recursive: true });
  const commit = JSON.parse(
    execFileSync("curl", ["-sS", "-L", "https://api.github.com/repos/eggert/tz/commits/main"], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 4,
    })
  );
  writeFileSync(
    join(dataDir, "SOURCE.json"),
    `${JSON.stringify(
      {
        repo: "eggert/tz (IANA time zone database)",
        ref: "main",
        commit: commit.sha,
        committedDate: commit.commit.author.date,
        fetched: new Date().toISOString().slice(0, 10),
        files: SOURCES,
      },
      null,
      2
    )}\n`
  );
  for (const file of SOURCES) {
    const url = `https://api.github.com/repos/eggert/tz/contents/${file}?ref=main`;
    console.log(`fetching ${file} ...`);
    const body = execFileSync("curl", ["-sS", "-L", "-H", "Accept: application/vnd.github.raw", url], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 8,
    });
    if (!body || body.startsWith("{")) {
      throw new Error(`Unexpected response while fetching ${url}`);
    }
    writeFileSync(join(dataDir, file), body);
  }
}

/** `+2743+08519`, `-6734-06808`, `+744144-0944945` -> decimal degrees. */
function parseCoordinates(text) {
  const match = /^([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?$/.exec(String(text).trim());
  if (!match) return null;
  const [, latSign, latDeg, latMin, latSec, lonSign, lonDeg, lonMin, lonSec] = match;
  const toDegrees = (sign, deg, min, sec) => {
    const value = Number(deg) + Number(min) / 60 + Number(sec || 0) / 3600;
    return sign === "-" ? -value : value;
  };
  return {
    lat: Number(toDegrees(latSign, latDeg, latMin, latSec).toFixed(4)),
    lon: Number(toDegrees(lonSign, lonDeg, lonMin, lonSec).toFixed(4)),
  };
}

function parseZoneTable(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [countries, coordinates, zone, comment] = line.split(/\t+/);
    if (!countries || !zone) continue;
    const position = parseCoordinates(coordinates);
    rows.push({
      zone: zone.trim(),
      countries: countries
        .split(",")
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean),
      lat: position ? position.lat : null,
      lon: position ? position.lon : null,
      comment: (comment || "").trim(),
    });
  }
  return rows;
}

function parseLinks(text) {
  const links = new Map();
  for (const line of text.split("\n")) {
    if (!line.startsWith("Link")) continue;
    // Columns are tab separated and `backward` pads some rows with extra tabs
    // for alignment, so collapse runs of tabs before reading the fields.
    const fields = line.split(/\t+/).filter(Boolean);
    if (fields.length < 3) continue;
    const [, target, alias] = fields;
    links.set(alias.trim(), target.trim());
  }
  return links;
}

/** Follow `Link` chains until a name that is not itself an alias shows up. */
function resolveCanonical(zone, links, known) {
  let current = zone;
  const seen = new Set([current]);
  for (let hops = 0; hops < 8; hops += 1) {
    const next = links.get(current);
    if (!next || seen.has(next)) break;
    // Stop at the first name that is a real zone (it is the modern id); a chain
    // that only lands on other aliases keeps walking.
    current = next;
    seen.add(current);
    if (known.has(current) && !links.has(current)) break;
  }
  return current;
}

function main() {
  if (process.argv.includes("--fetch")) fetchVendoredFiles();

  const read = (file) => {
    try {
      return readFileSync(join(dataDir, file), "utf8");
    } catch (_) {
      return "";
    }
  };
  const merged = parseZoneTable(read("zone1970.tab"));
  const mergedById = new Map(merged.map((row) => [row.zone, row]));

  // zone.tab adds the zones zone1970.tab folds away (same clock since 1970).
  for (const row of parseZoneTable(read("zone.tab"))) {
    if (mergedById.has(row.zone)) continue;
    mergedById.set(row.zone, row);
    merged.push(row);
  }

  const links = parseLinks(read("backward"));
  const known = new Set(mergedById.keys());

  // Keep only aliases that actually help: the legacy id differs from the
  // modern one and resolves to something we can describe.
  const usefulLinks = new Map();
  for (const alias of links.keys()) {
    if (known.has(alias)) continue;
    const canonical = resolveCanonical(alias, links, known);
    if (canonical === alias || !mergedById.has(canonical)) continue;
    usefulLinks.set(alias, canonical);
  }

  const rows = merged.map((row) => {
    const entry = [row.zone, row.countries.join(","), row.lat, row.lon];
    if (row.comment) entry.push(row.comment);
    return entry;
  });

  const aliasList = [...usefulLinks.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const generatedAt = new Date().toISOString().slice(0, 10);
  const sourceText = read("SOURCE.json");
  let source = null;
  try {
    source = sourceText ? JSON.parse(sourceText) : null;
  } catch (_) {
    source = null;
  }
  const provenance = source
    ? `IANA tzdb ${source.repo} @ ${String(source.commit).slice(0, 12)} (${source.committedDate}), vendored in tzdata/`
    : "IANA tzdb files vendored in tzdata/";

  const banner = `/* ------------------------------------------------------------------
 * GENERATED FILE — do not edit by hand.
 *
 * Produced by scripts/build-tz-data.mjs from the IANA tzdb files vendored in
 * tzdata/ (zone1970.tab, zone.tab, backward — all public domain). Run
 * \`npm run build:tz-data\` after refreshing those files with
 * \`npm run fetch:tz-data\`.
 *
 * Source: ${provenance}
 *
 *   * TZ_ROWS   [zone, "CC[,CC…]", latitude, longitude, comment?]
 *               the first country code is the primary one (tzdb lists the most
 *               populous country first) and rows keep tzdb's own order, which
 *               sorts each country's zones roughly by population.
 *   * TZ_LINKS  legacy / alternative zone id -> modern canonical id, so a
 *               browser that reports Asia/Katmandu can still show Kathmandu.
 * ------------------------------------------------------------------ */`;

  const rowLines = rows
    .map((row) =>
      `  [${JSON.stringify(row[0])}, ${JSON.stringify(row[1])}, ${row[2]}, ${row[3]}${
        row[4] ? `, ${JSON.stringify(row[4])}` : ""
      }]`
    )
    .join(",\n");
  const linkLines = aliasList.map(([alias, canonical]) => `  ${JSON.stringify(alias)}: ${JSON.stringify(canonical)}`).join(",\n");

  const body = [
    banner,
    "",
    `export const TZ_DATA_VERSION = ${JSON.stringify(
      `${provenance}, generated ${generatedAt}, ${rows.length} zones / ${aliasList.length} aliases`
    )};`,
    "",
    "export const TZ_ROWS = [",
    rowLines,
    "];",
    "",
    "export const TZ_LINKS = {",
    linkLines,
    "};",
    "",
  ].join("\n");

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, body);
  console.log(
    `wrote ${outFile.replace(`${root}/`, "")}: ${rows.length} zones, ${aliasList.length} legacy aliases, ${(body.length / 1024).toFixed(1)} kB`
  );
}

main();
