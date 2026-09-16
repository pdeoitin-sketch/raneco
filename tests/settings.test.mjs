import assert from "node:assert/strict";
import test from "node:test";

import {
  TEXT_SIZE_OPTIONS,
  applyTextSize,
  normaliseTextSize,
  readTextSize,
  textSizeOption,
  writeTextSize,
} from "../src/settings.js";

test("text size options are ordered from dense to most readable", () => {
  assert.deepEqual(TEXT_SIZE_OPTIONS.map((option) => option.id), ["compact", "default", "large", "extra"]);
  assert.deepEqual(TEXT_SIZE_OPTIONS.map((option) => option.scale), [0.94, 1, 1.12, 1.24]);
  for (const option of TEXT_SIZE_OPTIONS) {
    assert.ok(option.label);
    assert.ok(option.token.startsWith("A"));
    assert.ok(option.summary.length > 20);
  }
});

test("text size values are sanitised and migrate old names", () => {
  assert.equal(normaliseTextSize("large"), "large");
  assert.equal(normaliseTextSize("A++"), "extra");
  assert.equal(normaliseTextSize("small"), "compact");
  assert.equal(normaliseTextSize("0.95"), "compact");
  assert.equal(normaliseTextSize("nonsense"), "default");
  assert.equal(textSizeOption("extra").scale, 1.24);
  assert.equal(textSizeOption("unknown").id, "default");
});

test("text size reads and writes the settings storage key", () => {
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };

  assert.equal(readTextSize(storage), "default");
  writeTextSize("extra", storage);
  assert.equal(values.get("tempo-text-size"), "extra");
  assert.equal(readTextSize(storage), "extra");

  values.delete("tempo-text-size");
  values.set("tempo-text-scale", "1.12");
  assert.equal(readTextSize(storage), "large", "old raw scale values migrate on read");
});

test("applying a text size sets the root data hook and scale variable", () => {
  const root = {
    dataset: {},
    style: {
      values: {},
      setProperty(name, value) {
        this.values[name] = value;
      },
    },
  };
  const option = applyTextSize(root, "extra");
  assert.equal(option.id, "extra");
  assert.equal(root.dataset.textSize, "extra");
  assert.equal(root.style.values["--tempo-text-scale"], "1.24");
});
