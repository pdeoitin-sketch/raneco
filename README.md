# raneco

**Tempo** — a browser dashboard for your local time, world clocks, a countdown
timer, a stopwatch, and time calculations. Built with [Vite](https://vite.dev/).

Live site: https://pdeoitin-sketch.github.io/raneco/

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
2. builds the site with `vite build`, passing the Pages base path
   (`/raneco`) so asset URLs resolve under the project sub-path,
3. uploads `dist/` as the Pages artifact and deploys it.

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
