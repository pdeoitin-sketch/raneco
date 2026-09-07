import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

/**
 * End-to-end smoke test of the real app in a DOM.
 *
 * It boots app.js against a jsdom document parsed from index.html, with fetch
 * stubbed to an Open-Meteo-shaped payload, and drives the parts a pure unit
 * test cannot reach: place labels, the searchable picker, the weather card,
 * the Auto palette — and the timer / stopwatch / calculator that must keep
 * working.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

function weatherPayload({ now = Date.now(), code = 61, isDay = 1 } = {}) {
  const iso = (epoch) => new Date(epoch).toISOString().slice(0, 16);
  return {
    latitude: 27.7167,
    longitude: 85.3167,
    utc_offset_seconds: 20700,
    timezone: "Asia/Kathmandu",
    current: {
      time: iso(now),
      interval: 900,
      temperature_2m: 21.4,
      apparent_temperature: 24.1,
      relative_humidity_2m: 88,
      precipitation: 0.6,
      weather_code: code,
      is_day: isDay,
      wind_speed_10m: 7.3,
      wind_direction_10m: 210,
    },
    daily: {
      time: [new Date(now).toISOString().slice(0, 10)],
      sunrise: [iso(now - 4 * 3600 * 1000)],
      sunset: [iso(now + 4 * 3600 * 1000)],
    },
  };
}

async function boot({ homeZone = "Asia/Katmandu", weather = () => weatherPayload() } = {}) {
  const html = readFileSync(resolve(root, "index.html"), "utf8")
    // jsdom does not run ES module scripts or stylesheets; the bundle is
    // imported below and the CSS is checked by build, not by this test.
    .replace(/<link rel="stylesheet"[^>]*>/g, "")
    .replace(/<script type="module"[\s\S]*?<\/script>/g, "")
    .replace(/<script>[\s\S]*?<\/script>/g, "");

  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(`jsdomError: ${error.message}`));
  virtualConsole.on("error", (...args) => errors.push(`console.error: ${args.join(" ")}`));

  const dom = new JSDOM(html, { url: "http://localhost:5173/", pretendToBeVisual: true, virtualConsole });
  const { document, localStorage } = dom.window;
  localStorage.clear();
  if (homeZone) localStorage.setItem("tempo-home-zone", homeZone);

  const fetchCalls = [];
  const stubFetch = async (url) => {
    fetchCalls.push(String(url));
    const body = weather(String(url));
    return { ok: true, status: 200, json: async () => body };
  };
  dom.window.fetch = stubFetch;

  const installed = ["window", "document", "navigator", "localStorage", "getComputedStyle"];
  const previous = new Map(installed.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const expose = (name, value) =>
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true, enumerable: true });
  expose("window", dom.window);
  expose("document", document);
  expose("navigator", dom.window.navigator);
  expose("localStorage", localStorage);
  expose("getComputedStyle", dom.window.getComputedStyle.bind(dom.window));
  // weather.js reads the global fetch, exactly like the browser does.
  previous.set("fetch", Object.getOwnPropertyDescriptor(globalThis, "fetch"));
  expose("fetch", stubFetch);

  await import(`${pathToFileURL(resolve(root, "app.js")).href}?t=${Math.random()}`);
  await wait(80);

  const key = (selector, name) =>
    document.querySelector(selector).dispatchEvent(
      new dom.window.KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true })
    );

  return {
    dom,
    window: dom.window,
    document,
    localStorage,
    errors,
    fetchCalls,
    $: (selector) => document.querySelector(selector),
    $$: (selector) => Array.from(document.querySelectorAll(selector)),
    click: (selector) => document.querySelector(selector).click(),
    key,
    async typeIn(selector, value) {
      const input = document.querySelector(selector);
      input.value = value;
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      await wait(90);
    },
    cleanup() {
      dom.window.close();
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
}

const flatten = (text) => text.replace(/\s+/g, " ").trim();

describe("tempo in a browser-like DOM", () => {
  let app = null;
  afterEach(() => {
    if (app) app.cleanup();
    app = null;
  });

  test("a legacy home zone id is upgraded and labelled with its country", async () => {
    app = await boot({ homeZone: "Asia/Katmandu" });
    assert.equal(flatten(app.$("#top-timezone").textContent), "Nepal · Kathmandu");
    assert.match(app.$("#local-zone-name").textContent, /Nepal · Kathmandu · UTC\+05:45 · Asia\/Kathmandu/);
    assert.equal(app.$("#home-city-label").textContent, "Kathmandu");
    assert.equal(app.$("#home-country-label").textContent, "Nepal");
    assert.match(app.$("#local-hours").textContent, /^\d{2}$/);
    assert.match(document.title, /Kathmandu — Tempo/);
  });

  test("world clocks show country · city, and add / remove keep working", async () => {
    app = await boot();
    const cards = app.$$(".world-card");
    assert.equal(cards.length, 4, "the four default clocks render");
    assert.equal(flatten(cards[0].querySelector(".city-place").textContent), "United States · New York");
    assert.ok(cards.some((card) => card.classList.contains("is-home")), "the home zone is flagged");
    assert.match(app.$("#world-count").textContent, /4 of 8 clocks/);

    app.click(".world-card .remove-city");
    await wait(30);
    assert.equal(app.$$(".world-card").length, 3, "remove works");
    assert.equal(JSON.parse(app.localStorage.getItem("tempo-world-zones")).length, 3);
  });

  test("the searchable picker lists every zone and fixes legacy spellings", async () => {
    app = await boot();
    app.click("#add-city-button");
    await wait(60);

    const options = app.$$("#picker-list .picker-option");
    const highlighted = app.$("#picker-list .picker-option.active");
    assert.ok(highlighted, "the highlighted row exists");
    assert.equal(highlighted.getAttribute("aria-selected"), "true", "highlight matches the selection");
    assert.ok(options.includes(highlighted), "and it is one of the places");
    const groups = app.$$("#picker-list .picker-group");
    assert.ok(options.length > 300, `expected the full zone list, got ${options.length}`);
    assert.ok(groups.length > 100, `expected country groups, got ${groups.length}`);
    assert.match(flatten(groups[0].textContent), /^Afghanistan/);
    assert.match(app.$("#picker-count").textContent, /zones in \d+ countries/);

    await app.typeIn("#zone-search", "kiev");
    const found = app.$$("#picker-list .picker-option");
    assert.equal(found.length, 1, "the old spelling finds exactly one place");
    assert.equal(found[0].dataset.place, "Europe/Kyiv");
    assert.equal(found[0].querySelector(".picker-city").textContent, "Kyiv");

    found[0].click();
    await wait(20);
    assert.match(app.$("#picker-summary").textContent, /Ukraine · Kyiv · UTC\+03:00 · Europe\/Kyiv/);
    app.key("#zone-search", "Enter");
    await wait(40);
    assert.ok(app.$$(".world-card").some((card) => card.dataset.worldZone === "Europe/Kyiv"), "clock added");

    // A legacy id picked from search is stored as the modern zone id.
    app.click("#add-city-button");
    await wait(40);
    await app.typeIn("#zone-search", "calcutta");
    const kolkata = app.$$("#picker-list .picker-option");
    assert.equal(kolkata.length, 1);
    assert.equal(kolkata[0].dataset.place, "Asia/Kolkata");
    kolkata[0].click();
    app.key("#zone-search", "Enter");
    await wait(40);
    const stored = JSON.parse(app.localStorage.getItem("tempo-world-zones"));
    assert.ok(stored.includes("Asia/Kolkata"));
    assert.ok(!stored.some((zone) => /Calcutta/.test(zone)));
  });

  test("the picker moves the home zone and the whole page follows", async () => {
    app = await boot({ homeZone: "Asia/Katmandu" });
    app.click("#quick-zone-button");
    await wait(40);
    // The remembered selection is highlighted on the right row, even though
    // country headers are interleaved with the options.
    const active = app.$("#picker-list .picker-option.active");
    assert.ok(active, "one option is active");
    assert.equal(active.dataset.place, "Asia/Kathmandu");
    assert.equal(active.getAttribute("aria-selected"), "true");
    assert.equal(active.querySelector(".picker-city").textContent, "Kathmandu");
    await app.typeIn("#zone-search", "ho chi minh");
    const option = app.$$("#picker-list .picker-option")[0];
    assert.equal(option.dataset.place, "Asia/Ho_Chi_Minh");
    assert.equal(option.querySelector(".picker-city").textContent, "Ho Chi Minh City");
    option.click();
    app.key("#zone-search", "Enter");
    await wait(60);

    assert.equal(app.localStorage.getItem("tempo-home-zone"), "Asia/Ho_Chi_Minh");
    assert.equal(flatten(app.$("#top-timezone").textContent), "Vietnam · Ho Chi Minh City");
    assert.match(app.$("#local-zone-name").textContent, /Asia\/Ho_Chi_Minh/);
  });

  test("weather renders in Right now and drives the Auto palette", async () => {
    app = await boot();
    await wait(60);

    assert.equal(app.$("#weather-temp").textContent, "21");
    assert.equal(app.$("#weather-unit").textContent, "°C");
    assert.equal(app.$("#weather-condition").textContent, "Light rain");
    assert.match(app.$("#weather-place").textContent, /Kathmandu/);
    assert.match(app.$("#weather-sunrise").textContent, /^\d{2}:\d{2}$/);
    assert.match(app.$("#weather-sunset").textContent, /^\d{2}:\d{2}$/);
    assert.match(app.$("#weather-details").textContent, /88% humidity/);
    assert.equal(app.$$("#weather-card .weather-mini").length, 2);
    assert.equal(app.document.body.dataset.appearance, "rain");
    assert.equal(app.document.body.dataset.ui, "light");
    assert.match(app.$("#theme-caption").textContent, /Rainy/);
    assert.match(app.$("#theme-caption").title, /Auto · Rainy in Kathmandu/);

    assert.equal(app.fetchCalls.length, 1);
    const requested = new URL(app.fetchCalls[0]);
    assert.equal(requested.origin, "https://api.open-meteo.com");
    assert.equal(requested.searchParams.get("latitude"), "27.7167");
    assert.equal(requested.searchParams.get("longitude"), "85.3167");
    assert.equal(requested.searchParams.get("daily"), "sunrise,sunset");
    assert.match(requested.searchParams.get("current"), /^temperature_2m,apparent_temperature/);
  });

  test("the Auto palette changes with the sky, and manual modes win", async () => {
    const clear = await boot({ weather: () => weatherPayload({ code: 0 }) });
    await wait(60);
    assert.equal(clear.document.body.dataset.appearance, "clear");
    assert.equal(clear.document.body.classList.contains("dark"), false);
    assert.match(clear.$("#theme-caption").textContent, /Bright day/);
    assert.match(clear.$("#theme-caption").querySelector("span").textContent, /Auto · Kathmandu/);

    clear.click('#theme-switch [data-theme-mode="dark"]');
    await wait(20);
    assert.equal(clear.document.body.dataset.appearance, "dark", "manual dark overrides a sunny sky");
    assert.ok(clear.document.body.classList.contains("dark"));
    assert.equal(clear.localStorage.getItem("tempo-theme-mode"), "dark");
    assert.match(clear.$("#theme-caption").title, /Dark theme · fixed/);

    clear.click('#theme-switch [data-theme-mode="auto"]');
    await wait(20);
    assert.equal(clear.document.body.dataset.appearance, "clear", "Auto takes over again");
    assert.equal(clear.document.body.classList.contains("dark"), false);
    clear.cleanup();

    const storm = await boot({ weather: () => weatherPayload({ code: 95 }) });
    await wait(60);
    assert.equal(storm.document.body.dataset.appearance, "storm");
    assert.equal(storm.document.body.dataset.ui, "dark");
    assert.ok(storm.document.body.classList.contains("dark"), "component rules keyed on .dark still apply");
    storm.cleanup();

    const night = await boot({ weather: () => weatherPayload({ code: 0, isDay: 0 }) });
    await wait(60);
    assert.equal(night.document.body.dataset.appearance, "night");
    assert.match(night.$("#sun-icon").textContent, /☾|🌧/);
    night.cleanup();

    app = await boot();
  });

  test("a remembered manual theme is applied before the clocks start", async () => {
    app = await boot({ homeZone: "Asia/Katmandu" });
    app.document.body.dataset.appearance = "pending";
    app.localStorage.setItem("tempo-theme-mode", "light");
    app.click('#theme-switch [data-theme-mode="light"]');
    await wait(20);
    assert.equal(app.document.body.dataset.appearance, "light");
    assert.equal(app.document.body.dataset.mode, "light");
  });

  test("weather failures degrade to the clock-only palette", async () => {
    app = await boot({ weather: () => ({ not: "weather" }) });
    await wait(60);
    assert.match(app.$("#weather-condition").textContent, /unexpected|unavailable|not loaded/i);
    assert.ok(
      ["clear", "dawn", "dusk", "night", "cloud"].includes(app.document.body.dataset.appearance),
      `appearance was ${app.document.body.dataset.appearance}`
    );
    assert.equal(app.document.body.dataset.weather, "none");
  });

  test("timer, stopwatch and calculator still work", async () => {
    app = await boot();

    app.$("#timer-minutes").value = "1";
    app.$("#timer-minutes").dispatchEvent(new app.window.Event("input", { bubbles: true }));
    assert.equal(app.$("#timer-display").textContent, "01:00");
    app.click("#timer-start");
    await wait(140);
    assert.equal(app.$("#timer-status").textContent, "RUNNING");
    await wait(1100);
    assert.notEqual(app.$("#timer-display").textContent, "01:00", "it counts down");
    app.click("#timer-start");
    assert.equal(app.$("#timer-status").textContent, "PAUSED");
    app.click("#timer-reset");
    assert.equal(app.$("#timer-display").textContent, "01:00");

    app.click("#stopwatch-start");
    await wait(80);
    assert.match(app.$("#stopwatch-display").textContent, /^\d{2}:\d{2}\.\d{2}$/);
    assert.equal(app.$("#lap-button").disabled, false);
    app.click("#lap-button");
    assert.equal(app.$$("#laps-list li").length, 1);
    assert.equal(app.$("#lap-count").textContent, "01");
    app.click("#stopwatch-reset");
    assert.equal(app.$("#stopwatch-display").textContent, "00:00.00");
    assert.equal(app.$("#stopwatch-status").textContent, "STOPPED");

    app.$("#start-datetime").value = "2026-09-07T09:00";
    app.$("#end-datetime").value = "2026-09-09T11:30";
    app.$("#duration-form").dispatchEvent(new app.window.Event("submit", { bubbles: true, cancelable: true }));
    assert.equal(app.$("#duration-words").textContent, "2 days, 2 hours, 30 minutes");
    assert.equal(app.$("#total-hours").textContent, "50.5");
    assert.equal(app.$("#total-days").textContent, "2.1");
    assert.equal(app.$("#total-minutes").textContent, "3,030");
    assert.equal(app.$("#save-calculation").disabled, false);
    app.click("#save-calculation");
    assert.equal(app.$$("#saved-list .saved-item").length, 1);

    app.$("#convert-value").value = "5";
    app.$("#convert-unit").value = "days";
    app.$("#convert-unit").dispatchEvent(new app.window.Event("change", { bubbles: true }));
    app.$("#convert-value").dispatchEvent(new app.window.Event("input", { bubbles: true }));
    const converted = app.$$("#conversion-results .conversion-result strong").map((node) => node.textContent);
    assert.deepEqual(converted, ["120", "7,200", "432,000"]);
  });

  test("booting produces no console errors", async () => {
    app = await boot();
    await wait(150);
    assert.deepEqual(app.errors, [], `console output: ${app.errors.join(" | ")}`);
  });
});
