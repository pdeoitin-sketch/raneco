import { createHash } from "node:crypto";

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

/**
 * Security headers for the built site.
 *
 * GitHub Pages cannot set HTTP response headers, so the headers ship as
 * `<meta http-equiv>` tags instead. They are injected **at build time only**:
 * the dev server needs its own inline HMR client and WebSocket connection,
 * which a strict CSP would block.
 *
 * The Content-Security-Policy is generated from the HTML it is injected into:
 * every inline `<script>` is allowed by its own SHA-256 hash and nothing
 * else is, so the policy stays correct if the pre-paint theme script ever
 * changes, while `<script>` injection from outside stays blocked.
 */
function securityMetaPlugin() {
  return {
    name: "tempo-security-meta",
    apply: "build",
    enforce: "post",
    transformIndexHtml(html) {
      // Inline scripts carry no attributes: <script>...</script>. Module and
      // stylesheet entries all have src/href attributes and never match.
      const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
      const hashes = inlineScripts.map(
        (source) => `'sha256-${createHash("sha256").update(source, "utf8").digest("base64")}'`
      );
      const directives = [
        "default-src 'self'",
        [`script-src 'self'`, ...hashes].join(" "),
        "style-src 'self' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        // Custom alarm audio may be a direct https link, a local file
        // (blob:) or a data: URL — those three and nothing else.
        "media-src 'self' https: blob: data:",
        "connect-src 'self' https://api.open-meteo.com https://api.bigdatacloud.net",
        // The only documents this page may embed are the key-less YouTube
        // and Spotify players that custom alarm sounds use.
        "frame-src https://www.youtube-nocookie.com https://open.spotify.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
      ];
      const csp = directives.join("; ");
      const meta = [
        `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
        `<meta name="referrer" content="strict-origin-when-cross-origin" />`,
      ].join("\n    ");
      return html.replace("</title>", `</title>\n    ${meta}`);
    },
  };
}

export default defineConfig({
  base: resolveBase(),
  plugins: [securityMetaPlugin()],
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
    // No source maps in production: they would publish the full source,
    // comments and structure of the app to anyone who opens dev tools.
    sourcemap: false,
    // The modulepreload polyfill ships as an inline script; without it the
    // CSP only has to allow the one pre-paint theme script, and every
    // browser Tempo supports (2018 and newer) understands modulepreload
    // natively — older ones simply skip the preload hint.
    modulePreload: { polyfill: false },
  },
});
