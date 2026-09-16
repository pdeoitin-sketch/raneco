/**
 * Tempo — the dashboard shell.
 *
 * **One page, thirteen sections, time first.** Tempo used to be six routed pages
 * behind a sidebar, then a single scroll with weather sitting above the
 * clocks. Now the order follows the reader: Right now, Alarms, Timer,
 * Stopwatch, World clocks, Time standards, Calendar, Old clock and Time
 * calculator — the things you do with time — then Weather, Forecast, Settings
 * and About (see src/router.js).
 * Old links still work: they scroll, and renamed sections keep their old
 * hashes as aliases (`#/focus` still finds the Stopwatch).
 *
 * Underneath, ten ideas do the work:
 *   • places      src/places.js        one model for zones, cities and GPS fixes
 *   • location    src/location.js      a real fix, named by a real gazetteer
 *   • weather     src/weather.js       Open-Meteo, key-less and failure-tolerant
 *   • forecast    src/forecast.js      the next 24 hours and the next 7 days
 *   • alarms      src/alarms.js        wall-clock alarms, DST-safe, 90 s grace
 *   • sounds      src/alarm-sounds.js  16 synthesised sounds + your own music
 *   • faces       src/clock-themes.js + src/sky-scenes.js  eight dials, a live sky
 *   • theme       src/theme.js         Auto / fixed mood themes, keyed to the live sky
 *   • calendar    src/calendar.js      a home-zone month view
 *   • settings    src/settings.js      text size and display preferences
 */

import { createCityPicker } from "./src/city-picker.js";
import { createClockFace } from "./src/clock-face.js";
import { createOldClock } from "./src/old-clock.js";
import { createWorldBoard } from "./src/world-board.js";
import { createStandardsBoard } from "./src/standards-board.js";
import { createTimer } from "./src/timer.js";
import { createStopwatch } from "./src/stopwatch.js";
import { createCalculator } from "./src/calculator.js";
import { createCalendar } from "./src/calendar.js";
import { createWeatherCard } from "./src/weather-card.js";
import { createForecast } from "./src/forecast.js";
import { createScrollNav } from "./src/router.js";
import { createAlarms } from "./src/alarms.js";
import { createRemarks } from "./src/remarks.js";
import { phraseFor } from "./src/phrases.js";
import { createToaster, $, $$, escapeHTML, flatten, pad } from "./src/ui.js";
import { TEXT_SIZE_OPTIONS, applyTextSize, readTextSize, textSizeOption, writeTextSize } from "./src/settings.js";
import {
  HOLIDAY_SETS,
  WEEK_STARTS,
  readAlarmDuration,
  readAlarmVolumePercent,
  readNotificationsEnabled,
  readPreferences,
  readWeatherUnits,
  weekStartOption,
  writeAlarmDuration,
  writeAlarmVolumePercent,
  writeNotificationsEnabled,
  writePreferences,
  writeWeatherUnits,
} from "./src/preferences.js";
import { CALENDAR_SYSTEMS, calendarSystem, calendarSystemAvailable } from "./src/calendar-systems.js";
import { applyBackup, backupFileName, buildBackupJSON, parseBackup } from "./src/data-backup.js";
import { APPEARANCES, THEME_CHOICES, applyAppearance, readMode, resolveAppearance, themeCaption, themeChoice, writeMode } from "./src/theme.js";
import { REFRESH_MS, effectiveMood, fetchWeather, preferImperial } from "./src/weather.js";
import { BOARD_REFRESH_MS, fetchBoardTemperatures, unitForRecord } from "./src/board-weather.js";
import {
  currentLocation,
  describeAccuracy,
  locationErrorMessage,
  locationSuccessMessage,
  placeFromCoords,
} from "./src/location.js";
import { ALARM_SOUNDS, findSound, soundsByMood } from "./src/alarm-sounds.js";
import {
  DEFAULT_BOARD,
  POPULAR_PLACES,
  placeCoords,
  placeRecord,
  placeZone,
  sunNote,
  zoneOffsetLabel,
  zoneOffsetMinutes,
  ZONE_PREFIX,
} from "./src/places.js";
import {
  formatLongDate,
  formatMediumDate,
  nextMidnight,
  partsFor,
  secondsIntoDay,
} from "./src/time-math.js";

(() => {
  "use strict";

  const MAX_WORLD_CLOCKS = 12;

  const keys = {
    homePlace: "tempo-home-zone",
    worldPlaces: "tempo-world-zones",
  };

  /**
   * The headline above the scroll changes with the section you are reading,
   * which is what makes one long page still feel like it has chapters.
   */
  const PAGE_TITLES = {
    now: "Make every moment count.",
    alarms: "Rings when the clock says so.",
    timer: "A timer that will not be missed.",
    stopwatch: "One thing at a time.",
    clocks: "Around the world.",
    standards: "Every clock has a name.",
    calendar: "Your dates, on your clock.",
    clock: "A slower kind of clock.",
    calculator: "Time, without the mental maths.",
    weather: "The sky, where you actually are.",
    forecast: "What the week is planning.",
    settings: "Make Tempo fit you.",
    about: "What Tempo is, and what it is not.",
  };

  const SECTION_EYEBROWS = {
    now: "YOUR TIME, RIGHT NOW",
    alarms: "RING AT A WALL-CLOCK TIME",
    timer: "COUNTDOWN",
    stopwatch: "TRACK ELAPSED TIME",
    clocks: "STAY IN SYNC",
    standards: "SHORT FORM, FULL FORM",
    calendar: "DATES ON YOUR CLOCK",
    clock: "A SLOWER KIND OF CLOCK",
    calculator: "NO MENTAL MATH REQUIRED",
    weather: "RIGHT NOW, OUTSIDE",
    forecast: "THE WEEK AHEAD",
    settings: "MAKE IT YOURS",
    about: "WHAT THIS IS",
  };

  /* ---------------------------------------------------------------- storage */

  function getStoredJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  /**
   * Old saves stored bare (and sometimes legacy) zone ids; new ones store
   * `zone:` / `city:` / `geo:`. Either way we canonicalise, so a board saved
   * as `Asia/Calcutta` comes back as `zone:Asia/Kolkata`.
   */
  function normalisePlaceId(value) {
    let raw = String(value || "").trim();
    if (!raw) return "";
    if (/^(city|geo):/.test(raw)) return raw;
    if (raw.startsWith(ZONE_PREFIX)) raw = raw.slice(ZONE_PREFIX.length);
    return `${ZONE_PREFIX}${placeRecord(raw).zone}`;
  }

  function storedHomePlace() {
    try {
      const raw = localStorage.getItem(keys.homePlace);
      if (typeof raw === "string" && raw.trim()) return normalisePlaceId(raw);
    } catch (_) {
      /* private mode: fall back to the device zone */
    }
    return `${ZONE_PREFIX}${systemZone()}`;
  }

  function systemZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch (_) {
      return "UTC";
    }
  }

  function storedBoard() {
    const saved = getStoredJSON(keys.worldPlaces, null);
    if (!Array.isArray(saved)) return [...DEFAULT_BOARD];
    const seen = new Set();
    const valid = [];
    for (const item of saved) {
      if (typeof item !== "string") continue;
      const id = normalisePlaceId(item);
      const record = placeRecord(id);
      if (!record || record.unknown || seen.has(record.id)) continue;
      seen.add(record.id);
      valid.push(record.id);
      if (valid.length >= MAX_WORLD_CLOCKS) break;
    }
    return valid.length ? valid : [...DEFAULT_BOARD];
  }

  const state = {
    homeId: storedHomePlace(),
    board: storedBoard(),
    themeMode: readMode(),
    textSize: readTextSize(),
    preferences: readPreferences(),
    appearance: "light",
    weather: null,
    // The sky the Auto theme paints from. This is tied to the *home place*
    // specifically — never to wherever the Weather section or Forecast
    // happens to be pointed at right now. Those two can be looking at
    // Paris or Beijing on your behalf; the theme only ever answers "what is
    // it like where my clock says it is", which is the home place's own
    // time and its own sky.
    homeWeather: null,
    lastFix: null,
    localHour: null,
    localMinute: 0,
    phraseDay: null,
    // Board temperatures, keyed by place id. One batched request keeps the
    // whole board warm; a card with no reading simply shows no number.
    boardTemps: {},
    boardTempsAt: 0,
  };
  let homeWeatherRevision = 0;

  /* --------------------------------------------------------------- elements */

  const elements = {
    todayLabel: $("#today-label"),
    pageTitle: $("#page-title"),
    topTimeZone: $("#top-timezone"),
    locationButton: $("#location-button"),
    useLocationButton: $("#use-location-button"),
    mobileMenuButton: $("#mobile-menu-button"),
    mobileNav: $("#mobile-nav"),
    mobileNavBackdrop: $("#mobile-nav-backdrop"),

    localHours: $("#local-hours"),
    localMinutes: $("#local-minutes"),
    localSeconds: $("#local-seconds"),
    localDate: $("#local-date"),
    localZoneName: $("#local-zone-name"),
    homeAnalog: $("#home-analog"),
    sunIcon: $("#sun-icon"),
    dayProgress: $("#day-progress"),
    dayProgressLabel: $("#day-progress-label"),
    sunsetCopy: $("#sunset-copy"),
    midnightCountdown: $("#midnight-countdown"),
    midnightProgress: $("#midnight-progress"),
    homeCityLabel: $("#home-city-label"),
    homeCountryLabel: $("#home-country-label"),
    utcOffset: $("#utc-offset"),
    homeSunLine: $("#home-sun-line"),
    changeZoneButton: $("#change-zone-button"),
    quickZoneButton: $("#quick-zone-button"),

    solarNote: $("#solar-note"),
    daylightNote: $("#daylight-note"),

    nowWeather: $("#now-weather"),
    nowWeatherTemp: $("#now-weather-temp"),
    nowWeatherUnit: $("#now-weather-unit"),
    nowWeatherSymbol: $("#now-weather-symbol"),
    nowWeatherCondition: $("#now-weather-condition"),
    nowWeatherMeta: $("#now-weather-meta"),

    popularCities: $("#popular-cities"),
    worldWeatherNote: $("#world-weather-note"),
    addCityButton: $("#add-city-button"),
    useLocationClock: $("#use-location-clock"),

    weatherUseLocationTop: $("#weather-use-location-top"),
    weatherSetLocationTop: $("#weather-set-location-top"),
    weatherLiveNote: $("#weather-live-note"),

    locationCard: $("#location-card"),
    locationName: $("#location-name"),
    locationDetail: $("#location-detail"),
    locationAccuracy: $("#location-accuracy"),
    locationCoords: $("#location-coords"),
    locationZone: $("#location-zone"),
    locationWarning: $("#location-warning"),
    locationLocate: $("#location-locate"),

    themeSwitch: $("#theme-switch"),
    themeCaption: $("#theme-caption"),

    calendarMonth: $("#calendar-month"),
    calendarMonthSpan: $("#calendar-month-span"),
    calendarGrid: $("#calendar-grid"),
    calendarSummary: $("#calendar-summary"),
    calendarTodayPill: $("#calendar-today-pill"),
    calendarPrev: $("#calendar-prev"),
    calendarNext: $("#calendar-next"),
    calendarToday: $("#calendar-today"),
    calendarSystem: $("#calendar-system"),
    calendarSystemBadge: $("#calendar-system-badge"),
    calendarLegend: $("#calendar-legend"),
    calendarSpecsCard: $("#calendar-specs-card"),
    calendarSecondary: $("#calendar-secondary"),
    calendarEventsBlock: $("#calendar-events-block"),
    calendarEvents: $("#calendar-holidays"),
    calendarNoteCount: $("#calendar-note-count"),
    calendarNoteInput: $("#calendar-note-input"),
    calendarNoteColor: $("#calendar-note-color"),
    calendarNoteAdd: $("#calendar-note-add"),
    calendarNotesList: $("#calendar-notes-list"),
    calendarSelectedTitle: $("#calendar-selected-title"),
    calendarSelectedMeta: $("#calendar-selected-meta"),
    calendarSelectedIso: $("#calendar-selected-iso"),
    calendarSelectedWeek: $("#calendar-selected-week"),
    calendarSelectedYearDay: $("#calendar-selected-year-day"),
    calendarSelectedRemaining: $("#calendar-selected-remaining"),

    settingsThemeGrid: $("#settings-theme-grid"),
    settingsThemeStatus: $("#settings-theme-status"),
    settingsTextSize: $("#settings-text-size"),
    settingsTextStatus: $("#settings-text-status"),
    settingsReset: $("#settings-reset"),
    settingsWeekStart: $("#settings-week-start"),
    settingsCalendarSystem: $("#settings-calendar-system"),
    settingsHolidayToggles: $("#settings-holiday-toggles"),
    settingsCalendarStatus: $("#settings-calendar-status"),
    settingsUnits: $("#settings-units"),
    settingsUnitsStatus: $("#settings-units-status"),
    settingsVolume: $("#settings-volume"),
    settingsVolumeLabel: $("#settings-volume-label"),
    settingsDuration: $("#settings-duration"),
    settingsNotifications: $("#settings-notifications"),
    settingsNotifyStatus: $("#settings-notify-status"),
    settingsGeo: $("#settings-geo"),
    settingsGeoStatus: $("#settings-geo-status"),
    settingsClearData: $("#settings-clear-data"),
    settingsExport: $("#settings-export"),
    settingsImport: $("#settings-import"),
    settingsImportFile: $("#settings-import-file"),
    settingsDataStatus: $("#settings-data-status"),

    footerYear: $("#footer-year"),
  };

  const notify = createToaster({
    toast: $("#toast"),
    message: $("#toast-message"),
    icon: $(".toast-icon"),
  });

  /* ------------------------------------------------------------ home clock */

  const homeFace = createClockFace(elements.homeAnalog, { numerals: "arabic", seconds: true, smooth: false });

  function homeZone() {
    return placeZone(state.homeId);
  }

  function homePlace() {
    return placeRecord(state.homeId);
  }

  function updateLiveTime() {
    const now = new Date();
    const zone = homeZone();
    const place = homePlace();
    const parts = partsFor(now, zone);
    const offset = zoneOffsetLabel(zone, now);
    const daySeconds = parts.hour * 3600 + parts.minute * 60 + parts.second;
    const progress = (daySeconds / 86400) * 100;
    const untilMidnight = Math.max(0, (nextMidnight(now, zone).getTime() - now.getTime()) / 1000);

    state.localHour = parts.hour;
    state.localMinute = parts.minute;

    if (elements.localHours) elements.localHours.textContent = pad(parts.hour);
    if (elements.localMinutes) elements.localMinutes.textContent = pad(parts.minute);
    if (elements.localSeconds) elements.localSeconds.textContent = pad(parts.second);
    if (elements.localDate) elements.localDate.textContent = formatLongDate(now, zone);
    if (elements.localZoneName) {
      elements.localZoneName.textContent = `${place.label} · ${offset} · ${place.zone}`;
    }
    if (elements.topTimeZone) {
      elements.topTimeZone.textContent = place.label;
      elements.topTimeZone.parentElement.title = `${place.zone} · ${offset} — click to change`;
    }
    if (elements.homeCityLabel) elements.homeCityLabel.textContent = place.city;
    if (elements.homeCountryLabel) {
      elements.homeCountryLabel.textContent = place.country || "Your zone";
      elements.homeCountryLabel.hidden = !place.country;
    }
    if (elements.utcOffset) {
      elements.utcOffset.textContent = `${place.country ? `${place.country} · ` : ""}${offset}`;
    }
    if (elements.homeSunLine) elements.homeSunLine.textContent = sunNote(place, now);
    if (elements.todayLabel) elements.todayLabel.textContent = formatMediumDate(now, zone).toUpperCase();

    homeFace.update(now, { hour: parts.hour, minute: parts.minute, second: parts.second, ms: now.getMilliseconds() });

    if (elements.dayProgress) elements.dayProgress.style.width = `${Math.max(2, progress)}%`;
    if (elements.midnightProgress) elements.midnightProgress.style.width = `${progress}%`;
    if (elements.midnightCountdown) {
      const total = Math.floor(untilMidnight);
      elements.midnightCountdown.textContent = `${pad(Math.floor(total / 3600))}:${pad(
        Math.floor((total % 3600) / 60)
      )}:${pad(total % 60)}`;
    }
    if (elements.sunsetCopy) elements.sunsetCopy.textContent = `${Math.round(progress)}% through today`;

    if (elements.sunIcon) {
      const live = state.homeWeather && state.homeWeather.ok ? state.homeWeather : null;
      const symbol = live && live.symbol ? live.symbol : parts.hour >= 6 && parts.hour < 19 ? "☀" : "☾";
      elements.sunIcon.textContent = symbol;
      elements.sunIcon.title = live && live.condition ? `${live.condition} in ${place.city}` : "Local sky";
    }
    if (elements.dayProgressLabel) {
      if (parts.hour < 6) elements.dayProgressLabel.textContent = "A new day is waking up";
      else if (parts.hour < 12) elements.dayProgressLabel.textContent = "Your morning is underway";
      else if (parts.hour < 18) elements.dayProgressLabel.textContent = "The day is in motion";
      else elements.dayProgressLabel.textContent = "The day is winding down";
    }

    document.title = `${pad(parts.hour)}:${pad(parts.minute)} · ${place.city} — Tempo`;

    // Cheap (guarded by the day key) but it makes the heading lines turn
    // over at midnight rather than at the next place change.
    renderPhrases();

    board.update(now);
    if (standardsVisible) standards.update(now);
    if (calendarVisible) calendar.sync(now);
    oldClockTick(now);

    // Every half minute is enough for a palette that follows the sun, and it
    // keeps a sunrise or sunset switch from waiting on the next hour.
    if (now.getSeconds() % 30 === 0) applyTheme();
  }

  /* ------------------------------------------------------------------ theme */

  function applyTheme() {
    if (!Number.isFinite(state.localHour)) {
      const parts = partsFor(new Date(), homeZone());
      state.localHour = parts.hour;
      state.localMinute = parts.minute;
    }
    const result = resolveAppearance({
      mode: state.themeMode,
      hour: state.localHour,
      minute: state.localMinute,
      weather: state.homeWeather && state.homeWeather.ok ? state.homeWeather : null,
      now: Date.now(),
    });
    const applied = applyAppearance(document, { mode: state.themeMode, appearance: result.appearance });
    state.appearance = applied.appearance;
    document.body.dataset.weather = state.homeWeather && state.homeWeather.ok ? effectiveMood(state.homeWeather) : "none";

    if (elements.themeCaption) {
      const info = APPEARANCES[result.appearance] || APPEARANCES.light;
      const choice = state.themeMode === "auto" ? info : themeChoice(state.themeMode);
      const place = homePlace();
      const weatherLine =
        state.homeWeather && state.homeWeather.ok
          ? `${state.homeWeather.symbol} ${state.homeWeather.condition} ${Math.round(state.homeWeather.temperature)}${
              state.homeWeather.temperatureUnit || "°C"
            }`
          : "no live weather";
      const detail = state.themeMode === "auto" ? `Auto · ${place.city}` : "fixed by you";
      elements.themeCaption.innerHTML =
        `<b>${escapeHTML(`${choice.icon || info.icon} ${choice.label || info.label}`)}</b><span>${escapeHTML(detail)}</span>` +
        `<small>${escapeHTML(weatherLine)}</small>`;
      elements.themeCaption.title = themeCaption({
        mode: state.themeMode,
        appearance: result.appearance,
        place: place.city,
        reason: result.reason,
      });
    }

    $$(".theme-option", elements.themeSwitch || document).forEach((button) => {
      const active = button.dataset.themeMode === state.themeMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-checked", String(active));
    });
    syncSettingsPanel(result);
    if (picker && picker.isOpen) picker.refresh();
  }

  function setThemeMode(mode, { silent = false } = {}) {
    const next = THEME_CHOICES.some((choice) => choice.id === mode) ? mode : "auto";
    state.themeMode = next;
    writeMode(next);
    applyTheme();
    if (silent) return;
    const info = APPEARANCES[state.appearance] || APPEARANCES.light;
    const choice = themeChoice(next);
    notify(
      next === "auto"
        ? `Auto is back on — ${info.label.toLowerCase()} from your time and weather.`
        : `${choice.label} theme stays until you switch back to Auto.`
    );
  }

  /* ------------------------------------------------------------- settings */

  function renderSettingsShell() {
    if (elements.settingsThemeGrid && !elements.settingsThemeGrid.dataset.ready) {
      const groups = { automatic: "Automatic", fixed: "Classic", weather: "Weather moods", time: "Day parts" };
      elements.settingsThemeGrid.innerHTML = THEME_CHOICES
        .map((choice) => {
          const group = groups[choice.kind] || "Theme";
          return `<button type="button" class="setting-choice" role="radio" aria-checked="false" data-settings-theme="${escapeHTML(
            choice.id
          )}" data-theme-kind="${escapeHTML(choice.kind)}">
            <span class="setting-choice-kicker">${escapeHTML(group)}</span>
            <span class="setting-choice-main"><span aria-hidden="true">${escapeHTML(choice.icon)}</span><strong>${escapeHTML(choice.label)}</strong></span>
            <small>${escapeHTML(choice.summary)}</small>
          </button>`;
        })
        .join("");
      elements.settingsThemeGrid.dataset.ready = "true";
    }

    if (elements.settingsTextSize && !elements.settingsTextSize.dataset.ready) {
      elements.settingsTextSize.innerHTML = TEXT_SIZE_OPTIONS
        .map(
          (option) => `<button type="button" class="seg-button" role="radio" aria-checked="false"
            data-text-size="${escapeHTML(option.id)}" title="${escapeHTML(option.summary)}">
            <span class="text-size-token">${escapeHTML(option.token)}</span>${escapeHTML(option.label)}
          </button>`
        )
        .join("");
      elements.settingsTextSize.dataset.ready = "true";
    }

    if (elements.settingsWeekStart && !elements.settingsWeekStart.dataset.ready) {
      elements.settingsWeekStart.innerHTML = WEEK_STARTS.map(
        (start) => `<button type="button" class="seg-button" role="radio" aria-checked="false"
          data-week-start="${escapeHTML(start.id)}" title="${escapeHTML(start.note)}">${escapeHTML(start.label)}</button>`
      ).join("");
      elements.settingsWeekStart.dataset.ready = "true";
    }

    /* Both calendar-system pickers (Settings card and the Calendar section
     * toolbar) are fed from the same catalogue; systems this browser's ICU
     * build cannot compute are listed but disabled, honestly. */
    const systemOption = (system) => {
      const available = calendarSystemAvailable(system.id);
      return `<option value="${escapeHTML(system.id)}"${available ? "" : " disabled"}>${escapeHTML(system.label)}${
        system.place ? ` — ${escapeHTML(system.place)}` : ""
      }${available ? "" : " (not in this browser)"}</option>`;
    };
    const systemOptionsHtml = CALENDAR_SYSTEMS.map(systemOption).join("");
    for (const select of [elements.settingsCalendarSystem, elements.calendarSystem]) {
      if (select && !select.dataset.ready) {
        select.innerHTML = systemOptionsHtml;
        select.dataset.ready = "true";
      }
    }

    if (elements.settingsHolidayToggles && !elements.settingsHolidayToggles.dataset.ready) {
      elements.settingsHolidayToggles.innerHTML = HOLIDAY_SETS.map(
        (set) => `<label class="settings-check">
          <input type="checkbox" data-holiday-set="${escapeHTML(set.id)}" checked />
          <span class="settings-check-main"><strong>${escapeHTML(set.label)}</strong><small>${escapeHTML(set.note)}</small></span>
        </label>`
      ).join("");
      elements.settingsHolidayToggles.dataset.ready = "true";
    }

    const UNIT_CHOICES = [
      { id: "auto", label: "Auto" },
      { id: "metric", label: "°C · metric" },
      { id: "imperial", label: "°F · imperial" },
    ];
    if (elements.settingsUnits && !elements.settingsUnits.dataset.ready) {
      elements.settingsUnits.innerHTML = UNIT_CHOICES.map(
        (choice) => `<button type="button" class="seg-button" role="radio" aria-checked="false"
          data-units-choice="${escapeHTML(choice.id)}">${escapeHTML(choice.label)}</button>`
      ).join("");
      elements.settingsUnits.dataset.ready = "true";
    }

    const DURATION_CHOICES = [
      { seconds: 5, label: "5 s" },
      { seconds: 15, label: "15 s" },
      { seconds: 30, label: "30 s" },
      { seconds: 60, label: "1 min" },
      { seconds: 0, label: "Until off" },
    ];
    if (elements.settingsDuration && !elements.settingsDuration.dataset.ready) {
      elements.settingsDuration.innerHTML = DURATION_CHOICES.map(
        (choice) => `<button type="button" class="seg-button" role="radio" aria-checked="false"
          data-duration-choice="${choice.seconds}">${escapeHTML(choice.label)}</button>`
      ).join("");
      elements.settingsDuration.dataset.ready = "true";
    }
  }

  function syncSettingsPanel(result = null) {
    if (elements.settingsThemeGrid) {
      $$("[data-settings-theme]", elements.settingsThemeGrid).forEach((button) => {
        const active = button.dataset.settingsTheme === state.themeMode;
        button.classList.toggle("active", active);
        button.setAttribute("aria-checked", String(active));
      });
    }
    if (elements.settingsTextSize) {
      $$("[data-text-size]", elements.settingsTextSize).forEach((button) => {
        const active = button.dataset.textSize === state.textSize;
        button.classList.toggle("active", active);
        button.setAttribute("aria-checked", String(active));
      });
    }

    if (elements.settingsThemeStatus) {
      const resolved = result || { appearance: state.appearance, reason: "" };
      const choice = state.themeMode === "auto" ? themeChoice("auto") : themeChoice(state.themeMode);
      const appearance = APPEARANCES[resolved.appearance] || APPEARANCES.light;
      const line = state.themeMode === "auto"
        ? `Auto is using ${appearance.label.toLowerCase()} for ${homePlace().city}.`
        : `${choice.label} is locked in until you choose Auto again.`;
      elements.settingsThemeStatus.textContent = line;
      elements.settingsThemeStatus.title = themeCaption({
        mode: state.themeMode,
        appearance: resolved.appearance,
        place: homePlace().city,
        reason: resolved.reason || "",
      });
    }

    if (elements.settingsTextStatus) {
      const option = textSizeOption(state.textSize);
      elements.settingsTextStatus.textContent = `${option.label} text · ${Math.round(option.scale * 100)}% scale. ${option.summary}`;
    }

    syncPreferenceControls();
  }

  /**
   * Reflect state.preferences (and the shared tempo-* alarm/unit keys) into
   * the grown-up settings cards. Runs inside syncSettingsPanel, which is
   * already the "settings panel mirrors state" pass.
   */
  function syncPreferenceControls() {
    const prefs = state.preferences;

    if (elements.settingsWeekStart) {
      $$("[data-week-start]", elements.settingsWeekStart).forEach((button) => {
        const active = button.dataset.weekStart === prefs.weekStart;
        button.classList.toggle("active", active);
        button.setAttribute("aria-checked", String(active));
      });
    }
    for (const select of [elements.settingsCalendarSystem, elements.calendarSystem]) {
      if (select && select.value !== prefs.calendarSystem) select.value = prefs.calendarSystem;
    }
    if (elements.settingsHolidayToggles) {
      $$("[data-holiday-set]", elements.settingsHolidayToggles).forEach((input) => {
        input.checked = prefs.holidays[input.dataset.holidaySet] !== false;
      });
    }
    if (elements.settingsCalendarStatus) {
      const start = weekStartOption(prefs.weekStart);
      const system = calendarSystem(prefs.calendarSystem);
      const marked = HOLIDAY_SETS.filter((set) => prefs.holidays[set.id] !== false).map((set) => set.label.toLowerCase());
      elements.settingsCalendarStatus.textContent =
        `Weeks begin ${start.label}. Calendar shown first: ${system.label}. Gregorian stays underneath. Marking: ${marked.length ? marked.join(", ") : "nothing — a clean grid"}.`;
    }

    const units = readWeatherUnits();
    if (elements.settingsUnits) {
      $$("[data-units-choice]", elements.settingsUnits).forEach((button) => {
        const active = button.dataset.unitsChoice === units;
        button.classList.toggle("active", active);
        button.setAttribute("aria-checked", String(active));
      });
    }
    if (elements.settingsUnitsStatus) {
      elements.settingsUnitsStatus.textContent =
        units === "metric"
          ? "Celsius and km/h everywhere, no matter the place."
          : units === "imperial"
            ? "Fahrenheit and mph everywhere, no matter the place."
            : "Auto: each place uses its own measuring system.";
    }

    const volume = readAlarmVolumePercent();
    if (elements.settingsVolume && document.activeElement !== elements.settingsVolume) {
      elements.settingsVolume.value = String(volume);
    }
    if (elements.settingsVolumeLabel) elements.settingsVolumeLabel.textContent = `${volume}%`;

    const duration = readAlarmDuration();
    if (elements.settingsDuration) {
      $$("[data-duration-choice]", elements.settingsDuration).forEach((button) => {
        const active = Number(button.dataset.durationChoice) === duration;
        button.classList.toggle("active", active);
        button.setAttribute("aria-checked", String(active));
      });
    }

    const notifications = readNotificationsEnabled();
    if (elements.settingsNotifications) {
      elements.settingsNotifications.setAttribute("aria-pressed", String(notifications));
      elements.settingsNotifications.classList.toggle("active", notifications);
    }
    if (elements.settingsNotifyStatus) {
      const supported = typeof Notification !== "undefined";
      const permission = supported ? Notification.permission : "unsupported";
      if (!supported) elements.settingsNotifyStatus.textContent = "This browser has no notification support — sound it is.";
      else if (permission === "denied")
        elements.settingsNotifyStatus.textContent = "Notifications are blocked by the browser — the sound still plays.";
      else if (notifications) elements.settingsNotifyStatus.textContent = "A notification joins the sound when a ring goes off.";
      else elements.settingsNotifyStatus.textContent = "Sound only, by default.";
    }

    if (elements.settingsGeo) {
      elements.settingsGeo.setAttribute("aria-pressed", String(prefs.geo));
      elements.settingsGeo.classList.toggle("active", prefs.geo);
      elements.settingsGeo.innerHTML = `<span class="pill-icon" aria-hidden="true">⌖</span> Location buttons ${prefs.geo ? "on" : "off"}`;
    }
    if (elements.settingsGeoStatus) {
      elements.settingsGeoStatus.textContent = prefs.geo
        ? "Every “use my location” button asks your device for a position."
        : "All “use my location” buttons are switched off — places are picked by name only.";
    }
  }

  function setTextSize(size, { silent = false } = {}) {
    const option = applyTextSize(document, size);
    state.textSize = writeTextSize(option.id);
    syncSettingsPanel();
    if (!silent) notify(`${option.label} text size applied.`);
  }

  function resetSettings() {
    state.themeMode = "auto";
    state.textSize = "default";
    writeMode(state.themeMode);
    writeTextSize(state.textSize);
    applyTextSize(document, state.textSize);
    applyTheme();
    syncSettingsPanel();
    notify("Settings reset — Auto theme and default text are back.");
  }

  /* ----------------------------------------------- preferences, many tools */

  function patchPreferences(patch) {
    state.preferences = writePreferences(patch);
    syncSettingsPanel();
    calendar.refreshPreferences();
    return state.preferences;
  }

  function setWeekStartPreference(id) {
    if (id === state.preferences.weekStart) return;
    const prefs = patchPreferences({ weekStart: id });
    notify(`Calendar weeks now start on ${weekStartOption(prefs.weekStart).label}.`);
  }

  function setCalendarSystemPreference(id, { silent = false } = {}) {
    if (!calendarSystemAvailable(id)) {
      notify("This browser cannot compute that calendar — it stays on the list for other devices.", "!");
      return;
    }
    if (id === state.preferences.calendarSystem) return;
    const prefs = patchPreferences({ calendarSystem: id });
    if (!silent) {
      const system = calendarSystem(prefs.calendarSystem);
      notify(
        system.id === "gregorian"
          ? "Gregorian is primary — the plain calendar is back."
          : `${system.label} is now the primary date; Gregorian stays underneath.`
      );
    }
  }

  function setHolidaySetPreference(id, enabled) {
    const prefs = patchPreferences({ holidays: { [id]: enabled } });
    const set = HOLIDAY_SETS.find((entry) => entry.id === id);
    if (set) notify(`${set.label} ${prefs.holidays[id] !== false ? "marked on" : "hidden from"} the calendar.`);
  }

  function setUnitsPreference(choice) {
    const units = writeWeatherUnits(choice);
    syncSettingsPanel();
    // The weather card re-reads its units on refresh; the forecast derives
    // its units from the card, so one forced refresh carries the change.
    weatherCard.refresh({ force: true });
    refreshHomeWeather({ force: true });
    forecast.refresh();
    notify(
      units === "auto"
        ? "Weather units follow each place again."
        : units === "metric"
          ? "Celsius and km/h from here on."
          : "Fahrenheit and mph from here on."
    );
  }

  function setVolumePreference(percent, { quiet = false } = {}) {
    const applied = writeAlarmVolumePercent(percent);
    // The wall-clock alarms read this key at ring time; the timer keeps its
    // own state in a 0–1 gain, so mirror the change into it too.
    if (timer && typeof timer.setVolume === "function") timer.setVolume(applied / 100);
    if (elements.settingsVolumeLabel) elements.settingsVolumeLabel.textContent = `${applied}%`;
    if (!quiet) syncSettingsPanel();
    return applied;
  }

  function setDurationPreference(seconds) {
    const applied = writeAlarmDuration(seconds);
    if (timer && typeof timer.setDuration === "function") timer.setDuration(applied);
    syncSettingsPanel();
    notify(applied === 0 ? "Rings keep going until you stop them." : `Rings last ${applied < 60 ? `${applied} seconds` : "1 minute"} by default.`);
  }

  async function toggleNotificationsPreference() {
    const wantsOn = !readNotificationsEnabled();
    let enabled;
    if (timer && typeof timer.enableNotifications === "function") {
      // The timer owns the permission dance and writes the same key.
      enabled = await timer.enableNotifications(wantsOn);
    } else {
      enabled = writeNotificationsEnabled(wantsOn);
    }
    syncSettingsPanel();
    return enabled;
  }

  function setGeoPreference(enabled) {
    patchPreferences({ geo: enabled });
    applyGeoGate();
    notify(
      enabled
        ? "Location buttons are back — they ask your device each time."
        : "Location buttons are off. Places are chosen by name now."
    );
  }

  /** Disable every GPS button when the privacy toggle is off. */
  function applyGeoGate() {
    const enabled = state.preferences.geo !== false;
    $$("[data-needs-geo]").forEach((button) => {
      button.disabled = !enabled;
      button.setAttribute("aria-disabled", String(!enabled));
      if (!enabled) button.title = "Location features are switched off in Settings → Privacy & location.";
      else button.removeAttribute("title");
    });
  }

  function clearAllSavedData() {
    const verb = typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm : null;
    if (verb && !verb("Clear every preference, alarm, world clock, calendar note and remark Tempo saved on this device?")) {
      return;
    }
    try {
      const doomed = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (typeof key === "string" && key.startsWith("tempo-")) doomed.push(key);
      }
      doomed.forEach((key) => localStorage.removeItem(key));
      notify("Tempo has forgotten everything on this device. Reloading fresh…", "🗑", 2500);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (_) {
      notify("Storage is unavailable in this browser, so there is nothing to clear.", "!");
    }
  }

  /* --------------------------------------------------------- export/import */

  function exportBackup() {
    let json;
    try {
      json = buildBackupJSON(localStorage);
    } catch (_) {
      notify("Storage is unavailable in this browser, so there is nothing to export.", "!");
      return;
    }
    const name = backupFileName();
    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      if (elements.settingsDataStatus) {
        elements.settingsDataStatus.textContent = `Saved ${name} — every tempo-* key in one file.`;
      }
      notify("Backup exported. Keep it somewhere you trust.");
    } else {
      // A fallback for the rare engine without blob URLs: offer the text.
      if (elements.settingsDataStatus) elements.settingsDataStatus.textContent = json;
      notify("Your browser cannot download files — the backup is printed in the status line instead.", "!", 9000);
    }
  }

  async function importBackupFile(file) {
    if (!file) return;
    let text = "";
    try {
      text = await file.text();
    } catch (_) {
      notify("That file could not be read.", "!");
      return;
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      if (elements.settingsDataStatus) elements.settingsDataStatus.textContent = parsed.error;
      notify(parsed.error, "!");
      return;
    }
    const written = applyBackup(parsed.backup, localStorage);
    if (elements.settingsDataStatus) {
      elements.settingsDataStatus.textContent = `Restored ${written} keys from ${file.name}. Reloading with them…`;
    }
    notify(`Backup restored — ${written} settings came home. Reloading…`, "✓", 2500);
    window.setTimeout(() => window.location.reload(), 900);
  }

  /* ------------------------------------------------------------- phrases */

  /**
   * A line under every heading: time for the clock sections, sky for the
   * weather ones, a seasonal line for the forecast that flips hemisphere with
   * your latitude. Rotation is by day number, so a phrase is stable all day
   * and moves on at midnight — re-rendered when the day (or the home place,
   * which carries the latitude) changes.
   */
  function renderPhrases() {
    const now = new Date();
    const dayKey = now.toDateString();
    if (dayKey === state.phraseDay) return;
    state.phraseDay = dayKey;

    const place = homePlace();
    const latitude = Number.isFinite(place.lat) ? place.lat : null;
    for (const section of document.querySelectorAll(".page[data-page]")) {
      const host = section.querySelector(".section-phrase");
      if (!host) continue;
      host.textContent = phraseFor(section.dataset.page, { date: now, latitude });
    }
  }

  /* ---------------------------------------------------------- now weather */

  /**
   * The glance beside the clock: the home place's own sky, always — even
   * when the Weather section below has been pointed at somewhere else.
   */
  function renderNowWeather() {
    const card = elements.nowWeather;
    if (!card) return;
    const snapshot = state.homeWeather;
    const place = homePlace();

    if (!snapshot || !snapshot.ok) {
      card.dataset.state = snapshot ? "error" : "idle";
      setText(elements.nowWeatherTemp, "--");
      setText(elements.nowWeatherUnit, "°");
      setText(elements.nowWeatherSymbol, snapshot ? "!" : "☂");
      setText(elements.nowWeatherCondition, snapshot ? snapshot.message || "Weather unavailable" : "Weather not loaded");
      setText(elements.nowWeatherMeta, "The full story loads in the Weather section below.");
      return;
    }

    card.dataset.state = "ready";
    setText(elements.nowWeatherSymbol, snapshot.symbol || "☂");
    setText(elements.nowWeatherTemp, String(Math.round(snapshot.temperature)));
    setText(elements.nowWeatherUnit, snapshot.temperatureUnit || "°C");
    setText(elements.nowWeatherCondition, snapshot.condition);
    const meta = [];
    if (Number.isFinite(snapshot.feelsLike)) meta.push(`feels ${Math.round(snapshot.feelsLike)}${snapshot.temperatureUnit}`);
    if (Number.isFinite(snapshot.humidity)) meta.push(`${Math.round(snapshot.humidity)}% humidity`);
    setText(
      elements.nowWeatherMeta,
      `${snapshot.label || place.label}${meta.length ? " · " + meta.join(" · ") : ""}`
    );
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  /* ----------------------------------------------------------- home weather */

  /**
   * The weather behind the Auto theme, the "sky here" glance, the sun icon
   * and the solar/daylight notes — all of it about the **home place**,
   * independently of wherever the Weather card or the Forecast section
   * happen to be pointed at.
   *
   * Those two sections can legitimately look at another city ("what's it
   * like in Paris right now?") without the rest of the page pretending to
   * live there. Before this existed, `state.weather` was one shared snapshot
   * that followed whichever place the Weather card's "Choose a place…" or
   * "Use my location" last landed on — so switching your home place while an
   * old GPS fix (or an explicitly chosen city) was still pinned to the card
   * left the Auto theme frozen on a sky from somewhere else, sometimes for
   * good. `homeCoordsMatchSource` below only skips a redundant fetch when
   * the two truly agree; the moment they diverge, home weather is fetched
   * on its own.
   */
  function homeCoordsMatchSource(source) {
    if (!source || !Number.isFinite(Number(source.lat)) || !Number.isFinite(Number(source.lon))) return false;
    const home = placeCoords(state.homeId);
    if (!home) return false;
    return Math.abs(Number(source.lat) - home.lat) < 0.01 && Math.abs(Number(source.lon) - home.lon) < 0.01;
  }

  function applyHomeWeather(snapshot) {
    state.homeWeather = snapshot;
    applyTheme();
    updateNotes();
    updateLiveTime();
    renderNowWeather();
  }

  async function refreshHomeWeather({ force = false } = {}) {
    const revision = (homeWeatherRevision += 1);
    const place = homePlace();
    const coords = placeCoords(state.homeId);
    if (!coords) {
      applyHomeWeather({
        ok: false,
        message: "This place has no coordinates — pick a city to see its weather.",
        attemptedAt: Date.now(),
      });
      return null;
    }
    if (!force && state.homeWeather && state.homeWeather.ok && Date.now() - state.homeWeather.observedAt < REFRESH_MS) {
      return state.homeWeather;
    }
    // Units: the Settings card's choice wins; on Auto each place keeps the
    // measuring system it actually uses (°F for the US, °C elsewhere).
    const unitPreference = readWeatherUnits();
    const units =
      unitPreference !== "auto"
        ? unitPreference
        : preferImperial((place.countries || []).map((entry) => entry.code))
          ? "imperial"
          : "metric";
    const snapshot = await fetchWeather({ lat: coords.lat, lon: coords.lon, label: place.label, units, timezone: "auto" });
    if (revision !== homeWeatherRevision) return null; // the home place moved again while this was in flight
    applyHomeWeather(snapshot);
    return snapshot;
  }

  /** Called on a timer: top up home weather only when nothing else already keeps it fresh. */
  function maybeRefreshHomeWeather() {
    if (homeCoordsMatchSource(weatherCard.source)) return; // the weather card's own polling covers this case
    const stale =
      !state.homeWeather || !state.homeWeather.ok || Date.now() - state.homeWeather.observedAt >= REFRESH_MS;
    if (stale) refreshHomeWeather();
  }

  /* --------------------------------------------------------------- weather */

  const weatherCard = createWeatherCard({
    elements: {
      card: $("#weather-card"),
      temp: $("#weather-temp"),
      unit: $("#weather-unit"),
      symbol: $("#weather-symbol"),
      condition: $("#weather-condition"),
      place: $("#weather-place"),
      coords: $("#weather-coords"),
      source: $("#weather-source"),
      sunrise: $("#weather-sunrise"),
      sunset: $("#weather-sunset"),
      daylight: $("#weather-daylight"),
      details: $("#weather-details"),
      updated: $("#weather-updated"),
      useLocation: $("#weather-use-location"),
      setLocation: $("#weather-set-location"),
      retry: $("#weather-retry"),
      units: $("#weather-units"),
      sunArcDot: $("#sun-arc-dot"),
    },
    getHomeId: () => state.homeId,
    notify,
    onSnapshot: (snapshot) => {
      state.weather = snapshot;
      // The Auto theme, the sun icon, the "sky here" glance and the
      // daylight note are about the *home place* — they only adopt this
      // snapshot when the card genuinely happens to be looking at home
      // right now. Pointed at another city (Paris while home is Kathmandu),
      // this snapshot is real, useful weather — just not home's weather.
      if (homeCoordsMatchSource(weatherCard.source)) {
        applyHomeWeather(snapshot);
      } else if (!state.homeWeather) {
        // First load with an old session's weather pin (or a GPS fix)
        // already pointed elsewhere: home still needs its own sky, once.
        refreshHomeWeather();
      }
      // The old clock's sky is painted from this same snapshot — one request,
      // one truth, and a scene that can never contradict the weather card.
      if (oldClock) oldClock.updateScene();
      if (elements.weatherLiveNote) {
        elements.weatherLiveNote.textContent =
          snapshot && snapshot.ok ? `Updated for ${snapshot.label || homePlace().city}.` : "";
      }
      // The forecast follows the card, so the two can never disagree.
      forecast.refresh();
    },
  });

  /* --------------------------------------------------------------- forecast */

  const forecast = createForecast({
    elements: {
      section: $("#page-forecast"),
      summary: $("#forecast-summary"),
      hours: $("#forecast-hours"),
      days: $("#forecast-days"),
      place: $("#forecast-place"),
      zone: $("#forecast-zone"),
      refresh: $("#forecast-refresh"),
    },
    // One source of truth: whatever the weather card is pointed at.
    getSource: () => {
      const source = weatherCard.source;
      if (!source) return null;
      return {
        lat: source.lat,
        lon: source.lon,
        label: source.label,
        units: state.weather && state.weather.temperatureUnit === "°F" ? "imperial" : "metric",
      };
    },
    notify,
  });

  /* ------------------------------------------------------- location card */

  /**
   * The "where we think you are" panel.
   *
   * It exists because the honest answer to "where am I" has a confidence
   * attached, and hiding that confidence is what made the old feature feel
   * random. A 20 m GPS fix and a 40 km network guess look identical on a map;
   * here they do not.
   */
  function renderLocationCard(result) {
    if (!elements.locationCard) return;
    const card = elements.locationCard;

    if (!result) {
      card.dataset.precision = "unknown";
      return;
    }
    if (!result.ok) {
      card.dataset.precision = "error";
      if (elements.locationName) elements.locationName.textContent = "Could not locate you";
      if (elements.locationDetail) elements.locationDetail.textContent = locationErrorMessage(result);
      if (elements.locationWarning) elements.locationWarning.hidden = true;
      return;
    }

    const place = result.place;
    const precision = result.precision || describeAccuracy(result.accuracy);
    card.dataset.precision = precision.level;

    if (elements.locationName) elements.locationName.textContent = place.city || "Your location";
    if (elements.locationDetail) {
      elements.locationDetail.textContent =
        place.detail || [place.region, place.country].filter(Boolean).join(", ") || "Located from your device.";
    }
    if (elements.locationAccuracy) elements.locationAccuracy.textContent = precision.label;
    if (elements.locationCoords) elements.locationCoords.textContent = placeCoords2(place);
    if (elements.locationZone) elements.locationZone.textContent = place.zone || "—";
    if (elements.locationWarning) {
      if (result.coarse) {
        elements.locationWarning.hidden = false;
        elements.locationWarning.textContent =
          "This is a network estimate, not a GPS fix — it can be tens of kilometres out, and on a VPN it can be the wrong country. Allow precise location, or pick your city by hand.";
      } else if (!result.geocoded) {
        elements.locationWarning.hidden = false;
        elements.locationWarning.textContent =
          "Named from Tempo's own city list because the gazetteer was unreachable — the nearest known city may not be the one you are in.";
      } else {
        elements.locationWarning.hidden = true;
      }
    }
  }

  function updateNotes() {
    const place = homePlace();
    if (elements.solarNote) {
      const line = sunNote(place);
      const offset = placeCoords2(place);
      elements.solarNote.textContent = line
        ? `${place.city} sits at ${offset}. ${line}. Across a big country the same clock can be an hour away from the sun — that is why your region can feel 15 minutes early or late.`
        : "Pick a place with coordinates to see how far its clock sits from its own sun.";
    }
    if (elements.daylightNote) {
      const snapshot = state.homeWeather;
      if (snapshot && snapshot.ok && snapshot.sunrise && snapshot.sunset) {
        const hours = ((snapshot.sunset - snapshot.sunrise) / 3600000).toFixed(1);
        elements.daylightNote.textContent = `${place.city} gets about ${hours} hours of daylight today, from ${new Date(
          snapshot.sunrise + snapshot.utcOffsetSeconds * 1000
        ).toISOString().slice(11, 16)} to ${new Date(snapshot.sunset + snapshot.utcOffsetSeconds * 1000)
          .toISOString()
          .slice(11, 16)} local time.`;
      } else {
        elements.daylightNote.textContent = "Sunrise and sunset appear here once the sky is loaded.";
      }
    }
  }

  function placeCoords2(place) {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return "an unknown point";
    const ns = place.lat >= 0 ? "N" : "S";
    const ew = place.lon >= 0 ? "E" : "W";
    return `${Math.abs(place.lat).toFixed(2)}° ${ns}, ${Math.abs(place.lon).toFixed(2)}° ${ew}`;
  }

  /* ----------------------------------------------------------------- board */

  const board = createWorldBoard({
    elements: {
      grid: $("#world-grid"),
      count: $("#world-count"),
      empty: $("#world-empty"),
      onMakeHome: (id) => setHomePlace(id),
    },
    getHomeId: () => state.homeId,
    getTemperature: (id) => state.boardTemps[id] || null,
    notify,
    max: MAX_WORLD_CLOCKS,
    onChange: (places) => {
      state.board = places;
      try {
        localStorage.setItem(keys.worldPlaces, JSON.stringify(places));
      } catch (_) {
        /* the board resets next visit when storage is blocked */
      }
    },
    // A clock added (or removed) changes what the batch should ask for; a
    // card with no reading would otherwise sit blank until the next refresh.
    onPlacesChanged: () => refreshBoardTemperatures({ reason: "board-changed" }),
  });

  /* --------------------------------------------------- board temperatures */

  /**
   * One request for the whole board.
   *
   * Every card wants a temperature beside its hour, and twelve separate calls
   * for twelve small numbers would be both slow and rude to a free API — so
   * Open-Meteo's multi-coordinate form does it in one. Failures are silent by
   * design: the cards keep whatever they had, because a clock must never be
   * taken down by the weather.
   */
  let boardTempsBusy = false;
  async function refreshBoardTemperatures({ force = false, reason = "" } = {}) {
    if (boardTempsBusy) return;
    if (!force && state.boardTempsAt && Date.now() - state.boardTempsAt < 30 * 1000 && reason !== "board-changed") {
      return;
    }
    const points = state.board
      .map((id) => {
        const record = placeRecord(id);
        const coords = placeCoords(id);
        if (!coords) return null;
        return { id: record.id, lat: coords.lat, lon: coords.lon, units: unitForRecord(record) };
      })
      .filter(Boolean);
    if (!points.length) return;

    boardTempsBusy = true;
    try {
      const result = await fetchBoardTemperatures(points);
      if (result.ok) {
        state.boardTemps = { ...state.boardTemps, ...result.readings };
        state.boardTempsAt = result.observedAt;
        board.renderTemperatures();
        if (elements.worldWeatherNote) {
          elements.worldWeatherNote.textContent =
            "Each clock shows its own city's temperature, in the unit that city uses.";
        }
      } else if (elements.worldWeatherNote && result.message) {
        elements.worldWeatherNote.textContent = result.message;
      }
    } finally {
      boardTempsBusy = false;
    }
  }

  /* ------------------------------------------------------- time standards */

  const standards = createStandardsBoard({
    elements: {
      grid: $("#standards-grid"),
      count: $("#standards-count"),
      empty: $("#standards-empty"),
      regions: $("#standards-regions"),
      clockFormat: $("#standards-format"),
      search: $("#standards-search"),
    },
    getHomeOffsetMinutes: () => zoneOffsetMinutes(homeZone(), new Date()),
    getHomeCity: () => homePlace().city,
    notify,
  });

  function renderPopularCities() {
    if (!elements.popularCities) return;
    const chips = POPULAR_PLACES.map((id) => {
      const record = placeRecord(id);
      const added = state.board.includes(record.id);
      return `<button type="button" class="city-chip${added ? " added" : ""}" data-add-city="${escapeHTML(
        record.id
      )}"${added ? " disabled" : ""}>
        <span class="chip-plus" aria-hidden="true">${added ? "✓" : "+"}</span>${escapeHTML(record.city)}
      </button>`;
    }).join("");
    elements.popularCities.innerHTML = chips;
  }

  /* ------------------------------------------------------------ old clock  */

  let oldClock = null;
  let oldClockVisible = false;
  let calendarVisible = false;
  // The standards grid only ticks while it is on screen; off screen it is a
  // few dozen text nodes nobody is reading.
  let standardsVisible = false;

  function oldClockTick(now) {
    const isFs = typeof document !== "undefined" && Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    if ((!oldClockVisible && !isFs) || !oldClock) return;
    // The old clock runs its own frame loop; this only keeps the digital
    // readout honest when the browser throttles rAF.
    if (!document.hidden) return;
    oldClock.renderPlace();
  }

  /* ---------------------------------------------------------------- picker */

  let picker = null;

  function openPicker(mode) {
    const config = {
      home: {
        title: "Set your home place",
        eyebrow: "MAKE IT YOURS",
        copy: "Your home place drives the clock, the day progress, the weather and the Auto theme. Search a city, a country, or use your location.",
        submitLabel: "Save home place",
        selectedId: state.homeId,
      },
      add: {
        title: "Add a world clock",
        eyebrow: "STAY IN SYNC",
        copy: `Every zone and every city we know, grouped by country — up to ${MAX_WORLD_CLOCKS} clocks at a time.`,
        submitLabel: "Add this clock",
        selectedId: firstUnaddedPopular(),
      },
      weather: {
        title: "Where should we look?",
        eyebrow: "WEATHER LOCATION",
        copy: "Weather is measured at a point, not a country. Pick the city you want the sky for, or use your device.",
        submitLabel: "Use this place",
        selectedId: state.homeId,
      },
      clock: {
        title: "Which place should it show?",
        eyebrow: "OLD CLOCK",
        copy: "The hands follow this place's clock. It can be anywhere — a city you miss, or the one you are about to land in.",
        submitLabel: "Show this place",
        selectedId: oldClock ? oldClock.placeId || state.homeId : state.homeId,
      },
    }[mode] || {};

    picker.open({ mode, homeId: state.homeId, ...config });
  }

  function firstUnaddedPopular() {
    return POPULAR_PLACES.find((id) => !state.board.includes(id)) || state.homeId;
  }

  /* -------------------------------------------------------------- location */

  /**
   * "Use my location", everywhere it appears.
   *
   * Three things are different from the old flow, and all three were the bug
   * report: the fix is taken at **high accuracy** with a short cache window
   * (a stale, coarse fix is what produced "a random thing"), the name comes
   * from a **real gazetteer** rather than the nearest of our 328 cities, and
   * the result carries its own **confidence**, which the toast and the
   * location card both report instead of quietly pretending to be certain.
   */
  async function useMyLocation({ setHome = true, addClock = false, alsoWeather = true } = {}) {
    if (state.preferences.geo === false) {
      // The privacy toggle is off; the buttons are disabled too, so this is
      // the belt-and-braces path for programmatic callers.
      notify("Location features are switched off in Settings → Privacy & location.", "!");
      return null;
    }
    const buttons = [elements.useLocationButton, elements.locationLocate, elements.weatherUseLocationTop].filter(
      Boolean
    );
    for (const button of buttons) button.disabled = true;
    if (elements.locationCard) elements.locationCard.dataset.precision = "locating";
    notify("Reading your device's position…", "⌖", 12000);
    try {
      const result = await currentLocation({ lookup: true, geocode: true });
      if (!result.ok) {
        notify(locationErrorMessage(result), "!");
        renderLocationCard(result);
        return null;
      }
      const place = result.place;
      state.lastFix = result;
      renderLocationCard(result);

      if (setHome) setHomePlace(place.id, { silent: true, weather: alsoWeather });
      if (addClock) addClockFor(place.id);

      notify(locationSuccessMessage(result), result.coarse ? "!" : "⌖", result.coarse ? 7000 : 5000);
      return place;
    } finally {
      for (const button of buttons) button.disabled = false;
    }
  }

  /* ---------------------------------------------------------- place changes */

  function setHomePlace(id, { silent = false, weather = true } = {}) {
    const record = placeRecord(id);
    if (!record || record.unknown) return;
    state.homeId = record.id;
    try {
      localStorage.setItem(keys.homePlace, record.id);
    } catch (_) {
      /* the home place resets next visit when storage is blocked */
    }
    state.localHour = null;
    // The old city's sky must not linger for even one tick under the new
    // city's clock — clear it so Auto falls back to the clock-only palette
    // instantly, then the fresh fetch below replaces it as soon as it lands.
    // This is the fix for "I moved to New York and the theme stayed sunny":
    // the palette used to keep running on whatever place the weather card —
    // or an old GPS fix — happened to still be pointed at.
    state.homeWeather = null;
    updateLiveTime();
    board.render();
    renderPopularCities();
    applyTheme();
    calculator.refreshZone();
    calendar.refreshZone();
    updateNotes();
    // The phrases follow the place: the forecast's seasonal line flips with
    // latitude, and the glance names the place it is describing.
    state.phraseDay = null;
    renderPhrases();
    renderNowWeather();
    // The Auto theme always gets the new home place's own sky, on its own
    // request — regardless of whether the Weather card also moves with it.
    // This is deliberately independent of `weather`/followHomeZone below: a
    // GPS fix or a city you chose on purpose can keep the *card* looking
    // elsewhere, but the theme must never be left waiting on, or quietly
    // borrowing, a sky that belongs to a different place.
    refreshHomeWeather({ force: true });
    if (weather) weatherCard.followHomeZone();
    if (oldClock && (!oldClock.placeId || oldClock.placeId === record.id)) oldClock.setPlace(record.id);
    // Every standard's "ahead of / behind you" line is measured from home.
    standards.refreshShifts();
    refreshBoardTemperatures({ force: true, reason: "home-changed" });
    if (!silent) notify(`${record.label} is now your home place.`);
  }

  function addClockFor(id) {
    if (board.add(id)) {
      renderPopularCities();
      return true;
    }
    return false;
  }

  /* --------------------------------------------------------------- modules */

  const timer = createTimer({
    elements: {
      minutes: $("#timer-minutes"),
      seconds: $("#timer-seconds"),
      display: $("#timer-display"),
      ring: $("#timer-ring"),
      status: $("#timer-status"),
      start: $("#timer-start"),
      reset: $("#timer-reset"),
      presets: $$("#page-timer .preset-button"),
      // The alarm: its picker, its settings, and the bar that appears when
      // the countdown is over and the sound is still going.
      ringingBar: $("#timer-ringing"),
      dismiss: $("#timer-dismiss"),
      soundList: $("#alarm-sounds"),
      durationButtons: $$("#alarm-durations [data-alarm-duration]"),
      volume: $("#alarm-volume"),
      volumeLabel: $("#alarm-volume-label"),
      notifyToggle: $("#alarm-notify"),
      testAlarm: $("#alarm-test"),
      customInput: $("#alarm-custom"),
      customApply: $("#alarm-custom-apply"),
      customFile: $("#alarm-file"),
      currentSound: $("#alarm-current"),
    },
    notify,
  });

  /**
   * The sound picker, built from the catalogue rather than written out by
   * hand, so adding a sound to `src/alarm-sounds.js` is the only step needed
   * to make it appear here.
   */
  function renderSoundList() {
    const host = $("#alarm-sounds");
    if (!host) return;
    const groups = soundsByMood()
      .map((group) => {
        const options = group.sounds
          .map(
            (sound) => `<div class="sound-option" role="radio" aria-checked="false" tabindex="0"
              data-sound="${escapeHTML(sound.id)}" title="${escapeHTML(sound.note)}">
              <span class="sound-name">${escapeHTML(sound.name)}</span>
              <span class="sound-note">${escapeHTML(sound.note)}</span>
              <button class="sound-play" type="button" data-preview="${escapeHTML(sound.id)}"
                aria-label="Preview ${escapeHTML(sound.name)}">▶</button>
            </div>`
          )
          .join("");
        return `<div class="sound-group">
          <p class="sound-group-label">${escapeHTML(group.label)}</p>
          <div class="sound-options">${options}</div>
        </div>`;
      })
      .join("");

    host.innerHTML = `${groups}
      <div class="sound-group">
        <p class="sound-group-label">Your own</p>
        <div class="sound-options">
          <div class="sound-option sound-option-custom" role="radio" aria-checked="false" tabindex="0" data-sound="custom">
            <span class="sound-name">Custom music</span>
            <span class="sound-note">A file, a direct audio link, or YouTube / YouTube Music / Spotify.</span>
          </div>
        </div>
      </div>`;

    // Space and Enter pick a sound, the way a radio group should.
    host.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const option = event.target.closest("[data-sound]");
      if (!option) return;
      event.preventDefault();
      timer.setSound(option.dataset.sound);
    });
  }

  const stopwatch = createStopwatch({
    elements: {
      display: $("#stopwatch-display"),
      status: $("#stopwatch-status"),
      start: $("#stopwatch-start"),
      reset: $("#stopwatch-reset"),
      lapButton: $("#lap-button"),
      lapCount: $("#lap-count"),
      lapsList: $("#laps-list"),
      targetProgress: $("#target-progress"),
      targetCopy: $("#target-copy"),
      targetRow: $("#target-row"),
    },
  });

  /* ---------------------------------------------------------------- alarms */

  /**
   * Wall-clock alarms — the sibling the timer never had. Times are read on
   * the home place's clock; the engine runs on the device clock, walks
   * calendar days (so a Friday alarm jumps the weekend and DST is survived),
   * and grants a 90-second grace window for throttled tabs.
   */
  const alarms = createAlarms({
    elements: {
      editorTitle: $("#alarms-editor-title"),
      time: $("#alarms-time"),
      date: $("#alarms-date"),
      repeatRow: $("#alarms-repeat"),
      label: $("#alarms-label"),
      notes: $("#alarms-notes"),
      sound: $("#alarms-sound"),
      save: $("#alarms-save"),
      cancel: $("#alarms-cancel"),
      list: $("#alarms-list"),
      empty: $("#alarms-empty"),
      status: $("#alarms-status"),
      ringingBar: $("#alarms-ringing"),
      ringingLabel: $("#alarms-ringing-label"),
      ringingNote: $("#alarms-ringing-note"),
      dismiss: $("#alarms-dismiss"),
    },
    getZone: () => homeZone(),
    notify,
  });

  const calculator = createCalculator({
    elements: {
      durationForm: $("#duration-form"),
      startDatetime: $("#start-datetime"),
      endDatetime: $("#end-datetime"),
      durationWords: $("#duration-words"),
      durationContext: $("#duration-context"),
      totalDays: $("#total-days"),
      totalHours: $("#total-hours"),
      totalMinutes: $("#total-minutes"),
      totalSeconds: $("#total-seconds"),
      saveCalculation: $("#save-calculation"),
      convertValue: $("#convert-value"),
      convertUnit: $("#convert-unit"),
      conversionResults: $("#conversion-results"),
      conversionHint: $(".conversion-hint"),
      savedList: $("#saved-list"),
      clearSaved: $("#clear-saved"),
    },
    getZone: () => homeZone(),
    notify,
  });

  const calendar = createCalendar({
    elements: {
      month: elements.calendarMonth,
      monthSpan: elements.calendarMonthSpan,
      grid: elements.calendarGrid,
      summary: elements.calendarSummary,
      todayPill: elements.calendarTodayPill,
      prev: elements.calendarPrev,
      next: elements.calendarNext,
      today: elements.calendarToday,
      legend: elements.calendarLegend,
      systemBadge: elements.calendarSystemBadge,
      specsCard: elements.calendarSpecsCard,
      secondary: elements.calendarSecondary,
      eventsBlock: elements.calendarEventsBlock,
      events: elements.calendarEvents,
      noteCount: elements.calendarNoteCount,
      noteInput: elements.calendarNoteInput,
      noteColor: elements.calendarNoteColor,
      noteAdd: elements.calendarNoteAdd,
      notesList: elements.calendarNotesList,
      selectedTitle: elements.calendarSelectedTitle,
      selectedMeta: elements.calendarSelectedMeta,
      selectedIso: elements.calendarSelectedIso,
      selectedWeek: elements.calendarSelectedWeek,
      selectedYearDay: elements.calendarSelectedYearDay,
      selectedRemaining: elements.calendarSelectedRemaining,
    },
    getZone: () => homeZone(),
    getPlace: () => homePlace(),
    getPreferences: () => state.preferences,
    notify,
  });

  /* --------------------------------------------------------------- remarks */

  /**
   * The About section's remarks & feedback card: tagged, saved in this
   * browser only, and handed to the reader's own mail client on request —
   * no contact records, deliberately.
   */
  const remarks = createRemarks({
    elements: {
      tagRow: $("#remark-tags"),
      input: $("#remark-input"),
      add: $("#remark-add"),
      list: $("#remarks-list"),
      count: $("#remarks-count"),
      mailto: $("#remark-mailto"),
      clearAll: $("#remarks-clear"),
    },
    notify,
  });

  /* ---------------------------------------------------------------- router */

  /**
   * The scroll spy.
   *
   * Every section is in the DOM all the time now, so `onChange` is about
   * *waking things up* rather than swapping pages: the old clock's animation
   * loop only runs while its section is on screen (it is a rAF loop, and
   * burning frames on a clock nobody is looking at is rude), and the forecast
   * loads the first time you reach it rather than on boot.
   */
  const nav = createScrollNav({
    sections: [
      { id: "now", page: $("#page-now"), title: "Right now" },
      { id: "alarms", page: $("#page-alarms"), title: "Alarms" },
      { id: "timer", page: $("#page-timer"), title: "Timer" },
      { id: "stopwatch", page: $("#page-stopwatch"), title: "Stopwatch" },
      { id: "clocks", page: $("#page-clocks"), title: "World clocks" },
      { id: "standards", page: $("#page-standards"), title: "Time standards" },
      { id: "calendar", page: $("#page-calendar"), title: "Calendar" },
      { id: "clock", page: $("#page-clock"), title: "Old clock" },
      { id: "calculator", page: $("#page-calculator"), title: "Time calculator" },
      { id: "weather", page: $("#page-weather"), title: "Weather" },
      { id: "forecast", page: $("#page-forecast"), title: "Forecast" },
      { id: "settings", page: $("#page-settings"), title: "Settings" },
      { id: "about", page: $("#page-about"), title: "About" },
    ],
    // The Focus section grew up and became the Stopwatch; anyone who
    // bookmarked `#/focus` (a real URL in the routed era) still lands there.
    aliases: { focus: "stopwatch" },
    onChange: (section) => {
      if (elements.pageTitle) elements.pageTitle.textContent = PAGE_TITLES[section.id] || PAGE_TITLES.now;
      if (elements.todayLabel && SECTION_EYEBROWS[section.id]) {
        elements.todayLabel.dataset.section = section.id;
      }
      closeMobileNav();

      const isFs = typeof document !== "undefined" && Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      oldClockVisible = section.id === "clock" || isFs;
      if (oldClockVisible) oldClock.start();
      else if (oldClock) oldClock.stop();

      if (section.id === "alarms") alarms.sync();
      if (section.id === "timer") timer.sync();
      if (section.id === "stopwatch") stopwatch.sync();
      if (section.id === "clocks") {
        board.render();
        refreshBoardTemperatures({ reason: "section" });
      }
      standardsVisible = section.id === "standards";
      if (standardsVisible) standards.render();
      calendarVisible = section.id === "calendar";
      if (calendarVisible) calendar.render();
      if (section.id === "forecast") forecast.activate();
    },
  });

  function closeMobileNav() {
    if (elements.mobileNav) elements.mobileNav.classList.remove("open");
    if (elements.mobileNavBackdrop) elements.mobileNavBackdrop.classList.remove("open");
  }

  /* ---------------------------------------------------------------- events */

  function bindEvents() {
    if (elements.changeZoneButton) elements.changeZoneButton.addEventListener("click", () => openPicker("home"));
    if (elements.quickZoneButton) elements.quickZoneButton.addEventListener("click", () => openPicker("home"));
    if (elements.locationButton) elements.locationButton.addEventListener("click", () => openPicker("home"));
    if (elements.useLocationButton) {
      elements.useLocationButton.addEventListener("click", () => useMyLocation({ setHome: true, addClock: true }));
    }
    if (elements.addCityButton) {
      elements.addCityButton.addEventListener("click", () => {
        if (state.board.length >= MAX_WORLD_CLOCKS) {
          notify(`You can keep up to ${MAX_WORLD_CLOCKS} world clocks at once.`, "!");
          return;
        }
        openPicker("add");
      });
    }
    if (elements.useLocationClock) {
      elements.useLocationClock.addEventListener("click", () =>
        useMyLocation({ setHome: false, addClock: true, alsoWeather: false })
      );
    }
    if (elements.locationLocate) {
      elements.locationLocate.addEventListener("click", () => useMyLocation({ setHome: true, addClock: false }));
    }
    if (elements.weatherUseLocationTop) {
      elements.weatherUseLocationTop.addEventListener("click", () => weatherCard.useMyLocation());
    }
    if (elements.weatherSetLocationTop) {
      elements.weatherSetLocationTop.addEventListener("click", () => openPicker("weather"));
    }
    if (elements.popularCities) {
      elements.popularCities.addEventListener("click", (event) => {
        const chip = event.target.closest("[data-add-city]");
        if (!chip) return;
        addClockFor(chip.dataset.addCity);
      });
    }

    if (elements.themeSwitch) {
      elements.themeSwitch.addEventListener("click", (event) => {
        const button = event.target.closest("[data-theme-mode]");
        if (!button) return;
        const mode = button.dataset.themeMode;
        if (mode === state.themeMode) return;
        setThemeMode(mode);
      });
      // Roving tab index keeps the segmented control a single tab stop.
      elements.themeSwitch.addEventListener("keydown", (event) => {
        const buttons = $$(".theme-option", elements.themeSwitch);
        const index = buttons.indexOf(document.activeElement);
        if (index < 0) return;
        let next = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % buttons.length;
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + buttons.length) % buttons.length;
        if (next === null) return;
        event.preventDefault();
        buttons[next].focus();
        buttons[next].click();
      });
    }

    if (elements.settingsThemeGrid) {
      elements.settingsThemeGrid.addEventListener("click", (event) => {
        const button = event.target.closest("[data-settings-theme]");
        if (!button) return;
        setThemeMode(button.dataset.settingsTheme);
      });
    }
    if (elements.settingsTextSize) {
      elements.settingsTextSize.addEventListener("click", (event) => {
        const button = event.target.closest("[data-text-size]");
        if (!button) return;
        setTextSize(button.dataset.textSize);
      });
    }
    if (elements.settingsReset) elements.settingsReset.addEventListener("click", resetSettings);

    /* ------------------------------------------------ grown-up preferences */

    if (elements.settingsWeekStart) {
      elements.settingsWeekStart.addEventListener("click", (event) => {
        const button = event.target.closest("[data-week-start]");
        if (!button) return;
        setWeekStartPreference(button.dataset.weekStart);
      });
    }
    for (const select of [elements.settingsCalendarSystem, elements.calendarSystem]) {
      if (select) {
        select.addEventListener("change", () => setCalendarSystemPreference(select.value));
      }
    }
    if (elements.settingsHolidayToggles) {
      elements.settingsHolidayToggles.addEventListener("change", (event) => {
        const input = event.target.closest("[data-holiday-set]");
        if (!input) return;
        setHolidaySetPreference(input.dataset.holidaySet, input.checked);
      });
    }
    if (elements.settingsUnits) {
      elements.settingsUnits.addEventListener("click", (event) => {
        const button = event.target.closest("[data-units-choice]");
        if (!button) return;
        setUnitsPreference(button.dataset.unitsChoice);
      });
    }
    if (elements.settingsVolume) {
      elements.settingsVolume.addEventListener("input", () => setVolumePreference(Number(elements.settingsVolume.value)));
    }
    if (elements.settingsDuration) {
      elements.settingsDuration.addEventListener("click", (event) => {
        const button = event.target.closest("[data-duration-choice]");
        if (!button) return;
        setDurationPreference(Number(button.dataset.durationChoice));
      });
    }
    if (elements.settingsNotifications) {
      elements.settingsNotifications.addEventListener("click", toggleNotificationsPreference);
    }
    if (elements.settingsGeo) {
      elements.settingsGeo.addEventListener("click", () => setGeoPreference(!state.preferences.geo));
    }
    if (elements.settingsClearData) elements.settingsClearData.addEventListener("click", clearAllSavedData);
    if (elements.settingsExport) elements.settingsExport.addEventListener("click", exportBackup);
    if (elements.settingsImport && elements.settingsImportFile) {
      elements.settingsImport.addEventListener("click", () => elements.settingsImportFile.click());
      elements.settingsImportFile.addEventListener("change", () => {
        const file = elements.settingsImportFile.files && elements.settingsImportFile.files[0];
        importBackupFile(file);
        elements.settingsImportFile.value = "";
      });
    }

    if (elements.mobileMenuButton) {
      elements.mobileMenuButton.addEventListener("click", () => {
        elements.mobileNav.classList.toggle("open");
        elements.mobileNavBackdrop.classList.toggle("open");
      });
    }
    if (elements.mobileNavBackdrop) elements.mobileNavBackdrop.addEventListener("click", closeMobileNav);
    $$(".mobile-nav a").forEach((link) => link.addEventListener("click", closeMobileNav));

    window.addEventListener("online", () => {
      weatherCard.refresh({ force: true });
      refreshHomeWeather({ force: true });
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        updateLiveTime();
        weatherCard.refresh();
        maybeRefreshHomeWeather();
        applyTheme();
      }
    });
    // DST shifts and daylight boundaries both move the palette.
    window.setInterval(applyTheme, 30 * 1000);
    // Home weather refreshes on its own clock — independent of whatever the
    // Weather card and Forecast are polling for, per REFRESH_MS.
    window.setInterval(maybeRefreshHomeWeather, 60 * 1000);
  }

  /* ------------------------------------------------------------------- boot */

  function initialise() {
    picker = createCityPicker({
      elements: {
        dialog: $("#zone-dialog"),
        form: $("#zone-form"),
        title: $("#zone-dialog-title"),
        eyebrow: $("#dialog-eyebrow"),
        copy: $("#dialog-copy"),
        submit: $("#zone-submit"),
        close: $("#dialog-close"),
        search: $("#zone-search"),
        list: $("#picker-list"),
        count: $("#picker-count"),
        summary: $("#picker-summary"),
        chips: $("#picker-chips"),
        useLocation: $("#picker-use-location"),
      },
      callbacks: {
        formatOffset: (id) => zoneOffsetLabel(placeRecord(id).zone),
        isAdded: (id) => state.board.includes(placeRecord(id).id),
        onPick: (id, mode) => {
          if (mode === "add") return addClockFor(id);
          if (mode === "weather") {
            weatherCard.setPlace(id);
            return true;
          }
          if (mode === "clock") {
            oldClock.setPlace(id);
            return true;
          }
          setHomePlace(id);
          return true;
        },
        onBlocked: (id) => {
          notify(`${placeRecord(id).city} is already on your board.`, "!");
        },
        onUseLocation: async () => {
          const place = await useMyLocation({ setHome: false, addClock: false, alsoWeather: false });
          if (!place) return;
          picker.close();
          const record = placeRecord(place.id);
          if (picker.state.mode === "add") addClockFor(record.id);
          else if (picker.state.mode === "weather") weatherCard.setPlace(record.id);
          else if (picker.state.mode === "clock") oldClock.setPlace(record.id);
          else setHomePlace(record.id);
        },
      },
    });

    oldClock = createOldClock({
      elements: {
        face: $("#old-clock"),
        wrap: $("#old-clock-wrap"),
        stage: $("#old-clock-stage"),
        sceneNote: $("#old-clock-scene-note"),
        digital: $("#old-clock-digital"),
        meta: $("#old-clock-meta"),
        sun: $("#old-clock-sun"),
        placeName: $("#old-clock-place-name"),
        placeLabel: $("#old-clock-place-label"),
        eyebrow: $("#old-clock-eyebrow"),
        placeButton: $("#old-clock-place"),
        fullscreen: $("#old-clock-fullscreen"),
        facesGroup: $("#old-clock-faces"),
        faceNote: $("#old-clock-face-note"),
        motionGroup: $("#old-clock-motion"),
        chime: $("#old-clock-chime"),
      },
      getPlaceId: () => state.homeId,
      getWeather: () => state.weather,
      notify,
      onPickPlace: () => openPicker("clock"),
    });
    oldClock.init();

    weatherCard.onPickPlace(() => openPicker("weather"));

    // Migrate a board saved by an older browser (or an older Tempo) to place ids.
    const stored = getStoredJSON(keys.worldPlaces, null);
    if (Array.isArray(stored) && stored.some((item, index) => normalisePlaceId(item) !== state.board[index])) {
      try {
        localStorage.setItem(keys.worldPlaces, JSON.stringify(state.board));
      } catch (_) {
        /* nothing to do */
      }
    }

    // Store the canonical id back, so a legacy save is migrated on first load.
    try {
      localStorage.setItem(keys.homePlace, state.homeId);
    } catch (_) {
      /* nothing to do */
    }

    if (elements.footerYear) elements.footerYear.textContent = `© ${new Date().getFullYear()} Tempo`;

    board.setPlaces(state.board);
    board.bindEvents();
    renderPopularCities();

    standards.init();

    renderSettingsShell();
    renderSoundList();
    timer.init();
    stopwatch.init();
    calculator.init();
    calendar.init();
    alarms.init();
    remarks.init();
    forecast.init();
    bindEvents();
    applyGeoGate();

    setTextSize(state.textSize, { silent: true });
    applyTheme();
    updateLiveTime();
    updateNotes();
    renderPhrases();
    renderNowWeather();
    nav.registerLinks("[data-route]");
    nav.start();

    window.setInterval(updateLiveTime, 1000);
    weatherCard.init();

    // The board's temperatures: once now, then on a slow loop. Weather moves
    // far slower than a clock, so a quarter of an hour is plenty.
    refreshBoardTemperatures({ force: true, reason: "boot" });
    window.setInterval(() => refreshBoardTemperatures({ force: true, reason: "interval" }), BOARD_REFRESH_MS);

    // A coordinate-only place (added by an older build, or typed by hand) can
    // still be resolved: ask the network once, quietly, on load.
    if (state.homeId.startsWith("geo:")) {
      resolveHomeCoordinates();
    }
  }

  /**
   * A saved `geo:` home place guessed its zone from our own gazetteer. Ask the
   * weather service which zone actually covers that point and, when it
   * disagrees, correct the guess — borders are where the guesses go wrong.
   */
  async function resolveHomeCoordinates() {
    const record = placeRecord(state.homeId);
    if (!Number.isFinite(record.lat) || !Number.isFinite(record.lon)) return;
    const resolved = await placeFromCoords({ lat: record.lat, lon: record.lon, lookup: true });
    if (!resolved.ok || !resolved.zoneConfirmed) return;
    if (resolved.place.zone === record.zone) return;
    updateLiveTime();
    updateNotes();
    board.render();
    weatherCard.render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise);
  else initialise();
})();
