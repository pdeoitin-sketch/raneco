import { defineConfig } from "vite";

/**
 * Public base path the built site is served from.
 *
 * GitHub Pages serves project sites from a sub-path
 * (https://<owner>.github.io/<repo>/), so asset URLs must be prefixed with
 * "/<repo>/" or the browser will request them from the site root and get a
 * 404 -- which is exactly why the JavaScript never loaded on Pages.
 *
 * Resolution order:
 *   1. VITE_BASE_PATH  - set explicitly by the deploy workflow (it is derived
 *                        from actions/configure-pages, so it is also correct
 *                        for user/org sites and custom domains where the base
 *                        is simply "/").
 *   2. GITHUB_REPOSITORY - fallback inside any GitHub Actions run: "owner/repo"
 *                        becomes "/repo/".
 *   3. "/"              - local `vite dev` / `vite preview`.
 */
function resolveBase() {
  // An explicitly provided value wins, even when it is empty: configure-pages
  // emits "" for user/org sites and custom domains, which must map to "/".
  const explicit = process.env.VITE_BASE_PATH;
  if (explicit !== undefined) {
    return normalizeBase(explicit);
  }

  const repository = process.env.GITHUB_REPOSITORY;
  if (repository) {
    const repoName = repository.split("/")[1];
    if (repoName && !repoName.endsWith(".github.io")) {
      return normalizeBase(repoName);
    }
  }

  return "/";
}

function normalizeBase(path) {
  const trimmed = String(path).trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
}

export default defineConfig({
  base: "/raneco/",
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
