/**
 * Settings that are not clock data.
 *
 * The first settings Tempo exposes are intentionally simple and local:
 * typography size and the saved theme mode. Theme logic lives in `theme.js`;
 * this file owns the text-size preference so app.js can apply it before the
 * rest of the dashboard starts rendering.
 */

export const TEXT_SIZE_STORAGE_KEY = "tempo-text-size";
export const LEGACY_TEXT_SCALE_KEY = "tempo-text-scale";

export const TEXT_SIZE_OPTIONS = [
  {
    id: "compact",
    label: "Compact",
    token: "A−",
    scale: 0.94,
    summary: "A little smaller, for dense dashboards and laptop screens.",
  },
  {
    id: "default",
    label: "Default",
    token: "A",
    scale: 1,
    summary: "Tempo's standard reading size.",
  },
  {
    id: "large",
    label: "Large",
    token: "A+",
    scale: 1.12,
    summary: "Larger body copy without turning the layout into a zoomed page.",
  },
  {
    id: "extra",
    label: "Extra large",
    token: "A++",
    scale: 1.24,
    summary: "The most comfortable setting for long reading or tired eyes.",
  },
];

const BY_ID = new Map(TEXT_SIZE_OPTIONS.map((option) => [option.id, option]));

export function textSizeOption(size) {
  return BY_ID.get(size) || BY_ID.get("default");
}

export function normaliseTextSize(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (BY_ID.has(raw)) return raw;

  // A short migration path for older experiments that stored a raw multiplier
  // or names from an A/A+/A++ toggle. We do not write the legacy key back.
  if (raw === "small" || raw === "a-" || raw === "0.94" || raw === "0.95") return "compact";
  if (raw === "medium" || raw === "normal" || raw === "a" || raw === "1" || raw === "1.0") return "default";
  if (raw === "big" || raw === "a+" || raw === "1.08" || raw === "1.1" || raw === "1.12") return "large";
  if (raw === "largest" || raw === "x-large" || raw === "xl" || raw === "a++" || raw === "1.2" || raw === "1.24") return "extra";
  return "default";
}

export function readTextSize(storage) {
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!store) return "default";
    const saved = store.getItem(TEXT_SIZE_STORAGE_KEY);
    if (saved) return normaliseTextSize(saved);
    const legacy = store.getItem(LEGACY_TEXT_SCALE_KEY);
    return legacy ? normaliseTextSize(legacy) : "default";
  } catch (_) {
    return "default";
  }
}

export function writeTextSize(size, storage) {
  const id = normaliseTextSize(size);
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (store) store.setItem(TEXT_SIZE_STORAGE_KEY, id);
  } catch (_) {
    // The preference lives for this visit only when storage is blocked.
  }
  return id;
}

export function applyTextSize(target, size) {
  const option = textSizeOption(normaliseTextSize(size));
  const root = target.documentElement || target;
  if (!root || !root.style) return option;
  root.dataset.textSize = option.id;
  root.style.setProperty("--tempo-text-scale", String(option.scale));
  return option;
}
