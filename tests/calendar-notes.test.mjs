import assert from "node:assert/strict";
import test from "node:test";

import {
  NOTES_STORAGE_KEY,
  NOTE_TEXT_LIMIT,
  PER_DATE_LIMIT,
  addNote,
  normaliseNoteColor,
  noteCountForDate,
  notesForDate,
  removeNote,
  totalNoteCount,
} from "../src/calendar-notes.js";

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

test("notes pin to a date, list in order, and unpin cleanly", () => {
  const store = memoryStorage();
  const first = addNote("2026-09-16", { text: "Dashain shopping list", color: "amber" }, store);
  assert.ok(first && first.id);
  const second = addNote("2026-09-16", { text: "Call home at 7", color: "mint" }, store);

  const list = notesForDate("2026-09-16", store);
  assert.deepEqual(
    list.map((note) => note.text),
    ["Dashain shopping list", "Call home at 7"]
  );
  assert.equal(list[0].color, "amber");
  assert.equal(noteCountForDate("2026-09-16", store), 2);
  assert.equal(totalNoteCount(store), 2);

  assert.equal(removeNote("2026-09-16", first.id, store), true);
  assert.deepEqual(
    notesForDate("2026-09-16", store).map((note) => note.id),
    [second.id]
  );

  // Removing the last note prunes the date from the store entirely.
  assert.equal(removeNote("2026-09-16", second.id, store), true);
  assert.equal(store.values.has(NOTES_STORAGE_KEY), true, "key stays, as an empty object");
  assert.deepEqual(notesForDate("2026-09-16", store), []);
  assert.equal(JSON.parse(store.values.get(NOTES_STORAGE_KEY))["2026-09-16"], undefined);
});

test("notes are trimmed, capped and colour-checked", () => {
  const store = memoryStorage();
  const note = addNote("2027-01-01", { text: `  ${"x".repeat(400)}  `, color: "PURPLE" }, store);
  assert.equal(note.text.length, NOTE_TEXT_LIMIT);
  assert.equal(note.color, "violet", "unknown colours fall back");
  assert.equal(normaliseNoteColor("coral"), "coral");
  assert.equal(normaliseNoteColor("plaid"), "violet");

  assert.equal(addNote("not-a-date", { text: "nowhere" }, store), null);
  assert.equal(addNote("2027-01-01", { text: "   " }, store), null, "empty notes go nowhere");

  const capped = memoryStorage();
  for (let index = 0; index < PER_DATE_LIMIT; index += 1) {
    assert.ok(addNote("2027-01-01", { text: `note ${index}` }, capped));
  }
  assert.equal(addNote("2027-01-01", { text: "one too many" }, capped), null);
  assert.equal(noteCountForDate("2027-01-01", capped), PER_DATE_LIMIT);
});

test("a corrupt store reads as empty rather than throwing", () => {
  const gibberish = memoryStorage({ [NOTES_STORAGE_KEY]: "not json" });
  assert.deepEqual(notesForDate("2026-09-16", gibberish), []);

  const wrong = memoryStorage({ [NOTES_STORAGE_KEY]: JSON.stringify([1, 2, 3]) });
  assert.deepEqual(notesForDate("2026-09-16", wrong), []);

  const scrub = memoryStorage({
    [NOTES_STORAGE_KEY]: JSON.stringify({
      "2026-09-16": [{ id: "a", text: "keep", color: "mint" }, { text: "" }, "junk"],
      "bad date": [],
    }),
  });
  const list = notesForDate("2026-09-16", scrub);
  assert.equal(list.length, 1);
  assert.equal(list[0].text, "keep");
});
