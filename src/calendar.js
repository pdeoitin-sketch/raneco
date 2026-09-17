/**
 * A home-zone calendar that can wear any one of ten real calendar systems
 * at a time — Gregorian, Bikram Sambat, Chinese, Korean Dangi, Hebrew,
 * Islamic, Persian, Indian Śaka, Thai Buddhist, or Japanese.
 *
 * Whichever calendar you pick becomes the real month you are looking at:
 * its own month name, its own month length, its own "Previous / Next
 * month" stepping, and its own festivals, national days and religious
 * observances — not a small translation squeezed under a Gregorian grid.
 * A quiet Gregorian date still rides along under every cell so you always
 * know which everyday date a festival falls on, but Gregorian never owns
 * the page unless you have actually chosen it.
 *
 * Features:
 *   • Full month-wise duration for every calendar: Baisakh 1–31, Ramadan
 *     1–30, Tishri 1–30, Farvardin 1–31 — real month lengths, not a
 *     Gregorian grid wearing a costume.
 *   • Switching calendars is a real, one-tap display change: the month
 *     title, the big day numbers, the "Today" pill, the legend and the
 *     specification card all follow the calendar you chose.
 *   • Holidays, national days, democracy & freedom days, cultural festivals
 *     and religious observances are scoped to the active calendar's own
 *     culture (Nepal for Bikram Sambat, China for the Chinese calendar…),
 *     plus the international days that are shared by every calendar.
 *   • Week starts on Monday, Sunday, or Saturday (Settings).
 *   • Full specifications, month catalogues, regularities, and celebration
 *     dates for all 10 calendar systems.
 *   • Device-local notes pinned to any date.
 */

import { escapeHTML } from "./ui.js";
import { getFormatter, partsFor } from "./time-math.js";
import {
  CALENDAR_SYSTEMS,
  calendarSystem,
  describeInSystem,
  findSystemMonthBounds,
  stepSystemMonth,
} from "./calendar-systems.js";
import { eventCategory, eventsForDate } from "./calendar-events.js";
import { addNote, notesForDate, removeNote } from "./calendar-notes.js";

export const CALENDAR_STORAGE_KEY = "tempo-calendar";
export const WEEK_STARTS_ON = "monday";
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY = 86_400_000;
const SUN_FIRST_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const monthTitleFormatter = getFormatter("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
const fullDateFormatter = getFormatter("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
const shortDateFormatter = getFormatter("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
const spanDateFormatter = getFormatter("en-US", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const monthDayFormatter = getFormatter("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

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

/**
 * Weekday headers for a week start. `weekStart` is a getUTCDay-style index:
 * 1 = Monday (default), 0 = Sunday, 6 = Saturday.
 */
export function weekdayLabels(weekStart = 1) {
  const start = Number.isInteger(weekStart) && weekStart >= 0 && weekStart <= 6 ? weekStart : 1;
  return Array.from({ length: 7 }, (_, index) => SUN_FIRST_WEEKDAYS[(start + index) % 7]);
}

/**
 * Builds 42 grid cells (6 rows × 7 columns) for a month view.
 * Supports both standard Gregorian months and non-Gregorian systems
 * with true 1-month duration.
 */
export function buildMonth({
  year,
  month,
  today,
  selected,
  weekStart = 1,
  systemId = "gregorian",
  day1Greg,
  totalDays,
} = {}) {
  const start = Number.isInteger(weekStart) && weekStart >= 0 && weekStart <= 6 ? weekStart : 1;
  const labels = weekdayLabels(start);
  const todayIso = today ? plainDate(today) : "";
  const selectedIso = selected || todayIso;

  const isNonGregorian = systemId && systemId !== "gregorian" && day1Greg && totalDays;

  let gridStartStamp = 0;
  let inMonthStart = 0;
  let inMonthCount = 0;

  if (isNonGregorian) {
    const firstDay = new Date(Date.UTC(day1Greg.year, day1Greg.month - 1, day1Greg.day));
    const leading = (firstDay.getUTCDay() - start + 7) % 7;
    gridStartStamp = firstDay.getTime() - leading * DAY;
    inMonthStart = leading;
    inMonthCount = totalDays;
  } else {
    const gregYear = year || (day1Greg ? day1Greg.year : 2026);
    const gregMonth = month || (day1Greg ? day1Greg.month : 1);
    const firstDay = new Date(Date.UTC(gregYear, gregMonth - 1, 1));
    const leading = (firstDay.getUTCDay() - start + 7) % 7;
    gridStartStamp = Date.UTC(gregYear, gregMonth - 1, 1 - leading);
    inMonthStart = leading;
    inMonthCount = daysInMonth(gregYear, gregMonth);
  }

  return Array.from({ length: 42 }, (_, index) => {
    const stamp = new Date(gridStartStamp + index * DAY);
    const cell = {
      year: stamp.getUTCFullYear(),
      month: stamp.getUTCMonth() + 1,
      day: stamp.getUTCDate(),
    };
    const iso = plainDate(cell);
    const nativeDay = stamp.getUTCDay();
    const inMonth = isNonGregorian
      ? index >= inMonthStart && index < inMonthStart + inMonthCount
      : cell.month === (month || (day1Greg ? day1Greg.month : cell.month));

    const alt = systemId && systemId !== "gregorian" ? describeInSystem(systemId, cell) : null;
    const primaryDay = isNonGregorian && alt ? alt.day : cell.day;

    return {
      ...cell,
      iso,
      weekday: labels[index % 7],
      inMonth,
      isToday: iso === todayIso,
      isSelected: iso === selectedIso,
      isWeekend: nativeDay === 0 || nativeDay === 6,
      primaryDay,
      gregorianDay: cell.day,
      alt,
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
    const anchor = parsePlainDate(parsed.viewAnchorIso);
    return {
      view: view || null,
      selected: selected ? plainDate(selected) : "",
      viewAnchorIso: anchor ? plainDate(anchor) : (selected ? plainDate(selected) : ""),
      viewSystem: parsed.viewSystem || "",
    };
  } catch (_) {
    return {};
  }
}

function writeCalendarState(state) {
  try {
    localStorage.setItem(
      CALENDAR_STORAGE_KEY,
      JSON.stringify({
        view: state.view ? monthKey(state.view) : "",
        selected: state.selected,
        viewAnchorIso: state.viewAnchorIso || "",
        viewSystem: state.viewSystem || "",
      })
    );
  } catch (_) {
    // The calendar still works for this visit when storage is blocked.
  }
}

function formatDateSpan(d1, d2) {
  const t1 = new Date(Date.UTC(d1.year, d1.month - 1, d1.day));
  const t2 = new Date(Date.UTC(d2.year, d2.month - 1, d2.day));
  return `${spanDateFormatter.format(t1)} – ${spanDateFormatter.format(t2)}`;
}

function todayInZone(zone, at = new Date()) {
  const parts = partsFor(at, zone || "UTC");
  return { year: parts.year, month: parts.month, day: parts.day };
}

const FALLBACK_PREFERENCES = { weekStart: "monday", calendarSystem: "gregorian", holidays: {} };
const WEEK_START_DAYS = { monday: 1, sunday: 0, saturday: 6 };

/**
 * The active calendar's own title for the month currently on screen: its
 * month name plus its own year, in that calendar's own numbering — not the
 * Gregorian month the underlying dates happen to fall across.
 */
function systemMonthTitle(system, bounds) {
  if (system.id === "gregorian") {
    return monthTitleFormatter.format(new Date(Date.UTC(bounds.day1Greg.year, bounds.day1Greg.month - 1, 1)));
  }
  const desc = bounds.desc;
  if (!desc) return monthTitleFormatter.format(new Date(Date.UTC(bounds.day1Greg.year, bounds.day1Greg.month - 1, 1)));
  const monthName = desc.monthName || system.months?.[((desc.month || 1) - 1 + system.months.length) % system.months.length]?.name || "";
  const year = desc.year ?? desc.relatedYear ?? bounds.day1Greg.year;
  const era = system.id === "islamic" ? "AH" : system.id === "hebrew" ? "AM" : system.id === "persian" ? "AP" : system.id === "indian" ? "Śaka" : system.id === "buddhist" ? "BE" : system.id === "japanese" ? (desc.era || "Reiwa") : system.id === "bikram" ? "BS" : "";
  const zodiacNote = system.zodiac && desc.zodiac ? ` · ${desc.zodiac} year` : "";
  return `${monthName} ${year}${era ? ` ${era}` : ""}${zodiacNote}`;
}

export function createCalendar({
  elements = {},
  getZone = () => "UTC",
  getPlace = () => ({ city: "your home place" }),
  getPreferences,
  notify,
} = {}) {
  const state = readCalendarState();
  let bound = false;
  let lastToday = "";
  let inspectedSystemId = null;

  function preferences() {
    try {
      const prefs = typeof getPreferences === "function" ? getPreferences() : null;
      return { ...FALLBACK_PREFERENCES, ...(prefs || {}) };
    } catch (_) {
      return { ...FALLBACK_PREFERENCES };
    }
  }

  function weekStartDay(prefs = preferences()) {
    return WEEK_START_DAYS[prefs.weekStart] ?? 1;
  }

  function ensureState(now = new Date()) {
    const today = todayInZone(getZone(), now);
    if (!state.selected) state.selected = plainDate(today);
    if (!state.viewAnchorIso) state.viewAnchorIso = state.selected;
    if (!state.view) state.view = { year: today.year, month: today.month };
    return today;
  }

  function activeSystem(prefs = preferences()) {
    return calendarSystem(prefs.calendarSystem);
  }

  /**
   * Resolves the month bounds (Gregorian day 1, day count, that calendar's
   * own month/year description) for whatever the anchor date currently is,
   * in the active calendar system. If the preference's calendar changed
   * since the anchor was set, this re-derives the anchor from `selected`
   * (or today) so switching calendars always lands on a sensible month.
   */
  function currentBounds(system, today) {
    const anchorIso = state.viewAnchorIso || state.selected || plainDate(today);
    const anchor = parsePlainDate(anchorIso) || today;
    return findSystemMonthBounds(system.id, anchor);
  }

  function render(now = new Date()) {
    const today = ensureState(now);
    const todayIso = plainDate(today);
    lastToday = todayIso;

    const prefs = preferences();
    const start = weekStartDay(prefs);
    const system = activeSystem(prefs);
    const isGregorian = system.id === "gregorian";

    const selected = parsePlainDate(state.selected) || today;
    const selectedIso = plainDate(selected);

    // Whichever calendar is active becomes the real month on screen: its
    // own day-1, its own day count, and (for non-Gregorian systems) its own
    // month name and year. Previous / Next step that calendar's months.
    const bounds = currentBounds(system, today);
    const monthStart = bounds.day1Greg;
    const monthEnd = bounds.endGreg;
    state.view = { year: monthStart.year, month: monthStart.month };
    state.viewAnchorIso = plainDate(monthStart);
    state.viewSystem = system.id;
    writeCalendarState(state);

    const cells = buildMonth({
      systemId: system.id,
      year: monthStart.year,
      month: monthStart.month,
      today,
      selected: selectedIso,
      weekStart: start,
      day1Greg: monthStart,
      totalDays: bounds.totalDays,
    });

    const place = getPlace() || {};
    const city = place.city || place.label || "your home place";
    const displayTitle = systemMonthTitle(system, bounds);
    const displaySpan = formatDateSpan(monthStart, monthEnd);

    if (elements.month) {
      elements.month.textContent = displayTitle;
    }
    if (elements.monthSpan) {
      elements.monthSpan.textContent = isGregorian ? displaySpan : `${displaySpan} · Gregorian`;
    }
    if (elements.grid) {
      const card = elements.grid.closest(".calendar-card");
      if (card) {
        card.dataset.calendarPrimary = system.id;
        card.dataset.calendarLabel = system.label;
      }
    }
    if (elements.summary) {
      const todayDetail = describeDate(today, today);
      const todayAlt = !isGregorian ? describeInSystem(system.id, today) : null;
      const weekNote = start === 1 ? "Weeks start on Monday" : `Weeks start on ${start === 0 ? "Sunday" : "Saturday"}`;
      const systemNote = isGregorian
        ? " Gregorian is the calendar shown, with international observances and national days marked in color."
        : ` ${system.label} is the calendar shown, with its own national days, festivals and observances marked in color. Gregorian's ${todayDetail.short} runs quietly under each date.`;
      elements.summary.textContent = `Today in ${city}: ${todayAlt ? todayAlt.long : todayDetail.title}. ${weekNote}.${systemNote}`;
    }
    if (elements.todayPill) {
      const todayAlt = !isGregorian ? describeInSystem(system.id, today) : null;
      elements.todayPill.textContent = todayAlt ? `TODAY · ${todayAlt.long}` : `TODAY · ${todayIso}`;
    }
    if (elements.systemBadge) {
      elements.systemBadge.hidden = isGregorian;
      elements.systemBadge.textContent = isGregorian ? "" : `${system.shortLabel} · ${system.label}`;
    }
    if (elements.grid) {
      const labels = weekdayLabels(start);
      const weekdays = labels.map((day) => `<span class="calendar-weekday" role="columnheader">${day}</span>`).join("");
      const markedCategories = new Set();
      const days = cells
        .map((cell) => {
          const classes = ["calendar-day"];
          if (!cell.inMonth) classes.push("is-outside");
          if (cell.isToday) classes.push("is-today");
          if (cell.isSelected) classes.push("is-selected");
          if (cell.isWeekend) classes.push("is-weekend");

          const events = eventsForDate(cell, prefs.holidays, system.id);
          for (const event of events) markedCategories.add(event.category);
          const notes = notesForDate(cell.iso);
          const alt = !isGregorian ? cell.alt : null;
          if (events.length || notes.length) classes.push("is-marked");
          if (!isGregorian) classes.push("has-primary-calendar");

          const label = describeDate(cell, today).title;
          const aria = [alt ? alt.long : label];
          if (alt) aria.push(`Gregorian: ${label}`);
          if (events.length) aria.push(events.map((event) => event.name).join(", "));
          if (notes.length) aria.push(`${notes.length} note${notes.length === 1 ? "" : "s"}`);

          const dots = [];
          for (const event of events.slice(0, 3)) {
            dots.push(`<span class="calendar-dot" data-cat="${escapeHTML(event.category)}"></span>`);
          }
          if (events.length > 3) dots.push(`<span class="calendar-dot-extra">+${events.length - 3}</span>`);
          if (notes.length) dots.push('<span class="calendar-dot calendar-dot-note"></span>');

          // The active calendar owns the large number in each cell. A quiet
          // Gregorian date rides underneath for orientation — never the
          // other way around.
          const primaryNumber = alt ? (alt.day ?? cell.gregorianDay) : cell.day;
          const gregorianLine = !isGregorian
            ? `<span class="calendar-alt calendar-gregorian-date" title="${escapeHTML(`Gregorian: ${label}`)}">${escapeHTML(monthDayFormatter.format(new Date(Date.UTC(cell.year, cell.month - 1, cell.day))))}</span>`
            : "";

          return `<button type="button" class="${classes.join(" ")}" role="gridcell" data-date="${escapeHTML(cell.iso)}" aria-pressed="${cell.isSelected}" aria-label="${escapeHTML(aria.join(" — "))}${cell.isToday ? ", today" : ""}">
            <span class="calendar-number" title="${escapeHTML(alt ? alt.long : label)}">${escapeHTML(String(primaryNumber))}</span>
            ${gregorianLine}
            ${cell.isToday ? '<small class="calendar-day-tag">Today</small>' : ""}
            ${dots.length ? `<span class="calendar-dots">${dots.join("")}</span>` : ""}
          </button>`;
        })
        .join("");
      elements.grid.innerHTML = weekdays + days;
      renderLegend(prefs, markedCategories, system);
    } else {
      renderLegend(prefs, new Set(), system);
    }

    renderSelected(selected, today, prefs);
    renderSpecificationsGuide(system.id);
  }

  function renderLegend(prefs, markedCategories, system) {
    if (!elements.legend) return;
    const order = new Map([["world", 0], ["national", 1], ["cultural", 2], ["religious", 3]]);
    const parts = [...markedCategories]
      .sort((a, b) => (order.get(a) ?? 9) - (order.get(b) ?? 9))
      .map((id) => {
        const category = eventCategory(id);
        return `<span class="calendar-legend-item"><span class="calendar-dot" data-cat="${escapeHTML(category.id)}"></span>${escapeHTML(category.label)}</span>`;
      });
    parts.push(`<span class="calendar-legend-item"><span class="calendar-dot calendar-dot-note"></span>Your note</span>`);
    if (system && system.id !== "gregorian") {
      parts.push(`<span class="calendar-legend-item calendar-legend-alt"><strong>Calendar:</strong> ${escapeHTML(system.shortLabel)} · ${escapeHTML(system.label)} · <strong>Also shown:</strong> Gregorian</span>`);
    }
    elements.legend.innerHTML = parts.join("");
  }

  function renderSelected(selected, today, prefs = preferences()) {
    const detail = describeDate(selected, today);
    const system = activeSystem(prefs);
    const isGregorian = system.id === "gregorian";
    const alt = !isGregorian ? describeInSystem(system.id, selected) : null;
    if (elements.selectedTitle) elements.selectedTitle.textContent = alt ? alt.long : detail.title;
    if (elements.selectedMeta) {
      elements.selectedMeta.textContent = detail.today
        ? "This is today in your home place."
        : `This date is ${detail.relative}.`;
    }
    if (elements.selectedIso) elements.selectedIso.textContent = detail.iso;
    if (elements.selectedWeek) elements.selectedWeek.textContent = `Week ${pad2(detail.isoWeek.week)}, ${detail.isoWeek.year}`;
    if (elements.selectedYearDay) elements.selectedYearDay.textContent = `Day ${detail.dayOfYear}`;
    if (elements.selectedRemaining) elements.selectedRemaining.textContent = `${detail.daysLeft} days left`;

    if (elements.secondary) {
      elements.secondary.hidden = !alt;
      if (alt) {
        const monthNames = alt.monthLabel && alt.system === "bikram" ? ` · ${alt.monthLabel}` : "";
        elements.secondary.textContent = `Gregorian: ${detail.title}${monthNames}${alt.approximate ? " (tabular date — may differ locally by a day)" : ""}`;
      }
    }

    renderSelectedEvents(selected, prefs, system);
    renderNotes(selected);
  }

  function renderSelectedEvents(selected, prefs, system) {
    const events = eventsForDate(selected, prefs.holidays, system.id);
    if (elements.eventsBlock) elements.eventsBlock.hidden = false;
    if (elements.events) {
      elements.events.innerHTML = events.length
        ? events
            .map(
              (event) => `<li class="calendar-event" data-cat="${escapeHTML(event.category)}">
                <span class="calendar-dot" data-cat="${escapeHTML(event.category)}"></span>
                <span class="calendar-event-name">${escapeHTML(event.name)}</span>
                <small>${escapeHTML(eventCategory(event.category).label)}${event.place ? ` · ${escapeHTML(event.place)}` : ""}${event.bs ? ` · ${escapeHTML(event.bs.monthName)} ${event.bs.day}, ${event.bs.year} BS` : ""}${event.approximate ? " · approx." : ""}</small>
              </li>`
            )
            .join("")
        : `<li class="calendar-event-empty">No holidays marked on this date.</li>`;
    }
  }

  function renderNotes(selected) {
    const iso = plainDate(selected);
    const notes = notesForDate(iso);
    if (elements.noteCount) {
      elements.noteCount.textContent = notes.length ? `${notes.length}` : "";
      elements.noteCount.hidden = notes.length === 0;
    }
    if (elements.notesList) {
      elements.notesList.innerHTML = notes.length
        ? notes
            .map(
              (note) => `<li class="calendar-note" data-note-id="${escapeHTML(note.id)}">
                <span class="calendar-note-chip" data-color="${escapeHTML(note.color)}"></span>
                <span class="calendar-note-text">${escapeHTML(note.text)}</span>
                <button type="button" class="calendar-note-remove" data-note-remove="${escapeHTML(note.id)}" aria-label="Delete note">×</button>
              </li>`
            )
            .join("")
        : `<li class="calendar-note-empty">Nothing pinned to this date yet — add a note above.</li>`;
    }
  }

  function renderSpecificationsGuide(systemId) {
    if (!elements.specsCard) return;
    const currentId = inspectedSystemId || systemId || "bikram";
    const sys = calendarSystem(currentId);

    const tabsHtml = CALENDAR_SYSTEMS.map(
      (entry) => `<button type="button" class="seg-button calendar-spec-tab${entry.id === currentId ? " active" : ""}" data-spec-system="${escapeHTML(entry.id)}">
        ${escapeHTML(entry.label)}
      </button>`
    ).join("");

    const monthsHtml = (sys.months || [])
      .map(
        (m, idx) => `<tr>
          <td><span class="calendar-spec-ord">${m.ordinal || idx + 1}</span></td>
          <td><strong>${escapeHTML(m.name)}</strong>${m.native ? ` <small class="calendar-spec-native">(${escapeHTML(m.native)})</small>` : ""}</td>
          <td><code>${escapeHTML(String(m.days || "—"))}</code></td>
          <td><span class="calendar-spec-note">${escapeHTML(m.season || m.note || "—")}</span></td>
        </tr>`
      )
      .join("");

    elements.specsCard.innerHTML = `
      <div class="calculator-card-heading">
        <div>
          <p class="card-label">SPECIFICATIONS &amp; CELEBRATION DATES</p>
          <h3 id="calendar-specs-heading">${escapeHTML(sys.label)} ${sys.nativeLabel ? `(${escapeHTML(sys.nativeLabel)})` : ""}</h3>
        </div>
        <span class="formula-icon soft" aria-hidden="true">📖</span>
      </div>
      <div class="segmented wrap calendar-spec-tabs" role="tablist" aria-label="Select calendar specification">
        ${tabsHtml}
      </div>
      <div class="calendar-spec-details">
        <dl class="calendar-spec-meta">
          <div><dt>Calendar Type</dt><dd>${escapeHTML(sys.type || "Solar")}</dd></div>
          <div><dt>Origin / Epoch</dt><dd>${escapeHTML(sys.epoch || "—")}</dd></div>
          <div><dt>Region &amp; Culture</dt><dd>${escapeHTML(sys.place || "—")}</dd></div>
          <div><dt>Regularity &amp; Rules</dt><dd>${escapeHTML(sys.rule || sys.note || "—")}</dd></div>
        </dl>
        <p class="eyebrow calendar-spec-subhead">SPECIFIC MONTHS &amp; DURATIONS (${(sys.months || []).length} MONTHS)</p>
        <div class="calendar-spec-table-wrap">
          <table class="calendar-spec-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Month Name &amp; Native</th>
                <th scope="col">Days</th>
                <th scope="col">Season &amp; Observance Highlights</th>
              </tr>
            </thead>
            <tbody>
              ${monthsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const specButtons = elements.specsCard.querySelectorAll("[data-spec-system]");
    specButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        inspectedSystemId = btn.dataset.specSystem;
        renderSpecificationsGuide(activeSystem().id);
      });
    });
  }

  function selectDate(iso, { silent = false } = {}) {
    const date = parsePlainDate(iso);
    if (!date) return false;
    state.selected = plainDate(date);
    state.viewAnchorIso = state.selected;
    writeCalendarState(state);
    render();
    if (!silent && typeof notify === "function") notify(`${describeDate(date, ensureState()).short} selected in Calendar.`);
    return true;
  }

  function changeMonth(amount) {
    const today = ensureState();
    const system = activeSystem();
    // Navigation follows whichever calendar is active: stepping "next
    // month" in Bikram Sambat moves by a real Bikram Sambat month, in
    // Islamic by a real Hijri month, and so on — never a hidden Gregorian
    // month underneath a translated label.
    const bounds = currentBounds(system, today);
    const nextDay1 = stepSystemMonth(system.id, bounds.day1Greg, amount);
    state.view = { year: nextDay1.year, month: nextDay1.month };
    state.viewAnchorIso = plainDate(nextDay1);
    state.selected = plainDate(nextDay1);
    writeCalendarState(state);
    render();
  }

  function jumpToToday() {
    const today = ensureState();
    state.view = { year: today.year, month: today.month };
    state.selected = plainDate(today);
    state.viewAnchorIso = plainDate(today);
    writeCalendarState(state);
    render();
    if (typeof notify === "function") notify("Calendar returned to today.");
  }

  function addNoteFromEditor() {
    ensureState();
    const selected = parsePlainDate(state.selected);
    if (!selected || !elements.noteInput) return;
    const iso = plainDate(selected);
    const text = elements.noteInput.value;
    const color = elements.noteColor ? elements.noteColor.value : "violet";
    if (!text.trim()) {
      if (typeof notify === "function") notify("Write the note first, then pin it to the date.", "!");
      return;
    }
    const note = addNote(iso, { text, color });
    if (!note) {
      if (typeof notify === "function") notify("That date already has all the notes it can hold.", "!");
      return;
    }
    elements.noteInput.value = "";
    render();
    if (typeof notify === "function") notify(`Note pinned to ${describeDate(selected, ensureState()).short}.`);
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
    if (elements.noteAdd) elements.noteAdd.addEventListener("click", addNoteFromEditor);
    if (elements.noteInput) {
      elements.noteInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          addNoteFromEditor();
        }
      });
    }
    if (elements.notesList) {
      elements.notesList.addEventListener("click", (event) => {
        const removeButton = event.target.closest("[data-note-remove]");
        if (!removeButton) return;
        ensureState();
        const selected = parsePlainDate(state.selected);
        if (!selected) return;
        const iso = plainDate(selected);
        if (removeNote(iso, removeButton.dataset.noteRemove)) {
          render();
          if (typeof notify === "function") notify("Note removed from that date.");
        }
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
    refreshPreferences(now = new Date()) {
      ensureState(now);
      // A calendar switch re-anchors the view from the selected date, so
      // "Ashwin 2083" appears the instant you pick Bikram Sambat rather
      // than a stale Gregorian month carried over from before.
      state.viewAnchorIso = state.selected;
      render(now);
    },
    selectDate,
    jumpToToday,
  };
}
