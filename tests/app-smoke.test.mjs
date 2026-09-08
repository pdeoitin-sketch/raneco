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
 * test cannot reach: the page router, place labels for cities *and* zones, the
 * searchable picker, the weather card with its own location, the Auto palette
 * — and the timer, stopwatch and calculator that must keep working.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

function weatherPayload({ now = Date.now(), code = 61, isDay = 1, wind = 7.3 } = {}) {
  const iso = (epoch) => new Date(epoch).toISOString().slice(0, 16);
  return {
    latitude: 28.6,
    longitude: 77.2,
    utc_offset_seconds: 19800,
    timezone: "Asia/Kolkata",
    current: {
      time: iso(now),
      interval: 900,
      temperature_2m: 31.4,
      apparent_temperature: 34.1,
      relative_humidity_2m: 62,
      precipitation: 0,
      weather_code: code,
      is_day: isDay,
      wind_speed_10m: wind,
      wind_direction_10m: 210,
      wind_gusts_10m: wind * 1.6,
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

  // rAF drives the old clock's sweep hand; jsdom only provides it with
  // pretendToBeVisual, which is on — but guard anyway so the suite is stable.
  if (!dom.window.requestAnimationFrame) expose("requestAnimationFrame", (fn) => setTimeout(fn, 16));

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
    async go(route) {
      dom.window.location.hash = `#/${route}`;
      await wait(60);
    },
    visiblePages() {
      return Array.from(document.querySelectorAll(".page"))
        .filter((page) => !page.hidden)
        .map((page) => page.dataset.page);
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
    // The home place is stored as a modern place id.
    assert.equal(app.localStorage.getItem("tempo-home-zone"), "zone:Asia/Kathmandu");
  });

  test("each page is its own route, and only one shows at a time", async () => {
    app = await boot();
    assert.deepEqual(app.visiblePages(), ["now"], "Right now is the landing page");
    assert.match(app.$("#page-title").textContent, /moment/);
    assert.equal(app.$('.nav-link[data-route="now"]').classList.contains("active"), true);

    await app.go("clocks");
    assert.deepEqual(app.visiblePages(), ["clocks"]);
    assert.match(app.$("#page-title").textContent, /Around the world/);
    assert.equal(app.$('.nav-link[data-route="clocks"]').getAttribute("aria-current"), "page");
    assert.equal(app.$('.nav-link[data-route="now"]').getAttribute("aria-current"), null);

    await app.go("timer");
    assert.deepEqual(app.visiblePages(), ["timer"]);
    await app.go("clock");
    assert.deepEqual(app.visiblePages(), ["clock"]);
    await app.go("focus");
    assert.deepEqual(app.visiblePages(), ["focus"]);
    await app.go("calculator");
    assert.deepEqual(app.visiblePages(), ["calculator"]);
    assert.match(app.$("#page-title").textContent, /mental maths/);

    // A hash left over from an older build (or a typo) lands somewhere safe.
    await app.go("nope");
    assert.deepEqual(app.visiblePages(), ["now"]);
  });

  test("world clocks show country · city, cities have their own sun line", async () => {
    // London is on the default board, so the HOME badge has something to mark.
    app = await boot({ homeZone: "Europe/London" });
    await app.go("clocks");
    const cards = app.$$(".world-card");
    assert.ok(cards.length >= 4, `the default board renders, got ${cards.length}`);
    assert.equal(flatten(cards[1].querySelector(".city-place").textContent), "United Kingdom · London");
    assert.ok(cards.some((card) => card.classList.contains("is-home")), "the home place is flagged");
    assert.match(app.$("#world-count").textContent, /of 12 clocks/);
    // Every card carries a solar-time line computed from its own longitude.
    for (const card of cards) {
      assert.match(card.querySelector(".world-sun").textContent, /Sun time \d{2}:\d{2}/, card.dataset.place);
    }

    app.click(".world-card .remove-city");
    await wait(30);
    assert.equal(app.$$(".world-card").length, cards.length - 1, "remove works");
    assert.equal(JSON.parse(app.localStorage.getItem("tempo-world-zones")).length, cards.length - 1);
  });

  test("two cities in one zone stay two clocks, with different sun times", async () => {
    app = await boot();
    await app.go("clocks");
    // Clear the board, then add Delhi and Guwahati: both Asia/Kolkata.
    while (app.$$(".world-card").length) {
      app.click(".world-card .remove-city");
      await wait(10);
    }
    app.click("#add-city-button");
    await wait(60);
    await app.typeIn("#zone-search", "delhi");
    app.$$("#picker-list .picker-option")[0].click();
    app.key("#zone-search", "Enter");
    await wait(40);

    app.click("#add-city-button");
    await wait(60);
    await app.typeIn("#zone-search", "guwahati");
    app.$$("#picker-list .picker-option")[0].click();
    app.key("#zone-search", "Enter");
    await wait(40);

    const stored = JSON.parse(app.localStorage.getItem("tempo-world-zones"));
    assert.deepEqual(stored, ["city:delhi-in", "city:guwahati-in"]);
    const cards = app.$$(".world-card");
    assert.equal(cards.length, 2);
    // Same clock…
    assert.equal(cards[0].querySelector(".world-clock-value").textContent, cards[1].querySelector(".world-clock-value").textContent);
    assert.equal(cards[0].querySelector(".world-offset").textContent, cards[1].querySelector(".world-offset").textContent);
    // …different sun, which is the whole point.
    assert.notEqual(cards[0].querySelector(".world-sun").textContent, cards[1].querySelector(".world-sun").textContent);
  });

  test("the searchable picker lists zones and cities, and fixes legacy spellings", async () => {
    app = await boot();
    await app.go("clocks");
    app.click("#add-city-button");
    await wait(60);

    const options = app.$$("#picker-list .picker-option");
    const highlighted = app.$("#picker-list .picker-option.active");
    assert.ok(highlighted, "the highlighted row exists");
    assert.equal(highlighted.getAttribute("aria-selected"), "true", "highlight matches the selection");
    assert.ok(options.includes(highlighted), "and it is one of the places");
    const groups = app.$$("#picker-list .picker-group");
    assert.ok(options.length > 600, `expected zones *and* cities, got ${options.length}`);
    assert.ok(groups.length > 100, `expected country groups, got ${groups.length}`);
    assert.match(flatten(groups[0].textContent), /^Afghanistan/);
    assert.match(app.$("#picker-count").textContent, /places in \d+ countries/);

    await app.typeIn("#zone-search", "kiev");
    const found = app.$$("#picker-list .picker-option");
    assert.equal(found.length, 1, "the old spelling finds exactly one place");
    assert.equal(found[0].dataset.place, "zone:Europe/Kyiv");
    assert.equal(found[0].dataset.zone, "Europe/Kyiv");
    assert.equal(found[0].querySelector(".picker-city").textContent, "Kyiv");

    found[0].click();
    await wait(20);
    assert.match(app.$("#picker-summary").textContent, /Ukraine · Kyiv · UTC\+03:00 · Europe\/Kyiv/);
    app.key("#zone-search", "Enter");
    await wait(40);
    assert.ok(app.$$(".world-card").some((card) => card.dataset.place === "zone:Europe/Kyiv"), "clock added");

    // A legacy id picked from search is stored as the modern zone id.
    app.click("#add-city-button");
    await wait(40);
    await app.typeIn("#zone-search", "calcutta");
    const kolkata = app.$$("#picker-list .picker-option");
    assert.equal(kolkata.length, 1);
    assert.equal(kolkata[0].dataset.zone, "Asia/Kolkata");
    kolkata[0].click();
    app.key("#zone-search", "Enter");
    await wait(40);
    const stored = JSON.parse(app.localStorage.getItem("tempo-world-zones"));
    assert.ok(stored.includes("zone:Asia/Kolkata"));
    assert.ok(!stored.some((id) => /Calcutta/i.test(id)));

    // A city no zone is named after is findable too.
    app.click("#add-city-button");
    await wait(40);
    await app.typeIn("#zone-search", "ahmedabad");
    const city = app.$$("#picker-list .picker-option")[0];
    assert.equal(city.dataset.place, "city:ahmedabad-in");
  });

  test("the picker moves the home place and the whole page follows", async () => {
    app = await boot({ homeZone: "Asia/Katmandu" });
    app.click("#quick-zone-button");
    await wait(40);
    const active = app.$("#picker-list .picker-option.active");
    assert.ok(active, "one option is active");
    assert.equal(active.dataset.place, "zone:Asia/Kathmandu");
    assert.equal(active.querySelector(".picker-city").textContent, "Kathmandu");

    await app.typeIn("#zone-search", "ho chi minh");
    const option = app.$$("#picker-list .picker-option")[0];
    assert.equal(option.dataset.zone, "Asia/Ho_Chi_Minh");
    assert.equal(option.querySelector(".picker-city").textContent, "Ho Chi Minh City");
    option.click();
    app.key("#zone-search", "Enter");
    await wait(60);

    assert.equal(app.localStorage.getItem("tempo-home-zone"), "zone:Asia/Ho_Chi_Minh");
    assert.equal(flatten(app.$("#top-timezone").textContent), "Vietnam · Ho Chi Minh City");
    assert.match(app.$("#local-zone-name").textContent, /Asia\/Ho_Chi_Minh/);
  });

  test("weather renders in Right now, drives the Auto palette, and names its place", async () => {
    app = await boot();
    await wait(60);

    assert.equal(app.$("#weather-temp").textContent, "31");
    assert.equal(app.$("#weather-unit").textContent, "°C");
    assert.equal(app.$("#weather-condition").textContent, "Light rain");
    assert.match(app.$("#weather-place").textContent, /Kathmandu/);
    assert.match(app.$("#weather-coords").textContent, /\d+\.\d+° N, \d+\.\d+° E/);
    assert.match(app.$("#weather-sunrise").textContent, /^\d{2}:\d{2}$/);
    assert.match(app.$("#weather-sunset").textContent, /^\d{2}:\d{2}$/);
    assert.match(app.$("#weather-details").textContent, /62% humidity/);
    assert.match(app.$("#weather-details").textContent, /wind 7 km\/h/);
    assert.equal(app.document.body.dataset.appearance, "rain");
    assert.equal(app.document.body.dataset.ui, "light");
    assert.match(app.$("#theme-caption").textContent, /Rainy/);
    assert.match(app.$("#theme-caption").title, /Auto · Rainy in Kathmandu/);

    assert.equal(app.fetchCalls.length, 1);
    const requested = new URL(app.fetchCalls[0]);
    assert.equal(requested.origin, "https://api.open-meteo.com");
    assert.match(requested.searchParams.get("current"), /wind_gusts_10m/);
    assert.equal(requested.searchParams.get("daily"), "sunrise,sunset");
  });

  test("weather can be pointed at a different place than the home clock", async () => {
    app = await boot();
    await wait(60);
    app.click("#weather-set-location");
    await wait(50);
    assert.match(app.$("#zone-dialog-title").textContent, /Where should we look/);
    await app.typeIn("#zone-search", "ahmedabad");
    app.$$("#picker-list .picker-option")[0].click();
    app.key("#zone-search", "Enter");
    await wait(120);

    const stored = JSON.parse(app.localStorage.getItem("tempo-weather-place"));
    assert.equal(stored.kind, "place");
    assert.equal(stored.placeId, "city:ahmedabad-in");
    assert.match(app.$("#weather-place").textContent, /Ahmedabad/);
    // The home clock did not move with it.
    assert.equal(flatten(app.$("#top-timezone").textContent), "Nepal · Kathmandu");
    const last = new URL(app.fetchCalls[app.fetchCalls.length - 1]);
    assert.equal(last.searchParams.get("latitude"), "23.0225");
    assert.equal(last.searchParams.get("longitude"), "72.5714");
  });

  test("the Auto palette changes with the sky, and manual modes win", async () => {
    const sunny = await boot({ weather: () => weatherPayload({ code: 0 }) });
    await wait(60);
    assert.equal(sunny.document.body.dataset.appearance, "sunny", "clear skies are the sunny (warm) palette");
    assert.equal(sunny.document.body.classList.contains("dark"), false);
    assert.match(sunny.$("#theme-caption").textContent, /Sunny day/);

    const windy = await boot({ weather: () => weatherPayload({ code: 1, wind: 42 }) });
    await wait(60);
    assert.equal(windy.document.body.dataset.appearance, "wind", "a gale is a windy day, not a clear one");
    windy.cleanup();

    sunny.click('#theme-switch [data-theme-mode="dark"]');
    await wait(20);
    assert.equal(sunny.document.body.dataset.appearance, "dark", "manual dark overrides a sunny sky");
    assert.ok(sunny.document.body.classList.contains("dark"));
    assert.equal(sunny.localStorage.getItem("tempo-theme-mode"), "dark");
    assert.match(sunny.$("#theme-caption").title, /Dark theme · fixed/);

    sunny.click('#theme-switch [data-theme-mode="auto"]');
    await wait(20);
    assert.equal(sunny.document.body.dataset.appearance, "sunny", "Auto takes over again");
    sunny.cleanup();

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

  test("text size is a control, and it is remembered", async () => {
    app = await boot();
    assert.equal(app.document.documentElement.style.getPropertyValue("--type-scale"), "1.15");
    app.click('#text-size-switch [data-text-size="1.32"]');
    await wait(20);
    assert.equal(app.document.documentElement.style.getPropertyValue("--type-scale"), "1.32");
    assert.equal(app.localStorage.getItem("tempo-text-scale"), "1.32");
    assert.equal(
      app.$('#text-size-switch [data-text-size="1.32"]').getAttribute("aria-checked"),
      "true"
    );
    app.click('#text-size-switch [data-text-size="1"]');
    await wait(20);
    assert.equal(app.document.documentElement.style.getPropertyValue("--type-scale"), "1");
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
      ["sunny", "dawn", "dusk", "night", "cloud"].includes(app.document.body.dataset.appearance),
      `appearance was ${app.document.body.dataset.appearance}`
    );
    assert.equal(app.document.body.dataset.weather, "none");
  });

  test("the old clock page draws a face and can be pointed at a city", async () => {
    app = await boot();
    await app.go("clock");
    assert.equal(app.visiblePages()[0], "clock");
    assert.ok(app.$$("#old-clock .face-tick").length === 60, "sixty ticks");
    assert.equal(app.$$("#old-clock .face-number").length, 12);
    assert.equal(app.$("#old-clock").dataset.numerals, "roman");
    assert.equal(app.$("#old-clock .face-number em").textContent, "I");
    assert.match(app.$("#old-clock-digital").textContent, /^\d{2}:\d{2}:\d{2}$/);
    assert.match(app.$("#old-clock-meta").textContent, /UTC[+-]\d{2}:\d{2}/);
    assert.match(app.$("#old-clock-place-name").textContent, /Kathmandu/);

    app.click('#old-clock-numerals [data-numerals="arabic"]');
    await wait(20);
    assert.equal(app.$("#old-clock").dataset.numerals, "arabic");
    assert.equal(app.$("#old-clock .face-number em").textContent, "1");

    app.click("#old-clock-place");
    await wait(60);
    await app.typeIn("#zone-search", "delhi");
    app.$$("#picker-list .picker-option")[0].click();
    app.key("#zone-search", "Enter");
    await wait(60);
    assert.match(app.$("#old-clock-place-name").textContent, /Delhi/);
    assert.match(app.$("#old-clock-place-label").textContent, /Delhi/);
  });

  test("timer, stopwatch and calculator still work", async () => {
    app = await boot();

    await app.go("timer");
    app.$("#timer-minutes").value = "1";
    app.$("#timer-minutes").dispatchEvent(new app.window.Event("input", { bubbles: true }));
    assert.equal(app.$("#timer-display").textContent, "01:00");
    app.click("#timer-start");
    await wait(140);
    assert.equal(app.$("#timer-status").textContent, "RUNNING");
    await wait(1100);
    assert.notEqual(app.$("#timer-display").textContent, "01:00", "it counts down");
    // It keeps running while you are on another page.
    await app.go("clocks");
    await wait(300);
    await app.go("timer");
    assert.equal(app.$("#timer-status").textContent, "RUNNING");
    app.click("#timer-start");
    assert.equal(app.$("#timer-status").textContent, "PAUSED");
    app.click("#timer-reset");
    assert.equal(app.$("#timer-display").textContent, "01:00");

    await app.go("focus");
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

    await app.go("calculator");
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

  test("'use my location' turns a GPS fix into a home place and a clock", async () => {
    app = await boot();
    await wait(40);

    // Stand in for the browser's permission prompt. The stubbed fetch answers
    // the zone lookup with the same Open-Meteo-shaped payload.
    Object.defineProperty(app.window.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(onSuccess) {
          onSuccess({ coords: { latitude: 28.6139, longitude: 77.209, accuracy: 20 } });
        },
      },
    });

    app.click("#use-location-button");
    await wait(160);

    const home = app.localStorage.getItem("tempo-home-zone");
    assert.equal(home.startsWith("geo:"), true, `home place is the fix, got ${home}`);
    assert.match(app.$("#top-timezone").textContent, /Delhi/);
    assert.match(app.$("#home-sun-line").textContent, /Sun time/);
    // The confirmed zone beats the gazetteer's guess.
    assert.match(app.$("#local-zone-name").textContent, /Asia\/Kolkata/);
    assert.match(app.$("#toast-message").textContent, /Found you near Delhi/);

    const board = JSON.parse(app.localStorage.getItem("tempo-world-zones"));
    assert.ok(board.includes(home), "and your own location joins the board");
    const card = app.$$(".world-card").find((node) => node.dataset.place === home);
    assert.ok(card, "the location clock is rendered");
    assert.ok(card.querySelector(".world-pin"), "and flagged as coming from the device");
  });

  test("the clocks page can add your location without moving the home clock", async () => {
    app = await boot();
    await app.go("clocks");
    Object.defineProperty(app.window.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(onSuccess) {
          onSuccess({ coords: { latitude: 19.076, longitude: 72.8777, accuracy: 30 } });
        },
      },
    });
    const before = app.$$(".world-card").length;
    app.click("#use-location-clock");
    await wait(160);

    assert.equal(app.$$(".world-card").length, before + 1);
    assert.equal(app.localStorage.getItem("tempo-home-zone"), "zone:Asia/Kathmandu", "the home clock stayed put");
    assert.ok(app.$$(".world-card").some((card) => card.dataset.place.startsWith("geo:")));
  });

  test("'use my location' explains a refusal instead of failing silently", async () => {
    app = await boot();
    Object.defineProperty(app.window.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(onSuccess, onError) {
          onError({ code: 1 });
        },
      },
    });
    app.click("#use-location-button");
    await wait(120);
    assert.match(app.$("#toast-message").textContent, /declined/i);
    assert.equal(app.$("#top-timezone").textContent, "Nepal · Kathmandu", "nothing changed");
  });

  test("booting produces no console errors", async () => {
    app = await boot();
    await wait(200);
    for (const route of ["clocks", "timer", "clock", "focus", "calculator", "now"]) {
      await app.go(route);
    }
    assert.deepEqual(app.errors, [], `console output: ${app.errors.join(" | ")}`);
  });
});
