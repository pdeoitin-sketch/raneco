/**
 * Export and import for everything Tempo remembers.
 *
 * Tempo's whole memory is the flat `tempo-*` namespace in localStorage:
 * the home place, the world-clock board, alarms, timer sounds and volume,
 * theme, text size, calendar view and notes, preferences, remarks, saved
 * calculations, the old clock's face. A backup is therefore just that
 * namespace poured into one JSON document — no account, no server, nothing
 * leaving the device except the file the reader chose to save.
 *
 * Import validates the shape, refuses anything that is not a Tempo backup,
 * and only ever writes keys beginning with `tempo-`.
 */

export const BACKUP_KIND = "tempo-backup";
export const BACKUP_VERSION = 1;
export const BACKUP_PREFIX = "tempo-";

function allStorageKeys(storage) {
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (typeof key === "string") keys.push(key);
  }
  return keys;
}

/** { kind, version, exportedAt, settings: { tempo-…: "…" } } */
export function collectBackup(storage, { now = new Date() } = {}) {
  const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
  const settings = {};
  if (store) {
    for (const key of allStorageKeys(store)) {
      if (!key.startsWith(BACKUP_PREFIX)) continue;
      const value = store.getItem(key);
      if (typeof value === "string") settings[key] = value;
    }
  }
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    app: "Tempo",
    exportedAt: now.toISOString(),
    settings,
  };
}

export function backupFileName(now = new Date()) {
  return `tempo-backup-${now.toISOString().slice(0, 10)}.json`;
}

export function buildBackupJSON(storage, { now } = {}) {
  return JSON.stringify(collectBackup(storage, { now }), null, 2);
}

/**
 * Parse backup text defensively. Returns
 *   { ok: true, backup }
 *   { ok: false, error }
 * never throws — a hand-edited file should fail with a message, not a crash.
 */
export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text || ""));
  } catch (_) {
    return { ok: false, error: "That file is not JSON — nothing was imported." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "That file is not a Tempo backup." };
  }
  if (parsed.kind !== BACKUP_KIND) {
    return { ok: false, error: "That JSON does not look like a Tempo backup." };
  }
  if (typeof parsed.version !== "number" || parsed.version > BACKUP_VERSION) {
    return { ok: false, error: "This backup comes from a newer Tempo than this page — nothing was imported." };
  }
  const settings = parsed.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return { ok: false, error: "The backup is missing its settings." };
  }
  const clean = {};
  for (const [key, value] of Object.entries(settings)) {
    if (!key.startsWith(BACKUP_PREFIX) || typeof value !== "string") {
      return { ok: false, error: `The backup contains a key Tempo would never write (“${key}”).` };
    }
    clean[key] = value;
  }
  if (!Object.keys(clean).length) {
    return { ok: false, error: "The backup has no settings inside." };
  }
  return { ok: true, backup: { ...parsed, version: parsed.version, settings: clean } };
}

/**
 * Replace this device's Tempo memory with the backup's. Keys the backup
 * does not mention are removed first — import is a restore, not a merge.
 * Returns the number of keys written.
 */
export function applyBackup(backup, storage) {
  const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!store || !backup || !backup.settings) return 0;
  for (const key of allStorageKeys(store)) {
    if (key.startsWith(BACKUP_PREFIX)) store.removeItem(key);
  }
  let written = 0;
  for (const [key, value] of Object.entries(backup.settings)) {
    store.setItem(key, value);
    written += 1;
  }
  return written;
}
