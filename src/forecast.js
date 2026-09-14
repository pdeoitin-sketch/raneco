/**
 * The forecast section — the next 24 hours and the next 7 days.
 *
 * The weather *card* answers "what is it like right now". This answers "what
 * is it going to be like", which is a different question and deserves its own
 * section rather than a line of small print. It follows whatever place the
 * weather card is pointed at, so the two never disagree.
 *
 * Refresh policy: forecasts change far more slowly than observations, so this
 * re-fetches every 30 minutes rather than every 20, and only when the section
 * has actually been looked at (it is lazy — a single-scroll page must not fire
 * every network call it owns on load).
 */

import { escapeHTML } from "./ui.js";
import { FORECAST_DAYS, fetchForecastSeries } from "./weather.js";

export const SERIES_REFRESH_MS = 30 * 60 * 1000;

/** "Today", "Tomorrow", then "Wed 17". */
export function dayLabel(epoch, { timeZone, now = Date.now() } = {}) {
  if (!Number.isFinite(epoch)) return "—";
  const options = timeZone ? { timeZone } : {};
  const key = (value) =>
    new Intl.DateTimeFormat("en-CA", { ...options, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(value)
    );
  const today = key(now);
  const target = key(epoch);
  if (target === today) return "Today";
  if (target === key(now + 86400000)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", { ...options, weekday: "short", day: "numeric" }).format(new Date(epoch));
}

/** The temperature bar for a day, positioned inside the week's whole range. */
export function rangeBar(day, bounds) {
  const span = Math.max(1, bounds.max - bounds.min);
  const left = ((day.min - bounds.min) / span) * 100;
  const width = Math.max(6, ((day.max - day.min) / span) * 100);
  return { left: Math.max(0, Math.min(100 - width, left)), width };
}

/** The coldest low and the hottest high across the week. */
export function seriesBounds(days) {
  const lows = days.map((day) => day.min).filter(Number.isFinite);
  const highs = days.map((day) => day.max).filter(Number.isFinite);
  if (!lows.length || !highs.length) return { min: 0, max: 1 };
  return { min: Math.min(...lows), max: Math.max(...highs) };
}

/**
 * A plain-language summary of the week — the bit a person actually reads.
 * "Rain on Wednesday and Thursday", "Warming up to 31°", that kind of thing.
 */
export function summarise(series) {
  if (!series || !series.ok || !series.daily || !series.daily.length) return "";
  const days = series.daily;
  const unit = series.temperatureUnit || "°C";
  const wet = days.filter((day) => Number(day.precipitationChance) >= 50);
  const highs = days.map((day) => day.max).filter(Number.isFinite);
  const warmest = days.find((day) => day.max === Math.max(...highs));
  const parts = [];

  if (wet.length === 0) parts.push("A dry week ahead");
  else if (wet.length >= days.length - 1) parts.push("Rain on most days this week");
  else {
    const names = wet
      .slice(0, 3)
      .map((day) => dayLabel(day.epoch, { timeZone: series.timezone }))
      .join(", ");
    parts.push(`Rain likely ${wet.length === 1 ? "on" : "on"} ${names}`);
  }
  if (warmest && Number.isFinite(warmest.max)) {
    parts.push(
      `warmest ${dayLabel(warmest.epoch, { timeZone: series.timezone }).toLowerCase()} at ${Math.round(
        warmest.max
      )}${unit}`
    );
  }
  return `${parts.join(" · ")}.`;
}

export function createForecast({ elements = {}, getSource, notify } = {}) {
  let series = null;
  let busy = false;
  let lastKey = "";
  let timer = 0;
  // The forecast is below the fold. On a single-scroll page every section
  // firing its network calls on load would mean four requests before the user
  // has read the first screen, so this one waits until it is reached.
  let activated = false;

  const node = (id) => elements[id] || null;

  function sourceKey(source) {
    if (!source) return "";
    return `${Number(source.lat).toFixed(3)},${Number(source.lon).toFixed(3)},${source.units || ""}`;
  }

  function setState(value) {
    if (elements.section) elements.section.dataset.state = value;
  }

  /* ------------------------------------------------------------- render */

  function renderHours() {
    const host = node("hours");
    if (!host) return;
    if (!series || !series.ok || !series.hourly.length) {
      host.innerHTML = "";
      return;
    }
    const temps = series.hourly.map((hour) => hour.temperature).filter(Number.isFinite);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const span = Math.max(1, max - min);

    host.innerHTML = series.hourly
      .map((hour, index) => {
        const height = Number.isFinite(hour.temperature) ? 18 + ((hour.temperature - min) / span) * 62 : 18;
        const rain = Number.isFinite(hour.precipitationChance) ? hour.precipitationChance : null;
        return `<li class="hour-cell${index === 0 ? " is-now" : ""}"${
          hour.isDay ? "" : ' data-night="true"'
        } title="${escapeHTML(`${hour.wall} · ${hour.condition}`)}">
          <span class="hour-temp">${Number.isFinite(hour.temperature) ? Math.round(hour.temperature) : "—"}°</span>
          <span class="hour-bar" style="height:${height.toFixed(1)}%"></span>
          <span class="hour-symbol" aria-hidden="true">${escapeHTML(hour.symbol)}</span>
          ${rain !== null && rain >= 20 ? `<span class="hour-rain">${Math.round(rain)}%</span>` : '<span class="hour-rain"></span>'}
          <span class="hour-time">${index === 0 ? "now" : escapeHTML(hour.wall)}</span>
        </li>`;
      })
      .join("");
  }

  function renderDays() {
    const host = node("days");
    if (!host) return;
    if (!series || !series.ok || !series.daily.length) {
      host.innerHTML = "";
      return;
    }
    const bounds = seriesBounds(series.daily);
    const unit = series.temperatureUnit || "°C";

    host.innerHTML = series.daily
      .slice(0, FORECAST_DAYS)
      .map((day, index) => {
        const bar = rangeBar(day, bounds);
        const rain = Number.isFinite(day.precipitationChance) ? day.precipitationChance : null;
        return `<li class="day-row${index === 0 ? " is-today" : ""}">
          <span class="day-name">${escapeHTML(dayLabel(day.epoch, { timeZone: series.timezone }))}</span>
          <span class="day-symbol" aria-hidden="true" title="${escapeHTML(day.condition)}">${escapeHTML(day.symbol)}</span>
          <span class="day-condition">${escapeHTML(day.condition)}</span>
          <span class="day-rain">${rain !== null ? `${Math.round(rain)}%` : ""}</span>
          <span class="day-low">${Number.isFinite(day.min) ? Math.round(day.min) : "—"}°</span>
          <span class="day-range" aria-hidden="true">
            <span class="day-range-fill" style="left:${bar.left.toFixed(1)}%;width:${bar.width.toFixed(1)}%"></span>
          </span>
          <span class="day-high">${Number.isFinite(day.max) ? Math.round(day.max) : "—"}°</span>
          <span class="sr-only">${escapeHTML(
            `${day.condition}, low ${Math.round(day.min)}${unit}, high ${Math.round(day.max)}${unit}`
          )}</span>
        </li>`;
      })
      .join("");
  }

  function render() {
    if (busy && !series) {
      setState("loading");
      if (elements.summary) elements.summary.textContent = "Loading the week…";
      return;
    }
    if (!series || !series.ok) {
      setState("error");
      if (elements.summary) {
        elements.summary.textContent = (series && series.message) || "The forecast is not loaded yet.";
      }
      renderHours();
      renderDays();
      return;
    }
    setState("ready");
    if (elements.summary) elements.summary.textContent = summarise(series);
    if (elements.place) {
      const source = typeof getSource === "function" ? getSource() : null;
      elements.place.textContent = source && source.label ? source.label : "";
    }
    if (elements.zone) {
      elements.zone.textContent = series.timezone ? `Local time · ${series.timezone}` : "";
    }
    renderHours();
    renderDays();
    if (elements.refresh) elements.refresh.disabled = busy;
  }

  /* -------------------------------------------------------------- fetch */

  async function refresh({ force = false } = {}) {
    // Until the section has been reached, a refresh is a no-op: the weather
    // card emits a snapshot on every poll and we must not shadow it with a
    // second request the user cannot even see.
    if (!activated && !force) return series;
    const source = typeof getSource === "function" ? getSource() : null;
    if (!source || !Number.isFinite(Number(source.lat))) {
      series = { ok: false, message: "Pick a place to see its forecast." };
      render();
      return null;
    }
    const key = sourceKey(source);
    const fresh = series && series.ok && Date.now() - series.observedAt < SERIES_REFRESH_MS;
    if (!force && fresh && key === lastKey) return series;
    if (busy) return series;

    busy = true;
    render();
    const next = await fetchForecastSeries({
      lat: source.lat,
      lon: source.lon,
      units: source.units,
      timezone: "auto",
    });
    busy = false;
    lastKey = key;
    series = next;
    render();
    if (!next.ok && force && notify) notify(next.message || "The forecast could not be loaded.", "!");
    return next;
  }

  return {
    init() {
      if (elements.refresh) elements.refresh.addEventListener("click", () => refresh({ force: true }));
      render();
    },
    refresh,
    render,
    /** The section scrolled into view: load it now, if it has not loaded. */
    activate() {
      const first = !activated;
      activated = true;
      if (first || (!series && !busy)) refresh();
      if (!timer && typeof window !== "undefined") {
        timer = window.setInterval(() => refresh(), SERIES_REFRESH_MS);
      }
    },
    get activated() {
      return activated;
    },
    get series() {
      return series;
    },
    stop() {
      if (timer && typeof window !== "undefined") window.clearInterval(timer);
      timer = 0;
    },
  };
}
