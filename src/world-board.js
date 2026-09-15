/**
 * The world clock board.
 *
 * Cards are keyed by *place id* (`city:delhi-in`, `zone:Europe/London`,
 * `geo:28.61,77.21`), not by time zone, because two cities can share a zone
 * and still be different clocks. Every card carries its own coordinates, so
 * the little "sun time" line underneath is about that city — in India it is
 * the line that explains why the east eats breakfast an hour before the west
 * even though both watches say the same thing.
 *
 * **The card reads top to bottom in one glance.** The hour is the loudest
 * thing on it — large, bold, tabular — with the city's own temperature set
 * beside it on the right (°C or °F, chosen by that city's country, not by a
 * page-wide switch). Everything the reader only sometimes needs — how far
 * this clock is from home, its UTC offset, whether it is already tomorrow
 * there, where its sun actually is — is set small along the bottom.
 */

import { placeRecord, sunNote, zoneOffsetLabel, zoneOffsetMinutes } from "./places.js";
import { offsetDifferenceLabel } from "./time-standards.js";
import { $$, escapeHTML, flatten, pad } from "./ui.js";

const timeFormatters = new Map();
function clockParts(date, zone) {
  if (!timeFormatters.has(zone)) {
    timeFormatters.set(
      zone,
      new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", hour12: true })
    );
  }
  const parts = {};
  for (const item of timeFormatters.get(zone).formatToParts(date)) {
    if (item.type !== "literal") parts[item.type] = item.value;
  }
  return parts;
}

const dateFormatters = new Map();
function dateStamp(date, zone) {
  if (!dateFormatters.has(zone)) {
    dateFormatters.set(
      zone,
      new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" })
    );
  }
  const parts = {};
  for (const item of dateFormatters.get(zone).formatToParts(date)) {
    if (item.type !== "literal") parts[item.type] = item.value;
  }
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

export function createWorldBoard({
  elements = {},
  getHomeId,
  getTemperature,
  onChange,
  onPlacesChanged,
  notify,
  max = 12,
} = {}) {
  let places = [];
  let lastHomeId = "";

  const grid = elements.grid;
  const countNode = elements.count;
  const emptyNode = elements.empty;

  function homeId() {
    return typeof getHomeId === "function" ? getHomeId() : "zone:UTC";
  }

  /** The live reading for a card, or null when the sky has not answered yet. */
  function reading(id) {
    if (typeof getTemperature !== "function") return null;
    const value = getTemperature(id);
    return value && Number.isFinite(Number(value.temperature)) ? value : null;
  }

  function dayLabel(now, zone) {
    const difference = Math.round((dateStamp(now, zone) - dateStamp(now, placeRecord(homeId()).zone)) / 86400000);
    if (difference === 0) return { text: "SAME DAY", className: "same-day" };
    if (difference > 0) return { text: difference === 1 ? "TOMORROW" : `+${difference} DAYS`, className: "day-ahead" };
    return { text: difference === -1 ? "YESTERDAY" : `${difference} DAYS`, className: "day-behind" };
  }

  /**
   * The small line that says how far this clock is from the reader's own:
   * "+5h 45m from Kathmandu", or "your home clock" on the home card itself.
   */
  function shiftLabel(id, now) {
    const record = placeRecord(id);
    const home = placeRecord(homeId());
    if (record.id === home.id) return { text: "YOUR HOME CLOCK", className: "shift-home" };
    const delta = zoneOffsetMinutes(record.zone, now) - zoneOffsetMinutes(home.zone, now);
    const label = offsetDifferenceLabel(zoneOffsetMinutes(record.zone, now), zoneOffsetMinutes(home.zone, now));
    if (delta === 0) return { text: `SAME TIME AS ${home.city.toUpperCase()}`, className: "shift-same" };
    return { text: `${label} FROM ${home.city.toUpperCase()}`, className: delta > 0 ? "shift-ahead" : "shift-behind" };
  }

  /** The temperature block on the right of the hour — or a quiet placeholder. */
  function temperatureMarkup(id) {
    const live = reading(id);
    if (!live) {
      return '<div class="world-temp is-waiting" aria-hidden="true"><span class="world-temp-value">—</span></div>';
    }
    const title = `${live.condition} · ${live.temperature}${live.temperatureUnit}`;
    return `<div class="world-temp" title="${escapeHTML(title)}">
      <span class="world-temp-symbol" aria-hidden="true">${escapeHTML(live.symbol)}</span>
      <span class="world-temp-value">${escapeHTML(String(live.temperature))}<small>${escapeHTML(
        live.temperatureUnit
      )}</small></span>
    </div>`;
  }

  function cardMarkup(id, index, now) {
    const record = placeRecord(id);
    const isHome = id === homeId();
    const clock = clockParts(now, record.zone);
    const day = dayLabel(now, record.zone);
    const shift = shiftLabel(id, now);
    const pin = record.kind === "geo" ? '<span class="world-pin" title="From your browser location">⌖</span>' : "";
    const note = record.note ? ` ${record.note}.` : "";
    return `
      <article class="world-card color-${index % 6}${isHome ? " is-home" : ""}" data-place="${escapeHTML(id)}">
        <div class="world-card-top">
          <div class="city-label">
            <span class="city-color-dot" aria-hidden="true"></span>
            <strong class="city-place" title="${escapeHTML(`${record.label} — ${record.zone}${note}`)}">
              <span class="city-country">${escapeHTML(record.country || record.zone.split("/")[0])}</span> · <span class="city-name">${escapeHTML(record.city)}</span>
            </strong>
            ${pin}
          </div>
          <button class="remove-city" type="button" data-remove="${escapeHTML(id)}" aria-label="Remove ${escapeHTML(record.city)}">×</button>
        </div>
        ${isHome ? '<span class="world-home-flag">HOME</span>' : ""}
        <div class="world-headline">
          <div class="world-time"><span class="world-clock-value">${escapeHTML(`${clock.hour}:${clock.minute}`)}</span><span class="world-period">${escapeHTML((clock.dayPeriod || "").toUpperCase())}</span></div>
          <div class="world-temp-slot">${temperatureMarkup(id)}</div>
        </div>
        <div class="world-card-bottom"><span class="world-day-label ${day.className}">${day.text}</span><span class="world-offset">${escapeHTML(zoneOffsetLabel(record.zone, now))}</span></div>
        <p class="world-shift ${shift.className}" title="Difference from your home clock">${escapeHTML(shift.text)}</p>
        <p class="world-sun" title="Local solar time for ${escapeHTML(record.city)}">${escapeHTML(sunNote(record, now))}</p>
        ${isHome ? "" : `<button class="text-button world-home-button" type="button" data-make-home="${escapeHTML(id)}">Make this my home place</button>`}
      </article>
    `;
  }

  function render() {
    if (!grid) return;
    const now = new Date();
    lastHomeId = homeId();
    grid.innerHTML = places.map((id, index) => cardMarkup(id, index, now)).join("");
    if (emptyNode) emptyNode.hidden = places.length > 0;
    if (countNode) countNode.textContent = `${places.length} of ${max} clocks`;
  }

  /** Repaint just the temperature slots — called when a fetch lands. */
  function renderTemperatures() {
    if (!grid) return;
    for (const card of $$("[data-place]", grid)) {
      const slot = card.querySelector(".world-temp-slot");
      if (slot) slot.innerHTML = temperatureMarkup(card.dataset.place);
    }
  }

  /** Cheap per-second refresh: no re-render, just the moving parts. */
  function update(now = new Date()) {
    if (!grid) return;
    // The HOME badge and the "make home" button depend on the home place.
    if (lastHomeId !== homeId()) {
      render();
      return;
    }
    for (const card of $$("[data-place]", grid)) {
      const record = placeRecord(card.dataset.place);
      if (!record) continue;
      const clock = clockParts(now, record.zone);
      const value = card.querySelector(".world-clock-value");
      if (value) value.textContent = `${clock.hour}:${clock.minute}`;
      const period = card.querySelector(".world-period");
      if (period) period.textContent = (clock.dayPeriod || "").toUpperCase();
      const day = dayLabel(now, record.zone);
      const label = card.querySelector(".world-day-label");
      if (label) {
        label.textContent = day.text;
        label.className = `world-day-label ${day.className}`;
      }
      const offset = card.querySelector(".world-offset");
      if (offset) offset.textContent = zoneOffsetLabel(record.zone, now);
      const shift = shiftLabel(card.dataset.place, now);
      const shiftNode = card.querySelector(".world-shift");
      if (shiftNode) {
        shiftNode.textContent = shift.text;
        shiftNode.className = `world-shift ${shift.className}`;
      }
      const sun = card.querySelector(".world-sun");
      if (sun) sun.textContent = sunNote(record, now);
    }
  }

  function persist() {
    if (typeof onChange === "function") onChange([...places]);
    if (typeof onPlacesChanged === "function") onPlacesChanged([...places]);
  }

  function add(id, { silent = false } = {}) {
    const record = placeRecord(id);
    if (!record || record.unknown) return false;
    if (places.includes(record.id)) {
      if (!silent && notify) notify(`${record.city} is already on your board.`, "!");
      return false;
    }
    if (places.length >= max) {
      if (!silent && notify) notify(`Keep up to ${max} clocks — remove one first.`, "!");
      return false;
    }
    places.push(record.id);
    render();
    persist();
    if (!silent && notify) notify(`${record.city} added to your clocks.`);
    return true;
  }

  function remove(id) {
    const record = placeRecord(id);
    places = places.filter((item) => item !== id);
    render();
    persist();
    if (notify) notify(`${record.city} removed.`);
  }

  return {
    get places() {
      return [...places];
    },
    get max() {
      return max;
    },
    has(id) {
      const record = placeRecord(id);
      return places.includes(record.id);
    },
    setPlaces(ids) {
      const seen = new Set();
      places = ids
        .map((id) => placeRecord(id))
        .filter((record) => record && !record.unknown && !seen.has(record.id) && seen.add(record.id))
        .slice(0, max)
        .map((record) => record.id);
      render();
      if (typeof onPlacesChanged === "function") onPlacesChanged([...places]);
    },
    add,
    remove,
    render,
    renderTemperatures,
    update,
    refresh: render,
    bindEvents() {
      if (!grid) return;
      grid.addEventListener("click", (event) => {
        const removeButton = event.target.closest("[data-remove]");
        if (removeButton) {
          remove(removeButton.dataset.remove);
          return;
        }
        const homeButton = event.target.closest("[data-make-home]");
        if (homeButton && elements.onMakeHome) elements.onMakeHome(homeButton.dataset.makeHome);
      });
    },
  };
}

/** "09:41 PM" for a zone, used by the board tests. */
export function formatZoneTime(date, zone) {
  const parts = clockParts(date, zone);
  return flatten(`${pad(parts.hour)}:${parts.minute} ${(parts.dayPeriod || "").toUpperCase()}`);
}
