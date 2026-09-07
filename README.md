# Tempo — time, made useful

A calm, single-page dashboard for keeping up with time: your local clock, clocks from around the world, a countdown timer, a stopwatch, an alarm, and time calculators. Pure HTML/CSS/JS with no runtime dependencies — Vite is only the dev server.

## Features

- **Right now** — live digital + analog clock for your home time zone (auto-detected, changeable), full date, UTC offset, day-progress bar, and a countdown until midnight. Toggle **12H / 24H** display — your choice is remembered.
- **World clocks** — up to eight clocks for any IANA time zone (every region on Earth is in the picker). Each card shows the local time, UTC offset, and whether it's ahead/behind your day (yesterday / same day / tomorrow).
- **Timer** — set minutes:seconds (or tap a preset), start/pause/reset, progress ring, and an audio chime when time is up.
- **Stopwatch** — start/pause/reset with centisecond precision and laps (with split times).
- **Alarm** — pick a time, arm it, and it rings in your home zone with a stop and a **snooze 10 min** option. Shows how long until it fires.
- **Time calculator**
  - *Between two moments* — e.g. "today" → "15 days from now at 2:00 AM": total days/hours/minutes/seconds, in words, and a **live ticking "time remaining"** strip while the target is in the future.
  - *Quick converter* — turn any number of days/hours/minutes/seconds/weeks into the other units (5 days = 120 hours = 7,200 minutes = 432,000 seconds).
  - Calculations are computed in your home time zone and can be **saved** for later (localStorage).
- **Dark mode**, responsive layout down to small phones, live time in the browser tab title.

## Run it

```bash
npm install
npm run dev        # dev server on http://localhost:5173 (host 0.0.0.0)
npm run build      # production build into dist/
npm run preview    # serve the production build
```

No build step is required to view the site — open `index.html` directly in a browser if you prefer.

## Notes

- All preferences (home zone, world clocks, hour format, theme, saved calculations) live in `localStorage`.
- Alarm/timer audio uses the Web Audio API; browsers allow it once you've interacted with the page (arming the timer or alarm unlocks it).
