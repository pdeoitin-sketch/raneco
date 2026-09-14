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

/**
 * The hourly + daily arrays the Forecast section asks for. Merged into the
 * current-conditions payload below, so one stub answers both shapes.
 */
function seriesFields(now) {
  const iso = (epoch) => new Date(epoch).toISOString().slice(0, 16);
  const day = (epoch) => new Date(epoch).toISOString().slice(0, 10);
  const hourly = {
    time: [], temperature_2m: [], weather_code: [], precipitation_probability: [], wind_speed_10m: [], is_day: [],
  };
  for (let i = 0; i < 30; i += 1) {
    hourly.time.push(iso(now + i * 3600 * 1000));
    hourly.temperature_2m.push(24 + (i % 8));
    hourly.weather_code.push(i % 4 === 0 ? 61 : 1);
    hourly.precipitation_probability.push((i * 11) % 100);
    hourly.wind_speed_10m.push(9);
    hourly.is_day.push(i % 24 < 12 ? 1 : 0);
  }
  const daily = {
    time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [],
    precipitation_probability_max: [], precipitation_sum: [], wind_speed_10m_max: [],
    sunrise: [], sunset: [], uv_index_max: [],
  };
  for (let i = 0; i < 7; i += 1) {
    const at = now + i * 86400000;
    daily.time.push(day(at));
    daily.weather_code.push(i === 1 ? 63 : 2);
    daily.temperature_2m_max.push(29 + i);
    daily.temperature_2m_min.push(17 + i);
    daily.precipitation_probability_max.push(i === 1 ? 75 : 15);
    daily.precipitation_sum.push(i === 1 ? 8 : 0);
    daily.wind_speed_10m_max.push(16);
    daily.sunrise.push(iso(at - 4 * 3600 * 1000));
    daily.sunset.push(iso(at + 4 * 3600 * 1000));
    daily.uv_index_max.push(7);
  }
  return { hourly, daily };
}

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

/**
 * BigDataCloud's reverse-geocode shape, for whichever coordinates were asked
 * for. Two fixtures is enough: Delhi and Mumbai are the two the suite uses.
 */
function geocodePayload(url) {
  const query = new URL(url).searchParams;
  const lat = Number(query.get("latitude"));
  const mumbai = Math.abs(lat - 19.076) < 0.5;
  return mumbai
    ? {
        latitude: 19.076,
        longitude: 72.8777,
        lookupSource: "coordinates",
        countryName: "India",
        countryCode: "IN",
        principalSubdivision: "Maharashtra",
        city: "Mumbai",
        locality: "Dadar",
        postcode: "400014",
        localityInfo: {
          administrative: [
            { adminLevel: 2, name: "India" },
            { adminLevel: 4, name: "Maharashtra" },
            { adminLevel: 8, name: "Mumbai" },
          ],
        },
      }
    : {
        latitude: 28.6139,
        longitude: 77.209,
        lookupSource: "coordinates",
        countryName: "India",
        countryCode: "IN",
        principalSubdivision: "Delhi",
        city: "Delhi",
        locality: "Connaught Place",
        postcode: "110001",
        localityInfo: {
          administrative: [
            { adminLevel: 2, name: "India" },
            { adminLevel: 4, name: "Delhi" },
            { adminLevel: 8, name: "Delhi" },
          ],
        },
      };
}

async function boot({ homeZone = "Asia/Katmandu", weather = () => weatherPayload(), hash = "" } = {}) {
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

  const dom = new JSDOM(html, {
    url: `http://localhost:5173/${hash}`,
    pretendToBeVisual: true,
    virtualConsole,
  });
  // jsdom has no IntersectionObserver and no layout, so the scroll spy uses
  // its positional fallback. Stubbing scrollIntoView keeps the jump silent.
  dom.window.Element.prototype.scrollIntoView = function scrollIntoView() {};
  const { document, localStorage } = dom.window;
  localStorage.clear();
  if (homeZone) localStorage.setItem("tempo-home-zone", homeZone);

  const fetchCalls = [];
  const stubFetch = async (url) => {
    const href = String(url);
    fetchCalls.push(href);
    // Three endpoints are in play now, each with its own shape:
    //   • BigDataCloud   names a GPS fix,
    //   • Open-Meteo     current conditions (the weather card),
    //   • Open-Meteo     hourly + daily arrays (the forecast section).
    let body;
    if (href.includes("bigdatacloud")) body = geocodePayload(href);
    else if (href.includes("hourly=")) body = { ...weather(href), ...seriesFields(Date.now()) };
    else body = weather(href);
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
    /**
     * Navigate the way a reader does: click the nav link. With one scrolling
     * page there is nothing to swap, so this asserts on the spy's answer.
     */
    async go(route) {
      const link = document.querySelector(`.nav-link[data-route="${route}"]`);
      if (link) link.click();
      else dom.window.location.hash = `#/${route}`;
      await wait(80);
    },
    /**
     * Every section is in the DOM at once now, so "which page is showing" has
     * become "which section is the scroll spy pointing at".
     */
    visiblePages() {
      return Array.from(document.querySelectorAll(".page"))
        .filter((page) => !page.hidden)
        .map((page) => page.dataset.page);
    },
    activeSection() {
      return document.body.dataset.currentPage || null;
    },
    activeNav() {
      const link = document.querySelector(".nav-link[aria-current]");
      return link ? link.dataset.route : null;
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

  test("every section is on one scroll, and the nav follows the reader", async () => {
    app = await boot();

    // The whole dashboard is present at once — that is the upgrade.
    assert.deepEqual(
      app.visiblePages(),
      ["now", "weather", "forecast", "clocks", "timer", "clock", "focus", "calculator"],
      "all eight sections share one page"
    );
    assert.equal(app.activeSection(), "now", "and the reader starts at the top");
    assert.match(app.$("#page-title").textContent, /moment/);
    assert.equal(app.$('.nav-link[data-route="now"]').classList.contains("active"), true);

    // Weather and Forecast are sections of their own now, not a card.
    assert.ok(app.$("#page-weather"), "weather has its own section");
    assert.ok(app.$("#page-forecast"), "so does the forecast");
    assert.ok(app.$("#page-weather").contains(app.$("#weather-card")), "the weather card lives in it");

    await app.go("clocks");
    assert.equal(app.activeSection(), "clocks");
    assert.match(app.$("#page-title").textContent, /Around the world/);
    assert.equal(app.activeNav(), "clocks");
    assert.equal(app.$('.nav-link[data-route="now"]').hasAttribute("aria-current"), false);
    // Nothing was hidden to get there.
    assert.equal(app.visiblePages().length, 8, "sections are never torn down");

    for (const [route, heading] of [
      ["weather", /sky/i],
      ["forecast", /week/i],
      ["timer", /timer/i],
      ["calculator", /mental maths/],
    ]) {
      await app.go(route);
      assert.equal(app.activeSection(), route, `#/${route} selects its section`);
      assert.match(app.$("#page-title").textContent, heading);
    }

    // A hash left over from an older build (or a typo) changes nothing.
    const before = app.activeSection();
    await app.go("nope");
    assert.equal(app.activeSection(), before, "an unknown hash is ignored, not a 404");
  });

  test("old #/page bookmarks still resolve to their section", async () => {
    // Someone bookmarked #/timer when Tempo was six routed pages. That link
    // has to keep working, or the upgrade breaks the web.
    app = await boot({ hash: "#/timer" });
    await wait(140);
    assert.equal(app.activeSection(), "timer", "a deep link lands on its section");
    assert.equal(app.activeNav(), "timer");
    assert.ok(app.$("#page-timer"), "and the section is present");
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

  test("the old clock section draws a face and can be pointed at a city", async () => {
    app = await boot();
    await app.go("clock");
    assert.equal(app.activeSection(), "clock");
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

    // Stand in for the browser's permission prompt, and capture the options
    // Tempo asks with — they are the difference between a GPS fix and a
    // cached IP guess.
    let lastPositionOptions = {};
    Object.defineProperty(app.window.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(onSuccess, _onError, options) {
          lastPositionOptions = options || {};
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
    // The toast now reports how much to trust the fix, not just the place:
    // a 20 m GPS reading and a 40 km network guess must not read the same.
    // The gazetteer resolves the neighbourhood, not just the nearest big city
    // in Tempo's own 328-row table — that was the "it picks something random"
    // complaint.
    assert.match(app.$("#toast-message").textContent, /You are in Connaught Place, Delhi/);
    assert.match(app.$("#toast-message").textContent, /±20 m — GPS/);

    // …and the location panel says the same thing in full.
    assert.equal(app.$("#location-card").dataset.precision, "gps");
    assert.equal(app.$("#location-name").textContent, "Delhi");
    assert.match(app.$("#location-detail").textContent, /Connaught Place/);
    assert.match(app.$("#location-accuracy").textContent, /±20 m/);
    assert.match(app.$("#location-zone").textContent, /Asia\/Kolkata/);
    assert.equal(app.$("#location-warning").hidden, true, "a good fix needs no warning");

    // The fix is high-accuracy and barely cached: a stale, coarse position is
    // what the browser hands back otherwise, and that is the actual bug.
    assert.equal(lastPositionOptions.enableHighAccuracy, true);
    assert.ok(lastPositionOptions.maximumAge <= 60 * 1000, "a ten-minute cache is how you get yesterday's city");

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

  test("the alarm picker offers every sound, and remembers the choice", async () => {
    app = await boot();
    await app.go("timer");

    const options = app.$$("#alarm-sounds [data-sound]");
    // Sixteen synthesised sounds plus "custom music".
    assert.equal(options.length, 17, `expected the catalogue plus custom, got ${options.length}`);
    assert.ok(
      options.some((option) => option.dataset.sound === "custom"),
      "your own music is one of the choices"
    );
    // Grouped by mood, so "something soft" is one glance not sixteen reads.
    const groups = app.$$("#alarm-sounds .sound-group-label").map((node) => node.textContent);
    for (const mood of ["Soft & sweet", "Melodious", "Rock & band", "Loud & strong", "Ringtone"]) {
      assert.ok(groups.includes(mood), `${mood} is a group`);
    }
    // Every catalogue entry has a preview button; a sound you cannot hear
    // before choosing is not really a choice.
    assert.equal(app.$$("#alarm-sounds [data-preview]").length, 16);

    const rock = app.$('#alarm-sounds [data-sound="rock-band"]');
    rock.click();
    await wait(20);
    assert.equal(app.localStorage.getItem("tempo-alarm-sound"), "rock-band");
    assert.equal(rock.getAttribute("aria-checked"), "true");
    assert.match(app.$("#alarm-current").textContent, /Rock band/);

    // How long it rings, and how loud, are choices too — and they persist.
    app.click('#alarm-durations [data-alarm-duration="0"]');
    await wait(20);
    assert.equal(app.localStorage.getItem("tempo-alarm-duration"), "0");

    const volume = app.$("#alarm-volume");
    volume.value = "35";
    volume.dispatchEvent(new app.window.Event("input", { bubbles: true }));
    await wait(20);
    assert.equal(app.localStorage.getItem("tempo-alarm-volume"), "0.35");
    assert.equal(app.$("#alarm-volume-label").textContent, "35%");
  });

  test("a pasted Spotify or YouTube link becomes the alarm", async () => {
    app = await boot();
    await app.go("timer");

    app.$("#alarm-custom").value = "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT";
    app.click("#alarm-custom-apply");
    await wait(30);

    assert.equal(app.localStorage.getItem("tempo-alarm-sound"), "custom");
    assert.match(app.localStorage.getItem("tempo-alarm-custom"), /open\.spotify\.com/);
    assert.match(app.$("#toast-message").textContent, /Spotify track/);
    assert.match(app.$("#alarm-current").textContent, /Spotify/);

    // Rubbish is refused with a reason rather than silently accepted.
    app.$("#alarm-custom").value = "definitely not a link";
    app.click("#alarm-custom-apply");
    await wait(30);
    assert.match(app.$("#toast-message").textContent, /does not look like a link|cannot be played/i);
  });

  test("when the timer ends the alarm keeps going until it is dismissed", async () => {
    app = await boot();
    await app.go("timer");

    // Ring until stopped, so the end state is unambiguous.
    app.click('#alarm-durations [data-alarm-duration="0"]');
    app.$("#timer-minutes").value = "0";
    app.$("#timer-seconds").value = "1";
    app.$("#timer-seconds").dispatchEvent(new app.window.Event("input", { bubbles: true }));
    assert.equal(app.$("#timer-display").textContent, "00:01");

    app.click("#timer-start");
    await wait(1400);

    // The old ending was a 0.4s chime and a toast that vanished. Now the page
    // itself says so, and keeps saying so.
    assert.equal(app.$("#timer-status").textContent, "TIME'S UP");
    assert.equal(app.$("#timer-ringing").hidden, false, "the dismiss bar is showing");
    assert.match(app.$("#toast-message").textContent, /Time's up/);

    app.click("#timer-dismiss");
    await wait(40);
    assert.equal(app.$("#timer-ringing").hidden, true, "and it stops when told to");
    assert.notEqual(app.$("#timer-status").textContent, "TIME'S UP");
  });

  test("the weather and forecast sections share one place", async () => {
    app = await boot();
    await wait(80);

    // The weather card moved into its own section, with the location panel.
    assert.ok(app.$("#page-weather").contains(app.$("#weather-card")));
    assert.ok(app.$("#page-weather").contains(app.$("#location-card")));

    // The forecast is below the fold, so it must not fire on load.
    const before = app.fetchCalls.filter((url) => url.includes("hourly=")).length;
    assert.equal(before, 0, "the forecast waits until it is reached");

    await app.go("forecast");
    await wait(140);

    const forecastCalls = app.fetchCalls.filter((url) => url.includes("hourly="));
    assert.equal(forecastCalls.length, 1, "and then asks exactly once");
    const requested = new URL(forecastCalls[0]);
    assert.match(requested.searchParams.get("daily"), /temperature_2m_max/);
    // Same coordinates as the weather card: the two can never disagree.
    const current = app.fetchCalls.find((url) => url.includes("current=") && !url.includes("hourly="));
    assert.equal(requested.searchParams.get("latitude"), new URL(current).searchParams.get("latitude"));

    assert.ok(app.$$("#forecast-hours .hour-cell").length > 0, "hours are drawn");
    assert.ok(app.$$("#forecast-days .day-row").length > 0, "days are drawn");
    assert.match(app.$("#forecast-summary").textContent, /\w/);
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
