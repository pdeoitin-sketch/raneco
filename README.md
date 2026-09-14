# raneco

**Tempo** — a single-scroll browser dashboard for your local time, **alarms
that ring at a wall-clock time**, world clocks, live weather and forecast, an
old-style clock, a timer with real alarms, a stopwatch, and time calculations.
Built with [Vite](https://vite.dev/), deployed as a static site: there is no
backend and no API key to manage.

Live site: https://pdeoitin-sketch.github.io/raneco/

## One page, ten sections

Tempo used to be six routed pages behind a sidebar, then a single scroll with
the weather sitting above the clocks. **The order now follows the reader: time
first, sky after.** The things you *do* with time — alarms, timer, stopwatch,
the clocks, the arithmetic — come before the weather and the forecast, and an
About section closes the page. The sidebar still *reports where you are*
instead of deciding what you may see: as you scroll, the current section lights
up and the URL quietly follows.

| Section | Anchor | What it does |
| --- | --- | --- |
| **Right now** | `#/now` | Home clock (analog + digital) with the weather glance **beside it** — one snapshot, one request |
| **Alarms** | `#/alarms` | Wall-clock alarms: time, optional date or weekday repeat, label and **notes per alarm**, any of the 16 sounds |
| **Timer** | `#/timer` | Countdown with presets and a **16-sound alarm that keeps ringing** |
| **Stopwatch** | `#/stopwatch` | Centisecond stopwatch with laps, goals and splits |
| **World clocks** | `#/clocks` | Add up to 12 places, compare them against home, reorder and remove |
| **Old clock** | `#/clock` | Full-face clock with **eight faces**, a **live sky behind the dial**, sweep/tick hand and an hourly chime |
| **Time calculator** | `#/calculator` | Difference between two moments, unit conversion, saved results |
| **Weather** | `#/weather` | Live conditions for a point, plus a panel saying *where it thinks you are and how sure it is* |
| **Forecast** | `#/forecast` | Next 24 hours hour-by-hour, next 7 days with highs, lows and rain chance |
| **About** | `#/about` | What Tempo is, where the numbers come from, honest limits, and tagged remarks kept in your browser |

A **phrase sits under every heading** — time for the clock sections, sky for
the weather ones, and a seasonal line for the forecast that flips hemisphere
with your latitude (September is autumn in Kathmandu and spring in Sydney).
Phrases rotate by day number, never randomly, so a line is stable all day.

**Old links still work.** `#/timer` was a real routed URL; anyone who
bookmarked it lands on the timer section with a smooth scroll rather than a
404. Renamed sections keep their old hashes as aliases — `#/focus`, the
section that grew up and became the Stopwatch, still finds it. Clicking a
sidebar entry jumps; scrolling updates the highlight; the hash is rewritten
with `replaceState`, so one flick of the wheel does not push ten entries into
the back button.

Everything persists in `localStorage`: home place, board, **wall-clock
alarms**, timer settings, **alarm sound, volume and ring duration**, stopwatch
laps, saved calculations, old-clock face, theme, unit system and remarks.

## What is in the box

| Piece | Where | Notes |
| --- | --- | --- |
| Scroll-spy nav | `src/router.js`, `app.js` | `IntersectionObserver` with a positional fallback; old `#/page` links still resolve, via aliases where sections were renamed |
| Place model | `src/places.js` | 419 IANA zones + 328 curated cities = 747 searchable places |
| City gazetteer | `src/cities.js` | Country, region, coordinates and UTC offset for every city |
| Legacy zone ids | `src/tz-places.js` | `Asia/Calcutta` → `Asia/Kolkata` and friends, so saved boards survive |
| Searchable picker | `src/city-picker.js` | Grouped Country → City, diacritic-free search, keyboard navigation |
| Live weather | `src/weather.js`, `src/weather-card.js` | [Open-Meteo](https://open-meteo.com/) (free, key-less): temperature, wind, snow, sunrise/sunset |
| **Forecast** | `src/forecast.js` | 24 hourly + 7 daily, lazily loaded when the section is reached |
| **Wall-clock alarms** | `src/alarms.js` | Calendar-day walking, DST-safe zone arithmetic, a 90 s grace window |
| **Alarm sounds** | `src/alarm-sounds.js` | 16 Web-Audio sounds, looping playback, YouTube/Spotify/file input |
| **Clock faces** | `src/clock-themes.js` | Roman · Modern · Minimal · Railway · Pocket watch · Neon · Brutalist · Botanical |
| **Weather scenes** | `src/sky-scenes.js` | Eleven scenes behind the old clock, chosen from the live sky; mean-synodic moon phase |
| **Heading phrases** | `src/phrases.js` | Day-number rotation; seasonal lines that flip with latitude |
| **Remarks & feedback** | `src/remarks.js` | Tagged, kept in `localStorage`, handed to your own mail client |
| **Reverse geocoding** | `src/geocode.js` | Names a fix from a real gazetteer, and grades how much to trust it |
| Device location | `src/location.js` | High-accuracy `navigator.geolocation` + zone confirmation + a real place name |
| Solar time | `src/places.js` | Longitude-based sun time, so a wide country stops being one flat clock |
| Weather palettes | `src/theme.js` + the palette block in `styles.css` | Twelve palettes keyed on the local clock *and* the live sky |
| Timer, stopwatch, calculator | `src/timer.js`, `src/stopwatch.js`, `src/calculator.js` | Plain local-time maths; independent of the network |

### Cities and countries

The world clock is no longer limited to what the browser's ICU happens to
know. On top of all 419 IANA zones it ships **328 curated cities** (`src/cities.js`)
with their own coordinates, region and standard offset — from Delhi, Mumbai,
Guwahati and Ahmedabad to Nukuʻalofa, Timbuktu and Ushuaia. Search accepts
diacritic-free text (`munchen` finds **München**, `nukualofa` finds
**Nukuʻalofa**), country names, regions, ISO country codes and IANA ids, so
`delhi`, `India`, `IN` and `Asia/Kolkata` all reach the same place.

### Use my location

**This used to name the wrong place, and it has been rebuilt.**

The old flow asked the browser for a position with `enableHighAccuracy: false`
and a ten-minute cache, then named whatever came back after the nearest of our
328 curated cities. Both halves were wrong in the same direction:

* a low-accuracy request lets the browser answer from the **IP address**, which
  can be tens of kilometres out and, on a VPN, in the wrong country;
* naming a fix after the nearest *curated* city means standing in Bhaktapur
  reports "Kathmandu", and standing in a town we have never heard of reports
  whichever big city happens to be closest — sometimes hundreds of kilometres
  away.

Together they are why the feature "just put out a random thing". Now:

1. **The fix is real.** `requestBestPosition()` asks for high accuracy with a
   60-second cache window, so the GPS and wifi radios are actually consulted.
   If that times out indoors it retries permissively rather than failing — and
   labels the result as coarse.
2. **The name is real.** `src/geocode.js` asks
   [BigDataCloud's client-side endpoint](https://bigdatacloud.com/docs/api/free-reverse-geocode-to-city-api)
   (free, no API key, CORS-enabled) for the full administrative hierarchy, so
   you get *Madhyapur Thimi, Bhaktapur, Bagmati Province* instead of a guess.
3. **The zone is confirmed.** Open-Meteo is still asked which zone legally
   covers the point, because borders move and our own guess is wrong at them.
4. **The confidence is shown.** `coords.accuracy` is graded — GPS (≤ 50 m),
   fine, coarse (wifi), or *network estimate* (≥ 20 km) — and reported in the
   toast and in the new **Where we think you are** panel. A 40 km IP guess is
   labelled as one and comes with a warning, instead of being passed off as a
   street address.

Steps 2 and 3 run in parallel, and both are optional: with no network at all
the old nearest-city behaviour still applies, the panel says so, and nothing
breaks. A refusal (`PERMISSION_DENIED`) is also no longer confused with "the
radio has no fix yet" (`POSITION_UNAVAILABLE`) or a timeout — each gets its own
message, so you are not told you blocked a permission you actually granted.

The result is still a `geo:` place keeping its real latitude and longitude, so
the clock, the sun-time line, the weather and the forecast are all computed for
the spot where you actually are.

### Alarms that ring at a wall-clock time

The timer counts *down*; an alarm rings *at a time*. "Wake me at 06:30" and
"remind me in forty minutes" are different sentences, and for a long time
Tempo could only hear the second one. The **Alarms** section (`src/alarms.js`)
fixes that:

* an alarm is a **time** on your home clock, an optional **date** (one time
  only), an optional **weekday repeat**, a **label**, and **notes attached to
  that particular alarm** ("take the bread out of the freezer"), set to any of
  the **sixteen sounds** below;
* occurrences are found by **walking calendar days** in the alarm's zone, so a
  Friday-only alarm jumps clean over the weekend, and a date-pinned repeat
  skips the days before its date;
* the arithmetic is **DST-safe**: a daily 07:00 stays at 07:00 wall clock
  across the spring-forward night (the epoch distance shrinks to 23 hours) and
  the fall-back night (25 hours), and a wall time that does not exist — 02:30
  on the jump night — rings once the clock has moved past it;
* the engine runs on the **device clock** with a **90-second grace window**:
  a background tab whose timers were throttled still rings when it wakes up
  less than 90 s late; anything later is rescheduled, not rung;
* when one rings, **the page scrolls itself to it**, the card throbs, and a
  dismiss bar appears at the top of the section;
* one-time alarms switch themselves off after ringing; repeating ones keep
  their schedule. Everything is stored in `localStorage` under
  `tempo-alarms`.

The honest limit is stated in the About section: **a web page cannot wake a
sleeping phone.** Alarms ring while a Tempo tab is open — which is exactly as
far as a static page can go, and further than it sounds, thanks to the grace
window.

### Alarms that do not stop after one "ting"

The timer used to end with a single 0.4-second sine wave. If you had stepped
away from the desk — the entire reason you set a timer — you missed it.

**Sixteen sounds**, synthesised in the browser with the Web Audio API
(`src/alarm-sounds.js`), grouped by mood so "something soft" and "something
that will wake the street" are each one click away:

| Mood | Sounds |
| --- | --- |
| Simple | Classic ting |
| Soft & sweet | Soft chime · Zen bowl |
| Melodious | Music box · Harp rise |
| Modular | Marimba run |
| Meticulous | Digital pulse · Sonar ping |
| Ringtone | Classic ringtone · Old telephone bell |
| Sharp & hard | Alarm buzzer |
| Loud & strong | Siren sweep · Air horn |
| Rock & band | Rock band · Guitar arpeggio |
| Perfection | Grand fanfare |

Nothing is downloaded: every sound is scheduled from oscillators, filtered
noise and envelopes at play time, so the whole catalogue costs zero bytes, is
free of licensing, works offline, and can loop for as long as it needs to.
Each one has a ▶ preview, because a sound you cannot hear before choosing is
not really a choice.

**It keeps ringing.** Choose 5 s, 15 s, 30 s, 1 min or *until I stop it*
(capped at five minutes so a forgotten tab cannot scream all afternoon).
Cycles are scheduled in a rolling 1.5-second window rather than all at once, so
stopping is instant. While it rings the page shows a dismiss bar, the ring
shakes, and an optional **system notification** fires so it reaches you behind
another window.

**Your own music.** Pick a file from the device, paste a direct audio URL, or
paste a **YouTube, YouTube Music or Spotify** link — the platform's own
key-less embed player is mounted when the timer ends. That is the most a static
page can do without an API key, an OAuth redirect and (for Spotify) a Premium
account for every listener; `parseMediaLink()` understands `youtu.be`, `shorts`,
playlists, timestamps, `spotify:` URIs and Spotify's localised `/intl-xx/`
paths.

### Sun time: when one country is not one clock

Inside a single time zone the clock can run far from the sun. India (UTC+5:30)
is the clearest example: **Guwahati's clock is 37 minutes behind its sun while
Ahmedabad's is 40 minutes ahead** — a 77-minute spread of real daylight inside
one legal time. Tempo computes that offset from longitude (plus the equation of
time) and shows it everywhere it matters:

* the home card's **sun time** line (clock vs. sun, in minutes),
* every world clock card, alongside the hour difference from home,
* a plain-language note in the sidebar ("the sun lags the clock by 37 minutes"),
* a warning when a place's legal time is more than two hours from its sun.

### Weather themes

**Auto** (the default) re-tints the page from the local clock *and* the live
sky, in twelve palettes rather than a light/dark pair: dawn (cool lilac),
sunny (clean white with a warm sun and drifting clouds), cloudy (soft slate),
fog, rain (blue-slate with a soft drizzle), wind (pale mint with streaking
gusts), snow (icy blue), dusk (low amber), storm (dark slate with rain),
night (deep indigo with a starfield), plus the fixed light and dark palettes.
Wind only shows its palette when the wind is genuinely worth mentioning
(≥ 26 km/h sustained, or a ≥ 48 km/h gust) and the card then says *breezy*,
*windy* or *gusting*, with direction. Palettes cross-fade through registered
custom properties (`@property`) and `prefers-reduced-motion` is respected.
**Light** and **Dark** fix the look instead. The choice is remembered in
`localStorage`.

### Bigger text, fixed

The three-button text-size switch (**A · A⁺ · A⁺⁺**) was the wrong fix: it
scaled everything *proportionally*, so a 7.5px caption stayed a caption and
body copy was too small at every setting. It is gone. All 222 sizes now sit on
a **fixed ramp** in `styles.css`: the smallest text on the page is **11.5px**
(up from 7.5px), body copy sits at **14–15px**, and headings were already fine
and keep the size they always rendered at. The `--type-scale` custom property
and the `tempo-text-scale` storage key are both gone entirely.

### Eight faces, one live sky

The old clock's three numeral styles grew up into **eight faces** —
Roman · Modern · Minimal · Railway · Pocket watch · Neon · Brutalist ·
Botanical (`src/clock-themes.js`). A face is a coat of paint, not a second
mechanism: the renderer reports `data-clock-theme` on the dial and the
stylesheet does the rest. A saved `numerals` preference from an earlier Tempo
upgrades to the matching face, so nobody's clock changes on them.

Behind the dial, the stage shows the **live sky** (`src/sky-scenes.js`): a
thunderstorm with lightning, windstorm, rain, a rainbow (the one sky that
earns one: a sunlit light shower), snowfall, fog, a dark cloud at noon,
drifting clouds, a breeze, a starry night with the moon — and a moonless
night, decided by a **mean-synodic moon-phase calculation** anchored to the
new moon of 6 January 2000. The scene is **chosen from the weather snapshot
the page already loaded, never from a menu** — a sky you pick is a
screensaver; a sky you are told about is weather. Everything is CSS and
positioned particles, no images and no canvas, and every animation stops
under `prefers-reduced-motion`.

### Remarks & feedback, kept honestly

The About section ends the page with what Tempo is, where its numbers come
from (IANA `tzdata`, Open-Meteo, BigDataCloud's gazetteer, longitude-based sun
time, the mean-synodic moon), and its honest limits. Its remarks card takes a
tagged remark (Idea · Bug · Question · Praise), keeps it **in the browser
only**, and offers **send by email** — which does not send anything: it builds
a `mailto:` with the remarks in the body and hands it to your own mail client.
No contact records, deliberately.

## Time zone data

`tzdata/` vendors three public-domain IANA files (`zone1970.tab`, `zone.tab`,
`backward`, plus a `SOURCE.json` provenance note). `src/tz-places.generated.js`
is the compact form the bundle imports, and it is committed so `npm ci &&
npm run build` needs no network:

```bash
npm run build:tz-data    # regenerate src/tz-places.generated.js from tzdata/
npm run fetch:tz-data    # refresh tzdata/ from github.com/eggert/tz first
```

`tests/tz-data.test.mjs` fails if the generated file and the vendored sources
drift apart, so the data can never be edited by hand.

## Tests

```bash
npm test
```

**169 tests, no network.** `node --test` covers the pure logic in Node — place
naming and search, the city gazetteer, the tzdb data pipeline, the Open-Meteo
client, the theme decision table, the scroll spy, the reverse geocoder, the
geolocation service (with the permission prompt and `fetch` both stubbed), the
wall-clock alarm engine, the clock faces and the sky behind them, and the
heading phrases — and boots the real `app.js` in a jsdom document to drive the
whole dashboard.

New suites added with this upgrade:

| Suite | What it pins down |
| --- | --- |
| `tests/alarms.test.mjs` | A missing repeat is no repeat, not Sunday (`Number(null) === 0` is a trap); a dead sound id is reset by catalogue membership, because `findSound()` never returns null; occurrences walk calendar days (a Friday alarm jumps the weekend) and survive both DST corners (23 h and 25 h across the boundary, nonexistent wall times shift forward, ambiguous ones take the first); the 90 s grace window rings late but not too late; the wording is compact |
| `tests/clock-themes.test.mjs` | Exactly eight faces, ordered and drawable, with a legacy-numerals upgrade and a safe fallback; the renderer re-spells the dial per face; the stylesheet paints all eight faces and all eleven scenes; the mean-synodic moon anchors to a real new moon and reads real full/new moons correctly; `sceneFor()` maps the whole decision table — storms, snow, fog, the rainbow rule, moonlit vs moonless nights, the dark cloud at noon, breeze vs windstorm, and *no weather, no scene* |
| `tests/phrases.test.mjs` | Day numbers are stable within a local day; every section's line comes from its own pool (time for clocks, sky for weather); the forecast's seasonal line flips with latitude; `seasonFor()` knows both hemispheres; rotation is by day, sections differ, and an unknown section still gets a line |

The earlier suites (alarm sounds, geocode, forecast, router, and friends) are
still in place; the alarm-sounds suite renders all 16 sounds into a recording
fake `AudioContext`, and the geocode suite still checks that a Bhaktapur fix is
named *Bhaktapur*, not Kathmandu.

The smoke test additionally checks that all ten sections share one page in the
time-first order, that a phrase sits under every heading, that the text-size
switch is gone and `--type-scale` is never written (and that the smallest size
in the stylesheet is 11.5px), that a wall-clock alarm rings when the clock
reaches it and the page scrolls to it, that the Right-now glance and the
Weather section render the same snapshot from one request, that the old clock
wears all eight faces and upgrades an old numeral save, that the scene behind
it follows the live sky, that remarks are tagged, kept and handed to your own
mail client, and — as before — that the alarm picker lists and persists every
choice, that a pasted Spotify link becomes the alarm, that a finished timer
keeps ringing until dismissed, that the forecast is *not* fetched until its
section is reached, and that "use my location" asks with
`enableHighAccuracy: true` and a ≤ 60 s cache.

## Local development

```bash
npm ci          # install dependencies
npm run dev     # start the dev server (http://localhost:5173)
npm run build   # production build → dist/
npm run preview # serve the production build locally
```

## Deployment (GitHub Pages)

Deployment is automated by
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).
Pull requests run a lightweight **Verify pull request** job (`npm ci`,
`npm test`, `npm run build`) and are never deployed. On every push to `main`
(or a manual run from the **Actions** tab) the workflow:

1. installs dependencies with `npm ci`,
2. runs `npm test` so a broken dashboard can never be deployed,
3. builds the site with `vite build`, passing the Pages base path
   (`/raneco`) so asset URLs resolve under the project sub-path,
4. uploads `dist/` as the Pages artifact and deploys it.

Because the site is a single-page app on hash routing, GitHub Pages needs no
rewrite rules — every route is served by the same `index.html`.

### One-time repository setting

The repository's Pages source must be **GitHub Actions**:

> Settings → Pages → Build and deployment → Source → **GitHub Actions**

With the legacy "Deploy from a branch" mode Pages publishes the raw
repository, so the unbuilt `index.html` is served and its script cannot load.

### Base path

`vite.config.js` resolves the public base path in this order:

| Source | Value | Used when |
| --- | --- | --- |
| `VITE_BASE_PATH` | `/raneco` | Set by the workflow from `actions/configure-pages` |
| `GITHUB_REPOSITORY` | `owner/repo` → `/repo/` | Any other GitHub Actions run |
| _(default)_ | `/` | Local `npm run dev` / `npm run preview` |

If the site ever moves to a custom domain or a `<user>.github.io` repository,
`configure-pages` reports an empty base path and the build falls back to `/`
automatically — no config change needed.
