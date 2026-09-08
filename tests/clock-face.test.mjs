import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, describe, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

/**
 * The clock face (src/clock-face.js) draws both analog clocks: the small one
 * on "Right now" and the big one on the Old clock page.
 *
 * These tests lock three things:
 *   • every numeral style spells the full dial, in order, at the right angle;
 *   • switching styles re-spells the dial and reports itself on the root;
 *   • the stylesheet rule parks the glyphs on the dial edge. jsdom has no
 *     layout engine, so that last one reads styles.css directly — it guards
 *     the exact regression that once piled all twelve numerals at the centre.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// clock-face.js touches the global `document` only when a face is built, so
// one shared jsdom document is enough for every test in this file.
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
Object.defineProperty(globalThis, "document", {
  value: dom.window.document,
  configurable: true,
  writable: true,
  enumerable: true,
});
after(() => {
  if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
  else delete globalThis.document;
  dom.window.close();
});

const { createClockFace } = await import(pathToFileURL(resolve(root, "src/clock-face.js")).href);

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const ARABIC = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

function buildFace(options) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const face = createClockFace(host, options);
  return { host, face };
}

function glyphs(host) {
  return Array.from(host.querySelectorAll(".face-number em")).map((node) => node.textContent);
}

function angles(host) {
  return Array.from(host.querySelectorAll(".face-number")).map((node) =>
    node.style.getPropertyValue("--angle")
  );
}

describe("clock face numerals", () => {
  test("roman spells the full dial in order, one glyph per hour", () => {
    const { host } = buildFace({ numerals: "roman" });
    assert.equal(host.dataset.numerals, "roman");
    assert.deepEqual(glyphs(host), ROMAN);
    assert.deepEqual(
      angles(host),
      Array.from({ length: 12 }, (_, index) => `${(index + 1) * 30}deg`)
    );
    assert.equal(host.querySelectorAll(".face-tick").length, 60);
  });

  test("arabic is the default, and switching re-spells the dial", () => {
    const { host, face } = buildFace({});
    assert.equal(host.dataset.numerals, "arabic");
    assert.deepEqual(glyphs(host), ARABIC);

    face.setNumerals("roman");
    assert.equal(host.dataset.numerals, "roman");
    assert.deepEqual(glyphs(host), ROMAN);

    face.setNumerals("none");
    // Hidden by CSS (`[data-numerals="none"] .face-numbers`); the `data`
    // attribute is what the stylesheet keys on.
    assert.equal(host.dataset.numerals, "none");

    face.setNumerals("arabic");
    assert.equal(host.dataset.numerals, "arabic");
    assert.deepEqual(glyphs(host), ARABIC);
  });

  test("an unknown style falls back to arabic instead of a blank dial", () => {
    const { host, face } = buildFace({ numerals: "roman" });
    face.setNumerals("cuneiform");
    assert.equal(host.dataset.numerals, "arabic");
    assert.deepEqual(glyphs(host), ARABIC);
  });

  test("update() points the hands where the parts say", () => {
    const { face } = buildFace({ numerals: "roman" });
    face.update(new Date(2026, 8, 8, 3, 0, 0), { hour: 3, minute: 0, second: 0, ms: 0 });
    assert.equal(face.hourHand.style.transform, "rotate(90.000deg)");
    assert.equal(face.minuteHand.style.transform, "rotate(0.000deg)");
    assert.equal(face.secondHand.style.transform, "rotate(0.000deg)");

    face.update(new Date(2026, 8, 8, 6, 30, 15), { hour: 6, minute: 30, second: 15, ms: 0 });
    assert.equal(face.hourHand.style.transform, "rotate(195.125deg)");
    assert.equal(face.minuteHand.style.transform, "rotate(181.500deg)");
    assert.equal(face.secondHand.style.transform, "rotate(90.000deg)");
  });

  test("the stylesheet parks numerals on the dial edge, not the centre", () => {
    const css = readFileSync(resolve(root, "styles.css"), "utf8");
    const cell = css.match(/\.clock-face\s+\.face-number\s*\{([^}]*)\}/)?.[1] ?? "";
    assert.match(cell, /place-items\s*:\s*start\s+center/, "glyph cells pin to the top edge");
    const glyph = css.match(/\.clock-face\s+\.face-number\s+em\s*\{([^}]*)\}/)?.[1] ?? "";
    // A % margin resolves against the (square) face; a % translate would
    // resolve against the glyph itself and stack all twelve at the centre.
    assert.match(glyph, /margin-top\s*:\s*[\d.]+%/, "glyphs sit inside the tick ring");
    assert.doesNotMatch(glyph, /translateY\s*\(\s*-/, "no self-relative % translate");
  });
});

describe("head bar branding", () => {
  test("the top bar names the app Tempo and links home", () => {
    // Static markup, so parse index.html directly instead of booting the app.
    const html = readFileSync(resolve(root, "index.html"), "utf8");
    const page = new JSDOM(html, { url: "http://localhost/" });
    try {
      const brand = page.window.document.querySelector(".topbar .topbar-brand");
      assert.ok(brand, "a brand lives in the head bar");
      assert.equal(brand.getAttribute("href"), "#/now");
      assert.equal(brand.getAttribute("aria-label"), "Tempo home");
      assert.match(brand.textContent.replace(/\s+/g, ""), /tempo\./i);
      // The sidebar keeps its own brand; the head bar gains one, it is not moved.
      assert.ok(page.window.document.querySelector(".sidebar .brand"), "sidebar brand stays");
    } finally {
      page.window.close();
    }
  });
});
