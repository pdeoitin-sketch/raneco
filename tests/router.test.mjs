import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

import { activeFromPositions, createScrollNav, createRouter, DEFAULT_ROUTE, routeFromHash } from "../src/router.js";

const KNOWN = ["now", "weather", "forecast", "clocks", "timer", "clock", "focus", "calculator"];

/**
 * jsdom has no layout, so every `getBoundingClientRect()` is zero. The spy
 * refuses to guess from that (see `activeFromPositions`), which is what these
 * tests lean on: navigation here is deliberate — a click or a hash — never
 * inferred geometry.
 */
function documentWith(sections, { hash = "" } = {}) {
  return new JSDOM(
    `<body>
      <nav>
        ${KNOWN.map((id) => `<a class="nav-link" data-route="${id}" href="#/${id}">${id}</a>`).join("")}
      </nav>
      ${sections.map((id) => `<section class="page" data-page="${id}"></section>`).join("")}
    </body>`,
    { url: `http://localhost:5173/${hash}` }
  );
}

function install(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.history = dom.window.history;
  dom.window.Element.prototype.scrollIntoView = function scrollIntoView() {};
}

function uninstall() {
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.history;
}

test("hashes map to section ids, and unknown hashes do not", () => {
  assert.equal(routeFromHash("#/clocks", KNOWN), "clocks");
  assert.equal(routeFromHash("#clocks", KNOWN), "clocks");
  assert.equal(routeFromHash("", KNOWN), null);
  assert.equal(routeFromHash("#/nope", KNOWN), null);
  assert.equal(routeFromHash("#/clocks?x=1", KNOWN), "clocks");
  // Sections added by the single-scroll upgrade resolve like any other.
  assert.equal(routeFromHash("#/weather", KNOWN), "weather");
  assert.equal(routeFromHash("#/forecast", KNOWN), "forecast");
  assert.equal(DEFAULT_ROUTE, "now");
});

test("the spy picks the last section to cross the reading line", () => {
  const layout = [
    { id: "now", top: 0, bottom: 900 },
    { id: "weather", top: 900, bottom: 1800 },
    { id: "forecast", top: 1800, bottom: 2700 },
  ];
  const at = (scrollTop) => activeFromPositions(layout, { scrollTop, viewportHeight: 800, offset: 120 });

  assert.equal(at(0), "now");
  assert.equal(at(400), "now", "still reading the first section");
  assert.equal(at(800), "weather", "its heading has passed under the top bar");
  assert.equal(at(1700), "forecast");

  // The bottom of the document belongs to the last section, which can never
  // reach the line on a short final block.
  assert.equal(at(1950), "forecast");

  // A document with no layout (jsdom, display:none, pre-paint) is not a
  // reason to light up whichever section happens to be last.
  assert.equal(activeFromPositions([{ id: "now", top: 0, bottom: 0 }], { scrollTop: 0 }), null);
  assert.equal(activeFromPositions([], {}), null);
});

test("clicking the nav marks a section without hiding the others", () => {
  const dom = documentWith(KNOWN);
  install(dom);

  const changes = [];
  const nav = createScrollNav({
    sections: KNOWN.map((id) => ({ id, page: dom.window.document.querySelector(`[data-page="${id}"]`) })),
    onChange: (section, info) => changes.push(`${section.id}:${info.changed}`),
  });
  nav.registerLinks("[data-route]");
  nav.start();

  const visible = () =>
    Array.from(dom.window.document.querySelectorAll(".page")).filter((page) => !page.hidden).length;

  assert.equal(nav.currentId, "now", "an empty hash starts at the top");
  assert.equal(visible(), KNOWN.length, "every section stays in the document");
  assert.equal(dom.window.document.body.dataset.currentPage, "now");
  assert.equal(dom.window.document.querySelector('nav [data-route="now"]').getAttribute("aria-current"), "true");

  dom.window.document.querySelector('nav [data-route="timer"]').click();
  assert.equal(nav.currentId, "timer");
  assert.equal(visible(), KNOWN.length, "navigating still hides nothing");
  assert.equal(dom.window.document.querySelector('nav [data-route="timer"]').getAttribute("aria-current"), "true");
  assert.equal(dom.window.document.querySelector('nav [data-route="now"]').hasAttribute("aria-current"), false);
  assert.ok(dom.window.document.querySelector('[data-page="timer"]').classList.contains("is-active"));

  nav.navigate("nope");
  assert.equal(nav.currentId, "now", "an unknown id falls back to the top");

  assert.deepEqual(
    changes.filter((entry) => entry.endsWith(":true")),
    ["now:true", "timer:true", "now:true"]
  );

  nav.stop();
  uninstall();
});

test("a deep link scrolls to its section, and old page links still work", async () => {
  // #/timer was a real routed URL before the single-scroll upgrade. Anyone
  // who bookmarked it must land on the timer, not on a 404 or the top.
  const dom = documentWith(KNOWN, { hash: "#/timer" });
  install(dom);

  const nav = createScrollNav({
    sections: KNOWN.map((id) => ({ id, page: dom.window.document.querySelector(`[data-page="${id}"]`) })),
  });
  nav.registerLinks("[data-route]");
  nav.start();

  assert.equal(nav.currentId, "timer", "the hash chose the section");
  assert.equal(dom.window.document.querySelector('nav [data-route="timer"]').getAttribute("aria-current"), "true");

  nav.stop();
  uninstall();
});

test("hashchange (browser back and forward) still moves the reader", async () => {
  const dom = documentWith(KNOWN);
  install(dom);

  const nav = createScrollNav({
    sections: KNOWN.map((id) => ({ id, page: dom.window.document.querySelector(`[data-page="${id}"]`) })),
  });
  nav.registerLinks("[data-route]");
  nav.start();

  dom.window.location.hash = "#/focus";
  await new Promise((done) => setTimeout(done, 40));
  assert.equal(nav.currentId, "focus");

  dom.window.location.hash = "#/weather";
  await new Promise((done) => setTimeout(done, 40));
  assert.equal(nav.currentId, "weather", "a section added by the upgrade is reachable by hash");

  dom.window.location.hash = "#/nope";
  await new Promise((done) => setTimeout(done, 40));
  assert.equal(nav.currentId, "weather", "an unknown hash leaves the reader where they were");

  nav.stop();
  uninstall();
});

test("createRouter is kept as an alias, so old call sites still work", () => {
  const dom = documentWith(KNOWN);
  install(dom);

  const router = createRouter({
    routes: KNOWN.map((id) => ({ id, page: dom.window.document.querySelector(`[data-page="${id}"]`) })),
  });
  router.registerLinks("[data-route]");
  router.start();
  assert.equal(router.navigate("clocks"), "clocks");
  assert.equal(router.currentId, "clocks");

  router.stop();
  uninstall();
});
