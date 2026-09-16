# raneco

**Tempo** — a browser dashboard for your local time, **alarms that ring at a
wall-clock time**, a universal calendar with named secondary dates, world
clocks, live weather and forecast, an old-style clock, an interactive timer,
a stopwatch, time calculations, and a dedicated settings view.
Built with [Vite](https://vite.dev/), deployed as a static site: there is no
backend and no API key to manage.

Live site: https://pdeoitin-sketch.github.io/raneco/

## A fluent dashboard, with settings out of the scroll

The main experience is a time-first scroll: alarms, timer, stopwatch, clocks,
standards, calendar and arithmetic come before weather, forecast and About.
**Settings is deliberately different.** It remains a utility on the side and
opens a focused view only when clicked, so preferences never interrupt normal
scrolling. Return to the dashboard and every other tool is still safe and
ready. The sidebar reports where you are as the current section lights up and
the URL quietly follows.

| Section | Anchor | What it does |
| --- | --- | --- |
| **Right now** | `#/now` | Home clock (analog + digital) with the weather glance **beside it** — one snapshot, one request |
| **Alarms** | `#/alarms` | Wall-clock alarms: time, optional date or weekday repeat, label and **notes per alarm**, any of the 16 sounds |
| **Timer** | `#/timer` | Countdown with presets and a **16-sound alarm that keeps ringing** |
| **Stopwatch** | `#/stopwatch` | Centisecond stopwatch with laps, goals and splits |
| **World clocks** | `#/clocks` | Up to 12 places — **hour large and bold, that city's own temperature beside it**, the shift from home and the sun line small underneath |
| **Time standards** | `#/standards` | **UTC, GMT, IST, GST, JST, EST…** — the clocks that are named rather than placed, short form and full form, by region |
| **Calendar** | `#/calendar` | Home-zone month view with **Gregorian as the universal main calendar** (January stays January) and one compact, named secondary date — BS, AH, AP, Śaka, BE and more — plus holidays and **your own notes** |
| **Old clock** | `#/clock` | Full-face clock with **eight faces**, a **live sky behind the dial**, sweep/tick hand and an hourly chime |
| **Time calculator** | `#/calculator` | Difference between two moments, unit conversion, saved results |
| **Weather** | `#/weather` | Live conditions for a point, plus a panel saying *where it thinks you are and how sure it is* |
| **Forecast** | `#/forecast` | Next 24 hours hour-by-hour, next 7 days with highs, lows and rain chance |
| **Settings** | `#/settings` | A dedicated view opened from the sidebar: text size, themes, week start and secondary calendar, holidays, weather units, alarm defaults, notification behaviour, GPS privacy, data wipe and **export/import** |
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
with `replaceState`, so one flick of the wheel does not push a dozen entries
into the back button.

Everything persists in `localStorage`: home place, board, **wall-clock
alarms**, timer settings, **alarm sound, volume and ring duration**, stopwatch
laps, saved calculations, calendar selection, **calendar notes**, the
**preferences** (week start, secondary calendar, holiday sets, GPS switch),
old-clock face, theme, text size, unit system and remarks. Settings →
Export/Import pours that whole `tempo-*` namespace into one JSON file and
restores it back.

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
| **Clock faces** | `src/clock-themes.js` | Roman · Modern · Minimal · Railway · Pocket watch · Neon · Brutalist · Botanical — each one a genuinely different dial, and each explains itself in the picker |
| **Time standards** | `src/time-standards.js` | 50 named clocks as fixed offsets, grouped by region; the ambiguous short forms kept apart |
| **Calendar** | `src/calendar.js` | Month grid tied to the home time zone with a chosen week start; today, selected date, ISO week and day-of-year facts; holiday dots, a legend, and a notes editor on the selected day |
| **Calendar systems** | `src/calendar-systems.js` | Bikram Sambat from an embedded month-length table (BS 2000–2090), the Chinese, Korean (Dangi), Hebrew, Hijri, Persian, Indian, Thai Buddhist and Japanese calendars from the browser's own ICU — feature-detected, honestly omitted when unsupported |
| **Calendar events** | `src/calendar-events.js` | Fixed world days, Easter by the Western computus, 60+ national days (Nepal's counted in BS, Israel's in the Hebrew calendar), lunar new years, tabular-Hijri feasts — all switchable by set |
| **Calendar notes** | `src/calendar-notes.js` | Up to 20 color-coded notes per date, trimmed, capped and pruned when emptied |
| **Preferences** | `src/preferences.js` | One `tempo-preferences` blob for week start / secondary calendar / holiday sets / GPS, plus the shared `tempo-weather-units`, `tempo-alarm-volume/-duration/-notify` keys the tools already read |
| **Data backup** | `src/data-backup.js` | Export/import of the whole `tempo-*` namespace as one validated JSON document |
| **Settings** | `src/settings.js` + `src/theme.js` | Text-size preferences plus Auto/Light/Dark and fixed weather-mood theme choices |
| **Board temperatures** | `src/board-weather.js` | Every world clock's temperature in **one** batched Open-Meteo request, each card in its own country's unit |
| **Weather scenes** | `src/sky-scenes.js` | Eleven scenes behind the old clock, chosen from the live sky; mean-synodic moon phase |
| **Heading phrases** | `src/phrases.js` | Day-number rotation; seasonal lines that flip with latitude |
| **Remarks & feedback** | `src/remarks.js` | Tagged, kept in `localStorage`, handed to your own mail client |
| **Reverse geocoding** | `src/geocode.js` | Names a fix from a real gazetteer, and grades how much to trust it |
| Device location | `src/location.js` | High-accuracy `navigator.geolocation` + zone confirmation + a real place name |
| Solar time | `src/places.js` | Longitude-based sun time, so a wide country stops being one flat clock |
| Weather palettes | `src/theme.js` + the palette block in `styles.css` | Auto palettes keyed on the local clock and live sky, plus manual weather moods from Settings |
| Timer, stopwatch, calculator | `src/timer.js`, `src/stopwatch.js`, `src/calculator.js` | Plain local-time maths; independent of the network |

### The world card, re-read

A world clock is glanced at, not studied, so the card now has an order:

1. **The hour is the headline** — large, bold, tabular, the loudest thing on
   the card.
2. **The temperature sits beside it**, on the right, in **that city's own
   unit**. Chicago reads °F and Chennai reads °C on the same board, because
   that is what each place's own forecast says — not because of a page-wide
   switch. Only the United States, Liberia and Myanmar get Fahrenheit; a bare
   zone or a fix at sea falls back to Celsius.
3. **Everything else is small**, along the bottom: whether it is already
   tomorrow there, the UTC offset, **how far that clock is from your own**
   (`+3H 15M FROM KATHMANDU`), and the solar-time line.

All twelve temperatures come from **one** request. Open-Meteo accepts a
comma-separated coordinate list and answers with one object per location, so
a full board is a single call rather than twelve — and it refreshes every
fifteen minutes, because a temperature is not a second hand. Every failure
path (offline, rate limited, malformed) resolves to a reason rather than
throwing: the cards keep the last number they had, and **a clock is never
taken down by the weather**.

### Time standards — the clocks that are named rather than placed

The world board answers *"what time is it in Tokyo?"*. It cannot answer
*"what is JST?"* — and people ask that constantly, because invitations, server
logs, flight bookings and colleagues all speak in abbreviations. So there is a
section for it, laid out like the world cards on purpose: **hour large, short
form beside it, full form and the distance from your own clock underneath.**

Fifty standards across seven regions — Universal, Europe, Middle East, Asia,
Africa, Americas, Oceania — filterable by region and searchable by short form,
full form, note or zone (`GST`, `gulf`, `japan` and `kathmandu` all find
something). A 24 h / 12 h switch is remembered.

Two decisions worth stating:

* **A standard is a fixed offset, not a zone.** EST is −05:00 all year; New
  York in July is EDT, a *different* standard. Nothing here consults a DST
  table, so what you see is the standard itself rather than a city that may
  have moved its clocks.
* **The ambiguous short forms are kept apart.** "IST" is claimed by India
  (+05:30) and Israel (+02:00); "AST" by Arabia (+03:00) and Atlantic Canada
  (−04:00); "CST" by China (+08:00) and Chicago (−06:00); "BST" by Britain
  (+01:00) and Bangladesh (+06:00). Each gets its own id and its own card, and
  searching `IST` honestly returns both.

### The old clock's faces, fixed

The eight faces existed but several of them were not really faces, and a few
were broken outright. All of the following were found and fixed:

* **The "Tick" setting did not tick.** `src/clock-face.js` restamps a `.tick`
  class on the second hand every whole second precisely so CSS can animate the
  mechanical overshoot — and the stylesheet never had the keyframes. "Tick"
  was "Sweep" minus the smoothing. There is now a `hand-tick` animation, and
  it stills under `prefers-reduced-motion`.
* **Roman was not a face.** It was one `font-family` rule sitting on the base
  dial, which made Roman and Modern the same clock in two typefaces. It is now
  a warm ivory dial with a chapter ring and blued-steel hands.
* **Brutalist went blank in dark mode.** It hard-codes a paper-white dial but
  painted its numerals in `var(--ink)`, which turns near-white when the page
  does. Its ink is hard-coded to match its paper.
* **The botanical leaves were on the wrong hours.** They were placed with
  `:nth-child(1, 4, 7, 10)`, but the glyphs are built 1…12, so the "quarters"
  landed on I, IV, VII and X. Every glyph now reports the hour it stands for
  (`data-hour`), and the leaves sit on 12, 3, 6 and 9.
* **The pocket watch's crown never drew.** The bow hung off
  `.old-clock-stage[data-clock-theme="pocket"]` — an attribute the stage is
  never given — so only a clipped stub of the stem appeared. Both parts now
  hang off the stage, which is the element with room above the dial.
* **Minimal had no "up".** With no numerals the batons *are* the dial, and
  twelve was no heavier than any other; it is now unmistakable.
* **Railway, Neon, Pocket and Botanical** inherited the base dial's pale
  decorative inner ring, invisible or wrong on each of their own backgrounds,
  and their minute ticks vanished into the paper. Each face now tints its own
  ring and ticks; Railway also gets the counterweight disc a station clock's
  second hand actually has.
* **A live sky erased Brutalist and Minimal.** The shared translucent dial
  behind a weather scene removed Brutalist's opaque paper and hard shadow
  (leaving a generic face with a thick border) and left Minimal with too
  little contrast to read. Both are now exempt.
* **Every face explains itself.** Each one has carried a line of copy in
  `src/clock-themes.js` since the faces were added, and nothing ever rendered
  it — the picker was eight unlabelled words. The note now shows under the
  buttons.

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

### Settings: a focused view, not a scroll interruption

Settings opens from the sidebar as its own focused view. It includes:

* **Text size** — Compact, Default, Large and Extra large. The base ramp stays
  readable (no tiny 7.5px captions coming back), while the major reading
  surfaces scale from 94% to 124%. The choice is saved as `tempo-text-size`
  and restored by the pre-paint script so reloads do not flash at the wrong
  size.
* **Themes** — Auto, Light, Dark, plus manual moods: Sunny, Cloudy, Rainy,
  Snowy, Thunderous, Windy, Foggy, Sunrise, Sunset and Night. **Auto** still
  derives the look from the home place's local clock and live weather; a manual
  mood locks the palette until Auto is chosen again.

Auto re-tints the page from the local clock *and* the live sky: sunrise, sunny
day, cloud, fog, rain, wind, snow, sunset, storm, clear night and night-weather
combinations. Wind only shows its palette when the wind is genuinely worth
mentioning (≥ 26 km/h sustained, or a ≥ 48 km/h gust) and the card then says
*breezy*, *windy* or *gusting*, with direction. Palettes cross-fade through
registered custom properties (`@property`) and `prefers-reduced-motion` is
respected.

The same view also owns week start and secondary-calendar preferences, holiday
sets, weather units, alarm volume and duration, notification behaviour, GPS
privacy controls, full local-data clearing, and JSON export/import.

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
| `tests/time-standards.test.mjs` | Every record complete with a unique id; the ambiguous short forms (IST ×2, AST ×2, CST ×2, BST ×2) kept apart; the quarter- and half-hour clocks (+05:45, +04:30, +03:30, +06:30, +09:30, −03:30) exact; every daylight standard exactly one hour off its standard; unknown ids return `null` rather than a silent default; region grouping loses nothing; search reads short form, full form, note and zone; the clock is the offset applied to the instant (including the day that has already rolled over), 12-hour reads midnight as 12 AM and noon as 12 PM, and the shift sentence never says "0h ahead" |
| `tests/board-weather.test.mjs` | One request for the whole board (a comma-separated coordinate list), capped at twelve; the reply keyed back to the places asked about; **each card in its own country's unit in the same request**; a single location's object form read as well as the array form; a location with no reading skipped rather than filled with a confident 0 °C; and every failure path — no places, no coordinates, no `fetch`, HTTP error, empty body, thrown network error — resolving to a reason instead of throwing |
| `tests/calendar.test.mjs` | Plain dates parse without the device zone; the month grid is Monday-first and six weeks tall; today, selected dates and weekends are marked; ISO week, day-of-year, leap-year and relative-date facts are pinned; month navigation crosses years; **week starts rotate** — Sunday- and Saturday-first grids lead with the right days without moving the dates |
| `tests/calendar-systems.test.mjs` | The BS epoch (2000-01-01 BS = 1943-04-14 AD), real Nepali New Years (2082 → 2025-04-14, 2083 → 2026-04-14) and the table's honest edges; the inverse conversion; ICU-backed systems reading real days (a Horse-year CNY, Ramadan flagged approximate, Reiwa eras); zodiac mapping |
| `tests/calendar-events.test.mjs` | Fixed world days; Easter by computus (2026-04-05, 2025-04-20, 2024-03-31) with Good Friday/Easter Monday; shared independence days (Aug 15 = India and Korea both); lunar new years (CNY/Seollal 2026-02-17, Nowruz 2026-03-21); Nepal's BS-counted national days (Republic May 29, Constitution Sep 19, Democracy Feb 19); tabular Hijri feasts flagged approximate; disabling a set removes only its events |
| `tests/calendar-notes.test.mjs` | Notes pin/list/unpin per date with the last removal pruning the date; text trimmed at 280 and capped at 20 per day; colours validated; a corrupt store reads empty instead of throwing |
| `tests/preferences.test.mjs` | Defaults survive a corrupt blob; patches merge and persist; unrecognised values are inert; the shared time keys write the exact shapes the tools read (volume as a 0–1 gain, duration 0 = "until dismissed", units auto/metric/imperial) |
| `tests/data-backup.test.mjs` | Export gathers every `tempo-*` key and nothing else; build → parse → import round-trips; import restores rather than merges; malformed, foreign, future-version and key-smuggling files are refused politely |
| `tests/settings.test.mjs` | Text-size options are ordered and sanitised, old raw scale values migrate on read, storage writes the new key, and applying a size sets the root data hook and scale variable |
| `tests/phrases.test.mjs` | Day numbers are stable within a local day; every section's line comes from its own pool (time for clocks and settings, sky for weather); the forecast's seasonal line flips with latitude; `seasonFor()` knows both hemispheres; rotation is by day, sections differ, and an unknown section still gets a line |

The earlier suites (alarm sounds, geocode, forecast, router, and friends) are
still in place; the alarm-sounds suite renders all 16 sounds into a recording
fake `AudioContext`, and the geocode suite still checks that a Bhaktapur fix is
named *Bhaktapur*, not Kathmandu.

The smoke test additionally checks the time-first dashboard and its dedicated
Settings route, that a phrase sits under every heading, and that Settings can
apply text size and manual weather moods — including that the units
choice refetches weather in Fahrenheit, the volume slider writes the shared
gain key, the geo master switch disables every GPS button, and a browser
without the Notification API is told so honestly — that Calendar renders a
home-zone month and persists a selected day, carries a Bikram Sambat second
date in every cell, marks Constitution Day's dot on Ashwin 3, keeps world-day
dots when the national set is hidden, reflows the grid when weeks start on
Sunday, and pins and unpins a note to a date with the store to match, that a
wall-clock alarm rings when the clock
reaches it and the page scrolls to it, that the Right-now glance and the
Weather section render the same snapshot from one request, that the old clock
wears all eight faces and upgrades an old numeral save, that each face is more
than one CSS declaration (Roman used to be a single font rule), that the tick
animation the renderer asks for actually exists, that Brutalist's ink is
hard-coded to match its hard-coded paper, that the botanical leaves are placed
by hour rather than by child position, and that each face's note is rendered;
that every world card leads with its hour and carries a temperature in its own
country's unit from a single batched request, that the shift line is measured
from home and re-measured when home moves; that the Time standards section
renders short form and full form, filters by region, searches, and remembers
its 24 h / 12 h choice; that the scene behind the old clock follows the live
sky, that remarks are tagged, kept and handed to your own
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
