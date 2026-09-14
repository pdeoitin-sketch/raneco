# raneco

**Tempo** — a single-scroll browser dashboard for your local time, world clocks,
live weather and forecast, an old-style clock, a timer with real alarms, a
stopwatch, and time calculations. Built with
[Vite](https://vite.dev/), deployed as a static site: there is no backend and no
API key to manage.

Live site: https://pdeoitin-sketch.github.io/raneco/

## One page, eight sections

Tempo used to be six routed pages behind a sidebar. Everything worked, but
reading two facts meant two clicks and a repaint, and the dashboard felt like
a filing cabinet. **It is now a single scroll.** The sidebar is still there,
but it *reports where you are* instead of deciding what you may see: as you
scroll, the current section lights up and the URL quietly follows.

| Section | Anchor | What it does |
| --- | --- | --- |
| **Right now** | `#/now` | Home clock (analog + digital), live sky, day progress, sun note |
| **Weather** | `#/weather` | Live conditions for a point, plus a panel saying *where it thinks you are and how sure it is* |
| **Forecast** | `#/forecast` | Next 24 hours hour-by-hour, next 7 days with highs, lows and rain chance |
| **World clocks** | `#/clocks` | Add up to 12 places, compare them against home, reorder and remove |
| **Timer & alarm** | `#/timer` | Countdown with presets and a **16-sound alarm that keeps ringing** |
| **Old clock** | `#/clock` | Full-face retro clock with numerals, sweep/tick hand and an hourly chime |
| **Focus** | `#/focus` | Centisecond stopwatch with laps, goals and splits |
| **Time calculator** | `#/calculator` | Difference between two moments, unit conversion, saved results |

**Old links still work.** `#/timer` was a real routed URL; anyone who
bookmarked it lands on the timer section with a smooth scroll rather than a
404. Clicking a sidebar entry jumps; scrolling updates the highlight; the hash
is rewritten with `replaceState`, so one flick of the wheel does not push eight
entries into the back button.

Everything persists in `localStorage`: home place, board, timer settings,
**alarm sound, volume and ring duration**, stopwatch laps, saved calculations,
theme, unit system and text size.

## What is in the box

| Piece | Where | Notes |
| --- | --- | --- |
| Scroll-spy nav | `src/router.js`, `app.js` | `IntersectionObserver` with a positional fallback; old `#/page` links still resolve |
| Place model | `src/places.js` | 419 IANA zones + 328 curated cities = 747 searchable places |
| City gazetteer | `src/cities.js` | Country, region, coordinates and UTC offset for every city |
| Legacy zone ids | `src/tz-places.js` | `Asia/Calcutta` → `Asia/Kolkata` and friends, so saved boards survive |
| Searchable picker | `src/city-picker.js` | Grouped Country → City, diacritic-free search, keyboard navigation |
| Live weather | `src/weather.js`, `src/weather-card.js` | [Open-Meteo](https://open-meteo.com/) (free, key-less): temperature, wind, snow, sunrise/sunset |
| **Forecast** | `src/forecast.js` | 24 hourly + 7 daily, lazily loaded when the section is reached |
| **Alarm sounds** | `src/alarm-sounds.js` | 16 Web-Audio sounds, looping playback, YouTube/Spotify/file input |
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

### Bigger text

Every font size is a multiple of a single `--type-scale` custom property, so the
whole interface scales together. The default scale is **15 % larger** than the
original design, and the sidebar switch offers **A · A⁺ · A⁺⁺** (100 %, 115 %,
132 %); the choice is remembered across visits.

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

**128 tests, no network.** `node --test` covers the pure logic in Node — place
naming and search, the city gazetteer, the tzdb data pipeline, the Open-Meteo
client, the theme decision table, the scroll spy, the reverse geocoder and the
geolocation service (with the permission prompt and `fetch` both stubbed) —
and boots the real `app.js` in a jsdom document to drive the whole dashboard.

New suites added with this upgrade:

| Suite | What it pins down |
| --- | --- |
| `tests/alarm-sounds.test.mjs` | All 16 sounds render real audio into a recording fake `AudioContext`, schedule nothing in the past, and finish inside their own loop; every mood is covered; YouTube/Spotify/audio/blob links parse and rubbish is refused; a browser with no audio is silence, not a crash |
| `tests/geocode.test.mjs` | A Bhaktapur fix is named *Bhaktapur*, not Kathmandu; a name is never repeated in the detail line; an IP fallback admits what it is; accuracy is graded honestly; every failure is a value |
| `tests/forecast.test.mjs` | The hourly strip starts at the current hour and is hour-aligned; seven days parse with highs, lows and rain chance; the range bar never overflows; the week is summarised in a sentence |
| `tests/router.test.mjs` | The spy picks the last section to cross the reading line, refuses to guess with no layout, never hides a section, and still resolves old `#/page` bookmarks |

The smoke test additionally checks that all eight sections share one page, that
the alarm picker lists and persists every choice, that a pasted Spotify link
becomes the alarm, that a finished timer keeps ringing until dismissed, that
the forecast is *not* fetched until its section is reached, and that
"use my location" asks with `enableHighAccuracy: true` and a ≤ 60 s cache.

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
