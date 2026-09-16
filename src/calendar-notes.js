/**
 * Notes pinned to a calendar date.
 *
 * One localStorage key, one flat object: `{ "2026-09-16": [ {id, text,
 * color, createdAt}, ... ], ... }`. Dates with no notes left are pruned, so
 * the store never fills with empty husks. The backup export sweeps this key
 * up along with every other `tempo-*` key, so notes travel with a backup.
 */

export const NOTES_STORAGE_KEY = "tempo-calendar-notes";
export const NOTE_TEXT_LIMIT = 280;
export const PER_DATE_LIMIT = 20;

export const NOTE_COLORS = [
  { id: "violet", label: "Violet" },
  { id: "mint", label: "Mint" },
  { id: "amber", label: "Amber" },
  { id: "coral", label: "Coral" },
];

export function normaliseNoteColor(value) {
  const raw = String(value || "").trim().toLowerCase();
  return NOTE_COLORS.some((color) => color.id === raw) ? raw : "violet";
}

export function readAllNotes(storage) {
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!store) return {};
    const parsed = JSON.parse(store.getItem(NOTES_STORAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const all = {};
    for (const [iso, list] of Object.entries(parsed)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Array.isArray(list)) continue;
      const clean = list
        .filter((note) => note && typeof note.text === "string" && note.text.trim())
        .slice(0, PER_DATE_LIMIT)
        .map((note, index) => ({
          id: typeof note.id === "string" && note.id ? note.id : `${iso}-${index}`,
          text: note.text.trim().slice(0, NOTE_TEXT_LIMIT),
          color: normaliseNoteColor(note.color),
          createdAt: Number.isFinite(note.createdAt) ? note.createdAt : 0,
        }));
      if (clean.length) all[iso] = clean;
    }
    return all;
  } catch (_) {
    return {};
  }
}

function writeAllNotes(all, storage) {
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (store) store.setItem(NOTES_STORAGE_KEY, JSON.stringify(all));
  } catch (_) {
    /* notes live for this visit only when storage is blocked */
  }
}

export function notesForDate(iso, storage) {
  return readAllNotes(storage)[iso] || [];
}

export function noteCountForDate(iso, storage) {
  return notesForDate(iso, storage).length;
}

export function addNote(iso, { text, color } = {}, storage) {
  const cleanText = String(text || "").trim().slice(0, NOTE_TEXT_LIMIT);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || "")) || !cleanText) return null;
  const all = readAllNotes(storage);
  const list = all[iso] || [];
  if (list.length >= PER_DATE_LIMIT) return null;
  const note = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text: cleanText,
    color: normaliseNoteColor(color),
    createdAt: Date.now(),
  };
  all[iso] = [...list, note];
  writeAllNotes(all, storage);
  return note;
}

export function removeNote(iso, id, storage) {
  const all = readAllNotes(storage);
  const list = all[iso] || [];
  const next = list.filter((note) => note.id !== id);
  if (next.length === list.length) return false;
  if (next.length) all[iso] = next;
  else delete all[iso];
  writeAllNotes(all, storage);
  return true;
}

export function totalNoteCount(storage) {
  return Object.values(readAllNotes(storage)).reduce((sum, list) => sum + list.length, 0);
}
