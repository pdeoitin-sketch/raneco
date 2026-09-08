import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

import { createRouter, DEFAULT_ROUTE, routeFromHash } from "../src/router.js";

const KNOWN = ["now", "clocks", "timer", "clock", "focus", "calculator"];

function documentWith(pages) {
  const dom = new JSDOM(
    `<body>
      ${pages.map((id) => `<section class="page" data-page="${id}" ${id === "now" ? "" : "hidden"}></section>`).join("")}
      <nav>
        ${KNOWN.map((id) => `<a data-route="${id}" href="#/${id}">${id}</a>`).join("")}
      </nav>
    </body>`,
    { url: "http://localhost:5173/" }
  );
  return dom;
}

test("hashes map to route ids, and unknown hashes do not", () => {
  assert.equal(routeFromHash("#/clocks", KNOWN), "clocks");
  assert.equal(routeFromHash("#clocks", KNOWN), "clocks");
  assert.equal(routeFromHash("", KNOWN), null);
  assert.equal(routeFromHash("#/nope", KNOWN), null);
  assert.equal(routeFromHash("#/clocks?x=1", KNOWN), "clocks");
  assert.equal(DEFAULT_ROUTE, "now");
});

test("one page is visible at a time, and the nav follows it", async () => {
  const dom = documentWith(KNOWN);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.history = dom.window.history;

  const changes = [];
  const router = createRouter({
    routes: KNOWN.map((id) => ({ id, page: dom.window.document.querySelector(`[data-page="${id}"]`) })),
    onChange: (route, info) => changes.push(`${route.id}:${info.changed}`),
  });
  router.registerLinks("[data-route]");
  const started = router.start();

  assert.equal(started.id, "now", "an empty hash lands on Right now");
  assert.equal(dom.window.location.hash, "#/now", "and the hash is made canonical");

  const visible = () =>
    Array.from(dom.window.document.querySelectorAll(".page"))
      .filter((page) => !page.hidden)
      .map((page) => page.dataset.page);

  assert.deepEqual(visible(), ["now"]);
  assert.equal(dom.window.document.body.dataset.currentPage, "now");
  assert.equal(dom.window.document.querySelector('nav [data-route="now"]').getAttribute("aria-current"), "page");

  router.navigate("clocks");
  assert.deepEqual(visible(), ["clocks"], "navigate paints immediately, without waiting for the hashchange");
  assert.equal(dom.window.document.querySelector('nav [data-route="clocks"]').getAttribute("aria-current"), "page");
  assert.equal(dom.window.document.querySelector('nav [data-route="now"]').hasAttribute("aria-current"), false);
  assert.ok(dom.window.document.querySelector('[data-page="clocks"]').classList.contains("page-enter"));

  router.navigate("nope");
  assert.deepEqual(visible(), ["now"], "an unknown route falls back");

  // onChange fires once per real change (the hashchange echo is not one).
  assert.deepEqual(
    changes.filter((entry) => entry.endsWith(":true")),
    ["now:true", "clocks:true", "now:true"]
  );

  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.history;
});

test("hashchange (browser back and forward) drives the router", async () => {
  const dom = documentWith(KNOWN);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  const router = createRouter({
    routes: KNOWN.map((id) => ({ id, page: dom.window.document.querySelector(`[data-page="${id}"]`) })),
  });
  router.registerLinks("[data-route]");
  router.start();

  dom.window.location.hash = "#/focus";
  await new Promise((done) => setTimeout(done, 30));
  assert.equal(router.currentId, "focus");
  assert.equal(dom.window.document.querySelector('[data-page="focus"]').hidden, false);

  dom.window.location.hash = "#/calculator";
  await new Promise((done) => setTimeout(done, 30));
  assert.equal(router.currentId, "calculator");

  dom.window.location.hash = "#/";
  await new Promise((done) => setTimeout(done, 30));
  assert.equal(router.currentId, "now", "the empty hash is still the landing page");

  delete globalThis.window;
  delete globalThis.document;
});
