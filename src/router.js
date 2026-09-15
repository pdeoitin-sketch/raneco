/**
 * Scroll-spy navigation — one page, many sections.
 *
 * Tempo used to be six routed pages behind a sidebar. Everything worked, but
 * seeing two facts meant two clicks and a repaint, and the app felt like a
 * filing cabinet rather than a dashboard. So the pages became **sections of a
 * single scroll**: the sidebar is still there, but it now reports where you
 * are instead of deciding what you may see.
 *
 * Three things this has to get right:
 *
 *   1. **Old links must not break.** `#/timer` was a real URL people could
 *      have bookmarked, and it still resolves — to a smooth scroll to the
 *      timer section. `routeFromHash()` keeps its old signature and its old
 *      tests.
 *   2. **The hash must follow the scroll**, so copying the URL copies where
 *      you are — but via `replaceState`, otherwise a single flick of the
 *      wheel would push six entries into the back button.
 *   3. **Programmatic scrolls must not fight the spy.** While an anchor click
 *      is animating, observer callbacks are ignored; otherwise the highlight
 *      strobes through every section it passes on the way down.
 *
 * `IntersectionObserver` does the watching (cheap, off the main thread) with a
 * scroll-position fallback for browsers and test environments that lack it.
 */

export const DEFAULT_ROUTE = "now";

/**
 * `#/timer` -> "timer". Unchanged from the routed build, so old bookmarks,
 * old links and the existing router tests all keep working.
 */
export function routeFromHash(hash, known) {
  const raw = String(hash || "").replace(/^#\/?/, "").trim();
  const id = raw.split(/[?#]/)[0];
  return known.includes(id) ? id : null;
}

/**
 * Which section the reader is looking at, from geometry alone.
 *
 * The last section whose top has crossed an imaginary line just below the top
 * bar is the one being read. Returns `null` when the document has no layout
 * at all — every rect is zero in jsdom, in a `display:none` ancestor and
 * before the first paint, and guessing from that would light up whichever
 * section happens to be last.
 */
export function activeFromPositions(entries, { scrollTop = 0, viewportHeight = 800, offset = 120 } = {}) {
  if (!entries.length) return null;
  const measured = entries.some((entry) => entry.bottom > entry.top);
  if (!measured) return null;

  const line = scrollTop + offset;
  let best = entries[0];
  for (const entry of entries) {
    if (entry.top <= line + 8) best = entry;
  }
  // At the very bottom of the page the last section can never reach the line,
  // so it would never light up. Hand it the highlight explicitly.
  const last = entries[entries.length - 1];
  if (last.bottom > 0 && scrollTop + viewportHeight >= last.bottom - 4) return last.id;
  return best.id;
}

/**
 * @param {object} options
 *   @param {Array<{id: string, page: Element|null, title?: string}>} sections
 *   @param {(section: object, info: {changed: boolean, reason: string}) => void} [onChange]
 *   @param {string} [fallback]
 *   @param {Record<string, string>} [aliases] old route ids that still
 *        resolve — e.g. `{ focus: "stopwatch" }` keeps a bookmarked `#/focus`
 *        landing on the section that used to be called Focus.
 */
export function createScrollNav({ sections = [], onChange, fallback = DEFAULT_ROUTE, offset = 120, aliases = {} } = {}) {
  const known = sections.map((section) => section.id);
  const byId = new Map(sections.map((section) => [section.id, section]));
  const links = [];
  let currentId = null;
  let observer = null;
  let settling = 0;
  let hashTimer = 0;
  const seen = new Set();

  /** A hash, honouring the alias table for ids that were renamed. */
  function routeFromHashAliased(hash) {
    const id = routeFromHash(hash, known);
    if (id) return id;
    const raw = String(hash || "").replace(/^#\/?/, "").trim().split(/[?#]/)[0];
    const aliased = aliases[raw];
    return aliased && known.includes(aliased) ? aliased : null;
  }

  function syncLinks(id) {
    for (const link of links) {
      const active = link.dataset.route === id;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  }

  function markActive(id, reason) {
    const section = byId.get(id);
    if (!section) return;
    const changed = id !== currentId;
    currentId = id;
    syncLinks(id);

    for (const item of sections) {
      if (!item.page) continue;
      item.page.classList.toggle("is-active", item.id === id);
    }

    if (typeof document !== "undefined") {
      document.body.dataset.currentPage = id;
      if (changed && section.title) document.documentElement.dataset.routeTitle = `${section.title} — Tempo`;
    }

    // The URL should describe where you are, without filling the back button
    // with every section you scrolled past.
    if (changed && reason !== "hash" && typeof window !== "undefined" && window.history && window.history.replaceState) {
      if (hashTimer) clearTimeout(hashTimer);
      hashTimer = setTimeout(() => {
        try {
          window.history.replaceState(null, "", `#/${id}`);
        } catch (_) {
          /* a sandboxed iframe can refuse; the highlight is what matters */
        }
      }, 120);
    }

    const first = !seen.has(id);
    if (first) seen.add(id);
    if (typeof onChange === "function") onChange(section, { changed, reason, first });
  }

  /** Where a section sits in the document, for the fallback spy. */
  function positions() {
    return sections
      .filter((section) => section.page)
      .map((section) => {
        const rect = section.page.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
        return { id: section.id, top: rect.top + scrollTop, bottom: rect.bottom + scrollTop };
      });
  }

  function isFullscreenActive() {
    return (
      typeof document !== "undefined" &&
      Boolean(
        document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullScreenElement ||
          document.msFullscreenElement
      )
    );
  }

  function spyByPosition() {
    if (settling > Date.now() || isFullscreenActive()) return;
    const scroller = document.scrollingElement || document.documentElement;
    const id = activeFromPositions(positions(), {
      scrollTop: scroller ? scroller.scrollTop : 0,
      viewportHeight: window.innerHeight || 800,
      offset,
    });
    if (id) markActive(id, "scroll");
  }

  function startObserver() {
    if (typeof IntersectionObserver !== "function") return false;
    // A band across the upper third of the viewport: a section is "current"
    // when its content is where the eye is, not when it first peeks in.
    observer = new IntersectionObserver(
      (entries) => {
        if (settling > Date.now() || isFullscreenActive()) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (!visible.length) return;
        const id = visible[0].target.dataset.page;
        if (id) markActive(id, "scroll");
      },
      { rootMargin: `-${offset}px 0px -55% 0px`, threshold: [0, 0.15, 0.4] }
    );
    for (const section of sections) if (section.page) observer.observe(section.page);
    return true;
  }

  function scrollToSection(id, { smooth = true } = {}) {
    const section = byId.get(id) || byId.get(fallback);
    if (!section || !section.page) return null;
    // Ignore the spy while the smooth scroll travels, or the highlight flickers
    // through every section between here and there.
    settling = Date.now() + (smooth ? 700 : 80);
    markActive(section.id, "jump");
    try {
      const reduce =
        typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      section.page.scrollIntoView({ behavior: smooth && !reduce ? "smooth" : "auto", block: "start" });
    } catch (_) {
      // jsdom and older webviews: fall back to a plain offset jump.
      const scroller = document.scrollingElement || document.documentElement;
      if (scroller) {
        const rect = section.page.getBoundingClientRect();
        scroller.scrollTop = rect.top + (window.pageYOffset || scroller.scrollTop || 0) - offset + 20;
      }
    }
    return section;
  }

  function onHashChange() {
    const id = routeFromHashAliased(window.location.hash);
    if (!id) return;
    if (id === currentId) return;
    scrollToSection(id);
  }

  return {
    get current() {
      return byId.get(currentId) || null;
    },
    get currentId() {
      return currentId;
    },
    sections,
    routes: sections,
    registerLinks(selector = "[data-route]") {
      if (typeof document === "undefined") return;
      links.length = 0;
      links.push(...Array.from(document.querySelectorAll(selector)));
      for (const link of links) {
        link.addEventListener("click", (event) => {
          const id = link.dataset.route;
          if (!known.includes(id)) return;
          event.preventDefault();
          scrollToSection(id);
          try {
            if (window.history && window.history.replaceState) window.history.replaceState(null, "", `#/${id}`);
          } catch (_) {
            /* not fatal */
          }
        });
      }
      syncLinks(currentId);
    },
    /** Kept for callers that used the router: jump instead of swap. */
    navigate(id, { smooth = true } = {}) {
      const target = known.includes(id) ? id : fallback;
      scrollToSection(target, { smooth });
      return target;
    },
    scrollToSection,
    /** Every section is always in the DOM now; this reports, not decides. */
    isVisible(id) {
      return currentId === id;
    },
    start() {
      if (typeof window === "undefined") return null;
      window.addEventListener("hashchange", onHashChange);

      const observed = startObserver();
      if (!observed) {
        window.addEventListener("scroll", spyByPosition, { passive: true });
        window.addEventListener("resize", spyByPosition);
      }
      // Even with an observer, one positional read settles the initial state
      // in environments where the observer never fires (jsdom, print).
      const landing = routeFromHashAliased(window.location.hash);
      markActive(landing || fallback, "hash");
      if (landing) {
        // Let the layout settle before jumping to a deep-linked section.
        window.setTimeout(() => scrollToSection(landing, { smooth: false }), 60);
      }
      if (!observed) window.setTimeout(spyByPosition, 80);
      return byId.get(currentId) || null;
    },
    stop() {
      if (observer) observer.disconnect();
      observer = null;
      if (typeof window !== "undefined") {
        window.removeEventListener("hashchange", onHashChange);
        window.removeEventListener("scroll", spyByPosition);
      }
    },
  };
}

/**
 * Back-compatible alias.
 *
 * The old `createRouter({ routes, onChange })` call signature still resolves,
 * so nothing that imported it breaks — it simply scrolls instead of swapping.
 */
export function createRouter({ routes = [], sections, ...rest } = {}) {
  return createScrollNav({ sections: sections || routes, ...rest });
}
