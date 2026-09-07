/**
 * Searchable place picker — the replacement for the old <select> of cities.
 *
 * It lists every zone the browser understands, grouped Country → City, and
 * keeps typing honest: "kiev" and "kyiv", "calcutta" and "kolkata", "saigon"
 * and "ho chi minh city" all land on the same correctly spelled place.
 *
 * The knowledge lives in tz-places.js; this file is rendering, keyboard
 * support and the small amount of state a picker needs. It is used for both
 * "add a world clock" and "set your home zone", which is why `onPick` receives
 * the mode.
 */

import { allPlaces, pickerRows, recordFor, SUGGESTED_ZONES } from "./tz-places.js";

const suggestedZones = new Set(SUGGESTED_ZONES);

export function createCityPicker({ elements, callbacks = {} }) {
  const els = {
    dialog: elements.dialog,
    form: elements.form,
    title: elements.title,
    eyebrow: elements.eyebrow,
    copy: elements.copy,
    submit: elements.submit,
    close: elements.close,
    search: elements.search,
    list: elements.list,
    count: elements.count,
    summary: elements.summary,
    chips: Array.from(elements.chips ? elements.chips.querySelectorAll("[data-filter]") : []),
  };

  const state = {
    mode: "home",
    homeZone: "",
    query: "",
    filter: "all",
    selected: "",
    rows: [],
    places: [],
    activeIndex: -1,
    open: false,
  };

  const hook = (name, ...args) => {
    const fn = callbacks[name];
    return typeof fn === "function" ? fn(...args) : undefined;
  };

  /* ---------------------------------------------------------- rendering */

  const offsetText = (zone) => {
    const value = hook("formatOffset", zone);
    return typeof value === "string" ? value : "";
  };

  const isAdded = (zone) => Boolean(hook("isAdded", zone));

  function tagsFor(record) {
    const tags = [];
    if (state.mode === "home" && record.id === state.homeZone) tags.push({ text: "Home", kind: "home" });
    if (state.mode === "add" && isAdded(record.id)) tags.push({ text: "On your board", kind: "added" });
    if (suggestedZones.has(record.zone)) tags.push({ text: "Popular", kind: "popular" });
    return tags;
  }

  function optionNode(record, index) {
    const node = document.createElement("div");
    node.className = "picker-option";
    node.setAttribute("role", "option");
    node.id = `picker-option-${index}`;
    node.dataset.zone = record.id;
    node.dataset.place = record.zone;
    node.setAttribute("aria-selected", String(record.id === state.selected));
    if (state.mode === "add" && isAdded(record.id)) node.dataset.disabled = "true";

    const city = document.createElement("span");
    city.className = "picker-city";
    city.textContent = record.city;

    const meta = document.createElement("span");
    meta.className = "picker-meta";
    meta.textContent = [record.country, record.note].filter(Boolean).join(" · ") || record.zone;

    const offset = document.createElement("span");
    offset.className = "picker-offset";
    offset.textContent = offsetText(record.id);

    const tags = tagsFor(record);
    if (tags.length) {
      const wrap = document.createElement("span");
      wrap.className = "picker-tags";
      for (const tag of tags) {
        const item = document.createElement("em");
        item.className = `picker-tag ${tag.kind}`;
        item.textContent = tag.text;
        wrap.appendChild(item);
      }
      node.append(city, meta, wrap, offset);
    } else {
      node.append(city, meta, offset);
    }

    node.title = record.country ? `${record.country} · ${record.city} — ${record.zone}` : record.zone;
    return node;
  }

  function groupNode(label, count, code) {
    const node = document.createElement("div");
    node.className = "picker-group";
    node.setAttribute("role", "presentation");
    const name = document.createElement("span");
    name.textContent = label;
    node.appendChild(name);
    const number = document.createElement("em");
    number.textContent = `${count} ${count === 1 ? "zone" : "zones"}`;
    node.appendChild(number);
    if (code) node.title = code;
    return node;
  }

  function countPlacesInGroup(rows, groupIndex) {
    let count = 0;
    for (let i = groupIndex + 1; i < rows.length && rows[i].type === "place"; i += 1) count += 1;
    return count;
  }

  function render() {
    state.rows = pickerRows(state.query, {
      filter: state.filter === "suggested" ? (record) => suggestedZones.has(record.zone) : null,
    });
    state.places = state.rows.filter((row) => row.type === "place");

    const fragment = document.createDocumentFragment();
    if (!state.rows.length) {
      const empty = document.createElement("p");
      empty.className = "picker-empty";
      empty.textContent = `Nothing matches “${state.query}”. Try a country, a city, or an id like Asia/Kathmandu.`;
      fragment.appendChild(empty);
    }
    state.rows.forEach((row, index) => {
      if (row.type === "group") {
        fragment.appendChild(groupNode(row.country, countPlacesInGroup(state.rows, index), row.code));
      } else {
        fragment.appendChild(optionNode(row.record, index));
      }
    });
    els.list.replaceChildren(fragment);

    const countries = state.rows.filter((row) => row.type === "group").length;
    els.count.textContent =
      state.query || state.filter === "suggested"
        ? `${state.places.length} place${state.places.length === 1 ? "" : "s"}`
        : `${allPlaces().length} zones in ${countries} countries`;

    state.activeIndex = -1;
    updateSummary();
    const selectedIndex = state.places.findIndex((row) => row.record.id === state.selected);
    if (selectedIndex >= 0) setActive(selectedIndex, false);
  }

  function updateSummary() {
    if (!state.selected) {
      els.summary.textContent = "Start typing, or pick from the list below.";
      delete els.summary.dataset.legacy;
      return;
    }
    const record = recordFor(state.selected);
    els.summary.textContent = `${record.label} · ${offsetText(state.selected)} · ${record.zone}`;
    els.summary.dataset.legacy = String(record.legacy);
    els.summary.title = record.legacy
      ? `Your browser reports “${state.selected}”; Tempo maps it to the modern zone id.`
      : record.zone;
  }

  /* --------------------------------------------------------- navigation */

  const optionNodes = () => Array.from(els.list.querySelectorAll(".picker-option"));

  function setActive(index, scroll = true) {
    const options = optionNodes();
    if (!options.length) {
      state.activeIndex = -1;
      els.search.removeAttribute("aria-activedescendant");
      return;
    }
    const clamped = Math.max(0, Math.min(options.length - 1, index));
    state.activeIndex = clamped;
    options.forEach((option, i) => {
      const active = i === clamped;
      option.classList.toggle("active", active);
      if (active) els.search.setAttribute("aria-activedescendant", option.id);
    });
    if (scroll) {
      const node = options[clamped];
      if (node && typeof node.scrollIntoView === "function") node.scrollIntoView({ block: "nearest" });
    }
  }

  function activeZone() {
    const options = optionNodes();
    const node = options[state.activeIndex] || options[0];
    return node ? node.dataset.zone : state.selected;
  }

  function select(zone) {
    if (!zone) return;
    state.selected = zone;
    optionNodes().forEach((option) => option.setAttribute("aria-selected", String(option.dataset.zone === zone)));
    updateSummary();
  }

  function commit() {
    const zone = state.selected || activeZone();
    if (!zone) return;
    if (state.mode === "add" && isAdded(zone)) {
      hook("onBlocked", zone);
      return;
    }
    if (hook("onPick", zone, state.mode) !== false) api.close();
  }

  /* -------------------------------------------------------------- events */

  let typingTimer = 0;

  function attach() {
    els.list.addEventListener("click", (event) => {
      const option = event.target.closest(".picker-option");
      if (!option) return;
      select(option.dataset.zone);
      setActive(optionNodes().indexOf(option), false);
    });
    els.list.addEventListener("dblclick", (event) => {
      if (event.target.closest(".picker-option")) commit();
    });
    els.search.addEventListener("input", () => {
      window.clearTimeout(typingTimer);
      typingTimer = window.setTimeout(() => {
        state.query = els.search.value.trim();
        render();
      }, 40);
    });
    els.search.addEventListener("keydown", (event) => {
      const options = optionNodes();
      const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
      if (step && options.length) {
        event.preventDefault();
        setActive((state.activeIndex < 0 ? -step : state.activeIndex) + step);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        select(activeZone());
        commit();
        return;
      }
      if (event.key === "Home" || event.key === "End") {
        if (!options.length) return;
        event.preventDefault();
        setActive(event.key === "Home" ? 0 : options.length - 1);
        return;
      }
      if (event.key === "Escape" && state.query) {
        event.preventDefault();
        els.search.value = "";
        state.query = "";
        render();
      }
    });
    els.chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        state.filter = chip.dataset.filter === "all" || state.filter === chip.dataset.filter ? "all" : chip.dataset.filter;
        syncChips();
        render();
      });
    });
    if (els.form) els.form.addEventListener("submit", (event) => {
      event.preventDefault();
      commit();
    });
    if (els.close) els.close.addEventListener("click", () => api.close());
    if (els.dialog) {
      els.dialog.addEventListener("click", (event) => {
        if (event.target === els.dialog) api.close();
      });
      els.dialog.addEventListener("cancel", (event) => {
        // Let Escape out of the dialog, but not out of a typed query first.
        if (state.query) {
          event.preventDefault();
          els.search.value = "";
          state.query = "";
          render();
        }
      });
      els.dialog.addEventListener("close", () => {
        state.open = false;
        hook("onClose");
      });
    }
  }

  function syncChips() {
    els.chips.forEach((chip) => {
      const active = chip.dataset.filter === state.filter;
      chip.classList.toggle("active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
  }

  /* ------------------------------------------------------------------ api */

  const api = {
    open(config = {}) {
      state.mode = config.mode || "home";
      state.homeZone = config.homeZone || "";
      state.query = "";
      state.filter = config.filter || "all";
      state.selected = config.selectedZone || "";
      els.search.value = "";
      syncChips();
      if (els.title) els.title.textContent = config.title || "Choose a place";
      if (els.eyebrow) els.eyebrow.textContent = config.eyebrow || "EVERY ZONE ON EARTH";
      if (els.copy) els.copy.textContent = config.copy || "";
      if (els.submit) els.submit.textContent = config.submitLabel || "Use this place";
      render();
      state.open = true;
      if (typeof els.dialog.showModal === "function") els.dialog.showModal();
      else els.dialog.setAttribute("open", "");
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => els.search.focus());
      } else {
        els.search.focus();
      }
    },
    close() {
      if (!state.open) return;
      if (typeof els.dialog.close === "function" && els.dialog.open) els.dialog.close();
      else if (els.dialog) els.dialog.removeAttribute("open");
      state.open = false;
    },
    /** Re-render (offsets change across DST, so the app nudges this hourly). */
    refresh: render,
    select,
    get state() {
      return state;
    },
    get isOpen() {
      return state.open;
    },
  };

  attach();
  return api;
}
