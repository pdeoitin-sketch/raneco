import assert from "node:assert/strict";
import test from "node:test";

import {
  BACKUP_KIND,
  BACKUP_VERSION,
  applyBackup,
  backupFileName,
  buildBackupJSON,
  collectBackup,
  parseBackup,
} from "../src/data-backup.js";

/** A tiny Storage-shaped stand-in. */
function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
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

test("a backup gathers every tempo-* key and nothing else", () => {
  const store = memoryStorage({
    "tempo-home-zone": "city:kathmandu",
    "tempo-calendar-notes": "{}",
    "tempo-alarms": "[]",
    "browser-theme": "dark",
    "": "odd",
  });
  const backup = collectBackup(store, { now: new Date(Date.UTC(2026, 8, 16, 10, 30)) });
  assert.equal(backup.kind, BACKUP_KIND);
  assert.equal(backup.version, BACKUP_VERSION);
  assert.equal(backup.exportedAt, "2026-09-16T10:30:00.000Z");
  assert.deepEqual(Object.keys(backup.settings).sort(), ["tempo-alarms", "tempo-calendar-notes", "tempo-home-zone"]);
  assert.ok(!("browser-theme" in backup.settings), "foreign keys stay home");
  assert.match(backupFileName(new Date(Date.UTC(2026, 8, 16))), /^tempo-backup-2026-09-16\.json$/);
});

test("build → parse round-trips, and import restores exactly", () => {
  const origin = memoryStorage({ "tempo-text-size": "large", "tempo-theme-mode": "rain" });
  const json = buildBackupJSON(origin, { now: new Date(Date.UTC(2026, 8, 16)) });

  const parsed = parseBackup(json);
  assert.equal(parsed.ok, true);

  const target = memoryStorage({ "tempo-text-size": "compact", "tempo-stale": "gone", "keep-me": "untouched" });
  const written = applyBackup(parsed.backup, target);
  assert.equal(written, 2);
  assert.equal(target.values.get("tempo-text-size"), "large", "backup wins over current values");
  assert.equal(target.values.get("tempo-theme-mode"), "rain");
  assert.equal(target.values.has("tempo-stale"), false, "import is a restore, not a merge");
  assert.equal(target.values.get("keep-me"), "untouched", "non-tempo keys survive");
});

test("parseBackup refuses politely: bad JSON, wrong shape, wrong app, future versions, smuggled keys", () => {
  assert.match(parseBackup("not json").error, /not JSON/);
  assert.match(parseBackup("42").error, /not a Tempo backup/);
  assert.match(parseBackup(JSON.stringify({ kind: "other-app" })).error, /does not look like a Tempo backup/);
  assert.match(
    parseBackup(JSON.stringify({ kind: BACKUP_KIND, version: BACKUP_VERSION + 1, settings: {} })).error,
    /newer Tempo/
  );
  assert.match(
    parseBackup(JSON.stringify({ kind: BACKUP_KIND, version: BACKUP_VERSION })).error,
    /missing its settings/
  );
  assert.match(
    parseBackup(JSON.stringify({ kind: BACKUP_KIND, version: BACKUP_VERSION, settings: { "tempo-x": 12 } })).error,
    /never write/
  );
  assert.match(
    parseBackup(JSON.stringify({ kind: BACKUP_KIND, version: BACKUP_VERSION, settings: { "outside-key": "x" } })).error,
    /never write/
  );
  assert.match(
    parseBackup(JSON.stringify({ kind: BACKUP_KIND, version: BACKUP_VERSION, settings: {} })).error,
    /no settings inside/
  );
});
