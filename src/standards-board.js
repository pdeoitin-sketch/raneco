/**
 * The "Time standards" section: clocks that are named rather than placed.
 *
 * The world board answers "what time is it in Tokyo?"; this answers "what is
 * JST?" — and those are different questions. A meeting invite, a server log,
 * a flight booking and a colleague's message all speak in abbreviations, and
 * looking each one up is exactly the errand a time dashboard should save you.
 *
 * Each tile is laid out like a world card on purpose, so the page reads the
 * same way twice: the hour large and bold, the short form beside it, the full
 * name and the distance from your own clock set small underneath.
 *
 * The data (src/time-standards.js) is fixed offsets, not zones: a standard
 * *is* its offset, which is why EST and EDT are two entries rather than one
 * clock that moves. The section says so out loud rather than pretending.
 */

import {
  DEFAULT_STANDARDS,
  STANDARD_REGIONS,
  findStandard,
  offsetDifferenceSentence,
  searchStandards,
  standardClock,
  standardOffsetLabel,
  standardsInRegion,
} from "./time-standards.js";
import { escapeHTML } from "./ui.js";

const STORE_KEY = "tempo-standards";
const defaults = { region: "all", hour12: false, query: "" };

function readStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
    if (parsed && typeof parsed === "object") return { ...defaults, ...parsed, query: "" };
  } catch (_) {
    /* first visit, or storage blocked */
  }
  return { ...defaults };
}

export function createStandardsBoard({ elements = {}, getHomeOffsetMinutes, getHomeCity, notify } = {}) {
  const prefs = readStored();
  const grid = elements.grid;
  let visible = [];

  function homeOffset() {
    const value = typeof getHomeOffsetMinutes === "function" ? Number(getHomeOffsetMinutes()) : 0;
    return Number.isFinite(value) ? value : 0;
  }

  function homeCity() {
    return typeof getHomeCity === "function" ? String(getHomeCity() || "") : "";
  }

  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ region: prefs.region, hour12: prefs.hour12 }));
    } catch (_) {
      /* preferences are a nicety */
    }
  }

  /**
   * Which standards to show: the region filter first, the search box over it,
   * and — when nothing is chosen at all — a curated ten rather than all fifty,
   * because a wall of clocks is not an answer.
   */
  function selection() {
    const query = String(prefs.query || "").trim();
    if (query) return searchStandards(query);
    if (prefs.region === "all") return DEFAULT_STANDARDS.map(findStandard).filter(Boolean);
    return standardsInRegion(prefs.region);
  }

  function tileMarkup(standard, index, now) {
    const clock = standardClock(standard, now);
    const time = prefs.hour12 ? clock.time12 : clock.time24;
    const period = prefs.hour12 ? clock.period : "";
    const sentence = offsetDifferenceSentence(standard.offsetMinutes, homeOffset(), homeCity());
    const dayNote =
      clock.dayShift > 0 ? "NEXT DAY IN UTC TERMS" : clock.dayShift < 0 ? "STILL YESTERDAY IN UTC TERMS" : "";
    return `
      <article class="standard-card color-${index % 6}" data-standard="${escapeHTML(standard.id)}">
        <div class="standard-card-top">
          <span class="standard-region">${escapeHTML(
            (STANDARD_REGIONS.find((region) => region.id === standard.region) || {}).label || standard.region
          )}</span>
          <span class="standard-utc">${escapeHTML(standardOffsetLabel(standard.offsetMinutes))}</span>
        </div>
        <div class="standard-headline">
          <span class="standard-time">${escapeHTML(time)}${
            period ? `<span class="standard-period">${escapeHTML(period)}</span>` : ""
          }</span>
          <span class="standard-abbr" title="${escapeHTML(standard.name)}">${escapeHTML(standard.abbr)}</span>
        </div>
        <p class="standard-name">${escapeHTML(standard.name)}</p>
        <p class="standard-note">${escapeHTML(standard.note)}</p>
        <p class="standard-shift">${escapeHTML(sentence)}${
          dayNote ? ` · <span class="standard-day">${escapeHTML(dayNote)}</span>` : ""
        }</p>
      </article>
    `;
  }

  function render() {
    if (!grid) return;
    const now = new Date();
    visible = selection();
    grid.innerHTML = visible.map((standard, index) => tileMarkup(standard, index, now)).join("");
    if (elements.empty) elements.empty.hidden = visible.length > 0;
    if (elements.count) {
      elements.count.textContent = visible.length
        ? `${visible.length} standard${visible.length === 1 ? "" : "s"} shown`
        : "Nothing matches that";
    }
    syncControls();
  }

  /** Per-second refresh: only the digits move. */
  function update(now = new Date()) {
    if (!grid) return;
    for (const card of grid.querySelectorAll("[data-standard]")) {
      const standard = findStandard(card.dataset.standard);
      if (!standard) continue;
      const clock = standardClock(standard, now);
      const node = card.querySelector(".standard-time");
      if (!node) continue;
      const period = prefs.hour12 ? `<span class="standard-period">${clock.period}</span>` : "";
      const next = `${prefs.hour12 ? clock.time12 : clock.time24}${period}`;
      if (node.innerHTML !== next) node.innerHTML = next;
    }
  }

  /** The home place moved, so every "ahead of / behind" line is now stale. */
  function refreshShifts() {
    if (!grid) return;
    for (const card of grid.querySelectorAll("[data-standard]")) {
      const standard = findStandard(card.dataset.standard);
      const node = card.querySelector(".standard-shift");
      if (!standard || !node) continue;
      const clock = standardClock(standard, new Date());
      const dayNote =
        clock.dayShift > 0 ? "NEXT DAY IN UTC TERMS" : clock.dayShift < 0 ? "STILL YESTERDAY IN UTC TERMS" : "";
      node.innerHTML = `${escapeHTML(offsetDifferenceSentence(standard.offsetMinutes, homeOffset(), homeCity()))}${
        dayNote ? ` · <span class="standard-day">${dayNote}</span>` : ""
      }`;
    }
  }

  function syncControls() {
    if (elements.regions) {
      for (const button of elements.regions.querySelectorAll("[data-region]")) {
        const active = button.dataset.region === prefs.region;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      }
    }
    if (elements.clockFormat) {
      for (const button of elements.clockFormat.querySelectorAll("[data-standard-format]")) {
        const active = (button.dataset.standardFormat === "12") === Boolean(prefs.hour12);
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      }
    }
  }

  function setRegion(region) {
    prefs.region = region;
    prefs.query = "";
    if (elements.search) elements.search.value = "";
    persist();
    render();
  }

  function setHour12(on) {
    prefs.hour12 = Boolean(on);
    persist();
    render();
    if (notify) notify(prefs.hour12 ? "Standards now read as 12-hour time." : "Standards now read as 24-hour time.");
  }

  function bindEvents() {
    if (elements.regions) {
      elements.regions.addEventListener("click", (event) => {
        const button = event.target.closest("[data-region]");
        if (button) setRegion(button.dataset.region);
      });
    }
    if (elements.clockFormat) {
      elements.clockFormat.addEventListener("click", (event) => {
        const button = event.target.closest("[data-standard-format]");
        if (button) setHour12(button.dataset.standardFormat === "12");
      });
    }
    if (elements.search) {
      elements.search.addEventListener("input", () => {
        prefs.query = elements.search.value;
        render();
      });
    }
  }

  return {
    init() {
      bindEvents();
      render();
    },
    get region() {
      return prefs.region;
    },
    get hour12() {
      return prefs.hour12;
    },
    get visible() {
      return visible.map((standard) => standard.id);
    },
    setRegion,
    setHour12,
    render,
    update,
    refreshShifts,
  };
}
