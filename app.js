/**
 * Tempo — the dashboard shell.
 *
 * Place names come from src/tz-places.js (IANA zone1970.tab + Intl.DisplayNames),
 * the searchable picker from src/city-picker.js, live weather from
 * src/weather.js and the Auto theme from src/theme.js. The timer, stopwatch and
 * calculator are plain local-time maths and deliberately know nothing about any
 * of that.
 */

import { canonicalZone, isValidZone, placeLabel, recordFor, SUGGESTED_ZONES } from "./src/tz-places.js";
import { createCityPicker } from "./src/city-picker.js";
import { createWeatherCard } from "./src/weather-card.js";
import { APPEARANCES, applyAppearance, readMode, resolveAppearance, themeCaption, writeMode } from "./src/theme.js";

(() => {
  "use strict";

  const defaultWorldZones = [
    "America/New_York",
    "Europe/London",
    "Asia/Kathmandu",
    "Australia/Sydney",
  ];

  const MAX_WORLD_CLOCKS = 8;

  const keys = {
    homeZone: "tempo-home-zone",
    worldZones: "tempo-world-zones",
    saved: "tempo-saved-calculations",
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const pad = (value) => String(value).padStart(2, "0");
  const escapeHTML = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  /**
   * The id to actually hand to Intl: the modern canonical zone when this engine
   * understands it, otherwise whatever the browser reported (older ICU builds
   * still resolve their own legacy ids, e.g. Asia/Katmandu).
   */
  function usableZone(zone) {
    const canonical = canonicalZone(zone);
    return isValidZone(canonical) ? canonical : zone;
  }

  function getStoredJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function storedZone(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (typeof raw !== "string" || !raw) return fallback;
      const canonical = canonicalZone(raw);
      if (isValidZone(canonical)) return canonical;
      return isValidZone(raw) ? raw : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function systemTimeZone() {
    try {
      return usableZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch (_) {
      return "UTC";
    }
  }

  function getStoredWorldZones() {
    const saved = getStoredJSON(keys.worldZones, null);
    if (!Array.isArray(saved)) return [...defaultWorldZones];
    const seen = new Set();
    const valid = [];
    for (const item of saved) {
      if (typeof item !== "string") continue;
      const zone = usableZone(canonicalZone(item));
      if (!isValidZone(zone) || seen.has(zone)) continue;
      seen.add(zone);
      valid.push(zone);
      if (valid.length >= MAX_WORLD_CLOCKS) break;
    }
    return valid.length ? valid : [...defaultWorldZones];
  }

  const state = {
    homeZone: storedZone(keys.homeZone, systemTimeZone()),
    worldZones: getStoredWorldZones(),
    savedCalculations: getStoredJSON(keys.saved, []),
    lastCalculation: null,
    themeMode: readMode(),
    appearance: "light",
    weather: null,
    timer: {
      original: 5 * 60 * 1000,
      remaining: 5 * 60 * 1000,
      running: false,
      endAt: 0,
      interval: null,
    },
    stopwatch: {
      elapsed: 0,
      startedAt: 0,
      running: false,
      interval: null,
      laps: [],
      lastLapAt: 0,
    },
  };

  // Elements ---------------------------------------------------------------
  const elements = {
    topTimeZone: $("#top-timezone"),
    todayLabel: $("#today-label"),
    localHours: $("#local-hours"),
    localMinutes: $("#local-minutes"),
    localSeconds: $("#local-seconds"),
    localDate: $("#local-date"),
    localZoneName: $("#local-zone-name"),
    sunIcon: $("#sun-icon"),
    hourHand: $("#hour-hand"),
    minuteHand: $("#minute-hand"),
    secondHand: $("#second-hand"),
    dayProgress: $("#day-progress"),
    dayProgressLabel: $("#day-progress-label"),
    sunsetCopy: $("#sunset-copy"),
    midnightCountdown: $("#midnight-countdown"),
    midnightProgress: $("#midnight-progress"),
    homeCityLabel: $("#home-city-label"),
    homeCountryLabel: $("#home-country-label"),
    utcOffset: $("#utc-offset"),
    worldGrid: $("#world-grid"),
    worldCount: $("#world-count"),
    changeZoneButton: $("#change-zone-button"),
    quickZoneButton: $("#quick-zone-button"),
    addCityButton: $("#add-city-button"),
    themeSwitch: $("#theme-switch"),
    themeCaption: $("#theme-caption"),
    toast: $("#toast"),
    toastMessage: $("#toast-message"),
    footerYear: $("#footer-year"),
    timerMinutes: $("#timer-minutes"),
    timerSeconds: $("#timer-seconds"),
    timerDisplay: $("#timer-display"),
    timerRing: $("#timer-ring"),
    timerStatus: $("#timer-status"),
    timerStart: $("#timer-start"),
    timerReset: $("#timer-reset"),
    stopwatchDisplay: $("#stopwatch-display"),
    stopwatchStatus: $("#stopwatch-status"),
    stopwatchStart: $("#stopwatch-start"),
    stopwatchReset: $("#stopwatch-reset"),
    lapButton: $("#lap-button"),
    lapCount: $("#lap-count"),
    lapsList: $("#laps-list"),
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
    calculatorZone: $("#calculator-zone"),
    convertValue: $("#convert-value"),
    convertUnit: $("#convert-unit"),
    conversionResults: $("#conversion-results"),
    conversionHint: $(".conversion-hint"),
    savedList: $("#saved-list"),
    clearSaved: $("#clear-saved"),
    mobileMenuButton: $("#mobile-menu-button"),
    mobileNav: $("#mobile-nav"),
    mobileNavBackdrop: $("#mobile-nav-backdrop"),
  };

  // Date and timezone helpers ---------------------------------------------
  const formatters = new Map();
  function getFormatter(locale, options) {
    const cacheKey = `${locale}|${JSON.stringify(options)}`;
    if (!formatters.has(cacheKey)) {
      formatters.set(cacheKey, new Intl.DateTimeFormat(locale, options));
    }
    return formatters.get(cacheKey);
  }

  function partsFor(date, zone) {
    const formatter = getFormatter("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    return formatter.formatToParts(date).reduce((parts, item) => {
      if (item.type !== "literal") parts[item.type] = item.value;
      return parts;
    }, {});
  }

  function timeParts12(date, zone) {
    const formatter = getFormatter("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return formatter.formatToParts(date).reduce((parts, item) => {
      if (item.type !== "literal") parts[item.type] = item.value;
      return parts;
    }, {});
  }

  function formatOffset(date, zone) {
    try {
      const formatter = getFormatter("en-US", {
        timeZone: zone,
        timeZoneName: "longOffset",
      });
      const part = formatter.formatToParts(date).find((item) => item.type === "timeZoneName");
      if (!part || part.value === "GMT") return "UTC+0";
      return part.value.replace("GMT", "UTC");
    } catch (_) {
      return "UTC";
    }
  }

  /** Offset used by the picker, which only knows a zone id (no date). */
  const offsetCache = { at: 0, values: new Map() };
  function offsetForZone(zone) {
    const now = Date.now();
    if (now - offsetCache.at > 10 * 60 * 1000) {
      offsetCache.values.clear();
      offsetCache.at = now;
    }
    if (!offsetCache.values.has(zone)) {
      offsetCache.values.set(zone, formatOffset(new Date(now), zone));
    }
    return offsetCache.values.get(zone);
  }

  function placeFor(zone) {
    return recordFor(zone);
  }

  function formatLongDate(date, zone) {
    return getFormatter("en-US", {
      timeZone: zone,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function formatShortDateTime(date, zone) {
    return getFormatter("en-US", {
      timeZone: zone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  }

  function formatDateTimeLocal(date, zone) {
    const parts = partsFor(date, zone);
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function zonedDateTimeToUTC(localDateTime, zone) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localDateTime || "");
    if (!match) return null;

    const [, y, m, d, h, min] = match.map(Number);
    const desired = Date.UTC(y, m - 1, d, h, min, 0);
    let guess = desired;

    // Offset correction: format the guess in the chosen IANA zone and move it
    // toward the wall-clock time selected in the datetime-local control.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const actual = partsFor(new Date(guess), zone);
      const actualWallTime = Date.UTC(
        Number(actual.year),
        Number(actual.month) - 1,
        Number(actual.day),
        Number(actual.hour),
        Number(actual.minute),
        0
      );
      const adjustment = desired - actualWallTime;
      if (adjustment === 0) break;
      guess += adjustment;
    }
    return new Date(guess);
  }

  function zoneDateStamp(date, zone) {
    const parts = partsFor(date, zone);
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  }

  function formatNumber(value, maximumFractionDigits = 0) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits,
      minimumFractionDigits: 0,
    }).format(value);
  }

  function formatTimerMilliseconds(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  function formatStopwatchMilliseconds(milliseconds) {
    const centiseconds = Math.floor(milliseconds / 10);
    const minutes = Math.floor(centiseconds / 6000);
    const seconds = Math.floor((centiseconds % 6000) / 100);
    const hundredths = centiseconds % 100;
    return `${pad(minutes)}:${pad(seconds)}<span>.${pad(hundredths)}</span>`;
  }

  function formatDurationWords(totalSeconds) {
    const values = [
      ["day", Math.floor(totalSeconds / 86400)],
      ["hour", Math.floor((totalSeconds % 86400) / 3600)],
      ["minute", Math.floor((totalSeconds % 3600) / 60)],
      ["second", totalSeconds % 60],
    ];
    const meaningful = values.filter(([, amount]) => amount > 0);
    if (!meaningful.length) return "0 seconds";
    return meaningful
      .slice(0, 3)
      .map(([unit, amount]) => `${formatNumber(amount)} ${unit}${amount === 1 ? "" : "s"}`)
      .join(", ");
  }

  function notify(message, icon = "✓") {
    elements.toastMessage.textContent = message;
    $(".toast-icon", elements.toast).textContent = icon;
    elements.toast.classList.add("show");
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => elements.toast.classList.remove("show"), 3400);
  }

  // Local clock ------------------------------------------------------------
  function updateLiveTime() {
    const now = new Date();
    const parts = partsFor(now, state.homeZone);
    const hour = Number(parts.hour);
    const minute = Number(parts.minute);
    const second = Number(parts.second);
    const home = placeFor(state.homeZone);
    const offset = formatOffset(now, state.homeZone);
    const daySeconds = hour * 3600 + minute * 60 + second;
    const progress = (daySeconds / 86400) * 100;
    const untilMidnight = 86400 - daySeconds;

    elements.localHours.textContent = pad(hour);
    elements.localMinutes.textContent = pad(minute);
    elements.localSeconds.textContent = pad(second);
    elements.localDate.textContent = formatLongDate(now, state.homeZone);
    elements.localZoneName.textContent = `${home.label} · ${offset} · ${home.zone}`;
    elements.topTimeZone.textContent = home.label;
    elements.topTimeZone.title = `${home.zone} · ${offset}`;
    elements.homeCityLabel.textContent = home.city;
    if (elements.homeCountryLabel) {
      elements.homeCountryLabel.textContent = home.country || "Your zone";
      elements.homeCountryLabel.hidden = !home.country;
    }
    elements.utcOffset.textContent = `${home.country ? `${home.country} · ` : ""}${offset}`;
    elements.calculatorZone.textContent = `Calculations in ${home.city} time`;

    elements.todayLabel.textContent = getFormatter("en-US", {
      timeZone: state.homeZone,
      weekday: "long",
      month: "long",
      day: "numeric",
    })
      .format(now)
      .toUpperCase();

    const hourRotation = ((hour % 12) + minute / 60) * 30;
    const minuteRotation = (minute + second / 60) * 6;
    const secondRotation = second * 6;
    elements.hourHand.style.transform = `rotate(${hourRotation}deg)`;
    elements.minuteHand.style.transform = `rotate(${minuteRotation}deg)`;
    elements.secondHand.style.transform = `rotate(${secondRotation}deg)`;

    elements.dayProgress.style.width = `${Math.max(2, progress)}%`;
    elements.midnightProgress.style.width = `${progress}%`;
    elements.midnightCountdown.textContent = formatTimerMilliseconds(untilMidnight * 1000);
    elements.sunsetCopy.textContent = `${Math.round(progress)}% through today`;
    if (elements.sunIcon) {
      const live = state.weather && state.weather.ok ? state.weather : null;
      const symbol = live && live.symbol ? live.symbol : hour >= 6 && hour < 19 ? "☀" : "☾";
      elements.sunIcon.textContent = symbol;
      elements.sunIcon.title = live && live.condition ? `${live.condition} in ${home.city}` : "Local sky";
    }
    if (hour < 6) elements.dayProgressLabel.textContent = "A new day is waking up";
    else if (hour < 12) elements.dayProgressLabel.textContent = "Your morning is underway";
    else if (hour < 18) elements.dayProgressLabel.textContent = "The day is in motion";
    else elements.dayProgressLabel.textContent = "The day is winding down";

    state.localHour = hour;
    state.localMinute = minute;
    document.title = `${pad(hour)}:${pad(minute)} · ${home.city} — Tempo`;

    updateWorldClockTimes(now);
    // Every half minute is enough for a palette that follows the sun, and it
    // keeps a sunrise or sunset switch from waiting on the next hour.
    if (now.getSeconds() % 30 === 0) applyTheme();
  }

  // World clocks -----------------------------------------------------------
  function worldDayLabel(now, zone) {
    const difference = Math.round((zoneDateStamp(now, zone) - zoneDateStamp(now, state.homeZone)) / 86400000);
    if (difference === 0) return { text: "SAME DAY", className: "same-day" };
    if (difference > 0) return { text: difference === 1 ? "TOMORROW" : `+${difference} DAYS`, className: "day-ahead" };
    return { text: difference === -1 ? "YESTERDAY" : `${difference} DAYS`, className: "day-behind" };
  }

  function worldClockCard(zone, index, now) {
    const record = placeFor(zone);
    const clock = timeParts12(now, zone);
    const day = worldDayLabel(now, zone);
    const isHome = zone === state.homeZone;
    const countries = record.countries.length > 1 ? ` Also ${record.countries.slice(1).map((c) => c.name).join(", ")}.` : "";
    const legacyNote =
      record.legacy && record.zone !== record.id
        ? ` Tempo reads your browser’s “${record.id}” as the modern zone ${record.zone}.`
        : "";
    return `
      <article class="world-card color-${index % 6}${isHome ? " is-home" : ""}" data-world-zone="${escapeHTML(zone)}" data-legacy="${String(
        record.legacy && record.zone !== record.id
      )}">
        <div class="world-card-top">
          <div class="city-label">
            <span class="city-color-dot" aria-hidden="true"></span>
            <strong class="city-place" title="${escapeHTML(`${record.label} — ${record.zone}${countries}${legacyNote}`)}">
              <span class="city-country">${escapeHTML(record.country || record.zone.split("/")[0])}</span> · <span class="city-name">${escapeHTML(record.city)}</span>
            </strong>
          </div>
          <button class="remove-city" type="button" data-remove-city="${escapeHTML(zone)}" aria-label="Remove ${escapeHTML(record.city)}">×</button>
        </div>
        ${isHome ? '<span class="world-home-flag">HOME</span>' : ""}
        <div class="world-time"><span class="world-clock-value">${escapeHTML(`${clock.hour}:${clock.minute}`)}</span><span class="world-period">${escapeHTML((clock.dayPeriod || "").toUpperCase())}</span></div>
        <div class="world-card-bottom"><span class="world-day-label ${day.className}">${day.text}</span><span class="world-offset">${escapeHTML(formatOffset(now, zone))}</span></div>
      </article>
    `;
  }

  function renderWorldClocks() {
    const now = new Date();
    elements.worldGrid.innerHTML = state.worldZones.map((zone, index) => worldClockCard(zone, index, now)).join("");
    if (elements.worldCount) {
      elements.worldCount.textContent = `${state.worldZones.length} of ${MAX_WORLD_CLOCKS} clocks`;
    }
  }

  function updateWorldClockTimes(now = new Date()) {
    $$("[data-world-zone]").forEach((card) => {
      const zone = card.dataset.worldZone;
      if (!zone || !isValidZone(zone)) return;
      const clock = timeParts12(now, zone);
      const day = worldDayLabel(now, zone);
      $(".world-clock-value", card).textContent = `${clock.hour}:${clock.minute}`;
      $(".world-period", card).textContent = (clock.dayPeriod || "").toUpperCase();
      const label = $(".world-day-label", card);
      label.textContent = day.text;
      label.className = `world-day-label ${day.className}`;
      $(".world-offset", card).textContent = formatOffset(now, zone);
    });
  }

  function persistWorldZones() {
    try {
      localStorage.setItem(keys.worldZones, JSON.stringify(state.worldZones));
    } catch (_) {
      // Saving is a convenience, not a requirement for using the dashboard.
    }
  }

  function addWorldZone(zone) {
    const id = usableZone(zone);
    if (!isValidZone(id)) return false;
    if (state.worldZones.includes(id)) {
      notify("That clock is already on your board.", "!");
      return false;
    }
    if (state.worldZones.length >= MAX_WORLD_CLOCKS) {
      notify(`Keep up to ${MAX_WORLD_CLOCKS} clocks — remove one first.`, "!");
      return false;
    }
    state.worldZones.push(id);
    persistWorldZones();
    renderWorldClocks();
    notify(`${placeLabel(id)} added to your clocks.`);
    return true;
  }

  function removeWorldZone(zone) {
    state.worldZones = state.worldZones.filter((item) => item !== zone);
    persistWorldZones();
    renderWorldClocks();
    notify(`${placeLabel(zone)} removed.`);
  }

  // Theme (Auto / Light / Dark) -------------------------------------------
  let picker = null;

  function applyTheme() {
    if (!Number.isFinite(state.localHour)) {
      const parts = partsFor(new Date(), state.homeZone);
      state.localHour = Number(parts.hour);
      state.localMinute = Number(parts.minute);
    }
    const result = resolveAppearance({
      mode: state.themeMode,
      hour: state.localHour,
      minute: state.localMinute,
      weather: state.weather && state.weather.ok ? state.weather : null,
      now: Date.now(),
    });
    const applied = applyAppearance(document, { mode: state.themeMode, appearance: result.appearance });
    state.appearance = applied.appearance;
    document.body.dataset.weather = state.weather && state.weather.ok ? state.weather.mood || "unknown" : "none";

    if (elements.themeCaption) {
      const info = APPEARANCES[result.appearance] || APPEARANCES.light;
      const place = placeLabel(state.homeZone).split(" · ").pop();
      const weatherLine =
        state.weather && state.weather.ok
          ? `${state.weather.symbol} ${state.weather.condition} ${formatNumber(state.weather.temperature, 0)}${
              state.weather.temperatureUnit === "°F" ? "°F" : "°C"
            }`
          : "no live weather";
      const detail = state.themeMode === "auto" ? `Auto · ${place}` : "fixed by you";
      elements.themeCaption.innerHTML =
        `<b>${escapeHTML(`${info.icon} ${info.label}`)}</b><span>${escapeHTML(detail)}</span>` +
        `<small>${escapeHTML(weatherLine)}</small>`;
      elements.themeCaption.title = themeCaption({
        mode: state.themeMode,
        appearance: result.appearance,
        place,
        reason: result.reason,
      });
    }
    $$(".theme-option", elements.themeSwitch || document).forEach((button) => {
      const active = button.dataset.themeMode === state.themeMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-checked", String(active));
    });
    if (picker && picker.isOpen) picker.refresh();
  }

  function setThemeMode(mode) {
    state.themeMode = mode;
    writeMode(mode);
    applyTheme();
    const info = APPEARANCES[state.appearance] || APPEARANCES.light;
    notify(
      mode === "auto"
        ? `Auto is back on — ${info.label.toLowerCase()} from your time and weather.`
        : `${mode === "dark" ? "Dark" : "Light"} theme stays until you switch back to Auto.`
    );
  }

  // Weather ----------------------------------------------------------------
  const weatherCard = createWeatherCard({
    elements: {
      card: $("#weather-card"),
      temp: $("#weather-temp"),
      unit: $("#weather-unit"),
      symbol: $("#weather-symbol"),
      condition: $("#weather-condition"),
      place: $("#weather-place"),
      source: $("#weather-source"),
      sunrise: $("#weather-sunrise"),
      sunset: $("#weather-sunset"),
      daylight: $("#weather-daylight"),
      details: $("#weather-details"),
      updated: $("#weather-updated"),
      useLocation: $("#weather-use-location"),
      retry: $("#weather-retry"),
      units: $("#weather-units"),
    },
    getHomeZone: () => state.homeZone,
    notify,
    onSnapshot: (snapshot) => {
      state.weather = snapshot;
      applyTheme();
      updateLiveTime();
    },
  });

  // Zone picker -------------------------------------------------------------
  function openPicker(mode) {
    const isAdding = mode === "add";
    picker.open({
      mode,
      homeZone: state.homeZone,
      selectedZone: isAdding ? firstUnaddedSuggested() : state.homeZone,
      title: isAdding ? "Add a world clock" : "Set your home time zone",
      eyebrow: isAdding ? "STAY IN SYNC" : "MAKE IT YOURS",
      copy: isAdding
        ? `Every zone your browser knows, grouped by country. Search any city — up to ${MAX_WORLD_CLOCKS} clocks at a time.`
        : "Your home zone drives the clock, the day progress, the weather and the Auto theme.",
      submitLabel: isAdding ? "Add this clock" : "Save home zone",
    });
  }

  function firstUnaddedSuggested() {
    const found = SUGGESTED_ZONES.map((zone) => usableZone(zone)).find((zone) => !state.worldZones.includes(zone));
    return found || state.homeZone;
  }

  function saveHomeZone(zone) {
    const id = usableZone(zone);
    if (!isValidZone(id)) return;
    state.homeZone = id;
    try {
      localStorage.setItem(keys.homeZone, id);
    } catch (_) {
      // Time still changes for the current visit when storage is unavailable.
    }
    setDefaultDurationInputs();
    calculateDuration();
    updateLiveTime();
    renderWorldClocks();
    applyTheme();
    // Weather follows the home zone unless the visitor opted into GPS.
    weatherCard.followHomeZone();
    notify(`${placeLabel(id)} is now your home time.`);
  }

  // Timer ------------------------------------------------------------------
  function readTimerInputs() {
    const minutes = Math.max(0, Math.min(999, Number.parseInt(elements.timerMinutes.value, 10) || 0));
    const seconds = Math.max(0, Math.min(59, Number.parseInt(elements.timerSeconds.value, 10) || 0));
    elements.timerMinutes.value = minutes;
    elements.timerSeconds.value = seconds;
    return (minutes * 60 + seconds) * 1000;
  }

  function timerSecondsInputState(disabled) {
    elements.timerMinutes.disabled = disabled;
    elements.timerSeconds.disabled = disabled;
    $$(".preset-button").forEach((button) => {
      button.disabled = disabled;
    });
  }

  function renderTimer() {
    const { original, remaining, running } = state.timer;
    const percentage = original > 0 ? Math.max(0, Math.min(1, remaining / original)) : 0;
    const degrees = percentage * 360;
    const foreground = remaining === 0 && original > 0 ? "var(--coral)" : "var(--violet)";

    elements.timerDisplay.textContent = formatTimerMilliseconds(remaining);
    elements.timerRing.style.background = `conic-gradient(${foreground} 0deg ${degrees}deg, var(--canvas-soft) ${degrees}deg 360deg)`;
    elements.timerStart.innerHTML = running
      ? '<span class="play-icon">Ⅱ</span> Pause timer'
      : `<span class="play-icon">▶</span> ${remaining > 0 && remaining !== original ? "Resume timer" : "Start timer"}`;

    let status = "READY";
    if (running) status = "RUNNING";
    else if (remaining > 0 && remaining !== original) status = "PAUSED";
    else if (remaining === 0 && original > 0) status = "DONE";
    elements.timerStatus.textContent = status;
    elements.timerStatus.classList.toggle("running", running);
    timerSecondsInputState(running);
  }

  function setTimerFromInputs() {
    if (state.timer.running) return;
    const duration = readTimerInputs();
    state.timer.original = duration;
    state.timer.remaining = duration;
    $$(".preset-button").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.seconds) * 1000 === duration);
    });
    renderTimer();
  }

  function clearTimerInterval() {
    if (state.timer.interval) {
      window.clearInterval(state.timer.interval);
      state.timer.interval = null;
    }
  }

  function beep() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const audio = new AudioContextClass();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.025, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.35);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.36);
    } catch (_) {
      // A toast still tells the user the countdown finished if audio is blocked.
    }
  }

  function tickTimer() {
    state.timer.remaining = Math.max(0, state.timer.endAt - Date.now());
    if (state.timer.remaining <= 0) {
      state.timer.running = false;
      clearTimerInterval();
      renderTimer();
      beep();
      notify("Time's up — nice work.", "✦");
      return;
    }
    renderTimer();
  }

  function toggleTimer() {
    if (state.timer.running) {
      state.timer.remaining = Math.max(0, state.timer.endAt - Date.now());
      state.timer.running = false;
      clearTimerInterval();
      renderTimer();
      return;
    }
    if (state.timer.remaining <= 0) setTimerFromInputs();
    if (state.timer.remaining <= 0) {
      notify("Set a timer longer than zero first.", "!");
      return;
    }
    state.timer.running = true;
    state.timer.endAt = Date.now() + state.timer.remaining;
    clearTimerInterval();
    state.timer.interval = window.setInterval(tickTimer, 100);
    renderTimer();
  }

  function resetTimer() {
    clearTimerInterval();
    state.timer.running = false;
    state.timer.remaining = readTimerInputs();
    state.timer.original = state.timer.remaining;
    renderTimer();
  }

  // Stopwatch --------------------------------------------------------------
  function currentStopwatchElapsed() {
    return state.stopwatch.running
      ? state.stopwatch.elapsed + (Date.now() - state.stopwatch.startedAt)
      : state.stopwatch.elapsed;
  }

  function renderStopwatch() {
    const elapsed = currentStopwatchElapsed();
    elements.stopwatchDisplay.innerHTML = formatStopwatchMilliseconds(elapsed);
    elements.stopwatchStart.innerHTML = state.stopwatch.running
      ? '<span class="play-icon">Ⅱ</span> Pause'
      : `<span class="play-icon">▶</span> ${elapsed > 0 ? "Resume" : "Start"}`;
    elements.stopwatchStatus.textContent = state.stopwatch.running ? "RUNNING" : elapsed > 0 ? "PAUSED" : "STOPPED";
    elements.stopwatchStatus.classList.toggle("running", state.stopwatch.running);
    elements.stopwatchStatus.classList.toggle("neutral", !state.stopwatch.running);
    elements.lapButton.disabled = !state.stopwatch.running;
    elements.lapCount.textContent = state.stopwatch.laps.length ? String(state.stopwatch.laps.length).padStart(2, "0") : "—";
  }

  function renderLaps() {
    if (!state.stopwatch.laps.length) {
      elements.lapsList.innerHTML = '<li class="empty-lap">Your laps will show up here.</li>';
      return;
    }
    elements.lapsList.innerHTML = [...state.stopwatch.laps]
      .reverse()
      .map(
        (lap, index) => `
          <li>
            <span>Lap ${String(state.stopwatch.laps.length - index).padStart(2, "0")}</span>
            <span>${formatStopwatchMilliseconds(lap.elapsed).replace(/<[^>]+>/g, "")}</span>
            <span>+${formatStopwatchMilliseconds(lap.split).replace(/<[^>]+>/g, "")}</span>
          </li>`
      )
      .join("");
  }

  function clearStopwatchInterval() {
    if (state.stopwatch.interval) {
      window.clearInterval(state.stopwatch.interval);
      state.stopwatch.interval = null;
    }
  }

  function toggleStopwatch() {
    if (state.stopwatch.running) {
      state.stopwatch.elapsed = currentStopwatchElapsed();
      state.stopwatch.running = false;
      clearStopwatchInterval();
      renderStopwatch();
      return;
    }
    state.stopwatch.startedAt = Date.now();
    state.stopwatch.lastLapAt = state.stopwatch.elapsed;
    state.stopwatch.running = true;
    clearStopwatchInterval();
    state.stopwatch.interval = window.setInterval(renderStopwatch, 35);
    renderStopwatch();
  }

  function resetStopwatch() {
    clearStopwatchInterval();
    state.stopwatch.elapsed = 0;
    state.stopwatch.startedAt = 0;
    state.stopwatch.running = false;
    state.stopwatch.laps = [];
    state.stopwatch.lastLapAt = 0;
    renderStopwatch();
    renderLaps();
  }

  function addLap() {
    if (!state.stopwatch.running) return;
    const elapsed = currentStopwatchElapsed();
    const split = elapsed - state.stopwatch.lastLapAt;
    state.stopwatch.laps.push({ elapsed, split });
    state.stopwatch.lastLapAt = elapsed;
    renderLaps();
    renderStopwatch();
  }

  // Time calculations ------------------------------------------------------
  function setDefaultDurationInputs() {
    const now = new Date();
    const homeParts = partsFor(now, state.homeZone);
    const futureCalendarDate = new Date(
      Date.UTC(Number(homeParts.year), Number(homeParts.month) - 1, Number(homeParts.day) + 15)
    );
    elements.startDatetime.value = formatDateTimeLocal(now, state.homeZone);
    elements.endDatetime.value = `${futureCalendarDate.getUTCFullYear()}-${pad(
      futureCalendarDate.getUTCMonth() + 1
    )}-${pad(futureCalendarDate.getUTCDate())}T02:00`;
  }

  function calculateDuration() {
    const start = zonedDateTimeToUTC(elements.startDatetime.value, state.homeZone);
    const end = zonedDateTimeToUTC(elements.endDatetime.value, state.homeZone);
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      elements.durationWords.textContent = "Choose two valid moments";
      elements.durationContext.textContent = "Both date and time fields are needed.";
      elements.saveCalculation.disabled = true;
      state.lastCalculation = null;
      return;
    }

    const difference = end.getTime() - start.getTime();
    const absoluteMilliseconds = Math.abs(difference);
    const totalWholeSeconds = Math.floor(absoluteMilliseconds / 1000);
    const totalWholeMinutes = Math.floor(absoluteMilliseconds / 60000);
    const totalHoursExact = absoluteMilliseconds / 3600000;
    const totalDaysExact = absoluteMilliseconds / 86400000;
    const direction = difference < 0 ? "back" : difference > 0 ? "ahead" : "apart";
    const words = formatDurationWords(totalWholeSeconds);
    const startLabel = formatShortDateTime(start, state.homeZone);
    const endLabel = formatShortDateTime(end, state.homeZone);

    elements.durationWords.textContent =
      difference < 0 ? `${words} back in time` : difference === 0 ? "The same exact moment" : words;
    elements.durationContext.textContent =
      difference === 0
        ? "Both fields point to the same moment."
        : `${formatNumber(totalHoursExact, 2)} total hours from ${startLabel} to ${endLabel}.`;
    elements.totalDays.textContent = formatNumber(totalDaysExact, 2);
    elements.totalHours.textContent = formatNumber(totalHoursExact, 2);
    elements.totalMinutes.textContent = formatNumber(totalWholeMinutes);
    elements.totalSeconds.textContent = formatNumber(totalWholeSeconds);
    elements.saveCalculation.disabled = false;

    state.lastCalculation = {
      id: Date.now(),
      words: difference === 0 ? "Same moment" : `${words} ${direction}`,
      details: `${formatNumber(totalHoursExact, 2)} hours · ${startLabel} → ${endLabel}`,
      zone: placeFor(state.homeZone).city,
    };
  }

  const secondsPerUnit = {
    weeks: 604800,
    days: 86400,
    hours: 3600,
    minutes: 60,
    seconds: 1,
  };

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

  function singular(value, unit) {
    return Math.abs(value) === 1 ? unit.slice(0, -1) : unit;
  }

  function updateConverter() {
    const raw = Number.parseFloat(elements.convertValue.value);
    const value = Number.isFinite(raw) && raw >= 0 ? raw : 0;
    const unit = elements.convertUnit.value;
    const seconds = value * (secondsPerUnit[unit] || 1);
    const targets = conversionTargets(unit);
    elements.conversionResults.innerHTML = targets
      .map((target) => {
        const converted = seconds / secondsPerUnit[target];
        const decimals = Number.isInteger(converted) ? 0 : 3;
        return `<div class="conversion-result"><strong>${formatNumber(converted, decimals)}</strong><span>${escapeHTML(
          target.toUpperCase()
        )}</span></div>`;
      })
      .join("");

    const readableTargets = targets.map((target) => {
      const converted = seconds / secondsPerUnit[target];
      return `${formatNumber(converted, Number.isInteger(converted) ? 0 : 3)} ${singular(converted, target)}`;
    });
    elements.conversionHint.textContent = `${formatNumber(value, Number.isInteger(value) ? 0 : 3)} ${singular(
      value,
      unit
    )} is ${readableTargets.join(", ").replace(/, ([^,]*)$/, ", and $1")}.`;
  }

  function persistSavedCalculations() {
    try {
      localStorage.setItem(keys.saved, JSON.stringify(state.savedCalculations));
    } catch (_) {
      // Showing a result remains useful when private browsing blocks storage.
    }
  }

  function renderSavedCalculations() {
    if (!Array.isArray(state.savedCalculations) || !state.savedCalculations.length) {
      elements.savedList.innerHTML = '<p class="empty-saved">Your useful answers can live here for later.</p>';
      elements.clearSaved.hidden = true;
      return;
    }
    elements.clearSaved.hidden = false;
    elements.savedList.innerHTML = state.savedCalculations
      .map(
        (calculation) => `
          <article class="saved-item">
            <strong>${escapeHTML(calculation.words)}</strong>
            <span>${escapeHTML(calculation.details)}</span>
            <button type="button" data-delete-saved="${escapeHTML(calculation.id)}" aria-label="Remove saved calculation">×</button>
          </article>`
      )
      .join("");
  }

  function saveCalculation() {
    if (!state.lastCalculation) return;
    state.savedCalculations.unshift({
      ...state.lastCalculation,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    });
    state.savedCalculations = state.savedCalculations.slice(0, 8);
    persistSavedCalculations();
    renderSavedCalculations();
    notify("Calculation saved for later.", "✦");
  }

  // Navigation and events --------------------------------------------------
  function closeMobileNav() {
    elements.mobileNav.classList.remove("open");
    elements.mobileNavBackdrop.classList.remove("open");
  }

  function setupNavigationObserver() {
    if (!("IntersectionObserver" in window)) return;
    const sections = ["now", "world", "tools", "calculator"].map((id) => document.getElementById(id));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const id = visible.target.id;
        $$("[data-nav]").forEach((link) => link.classList.toggle("active", link.dataset.nav === id));
      },
      { rootMargin: "-22% 0px -60% 0px", threshold: [0.01, 0.2, 0.4] }
    );
    sections.forEach((section) => observer.observe(section));
  }

  function bindEvents() {
    elements.changeZoneButton.addEventListener("click", () => openPicker("home"));
    elements.quickZoneButton.addEventListener("click", () => openPicker("home"));
    elements.addCityButton.addEventListener("click", () => {
      if (state.worldZones.length >= MAX_WORLD_CLOCKS) {
        notify(`You can keep up to ${MAX_WORLD_CLOCKS} world clocks at once.`, "!");
        return;
      }
      openPicker("add");
    });

    elements.worldGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-city]");
      if (!button) return;
      removeWorldZone(button.dataset.removeCity);
    });

    if (elements.themeSwitch) {
      elements.themeSwitch.addEventListener("click", (event) => {
        const button = event.target.closest("[data-theme-mode]");
        if (!button) return;
        const mode = button.dataset.themeMode;
        if (mode === state.themeMode) return;
        setThemeMode(mode);
      });
      // Roving tab index keeps the segmented control a single stop.
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

    elements.timerMinutes.addEventListener("input", setTimerFromInputs);
    elements.timerSeconds.addEventListener("input", setTimerFromInputs);
    $$(".preset-button").forEach((button) => {
      button.addEventListener("click", () => {
        if (state.timer.running) return;
        const totalSeconds = Number(button.dataset.seconds);
        elements.timerMinutes.value = Math.floor(totalSeconds / 60);
        elements.timerSeconds.value = totalSeconds % 60;
        setTimerFromInputs();
      });
    });
    elements.timerStart.addEventListener("click", toggleTimer);
    elements.timerReset.addEventListener("click", resetTimer);

    elements.stopwatchStart.addEventListener("click", toggleStopwatch);
    elements.stopwatchReset.addEventListener("click", resetStopwatch);
    elements.lapButton.addEventListener("click", addLap);

    elements.durationForm.addEventListener("submit", (event) => {
      event.preventDefault();
      calculateDuration();
      notify("Here’s your time answer.");
    });
    elements.startDatetime.addEventListener("change", calculateDuration);
    elements.endDatetime.addEventListener("change", calculateDuration);
    elements.saveCalculation.addEventListener("click", saveCalculation);
    elements.savedList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-saved]");
      if (!button) return;
      state.savedCalculations = state.savedCalculations.filter((item) => item.id !== button.dataset.deleteSaved);
      persistSavedCalculations();
      renderSavedCalculations();
    });
    elements.clearSaved.addEventListener("click", () => {
      state.savedCalculations = [];
      persistSavedCalculations();
      renderSavedCalculations();
      notify("Saved calculations cleared.");
    });
    elements.convertValue.addEventListener("input", updateConverter);
    elements.convertUnit.addEventListener("change", updateConverter);

    elements.mobileMenuButton.addEventListener("click", () => {
      elements.mobileNav.classList.toggle("open");
      elements.mobileNavBackdrop.classList.toggle("open");
    });
    elements.mobileNavBackdrop.addEventListener("click", closeMobileNav);
    $$(".mobile-nav a").forEach((link) => link.addEventListener("click", closeMobileNav));

    window.addEventListener("online", () => weatherCard.refresh({ force: true }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        updateLiveTime();
        weatherCard.refresh();
        applyTheme();
      }
    });
    // DST shifts and daylight boundaries both move the palette.
    window.setInterval(applyTheme, 30 * 1000);
  }

  function initialise() {
    if (!Array.isArray(state.savedCalculations)) state.savedCalculations = [];
    if (!Array.isArray(state.worldZones) || !state.worldZones.length) state.worldZones = [...defaultWorldZones];

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
      },
      callbacks: {
        formatOffset: (zone) => offsetForZone(zone),
        isAdded: (zone) => state.worldZones.includes(zone),
        onPick: (zone, mode) => {
          if (mode === "add") return addWorldZone(zone);
          saveHomeZone(zone);
          return true;
        },
        onBlocked: (zone) => {
          notify(`${placeLabel(zone)} is already on your board.`, "!");
        },
      },
    });

    // Migrate a board saved by an older browser (or an older Tempo) so the
    // stored ids are the modern ones too.
    const storedZones = getStoredJSON(keys.worldZones, null);
    if (Array.isArray(storedZones) && storedZones.some((zone, i) => zone !== state.worldZones[i])) persistWorldZones();

    elements.footerYear.textContent = `© ${new Date().getFullYear()} Tempo`;
    applyTheme();
    setDefaultDurationInputs();
    renderWorldClocks();
    renderTimer();
    renderStopwatch();
    renderLaps();
    updateConverter();
    calculateDuration();
    renderSavedCalculations();
    bindEvents();
    setupNavigationObserver();
    updateLiveTime();
    window.setInterval(updateLiveTime, 1000);
    weatherCard.init();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise);
  else initialise();
})();
