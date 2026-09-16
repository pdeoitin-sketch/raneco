/**
 * A small home-zone calendar.
 *
 * A clock app should not make the reader leave the page just to answer
 * "what day is that?". This calendar is deliberately date-only: it follows
 * the dashboard's home place, highlights that place's today, and stores the
 * month/day you were looking at in localStorage. All calculations are done as
 * plain UTC dates so the browser's own time zone cannot move a calendar cell.
 */

import { escapeHTML } from "./ui.js";
import { getFormatter, partsFor } from "./time-math.js";

export const CALENDAR_STORAGE_KEY = "tempo-calendar";
export const WEEK_STARTS_ON = "monday";
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY = 86_400_000;

const monthTitleFormatter = getFormatter("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
const fullDateFormatter = getFormatter("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
const shortDateFormatter = getFormatter("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

export function pad2(value) {
  return String(value).padStart(2, "0");
}

export function plainDate({ year, month, day }) {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

export function parsePlainDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function parseYearMonth(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function dayOfYear(date) {
  return Math.floor((Date.UTC(date.year, date.month - 1, date.day) - Date.UTC(date.year, 0, 1)) / DAY) + 1;
}

export function isoWeek(date) {
  const target = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const weekday = (target.getUTCDay() + 6) % 7; // Monday = 0, Sunday = 6
  target.setUTCDate(target.getUTCDate() - weekday + 3); // Thursday decides the ISO week-year

  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);

  return {
    year: target.getUTCFullYear(),
    week: 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * DAY)),
  };
}

export function addMonths(view, amount) {
  const base = new Date(Date.UTC(view.year, view.month - 1 + amount, 1));
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1 };
}

export function monthKey(view) {
  return `${String(view.year).padStart(4, "0")}-${pad2(view.month)}`;
}

export function buildMonth({ year, month, today, selected } = {}) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstMondayIndex = (first.getUTCDay() + 6) % 7;
  const start = Date.UTC(year, month - 1, 1 - firstMondayIndex);
  const todayIso = today ? plainDate(today) : "";
  const selectedIso = selected || todayIso;

  return Array.from({ length: 42 }, (_, index) => {
    const stamp = new Date(start + index * DAY);
    const cell = {
      year: stamp.getUTCFullYear(),
      month: stamp.getUTCMonth() + 1,
      day: stamp.getUTCDate(),
    };
    const iso = plainDate(cell);
    const nativeDay = stamp.getUTCDay();
    return {
      ...cell,
      iso,
      weekday: WEEKDAYS[(nativeDay + 6) % 7],
      inMonth: cell.month === month,
      isToday: iso === todayIso,
      isSelected: iso === selectedIso,
      isWeekend: nativeDay === 0 || nativeDay === 6,
    };
  });
}

export function describeDate(date, today) {
  const iso = plainDate(date);
  const todayIso = plainDate(today || date);
  const then = Date.UTC(date.year, date.month - 1, date.day);
  const now = Date.UTC((today || date).year, (today || date).month - 1, (today || date).day);
  const diff = Math.round((then - now) / DAY);
  const week = isoWeek(date);
  const ordinal = dayOfYear(date);
  const total = isLeapYear(date.year) ? 366 : 365;
  const relative =
    diff === 0 ? "today" : diff === 1 ? "tomorrow" : diff === -1 ? "yesterday" : diff > 1 ? `in ${diff} days` : `${Math.abs(diff)} days ago`;

  return {
    iso,
    title: fullDateFormatter.format(new Date(Date.UTC(date.year, date.month - 1, date.day))),
    short: shortDateFormatter.format(new Date(Date.UTC(date.year, date.month - 1, date.day))),
    relative,
    dayOfYear: ordinal,
    daysLeft: total - ordinal,
    isoWeek: week,
    today: iso === todayIso,
  };
}

export function readCalendarState(storage) {
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!store) return {};
    const parsed = JSON.parse(store.getItem(CALENDAR_STORAGE_KEY) || "{}");
    const view = parseYearMonth(parsed.view);
    const selected = parsePlainDate(parsed.selected);
    return {
      view: view || null,
      selected: selected ? plainDate(selected) : "",
    };
  } catch (_) {
    return {};
  }
}

function writeCalendarState(state) {
  try {
    localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify({ view: monthKey(state.view), selected: state.selected }));
  } catch (_) {
    // The calendar still works for this visit when storage is blocked.
  }
}

function monthTitle(view) {
  return monthTitleFormatter.format(new Date(Date.UTC(view.year, view.month - 1, 1)));
}

function todayInZone(zone, at = new Date()) {
  const parts = partsFor(at, zone || "UTC");
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function createCalendar({ elements = {}, getZone = () => "UTC", getPlace = () => ({ city: "your home place" }), notify } = {}) {
  const state = readCalendarState();
  let bound = false;
  let lastToday = "";

  function ensureState(now = new Date()) {
    const today = todayInZone(getZone(), now);
    if (!state.view) state.view = { year: today.year, month: today.month };
    if (!state.selected) state.selected = plainDate(today);
    return today;
  }

  function render(now = new Date()) {
    const today = ensureState(now);
    const todayIso = plainDate(today);
    lastToday = todayIso;

    const selected = parsePlainDate(state.selected) || today;
    const selectedIso = plainDate(selected);
    const cells = buildMonth({ ...state.view, today, selected: selectedIso });
    const place = getPlace() || {};
    const city = place.city || place.label || "your home place";

    if (elements.month) elements.month.textContent = monthTitle(state.view);
    if (elements.summary) {
      const todayDetail = describeDate(today, today);
      elements.summary.textContent = `Today in ${city}: ${todayDetail.title}. Calendar weeks start on Monday.`;
    }
    if (elements.todayPill) elements.todayPill.textContent = `TODAY · ${todayIso}`;
    if (elements.grid) {
      const weekdays = WEEKDAYS.map((day) => `<span class="calendar-weekday" role="columnheader">${day}</span>`).join("");
      const days = cells
        .map((cell) => {
          const classes = ["calendar-day"];
          if (!cell.inMonth) classes.push("is-outside");
          if (cell.isToday) classes.push("is-today");
          if (cell.isSelected) classes.push("is-selected");
          if (cell.isWeekend) classes.push("is-weekend");
          const label = describeDate(cell, today).title;
          return `<button type="button" class="${classes.join(" ")}" role="gridcell" data-date="${escapeHTML(cell.iso)}" aria-pressed="${cell.isSelected}" aria-label="${escapeHTML(label)}${cell.isToday ? ", today" : ""}">
            <span class="calendar-number">${cell.day}</span>
            ${cell.isToday ? '<small class="calendar-day-tag">Today</small>' : ""}
          </button>`;
        })
        .join("");
      elements.grid.innerHTML = weekdays + days;
    }

    renderSelected(selected, today);
  }

  function renderSelected(selected, today) {
    const detail = describeDate(selected, today);
    if (elements.selectedTitle) elements.selectedTitle.textContent = detail.title;
    if (elements.selectedMeta) {
      elements.selectedMeta.textContent = detail.today ? "This is today in your home place." : `This date is ${detail.relative}.`;
    }
    if (elements.selectedIso) elements.selectedIso.textContent = detail.iso;
    if (elements.selectedWeek) elements.selectedWeek.textContent = `Week ${pad2(detail.isoWeek.week)}, ${detail.isoWeek.year}`;
    if (elements.selectedYearDay) elements.selectedYearDay.textContent = `Day ${detail.dayOfYear}`;
    if (elements.selectedRemaining) elements.selectedRemaining.textContent = `${detail.daysLeft} days left`;
  }

  function selectDate(iso, { silent = false } = {}) {
    const date = parsePlainDate(iso);
    if (!date) return false;
    state.selected = plainDate(date);
    state.view = { year: date.year, month: date.month };
    writeCalendarState(state);
    render();
    if (!silent && typeof notify === "function") notify(`${describeDate(date, ensureState()).short} selected in Calendar.`);
    return true;
  }

  function changeMonth(amount) {
    ensureState();
    const selected = parsePlainDate(state.selected) || { day: 1 };
    state.view = addMonths(state.view, amount);
    state.selected = plainDate({
      year: state.view.year,
      month: state.view.month,
      day: Math.min(selected.day, daysInMonth(state.view.year, state.view.month)),
    });
    writeCalendarState(state);
    render();
  }

  function jumpToToday() {
    const today = ensureState();
    state.view = { year: today.year, month: today.month };
    state.selected = plainDate(today);
    writeCalendarState(state);
    render();
    if (typeof notify === "function") notify("Calendar returned to today.");
  }

  function bindEvents() {
    if (bound) return;
    bound = true;
    if (elements.prev) elements.prev.addEventListener("click", () => changeMonth(-1));
    if (elements.next) elements.next.addEventListener("click", () => changeMonth(1));
    if (elements.today) elements.today.addEventListener("click", jumpToToday);
    if (elements.grid) {
      elements.grid.addEventListener("click", (event) => {
        const day = event.target.closest("[data-date]");
        if (!day) return;
        selectDate(day.dataset.date);
      });
    }
  }

  return {
    get view() {
      ensureState();
      return { ...state.view };
    },
    get selected() {
      ensureState();
      return state.selected;
    },
    init() {
      render();
      bindEvents();
    },
    render,
    sync(now = new Date()) {
      const today = todayInZone(getZone(), now);
      const iso = plainDate(today);
      if (iso !== lastToday) render(now);
    },
    refreshZone(now = new Date()) {
      ensureState(now);
      render(now);
    },
    selectDate,
    jumpToToday,
  };
}
