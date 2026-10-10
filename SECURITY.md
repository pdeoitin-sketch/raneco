# Security policy — Tempo

## The shape of this project

Tempo is a **purely static, client-side dashboard** built with Vite and
deployed to GitHub Pages. That shape decides what security means for it:

| Classic web-app concern | Status here |
| --- | --- |
| API keys / secrets | **None exist.** Every third-party API Tempo calls (Open-Meteo, BigDataCloud) is key-less by design, and YouTube/Spotify are used only through their official key-less embed players. There is nothing to hide because there is nothing to leak. |
| Server, API endpoints | **None.** There is no server code in this repository. |
| Admin routes | **None.** No routes are privileged because no routes are protected — every page is public static content. |
| Authentication / authorization | **None, by design.** Nothing on this site is per-user on a server; the "memory" (alarms, notes, preferences) lives in the visitor's own `localStorage`. There is no account to protect and no data of one visitor reachable by another. |
| Database | **None.** `localStorage` only. The backup/restore feature validates the imported JSON strictly (see below). |
| Passwords | **None** are stored, so there is nothing to hash. |

## What is actually defended, and how

### Cross-site scripting (XSS)
Every place where stored or fetched text is rendered through `innerHTML`,
it is passed through the `escapeHTML()` helper in `src/ui.js`; everything
else is rendered with `textContent` or DOM APIs. Pasted media links are
parsed by `parseMediaLink()` in `src/alarm-sounds.js`, which:

- caps input length (2 048 characters),
- matches YouTube video ids, playlist ids and Spotify ids against strict
  character sets before they may reach an `<iframe src>`,
- only lets `http(s)`, `blob:` and `data:` URLs reach an `<audio>` element,
  so `javascript:` and friends can never become a media source.

### Content Security Policy
The production build carries a strict CSP (`script-src 'self'` plus the
SHA-256 hash of the one pre-paint inline script, locked-down `connect-src`,
`frame-src`, `media-src`, `object-src 'none'`, `base-uri`, `form-action`,
`upgrade-insecure-requests`) and a `strict-origin-when-cross-origin`
referrer policy. GitHub Pages cannot set HTTP headers, so the policy ships
as `<meta http-equiv>` tags, injected at build time by the
`tempo-security-meta` plugin in `vite.config.js`. The inline-script hash is
computed from the HTML itself, so the policy cannot drift from the code.
Source maps are disabled in production builds.

### Supply chain
- Dependencies are locked (`package-lock.json`), installed with `npm ci`,
  and gated in CI by `npm audit --audit-level=high`.
- GitHub Actions are pinned to full commit SHAs, not moving tags.
- The CI token carries the least privilege the deployment needs.

### Rate limiting
There is no server to rate-limit. The client protects the free public APIs
it uses instead: location lookups have a 5-second cooldown on top of the
in-flight button disable, weather refreshes are time-gated (15–30 minutes),
every network call has a timeout via `AbortController`, and requests stop
entirely when the browser reports it is offline.

### Privacy
Custom alarm embeds load YouTube through `youtube-nocookie.com` and all
embed iframes set `referrerpolicy="no-referrer"`. Location is only ever
requested after an explicit button press and can be switched off in
Settings. Nothing leaves the device except the weather/geocoding calls the
visitor triggered.

## Keeping it that way

- Run `npm audit` before updating; CI enforces it.
- Never add a secret to this repository. It is public, its history is
  public, and the site needs no secrets at all. If one ever lands by
  accident, treat it as compromised and rotate it — deleting the commit is
  not enough until the history is rewritten.
- New `.env`-style files are covered by `.gitignore`; keep it that way.
- Any new rendering of stored/external text must go through `escapeHTML()`
  or `textContent`.

## Reporting a vulnerability

Open a GitHub issue, or — for anything you would rather not discuss in
public — contact the repository owner directly. This is a volunteer project
without a security inbox; expect a best-effort response.
