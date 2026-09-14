import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, describe, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

/**
 * The eight clock faces (src/clock-themes.js) and the live sky behind the
 * Old clock (src/sky-scenes.js).
 *
 * A face is a thin record — the mechanism never changes, only the coat of
 * paint — so the tests pin the records, the upgrade from the old numeral
 * settings, that the renderer honours a face, and that the stylesheet
 * actually paints all eight. The sky half pins the mean-synodic moon and
 * the scene a given weather earns.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

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

const { CLOCK_THEMES, CLOCK_THEME_IDS, DEFAULT_CLOCK_THEME, findClockTheme, themeFromLegacyNumerals } = await import(
  pathToFileURL(resolve(root, "src/clock-themes.js")).href
);
const { createClockFace, NUMERAL_STYLES } = await import(pathToFileURL(resolve(root, "src/clock-face.js")).href);
const {
  MOONLESS_ILLUMINATION,
  SCENES,
  moonIllumination,
  moonPhase,
  moonShadowShift,
  sceneFor,
  sceneParticles,
} = await import(pathToFileURL(resolve(root, "src/sky-scenes.js")).href);

function buildFace(options) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return { host, face: createClockFace(host, options) };
}

const glyphs = (host) => Array.from(host.querySelectorAll(".face-number em")).map((node) => node.textContent);

describe("the eight faces", () => {
  test("there are exactly eight, ordered, labelled, and drawable", () => {
    assert.deepEqual(
      CLOCK_THEME_IDS,
      ["roman", "modern", "minimal", "railway", "pocket", "neon", "brutalist", "botanical"]
    );
    assert.equal(CLOCK_THEMES.length, 8);
    for (const theme of CLOCK_THEMES) {
      assert.ok(theme.label.length > 2, `${theme.id} has a label`);
      assert.ok(theme.note.length > 10, `${theme.id} explains itself`);
      assert.ok(NUMERAL_STYLES.includes(theme.numerals), `${theme.id} uses a numeral mode the face can draw`);
    }
    // The faces are deliberately not all the same clock.
    const modes = new Set(CLOCK_THEMES.map((theme) => theme.numerals));
    assert.deepEqual([...modes].sort(), ["arabic", "none", "roman"]);
  });

  test("an unknown face id falls back to the default, never to a blank dial", () => {
    assert.equal(findClockTheme("railway").id, "railway");
    assert.equal(findClockTheme("no-such-face").id, DEFAULT_CLOCK_THEME);
    assert.equal(findClockTheme(null).id, DEFAULT_CLOCK_THEME);
    assert.equal(findClockTheme(undefined).id, DEFAULT_CLOCK_THEME);
    assert.equal(DEFAULT_CLOCK_THEME, "roman", "the face Tempo has always shipped with");
  });

  test("a numeral setting saved by an earlier Tempo upgrades to a face", () => {
    assert.equal(themeFromLegacyNumerals("roman"), "roman");
    assert.equal(themeFromLegacyNumerals("arabic"), "modern");
    assert.equal(themeFromLegacyNumerals("none"), "minimal");
    assert.equal(themeFromLegacyNumerals("brutalist"), null, "already a face id: not the caller's business");
    assert.equal(themeFromLegacyNumerals("junk"), null);
  });

  test("setTheme reports the face on the root and re-spells the dial", () => {
    const { host, face } = buildFace({ numerals: "arabic" });
    face.setTheme("pocket");
    assert.equal(host.dataset.clockTheme, "pocket");
    assert.equal(host.dataset.numerals, "roman", "the pocket watch spells in Roman numerals");
    assert.equal(glyphs(host)[11], "XII", "the twelfth hour spells XII");

    face.setTheme("railway");
    assert.equal(host.dataset.clockTheme, "railway");
    assert.equal(host.dataset.numerals, "arabic");
    assert.equal(glyphs(host)[0], "1");
  });

  test("minimal drops the numerals; a face can be worn from construction", () => {
    const { host, face } = buildFace({ theme: "minimal" });
    assert.equal(host.dataset.clockTheme, "minimal", "the face arrives with the clock");
    assert.equal(host.dataset.numerals, "none");
    face.setTheme("botanical");
    assert.equal(host.dataset.numerals, "roman", "botanical prefers the old spelling too");
    assert.equal(glyphs(host)[11], "XII");
  });

  test("the stylesheet paints every face — and every scene", () => {
    const css = readFileSync(resolve(root, "styles.css"), "utf8");
    for (const id of CLOCK_THEME_IDS) {
      assert.ok(css.includes(`[data-clock-theme="${id}"]`), `styles.css knows the ${id} face`);
    }
    for (const scene of SCENES) {
      assert.ok(css.includes(`[data-scene="${scene}"]`), `styles.css knows the ${scene} scene`);
    }
  });
});

describe("the moon behind the dial", () => {
  test("the mean-synodic phase anchors to a real new moon", () => {
    const reference = moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14)));
    assert.ok(reference < 0.02, `the anchor new moon is phase 0, got ${reference}`);
    // Real events, within the honest error of a mean-synodic calculation.
    const fullMoonJan2024 = moonPhase(new Date("2024-01-25T17:54:00Z"));
    assert.ok(Math.abs(fullMoonJan2024 - 0.5) < 0.05, `a real full moon reads ~0.5, got ${fullMoonJan2024}`);
    const newMoonFeb2024 = moonPhase(new Date("2024-02-09T22:59:00Z"));
    assert.ok(newMoonFeb2024 < 0.05, `a real new moon reads ~0, got ${newMoonFeb2024}`);
    // One synodic month later, the anchor is back where it started.
    const cycle = moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14) + 29.530588861 * 86400000));
    assert.ok(cycle < 0.01 || cycle > 0.99, `phase is periodic, got ${cycle}`);
    assert.ok(moonPhase() >= 0 && moonPhase() < 1, "phase is always 0–1");
  });

  test("illumination reads the way a person would, and the scene's shadow follows", () => {
    assert.equal(moonIllumination(0).toFixed(2), "0.00");
    assert.equal(moonIllumination(0.5).toFixed(2), "1.00");
    assert.equal(moonIllumination(0.25).toFixed(2), "0.50");
    assert.equal(moonIllumination(0.75).toFixed(2), "0.50");
    // The shadow's shift encodes the phase on the drawn moon.
    assert.equal(Number(moonShadowShift(0.5)), 0, "full: the shadow hides behind the disc");
    assert.equal(Number(moonShadowShift(0)), 100, "new: the shadow covers it");
    assert.equal(Number(moonShadowShift(0.25)), 50, "first quarter: half covered");
  });
});

describe("the scene a sky earns", () => {
  const sky = (over = {}) => ({
    ok: true,
    code: 0,
    isDay: true,
    windSpeed: 8,
    windUnit: "km/h",
    utcOffsetSeconds: 19800,
    ...over,
  });
  const noon = new Date(Date.UTC(2026, 8, 14, 6, 30)); // 12:00 in Kathmandu

  test("precipitation and drama outrank everything", () => {
    assert.equal(sceneFor(sky({ code: 95 }), { now: noon }), "thunderstorm", "a thunderstorm is a thunderstorm");
    assert.equal(sceneFor(sky({ code: 96 }), { now: noon }), "thunderstorm");
    assert.equal(sceneFor(sky({ code: 73 }), { now: noon }), "snowfall");
    assert.equal(sceneFor(sky({ code: 45 }), { now: noon }), "fog");
    assert.equal(sceneFor(sky({ code: 63 }), { now: noon }), "rain", "heavy rain, no sun about");
    assert.equal(sceneFor(sky({ code: 51 }), { now: noon }), "rain");

    // A sunlit light shower is the one sky that earns a rainbow.
    assert.equal(sceneFor(sky({ code: 80 }), { now: noon }), "rainbow");
    assert.equal(sceneFor(sky({ code: 81 }), { now: noon }), "rainbow");
    assert.equal(sceneFor(sky({ code: 80, isDay: false }), { now: noon }), "rain", "at night it is just rain");
    assert.equal(sceneFor(sky({ code: 82 }), { now: noon }), "rain", "a violent shower is not a rainbow");
  });

  test("a clear night gets stars — with a moon only if the real one is up", () => {
    const night = { now: noon, phase: 0.5 };
    assert.equal(sceneFor(sky({ isDay: false }), night), "starry-night", "a full moon is in the scene");
    assert.equal(sceneFor(sky({ isDay: false }), { now: noon, phase: 0.02 }), "moonless-night");
    assert.equal(sceneFor(sky({ code: 1, isDay: false }), { now: noon, phase: 0.98 }), "moonless-night", "the wrap-around new moon");
    assert.equal(sceneFor(sky({ code: 3, isDay: false }), night), "cloudy", "an overcast night hides the stars");
    assert.ok(moonIllumination(0.02) < MOONLESS_ILLUMINATION, "the threshold agrees about darkness");
  });

  test("an overcast midday is gloom — that is the weather", () => {
    assert.equal(sceneFor(sky({ code: 3 }), { now: noon }), "dark-cloud-noon", "11–14 local: the dark cloud at noon");
    const evening = new Date(Date.UTC(2026, 8, 14, 12, 30)); // 18:00 in Kathmandu
    assert.equal(sceneFor(sky({ code: 3 }), { now: evening }), "cloudy");
    assert.equal(sceneFor(sky({ code: 2 }), { now: noon }), "cloudy");
  });

  test("a fair day is a breeze, until the wind makes it a storm", () => {
    assert.equal(sceneFor(sky({ code: 0 }), { now: noon }), "breeze");
    assert.equal(sceneFor(sky({ code: 1, windSpeed: 20 }), { now: noon }), "breeze", "20 km/h is still a pleasant day");
    assert.equal(sceneFor(sky({ code: 0, windSpeed: 45 }), { now: noon }), "windstorm");
    assert.equal(sceneFor(sky({ code: 0, windSpeed: 12, windGust: 70 }), { now: noon }), "windstorm", "the gust decides");
    assert.equal(sceneFor(sky({ code: 0, windSpeed: 30, windUnit: "mph" }), { now: noon }), "windstorm", "48 km/h in old money");
    assert.equal(sceneFor(sky({ code: 0, windSpeed: 20, windUnit: "mph" }), { now: noon }), "breeze");
  });

  test("no weather means no scene — a made-up sky is worse than none", () => {
    assert.equal(sceneFor(null, { now: noon }), null);
    assert.equal(sceneFor({ ok: false }, { now: noon }), null);
    assert.equal(sceneFor({ ok: true, code: "not-a-code" }, { now: noon }), "breeze", "an unreadable code is treated as fair");
  });

  test("scenes are drawn with deterministic, in-bounds particles", () => {
    for (const scene of SCENES) {
      const first = sceneParticles(scene);
      const second = sceneParticles(scene);
      assert.ok(first.length > 0, `${scene} has particles`);
      assert.deepEqual(first, second, `${scene} does not rearrange itself between renders`);
      for (const particle of first) {
        const x = Number.parseFloat(particle.style["--x"]);
        assert.ok(x >= 0 && x <= 100, `${scene}: --x stays inside the stage`);
      }
    }
    // The scenes the handoff names are all really there.
    assert.deepEqual(SCENES, [
      "thunderstorm", "windstorm", "rain", "rainbow", "snowfall", "fog",
      "dark-cloud-noon", "cloudy", "breeze", "starry-night", "moonless-night",
    ]);
    const storm = sceneParticles("thunderstorm");
    assert.ok(storm.some((particle) => particle.className.includes("p-lightning")), "a storm has lightning");
    assert.ok(sceneParticles("starry-night").some((particle) => particle.className === "p-moon"), "a starry night has the moon");
    assert.deepEqual(sceneParticles("not-a-scene"), []);
  });
});
