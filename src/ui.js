/**
 * The handful of DOM helpers every page shares — and the toast, which is the
 * app's only way of saying "that worked".
 */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export const pad = (value) => String(value).padStart(2, "0");

export const escapeHTML = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const flatten = (text) => String(text || "").replace(/\s+/g, " ").trim();

const numberFormat = new Map();
/** Thousands separators with a fixed number of decimals, locale aware. */
export function formatNumber(value, decimals) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  const places = Number.isInteger(decimals) ? decimals : Number.isInteger(numeric) ? 0 : 2;
  const key = places;
  if (!numberFormat.has(key)) {
    numberFormat.set(key, new Intl.NumberFormat(typeof navigator !== "undefined" ? navigator.language : "en-US", {
      maximumFractionDigits: places,
    }));
  }
  return numberFormat.get(key).format(numeric);
}

/**
 * The toast. `notify(message)` shows it for a few seconds; a second call
 * replaces the first instead of queueing, because nobody reads a stack.
 */
export function createToaster({ toast, message, icon } = {}) {
  let timer = 0;
  function notify(text, symbol = "✓", duration = 3600) {
    if (!toast || !message) return;
    message.textContent = text;
    if (icon) icon.textContent = symbol;
    toast.classList.add("show");
    toast.dataset.kind = symbol === "!" ? "warn" : "ok";
    if (typeof window !== "undefined") {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => toast.classList.remove("show"), duration);
    }
  }
  return notify;
}

/** A short chime, used by the timer and the old clock's hourly bell. */
export function beep({ frequency = 880, duration = 0.35, gain = 0.03 } = {}) {
  try {
    const AudioContextClass = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();
    oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(gain, audio.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(volume).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration + 0.02);
  } catch (_) {
    // A toast still tells the user the countdown finished if audio is blocked.
  }
}
