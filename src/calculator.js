/**
 * The time calculator: the gap between two moments, and a unit converter.
 *
 * Dates are entered on the *wall clock of the home place* and converted to
 * real instants with `zonedDateTimeToUTC`, so "9am to 5pm" is right even when
 * a DST boundary sits in the middle of it.
 */

import {
  formatDateTimeLocal,
  formatDurationWords,
  formatShortDateTime,
  partsFor,
  secondsIntoDay,
  zonedDateTimeToUTC,
} from "./time-math.js";
import { escapeHTML, formatNumber, pad } from "./ui.js";

const SAVED_KEY = "tempo-saved-calculations";
const MAX_SAVED = 8;

const secondsPerUnit = { weeks: 604800, days: 86400, hours: 3600, minutes: 60, seconds: 1 };

function conversionTargets(unit) {
  const choices = {
    weeks: ["days", "hours", "minutes"],
    days: ["hours", "minutes", "seconds"],
    hours: ["days", "minutes", "seconds"],
    minutes: ["days", "hours", "seconds"],
    seconds: ["days", "hours", "minutes"],
  };
  return choices[unit] || ["hours", "minutes", "seconds"];
}

const singular = (value, unit) => (Math.abs(value) === 1 ? unit.slice(0, -1) : unit);

function readSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export function createCalculator({ elements = {}, getZone, notify } = {}) {
  let saved = readSaved();
  let lastCalculation = null;

  function zone() {
    return typeof getZone === "function" ? getZone() : "UTC";
  }

  function persist() {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    } catch (_) {
      /* saving is a convenience, not a requirement */
    }
  }

  function renderSaved() {
    if (!elements.savedList) return;
    if (!saved.length) {
      elements.savedList.innerHTML = '<p class="empty-saved">Your useful answers can live here for later.</p>';
      if (elements.clearSaved) elements.clearSaved.hidden = true;
      return;
    }
    if (elements.clearSaved) elements.clearSaved.hidden = false;
    elements.savedList.innerHTML = saved
      .map(
        (item) => `
          <article class="saved-item">
            <strong>${escapeHTML(item.words)}</strong>
            <span>${escapeHTML(item.details)}</span>
            <button type="button" data-delete-saved="${escapeHTML(item.id)}" aria-label="Remove saved calculation">×</button>
          </article>`
      )
      .join("");
  }

  function calculate() {
    if (!elements.startDatetime || !elements.endDatetime) return;
    const start = zonedDateTimeToUTC(elements.startDatetime.value, zone());
    const end = zonedDateTimeToUTC(elements.endDatetime.value, zone());

    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      if (elements.durationWords) elements.durationWords.textContent = "Choose two valid moments";
      if (elements.durationContext) elements.durationContext.textContent = "Both date and time fields are needed.";
      for (const node of [elements.totalDays, elements.totalHours, elements.totalMinutes, elements.totalSeconds]) {
        if (node) node.textContent = "—";
      }
      if (elements.saveCalculation) elements.saveCalculation.disabled = true;
      lastCalculation = null;
      return;
    }

    const difference = end.getTime() - start.getTime();
    const absolute = Math.abs(difference);
    const totalWholeSeconds = Math.floor(absolute / 1000);
    const totalWholeMinutes = Math.floor(absolute / 60000);
    const totalHoursExact = absolute / 3600000;
    const totalDaysExact = absolute / 86400000;
    const direction = difference < 0 ? "back" : difference > 0 ? "ahead" : "apart";
    const words = formatDurationWords(totalWholeSeconds);
    const startLabel = formatShortDateTime(start, zone());
    const endLabel = formatShortDateTime(end, zone());

    if (elements.durationWords) {
      elements.durationWords.textContent =
        difference < 0 ? `${words} back in time` : difference === 0 ? "The same exact moment" : words;
    }
    if (elements.durationContext) {
      elements.durationContext.textContent =
        difference === 0
          ? "Both fields point to the same moment."
          : `${formatNumber(totalHoursExact, 2)} total hours from ${startLabel} to ${endLabel}.`;
    }
    if (elements.totalDays) elements.totalDays.textContent = formatNumber(totalDaysExact, 2);
    if (elements.totalHours) elements.totalHours.textContent = formatNumber(totalHoursExact, 2);
    if (elements.totalMinutes) elements.totalMinutes.textContent = formatNumber(totalWholeMinutes);
    if (elements.totalSeconds) elements.totalSeconds.textContent = formatNumber(totalWholeSeconds);
    if (elements.saveCalculation) elements.saveCalculation.disabled = false;

    lastCalculation = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      words: difference === 0 ? "Same moment" : `${words} ${direction}`,
      details: `${formatNumber(totalHoursExact, 2)} hours · ${startLabel} → ${endLabel}`,
      zone: zone(),
    };
  }

  function save() {
    if (!lastCalculation) return;
    saved.unshift(lastCalculation);
    saved = saved.slice(0, MAX_SAVED);
    persist();
    renderSaved();
    if (notify) notify("Calculation saved for later.", "✦");
  }

  function updateConverter() {
    if (!elements.convertValue || !elements.convertUnit) return;
    const raw = Number.parseFloat(elements.convertValue.value);
    const value = Number.isFinite(raw) && raw >= 0 ? raw : 0;
    const unit = elements.convertUnit.value;
    const seconds = value * (secondsPerUnit[unit] || 1);
    const targets = conversionTargets(unit);

    if (elements.conversionResults) {
      elements.conversionResults.innerHTML = targets
        .map((target) => {
          const converted = seconds / secondsPerUnit[target];
          const decimals = Number.isInteger(converted) ? 0 : 3;
          return `<div class="conversion-result"><strong>${formatNumber(converted, decimals)}</strong><span>${escapeHTML(
            target.toUpperCase()
          )}</span></div>`;
        })
        .join("");
    }

    if (elements.conversionHint) {
      const readable = targets.map((target) => {
        const converted = seconds / secondsPerUnit[target];
        return `${formatNumber(converted, Number.isInteger(converted) ? 0 : 3)} ${singular(converted, target)}`;
      });
      elements.conversionHint.textContent = `${formatNumber(value, Number.isInteger(value) ? 0 : 3)} ${singular(
        value,
        unit
      )} is ${readable.join(", ").replace(/, ([^,]*)$/, ", and $1")}.`;
    }
  }

  /** Sensible defaults: now, and two weeks out at 2am. */
  function setDefaultInputs() {
    if (!elements.startDatetime || !elements.endDatetime) return;
    const now = new Date();
    const parts = partsFor(now, zone());
    const future = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 15));
    elements.startDatetime.value = formatDateTimeLocal(now, zone());
    elements.endDatetime.value = `${future.getUTCFullYear()}-${pad(future.getUTCMonth() + 1)}-${pad(
      future.getUTCDate()
    )}T02:00`;
  }

  function bind() {
    if (elements.durationForm) {
      elements.durationForm.addEventListener("submit", (event) => {
        event.preventDefault();
        calculate();
        if (notify) notify("Here’s your time answer.");
      });
    }
    if (elements.startDatetime) elements.startDatetime.addEventListener("change", calculate);
    if (elements.endDatetime) elements.endDatetime.addEventListener("change", calculate);
    if (elements.saveCalculation) elements.saveCalculation.addEventListener("click", save);
    if (elements.savedList) {
      elements.savedList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-delete-saved]");
        if (!button) return;
        saved = saved.filter((item) => item.id !== button.dataset.deleteSaved);
        persist();
        renderSaved();
      });
    }
    if (elements.clearSaved) {
      elements.clearSaved.addEventListener("click", () => {
        saved = [];
        persist();
        renderSaved();
        if (notify) notify("Saved calculations cleared.");
      });
    }
    if (elements.convertValue) elements.convertValue.addEventListener("input", updateConverter);
    if (elements.convertUnit) elements.convertUnit.addEventListener("change", updateConverter);
  }

  return {
    init() {
      bind();
      setDefaultInputs();
      calculate();
      updateConverter();
      renderSaved();
    },
    /** Home place changed: re-interpret the entered dates in the new zone. */
    refreshZone() {
      calculate();
    },
    setDefaultInputs,
    get saved() {
      return [...saved];
    },
  };
}

/** Whole seconds since local midnight — used for the day-progress bar. */
export { secondsIntoDay };
