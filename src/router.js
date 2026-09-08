/**
 * A tiny hash router — enough to make Tempo feel like a set of pages instead
 * of one very long scroll.
 *
 * Hash routing (`#/world`) is a deliberate choice: the site is static, served
 * from GitHub Pages with no server to rewrite URLs, so a path router would
 * 404 on a refresh. Hashes also give us the browser's own back/forward buttons
 * and deep links for free.
 *
 * Pages are plain `<section class="page" data-page="…">` elements already in
 * the document: one is visible at a time, the rest are `hidden`. Because the
 * markup is never destroyed, every page keeps its state — a running stopwatch
 * on the Focus page keeps counting while you are on the Clocks page.
 */

export const DEFAULT_ROUTE = "now";

export function routeFromHash(hash, known) {
  const raw = String(hash || "").replace(/^#\/?/, "").trim();
  const id = raw.split(/[?#]/)[0];
  return known.includes(id) ? id : null;
}

/**
 * @param {object} options
 *   @param {Array<{id: string, label: string, page: Element|null}>} routes
 *   @param {() => void} [onChange]  called with the route object after a swap
 *   @param {string} [fallback]      route id used for unknown / empty hashes
 */
export function createRouter({ routes = [], onChange, fallback = DEFAULT_ROUTE } = {}) {
  const known = routes.map((route) => route.id);
  const byId = new Map(routes.map((route) => [route.id, route]));
  const links = [];
  let currentId = null;

  function syncLinks(id) {
    for (const link of links) {
      const active = link.dataset.route === id;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }

  function show(id, { scroll = true } = {}) {
    const route = byId.get(id) || byId.get(fallback);
    if (!route) return null;
    const changed = route.id !== currentId;
    currentId = route.id;

    for (const item of routes) {
      if (!item.page) continue;
      const active = item.id === route.id;
      item.page.hidden = !active;
      item.page.classList.toggle("is-active", active);
      // Re-trigger the entry animation on every navigation.
      if (active) {
        item.page.classList.remove("page-enter");
        // A reflow is what makes the animation restart rather than no-op.
        void item.page.offsetWidth;
        item.page.classList.add("page-enter");
      }
    }

    syncLinks(route.id);
    if (typeof document !== "undefined") {
      // Not `data-route`: that attribute marks the nav links themselves, and
      // `registerLinks()` collects `[data-route]` from the whole document.
      document.body.dataset.currentPage = route.id;
      if (changed) {
        const title = route.title ? `${route.title} — Tempo` : null;
        // The clock owns the document title on the "now" page; elsewhere we
        // put the page name back so browser tabs and history make sense.
        document.documentElement.dataset.routeTitle = title || "";
      }
    }
    if (changed && scroll && typeof document !== "undefined") {
      // Setting scrollTop (with `scroll-behavior: smooth` in CSS) rather than
      // calling window.scrollTo: it is the same result, and it does not trip
      // the "not implemented" error that jsdom and some webviews raise.
      const scroller = document.scrollingElement || document.documentElement;
      if (scroller) scroller.scrollTop = 0;
    }
    if (typeof onChange === "function") onChange(route, { changed });
    return route;
  }

  function resolve() {
    const id = routeFromHash(typeof window !== "undefined" ? window.location.hash : "", known);
    return id || fallback;
  }

  // `navigate()` paints the new page straight away; the hashchange it causes
  // arrives a tick later and must not scroll the page a second time.
  let internalNavigation = false;

  function onHashChange() {
    show(resolve(), { scroll: !internalNavigation });
  }

  return {
    get current() {
      return byId.get(currentId) || null;
    },
    get currentId() {
      return currentId;
    },
    routes,
    registerLinks(selector = "[data-route]") {
      if (typeof document === "undefined") return;
      links.length = 0;
      links.push(...Array.from(document.querySelectorAll(selector)));
      syncLinks(currentId);
    },
    navigate(id, { replace = false } = {}) {
      const target = known.includes(id) ? id : fallback;
      if (typeof window === "undefined" || !window.location) {
        show(target);
        return target;
      }
      const hash = `#/${target}`;
      if (window.location.hash === hash) {
        show(target);
        return target;
      }
      internalNavigation = true;
      if (replace && window.history && window.history.replaceState) {
        window.history.replaceState(null, "", hash);
      } else {
        window.location.hash = hash;
      }
      // Paint now: waiting for the hashchange to land makes navigation feel
      // a frame late on slow devices.
      show(target);
      if (typeof window.setTimeout === "function") {
        window.setTimeout(() => {
          internalNavigation = false;
        }, 0);
      } else {
        internalNavigation = false;
      }
      return target;
    },
    start() {
      if (typeof window !== "undefined") window.addEventListener("hashchange", onHashChange);
      // An empty hash still gets a canonical one, so links copy cleanly.
      if (typeof window !== "undefined" && !routeFromHash(window.location.hash, known)) {
        const id = resolve();
        if (window.history && window.history.replaceState) window.history.replaceState(null, "", `#/${id}`);
      }
      return show(resolve(), { scroll: false });
    },
  };
}
