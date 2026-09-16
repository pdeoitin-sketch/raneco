/**
 * User preferences that reach beyond a single tool.
 *
 * Text size and the theme mode already had their own homes (`settings.js`,
 * `theme.js`). This module owns the preferences that several sections read
 * at once: how the calendar starts its weeks, which second calendar the
 * date cells carry, which holiday sets are marked, whether the GPS buttons
 * are on, and — through the keys the timer, alarms and weather card already
 * used — default weather units, alarm volume, ring duration and whether a
 * finished countdown may also send a browser notification.
 *
 * Everything stays in localStorage on this device. New keys are gathered
 * into one `tempo-preferences` blob so the export/import backup can treat
 * Tempo's whole memory as a single flat `tempo-*` namespace.
 */

export const PREF_STORAGE_KEY = "tempo-preferences";

/* The timer/alarms/weather keys existed before this module did; the
 * settings section edits them in place so both readers always agree. */
export const WEATHER_UNITS_KEY = "tempo-weather-units";
export const ALARM_VOLUME_KEY = "tempo-alarm-volume";
export const ALARM_DURATION_KEY = "tempo-alarm-duration";
export const ALARM_NOTIFY_KEY = "tempo-alarm-notify";

export const WEEK_STARTS = [
  { id: "monday", label: "Monday", jsDay: 1, note: "ISO-8601 weeks; most of Europe and Asia." },
  { id: "sunday", label: "Sunday", jsDay: 0, note: "Common in the US, Canada and Japan." },
  { id: "saturday", label: "Saturday", jsDay: 6, note: "Common in much of the Middle East." },
];

export const CALENDAR_SYSTEM_IDS = [
  "gregorian",
  "bikram",
  "chinese",
  "dangi",
  "hebrew",
  "islamic",
  "persian",
  "indian",
  "buddhist",
  "japanese",
];

export const HOLIDAY_SETS = [
  {
    id: "world",
    label: "International days",
    note: "New Year's Day, Earth Day, Human Rights Day and friends.",
  },
  {
    id: "national",
    label: "National days",
    note: "Independence and national days for fifty-plus countries.",
  },
  {
    id: "cultural",
    label: "Lunar & cultural festivals",
    note: "Chinese, Korean, Nepali and Persian new years, Chuseok, Songkran…",
  },
  {
    id: "religious",
    label: "Religious observances",
    note: "Christmas and Easter, the big Islamic and Hebrew feasts.",
  },
];

export const DEFAULT_PREFERENCES = Object.freeze({
  weekStart: "monday",
  calendarSystem: "gregorian",
  holidays: Object.freeze({ world: true, national: true, cultural: true, religious: true }),
  geo: true,
});

function normaliseWeekStart(value) {
  const raw = String(value || "").trim().toLowerCase();
  return WEEK_STARTS.some((start) => start.id === raw) ? raw : DEFAULT_PREFERENCES.weekStart;
}

function normaliseCalendarSystem(value) {
  const raw = String(value || "").trim().toLowerCase();
  return CALENDAR_SYSTEM_IDS.includes(raw) ? raw : DEFAULT_PREFERENCES.calendarSystem;
}

function normaliseHolidays(value) {
  const holidays = {};
  for (const set of HOLIDAY_SETS) {
    const saved = value && typeof value === "object" ? value[set.id] : undefined;
    holidays[set.id] = typeof saved === "boolean" ? saved : true;
  }
  return holidays;
}

export function weekStartOption(id) {
  return WEEK_STARTS.find((start) => start.id === normaliseWeekStart(id)) || WEEK_STARTS[0];
}

export function readPreferences(storage) {
  let parsed = {};
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    parsed = store ? JSON.parse(store.getItem(PREF_STORAGE_KEY) || "{}") || {} : {};
  } catch (_) {
    parsed = {};
  }
  return {
    weekStart: normaliseWeekStart(parsed.weekStart),
    calendarSystem: normaliseCalendarSystem(parsed.calendarSystem),
    holidays: normaliseHolidays(parsed.holidays),
    geo: typeof parsed.geo === "boolean" ? parsed.geo : DEFAULT_PREFERENCES.geo,
  };
}

/**
 * Merge a patch into the stored blob and return the normalised result. The
 * blob is small, so read-modify-write per change is far simpler than one key
 * per preference and keeps the backup story: one flat `tempo-*` namespace.
 */
export function writePreferences(patch = {}, storage) {
  const current = readPreferences(storage);
  // Unrecognised patch values keep the current preference rather than
  // snapping back to a default — a bad write should be inert, not loud.
  const patchedWeekStart =
    patch.weekStart !== undefined && WEEK_STARTS.some((start) => start.id === String(patch.weekStart).toLowerCase())
      ? normaliseWeekStart(patch.weekStart)
      : current.weekStart;
  const patchedSystem =
    patch.calendarSystem !== undefined && CALENDAR_SYSTEM_IDS.includes(String(patch.calendarSystem).toLowerCase())
      ? normaliseCalendarSystem(patch.calendarSystem)
      : current.calendarSystem;
  const next = {
    weekStart: patchedWeekStart,
    calendarSystem: patchedSystem,
    holidays:
      patch.holidays !== undefined
        ? { ...current.holidays, ...normaliseHolidays({ ...current.holidays, ...patch.holidays }) }
        : current.holidays,
    geo: typeof patch.geo === "boolean" ? patch.geo : current.geo,
  };
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (store) store.setItem(PREF_STORAGE_KEY, JSON.stringify(next));
  } catch (_) {
    // Preferences live for this visit only when storage is blocked.
  }
  return next;
}

/* ------------------------------------------------------------ weather units */

export function normaliseWeatherUnits(value) {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "metric" || raw === "imperial" ? raw : "auto";
}

export function readWeatherUnits(storage) {
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    return store ? normaliseWeatherUnits(store.getItem(WEATHER_UNITS_KEY)) : "auto";
  } catch (_) {
    return "auto";
  }
}

export function writeWeatherUnits(units, storage) {
  const id = normaliseWeatherUnits(units);
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (store) store.setItem(WEATHER_UNITS_KEY, id);
  } catch (_) {
    /* this visit only */
  }
  return id;
}

/* ------------------------------------------------------------ alarm defaults */

const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

/** Volume is stored as the 0–1 gain the sound engine wants; UI reads 0–100. */
export function readAlarmVolumePercent(storage) {
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    const raw = store ? store.getItem(ALARM_VOLUME_KEY) : null;
    return Math.round(clampNumber(raw === null ? 0.7 : Number(raw), 0, 1, 0.7) * 100);
  } catch (_) {
    return 70;
  }
}

export function writeAlarmVolumePercent(percent, storage) {
  const gain = clampNumber(Number(percent) / 100, 0, 1, 0.7);
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (store) store.setItem(ALARM_VOLUME_KEY, String(gain));
  } catch (_) {
    /* this visit only */
  }
  return Math.round(gain * 100);
}

/** Ring duration in seconds; 0 means "keep ringing until dismissed". */
export function readAlarmDuration(storage) {
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    const raw = store ? store.getItem(ALARM_DURATION_KEY) : null;
    return Math.round(clampNumber(raw === null ? 30 : Number(raw), 0, 600, 30));
  } catch (_) {
    return 30;
  }
}

export function writeAlarmDuration(seconds, storage) {
  const value = Math.round(clampNumber(Number(seconds), 0, 600, 30));
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (store) store.setItem(ALARM_DURATION_KEY, String(value));
  } catch (_) {
    /* this visit only */
  }
  return value;
}

export function readNotificationsEnabled(storage) {
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    return store ? store.getItem(ALARM_NOTIFY_KEY) === "on" : false;
  } catch (_) {
    return false;
  }
}

export function writeNotificationsEnabled(enabled, storage) {
  try {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (store) store.setItem(ALARM_NOTIFY_KEY, enabled ? "on" : "off");
  } catch (_) {
    /* this visit only */
  }
  return Boolean(enabled);
}
