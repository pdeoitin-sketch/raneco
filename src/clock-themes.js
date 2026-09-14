/**
 * Eight clock faces for the Old clock.
 *
 * Tempo used to offer three *numeral styles* — Roman, Arabic, none — which
 * answered "which glyphs?" but not "which clock?". A railway clock and a
 * pocket watch can share the same numerals and still be entirely different
 * objects, so the styles grew up into full **faces**:
 *
 *   Roman · Modern · Minimal · Railway · Pocket watch · Neon · Brutalist ·
 *   Botanical
 *
 * Each face is a thin record: an id, a label, the numeral mode the shared
 * face renderer should draw (see src/clock-face.js), and a line of copy for
 * the picker. Everything visual that distinguishes the faces lives in the
 * stylesheet, keyed on `[data-clock-theme]` — the DOM stays one clock, and a
 * face is a coat of paint rather than a second mechanism.
 *
 * The first three faces keep the old numeral settings alive: a saved
 * `numerals: "roman"` preference from an earlier Tempo maps to the Roman face,
 * `"arabic"` to Modern and `"none"` to Minimal, so nobody's saved clock
 * changes on them (see `themeFromLegacyNumerals`).
 */

export const CLOCK_THEMES = [
  {
    id: "roman",
    label: "Roman",
    numerals: "roman",
    note: "XII at the top, the way clocks said it for three centuries.",
  },
  {
    id: "modern",
    label: "Modern",
    numerals: "arabic",
    note: "Plain digits, clean ticks — the clock a kitchen deserves.",
  },
  {
    id: "minimal",
    label: "Minimal",
    numerals: "none",
    note: "No numerals at all. You can read a clock face without them.",
  },
  {
    id: "railway",
    label: "Railway",
    numerals: "arabic",
    note: "Station-clock digits on a dark dial, second hand on time.",
  },
  {
    id: "pocket",
    label: "Pocket watch",
    numerals: "roman",
    note: "A cream dial, a brass rim, a crown at twelve.",
  },
  {
    id: "neon",
    label: "Neon",
    numerals: "arabic",
    note: "Digits that glow, for the hour that does not.",
  },
  {
    id: "brutalist",
    label: "Brutalist",
    numerals: "arabic",
    note: "Heavy slabs of type. The time, with intent.",
  },
  {
    id: "botanical",
    label: "Botanical",
    numerals: "roman",
    note: "Roman numerals on sage, with leaves for quarter marks.",
  },
];

export const CLOCK_THEME_IDS = CLOCK_THEMES.map((theme) => theme.id);

export const DEFAULT_CLOCK_THEME = "roman";

/**
 * Look a face up by id. Unknown ids fall back to the default face — never
 * `null` — because a saved preference must never blank the clock.
 */
export function findClockTheme(id) {
  return CLOCK_THEMES.find((theme) => theme.id === id) || CLOCK_THEMES.find((theme) => theme.id === DEFAULT_CLOCK_THEME);
}

/**
 * Upgrade a numeral setting saved by the previous Tempo into a face.
 *
 * @returns {string|null} a theme id, or null when the value is not a legacy
 *          numeral setting (the caller then keeps whatever it already had).
 */
export function themeFromLegacyNumerals(value) {
  const map = { roman: "roman", arabic: "modern", none: "minimal" };
  return map[String(value)] || null;
}
