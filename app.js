/**
 * Tempo — the dashboard shell.
 *
 * **One page, eight sections.** Tempo used to be six routed pages behind a
 * sidebar: everything worked, but reading two facts took two clicks and a
 * repaint. Now the whole dashboard is a single scroll — Right now, Weather,
 * Forecast, World clocks, Timer & alarm, Old clock, Focus and Time calculator
 * — and the sidebar reports where you are instead of deciding what you may
 * see (see src/router.js). Old `#/timer` links still work: they scroll.
 *
 * Underneath, six ideas do the work:
 *   • places      src/places.js        one model for zones, cities and GPS fixes
 *   • location    src/location.js      a real fix, named by a real gazetteer
 *   • weather     src/weather.js       Open-Meteo, key-less and failure-tolerant
 *   • forecast    src/forecast.js      the next 24 hours and the next 7 days
 *   • alarms      src/alarm-sounds.js  16 synthesised sounds + your own music
 *   • theme       src/theme.js         Auto / Light / Dark, keyed to the live sky
 */

import { createCityPicker } from "./src/city-picker.js";
import { createClockFace } from "./src/clock-face.js";
import { createOldClock } from "./src/old-clock.js";
import { createWorldBoard } from "./src/world-board.js";
import { createTimer } from "./src/timer.js";
import { createStopwatch } from "./src/stopwatch.js";
import { createCalculator } from "./src/calculator.js";
import { createWeatherCard } from "./src/weather-card.js";
import { createForecast } from "./src/forecast.js";
import { createScrollNav } from "./src/router.js";
import { createToaster, $, $$, escapeHTML, flatten, pad } from "./src/ui.js";
import { APPEARANCES, applyAppearance, readMode, resolveAppearance, themeCaption, writeMode } from "./src/theme.js";
import { effectiveMood } from "./src/weather.js";
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
  placeRecord,
  placeZone,
  sunNote,
  zoneOffsetLabel,
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
    textScale: "tempo-text-scale",
  };

  /**
   * The headline above the scroll changes with the section you are reading,
   * which is what makes one long page still feel like it has chapters.
   */
  const PAGE_TITLES = {
    now: "Make every moment count.",
    weather: "The sky, where you actually are.",
    forecast: "What the week is planning.",
    clocks: "Around the world.",
    timer: "A timer that will not be missed.",
    clock: "A slower kind of clock.",
    focus: "One thing at a time.",
    calculator: "Time, without the mental maths.",
  };

  const SECTION_EYEBROWS = {
    now: "YOUR TIME, RIGHT NOW",
    weather: "RIGHT NOW, OUTSIDE",
    forecast: "THE WEEK AHEAD",
    clocks: "STAY IN SYNC",
    timer: "COUNTDOWN",
    clock: "A SLOWER KIND OF CLOCK",
    focus: "ONE THING AT A TIME",
    calculator: "NO MENTAL MATH REQUIRED",
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
    appearance: "light",
    weather: null,
    lastFix: null,
    localHour: null,
    localMinute: 0,
    textScale: Number(localStorage.getItem(keys.textScale)) || 1.15,
  };

  if (!Number.isFinite(state.textScale) || state.textScale < 1 || state.textScale > 1.6) state.textScale = 1.15;

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

    popularCities: $("#popular-cities"),
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
    textSizeSwitch: $("#text-size-switch"),

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
      const live = state.weather && state.weather.ok ? state.weather : null;
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

    board.update(now);
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
      weather: state.weather && state.weather.ok ? state.weather : null,
      now: Date.now(),
    });
    const applied = applyAppearance(document, { mode: state.themeMode, appearance: result.appearance });
    state.appearance = applied.appearance;
    document.body.dataset.weather = state.weather && state.weather.ok ? effectiveMood(state.weather) : "none";

    if (elements.themeCaption) {
      const info = APPEARANCES[result.appearance] || APPEARANCES.light;
      const place = homePlace();
      const weatherLine =
        state.weather && state.weather.ok
          ? `${state.weather.symbol} ${state.weather.condition} ${Math.round(state.weather.temperature)}${
              state.weather.temperatureUnit || "°C"
            }`
          : "no live weather";
      const detail = state.themeMode === "auto" ? `Auto · ${place.city}` : "fixed by you";
      elements.themeCaption.innerHTML =
        `<b>${escapeHTML(`${info.icon} ${info.label}`)}</b><span>${escapeHTML(detail)}</span>` +
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

  /* -------------------------------------------------------------- text size */

  function applyTextScale(scale, { persist = true } = {}) {
    state.textScale = Number(scale) || 1;
    document.documentElement.style.setProperty("--type-scale", String(state.textScale));
    if (persist) {
      try {
        localStorage.setItem(keys.textScale, String(state.textScale));
      } catch (_) {
        /* the size lasts for this visit only */
      }
    }
    $$("[data-text-size]", elements.textSizeSwitch || document).forEach((button) => {
      const active = Math.abs(Number(button.dataset.textSize) - state.textScale) < 0.001;
      button.classList.toggle("active", active);
      button.setAttribute("aria-checked", String(active));
    });
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
      applyTheme();
      updateNotes();
      updateLiveTime();
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
      const snapshot = state.weather;
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

  function oldClockTick(now) {
    if (!oldClockVisible || !oldClock) return;
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
    updateLiveTime();
    board.render();
    renderPopularCities();
    applyTheme();
    calculator.refreshZone();
    updateNotes();
    if (weather) weatherCard.followHomeZone();
    if (oldClock && (!oldClock.placeId || oldClock.placeId === record.id)) oldClock.setPlace(record.id);
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
      { id: "weather", page: $("#page-weather"), title: "Weather" },
      { id: "forecast", page: $("#page-forecast"), title: "Forecast" },
      { id: "clocks", page: $("#page-clocks"), title: "World clocks" },
      { id: "timer", page: $("#page-timer"), title: "Timer & alarm" },
      { id: "clock", page: $("#page-clock"), title: "Old clock" },
      { id: "focus", page: $("#page-focus"), title: "Focus" },
      { id: "calculator", page: $("#page-calculator"), title: "Time calculator" },
    ],
    onChange: (section) => {
      if (elements.pageTitle) elements.pageTitle.textContent = PAGE_TITLES[section.id] || PAGE_TITLES.now;
      if (elements.todayLabel && SECTION_EYEBROWS[section.id]) {
        elements.todayLabel.dataset.section = section.id;
      }
      closeMobileNav();

      oldClockVisible = section.id === "clock";
      if (oldClockVisible) oldClock.start();
      else if (oldClock) oldClock.stop();

      if (section.id === "timer") timer.sync();
      if (section.id === "focus") stopwatch.sync();
      if (section.id === "clocks") board.render();
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

    if (elements.textSizeSwitch) {
      elements.textSizeSwitch.addEventListener("click", (event) => {
        const button = event.target.closest("[data-text-size]");
        if (!button) return;
        applyTextScale(Number(button.dataset.textSize));
        notify("Text size updated.");
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
        digital: $("#old-clock-digital"),
        meta: $("#old-clock-meta"),
        sun: $("#old-clock-sun"),
        placeName: $("#old-clock-place-name"),
        placeLabel: $("#old-clock-place-label"),
        eyebrow: $("#old-clock-eyebrow"),
        placeButton: $("#old-clock-place"),
        fullscreen: $("#old-clock-fullscreen"),
        numeralsGroup: $("#old-clock-numerals"),
        motionGroup: $("#old-clock-motion"),
        chime: $("#old-clock-chime"),
      },
      getPlaceId: () => state.homeId,
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

    applyTextScale(state.textScale, { persist: false });
    board.setPlaces(state.board);
    board.bindEvents();
    renderPopularCities();

    renderSoundList();
    timer.init();
    stopwatch.init();
    calculator.init();
    forecast.init();
    bindEvents();

    applyTheme();
    updateLiveTime();
    updateNotes();
    nav.registerLinks("[data-route]");
    nav.start();

    window.setInterval(updateLiveTime, 1000);
    weatherCard.init();

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
