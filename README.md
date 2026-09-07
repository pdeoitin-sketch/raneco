# raneco

**Tempo** — a browser dashboard for your local time, world clocks, live
weather, a countdown timer, a stopwatch, and time calculations. Built with
[Vite](https://vite.dev/) and deployed as a static site; there is no backend and
no API key to manage.

Live site: https://pdeoitin-sketch.github.io/raneco/

## What is in the box

| Piece | Where | Notes |
| --- | --- | --- |
| Place names for every clock | `src/tz-places.js` | Country + modern city for each IANA zone, built from vendored tzdb data |
| Searchable city picker | `src/city-picker.js` | Grouped Country → City, covers every zone `Intl.supportedValuesOf("timeZone")` reports |
| Live weather | `src/weather.js`, `src/weather-card.js` | [Open-Meteo](https://open-meteo.com/) (free, key-less): temperature, condition, sunrise/sunset |
| Auto / Light / Dark theme | `src/theme.js` + the palette block in `styles.css` | Auto reads the local clock *and* the live sky |
| Timer, stopwatch, calculator | `app.js` | Plain local-time maths; independent of the above |

### World clocks name places correctly

Browsers report whatever time-zone ids their bundled ICU knows, so older builds
say `Asia/Katmandu`, `Asia/Calcutta`, `Europe/Kiev`, `Asia/Saigon` or
`Asia/Rangoon`. Tempo folds those legacy ids onto the modern canonical zone
(using tzdb's `backward` links) and labels every clock with its real country,
so the UI reads **Nepal · Kathmandu**, **India · Kolkata**, **Ukraine · Kyiv**,
**Vietnam · Ho Chi Minh City**, **Myanmar · Yangon**. Country names come from
`Intl.DisplayNames`, so they localise with the browser.

* Adding a clock opens a searchable picker listing every zone the browser
  understands, grouped Country → City, with keyboard navigation and filters.
  Searching `calcutta`, `kolkata`, `IN` or `Asia/Kolkata` finds the same place.
* Add, remove (×) and the home zone all still work; saved boards are migrated
  to the modern ids on the next load.

### Weather and the Auto theme

* The "Right now" weather card uses your browser location when it has already
  been granted and otherwise the home-zone city's coordinates (from
  `zone1970.tab`), so nothing is requested without asking. A button in the card
  switches between the two, and °C/°F can be toggled.
* **Auto** (the default) re-tints the whole page from the local clock and the
  live sky: sunrise is warm, a bright day is clean white with a blue sky hero,
  cloud is soft grey, rain is slate blue, snow is icy, a thunderstorm goes dark
  and stormy, and night is dark with a starfield. **Light** and **Dark** fix the
  look instead. The choice is remembered in `localStorage`, and palettes
  cross-fade via registered custom properties (`@property`), with
  `prefers-reduced-motion` respected.

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

`node --test` covers the pure logic in Node (place naming, the tzdb data
pipeline, the Open-Meteo client, the theme decision table) and boots the real
`app.js` in a jsdom document — with `fetch` stubbed — to check the clock labels,
the picker, the weather card, the Auto palette, and that the timer, stopwatch
and calculator still work.

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
