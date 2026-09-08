# raneco

**Tempo** — a browser dashboard for your local time, world clocks, live weather,
an old-style clock, focus timers, a stopwatch, and time calculations. Built with
[Vite](https://vite.dev/), deployed as a static site: there is no backend and no
API key to manage.

Live site: https://pdeoitin-sketch.github.io/raneco/

## Pages

Tempo is six real pages with a permanent sidebar (and a bottom tab bar on
phones). Page changes are routed on the URL hash (`#/clocks`, `#/focus`, …),
so links, bookmarks, back and forward all work, and each page keeps its own
state while you move around.

| Page | Route | What it does |
| --- | --- | --- |
| **Right now** | `#/now` | Home clock (analog + digital), live sky, weather card, sun note, quick jump buttons |
| **World clocks** | `#/clocks` | Add up to 12 places, compare them against home, reorder and remove |
| **Focus timer** | `#/timer` | Countdown with presets, progress ring, laps and keyboard shortcuts |
| **Old clock** | `#/clock` | Full-screen retro clock with calm/graph/mirror finishes and a ticking hand |
| **Stopwatch** | `#/focus` | Centisecond stopwatch with laps, fastest/slowest summary and splits |
| **Time calculator** | `#/calculator` | Add/subtract durations from a date-time, difference between two moments, saved results |

Everything persists in `localStorage`: home place, board, timer settings,
stopwatch laps, saved calculations, theme, unit system and text size.

## What is in the box

| Piece | Where | Notes |
| --- | --- | --- |
| Routed pages | `src/router.js`, `app.js` | Hash router with keyboard nav, back/forward and deep links |
| Place model | `src/places.js` | 419 IANA zones + 328 curated cities = 747 searchable places |
| City gazetteer | `src/cities.js` | Country, region, coordinates and UTC offset for every city |
| Legacy zone ids | `src/tz-places.js` | `Asia/Calcutta` → `Asia/Kolkata` and friends, so saved boards survive |
| Searchable picker | `src/city-picker.js` | Grouped Country → City, diacritic-free search, keyboard navigation |
| Live weather | `src/weather.js`, `src/weather-card.js` | [Open-Meteo](https://open-meteo.com/) (free, key-less): temperature, wind, snow, sunrise/sunset |
| Device location | `src/location.js` | `navigator.geolocation` + an Open-Meteo zone lookup to confirm the zone |
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

*Every* place list has a **Use my location** button — the home clock, the world
clock board and the weather card. With the browser's permission, Tempo takes a
GPS fix and then:

1. names the fix after the **nearest city** in the gazetteer, and
2. asks Open-Meteo which time zone legally covers those coordinates, so a fix
   taken a few kilometres from a border gets the zone right instead of the
   gazetteer's best guess.

The result is a `geo:` place: it keeps its real latitude and longitude, so the
clock, the sun-time line and the weather are all computed for the spot where you
actually are. If permission is refused, or the device has no fix, the button
says so and nothing changes.

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

`node --test` covers the pure logic in Node — place naming and search, the
city gazetteer, the tzdb data pipeline, the Open-Meteo client, the theme
decision table, the router, and the geolocation service (with the permission
prompt and `fetch` both stubbed) — and boots the real `app.js` in a jsdom
document to check the six pages, the clock labels, the picker, "use my
location", the weather card, the Auto palettes, the text-size switch, and that
the timer, stopwatch and calculator still work.

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
On every push to `main` (or a manual run from the **Actions** tab) the workflow:

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
