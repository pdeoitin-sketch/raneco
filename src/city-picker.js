/**
 * Searchable place picker.
 *
 * One dialog, four jobs: set the home place, add a world clock, choose where
 * the weather looks, and pick the city the Old clock shows. It lists every
 * time zone *and* every curated city, grouped Country → City, and keeps typing
 * honest: "kiev" and "kyiv", "calcutta" and "kolkata", "saigon" and
 * "ho chi minh city" all land on the same correctly spelled place.
 *
 * The knowledge lives in places.js; this file is rendering, keyboard support
 * and the small amount of state a picker needs.
 */

import { allPlaceRecords, placeGroups, placeRecord, POPULAR_PLACES, searchPlacesAny, zoneOffsetLabel } from "./places.js";

const popular = new Set(POPULAR_PLACES);

const FILTERS = {
  all: () => true,
  suggested: (record) => popular.has(record.id),
  city: (record) => record.kind === "city",
  zone: (record) => record.kind === "zone",
};

export function createCityPicker({ elements, callbacks = {} } = {}) {
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
    useLocation: elements.useLocation || null,
  };

  const state = {
    mode: "home",
    homeId: "",
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

  /* --------------------------------------------------------- formatting */

  const offsetText = (id) => {
    const value = hook("formatOffset", id);
    return typeof value === "string" ? value : zoneOffsetLabel(placeRecord(id).zone);
  };

  const isAdded = (id) => Boolean(hook("isAdded", id));

  /* ---------------------------------------------------------- rendering */

  function tagsFor(record) {
    const tags = [];
    if (state.mode === "home" && record.id === state.homeId) tags.push({ text: "Home", kind: "home" });
    if (state.mode === "add" && isAdded(record.id)) tags.push({ text: "On your board", kind: "added" });
    if (popular.has(record.id)) tags.push({ text: "Popular", kind: "popular" });
    if (record.kind === "city") tags.push({ text: "City", kind: "city" });
    return tags;
  }

  function optionNode(record, index) {
    const node = document.createElement("div");
    node.className = "picker-option";
    node.setAttribute("role", "option");
    node.id = `picker-option-${index}`;
    node.dataset.place = record.id;
    node.dataset.zone = record.zone;
    node.setAttribute("aria-selected", String(record.id === state.selected));
    if (state.mode === "add" && isAdded(record.id)) node.dataset.disabled = "true";

    const city = document.createElement("span");
    city.className = "picker-city";
    city.textContent = record.city;

    const meta = document.createElement("span");
    meta.className = "picker-meta";
    meta.textContent = [record.country || record.region, record.note].filter(Boolean).join(" · ") || record.zone;

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
    number.textContent = `${count} ${count === 1 ? "place" : "places"}`;
    node.appendChild(number);
    if (code) node.title = code;
    return node;
  }

  /** `[{type:"group"}, {type:"place", record}]`, the flat list we render. */
  function pickerRows() {
    const filter = FILTERS[state.filter] || FILTERS.all;
    if (state.query) {
      const matches = searchPlacesAny(state.query).filter(filter);
      if (!matches.length) return [];
      return [
        { type: "group", country: "Matching places", code: "", count: matches.length },
        ...matches.map((record) => ({ type: "place", record })),
      ];
    }
    const groups = placeGroups()
      .map((group) => ({ ...group, entries: group.entries.filter(filter) }))
      .filter((group) => group.entries.length);
    return groups.flatMap((group) => [
      { type: "group", country: group.country, code: group.code, count: group.entries.length },
      ...group.entries.map((record) => ({ type: "place", record })),
    ]);
  }

  function render() {
    state.rows = pickerRows();
    state.places = state.rows.filter((row) => row.type === "place");

    const fragment = document.createDocumentFragment();
    if (!state.rows.length) {
      const empty = document.createElement("p");
      empty.className = "picker-empty";
      empty.textContent = `Nothing matches “${state.query}”. Try a country, a city, or an id like Asia/Kathmandu.`;
      fragment.appendChild(empty);
    }
    state.rows.forEach((row, index) => {
      if (row.type === "group") fragment.appendChild(groupNode(row.country, row.count, row.code));
      else fragment.appendChild(optionNode(row.record, index));
    });
    els.list.replaceChildren(fragment);

    const countries = state.rows.filter((row) => row.type === "group").length;
    els.count.textContent = state.query
      ? `${state.places.length} place${state.places.length === 1 ? "" : "s"}`
      : state.filter === "all"
        ? `${allPlaceRecords().length} places in ${countries} countries`
        : `${state.places.length} places`;

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
    const record = placeRecord(state.selected);
    els.summary.textContent = `${record.label} · ${offsetText(state.selected)} · ${record.zone}`;
    els.summary.dataset.legacy = String(Boolean(record.legacyZone));
    els.summary.title = record.legacyZone
      ? `Your browser reports “${record.legacyZone}”; Tempo maps it to the modern zone id.`
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

  function activeId() {
    const options = optionNodes();
    const node = options[state.activeIndex] || options[0];
    return node ? node.dataset.place : state.selected;
  }

  function select(id) {
    if (!id) return;
    state.selected = id;
    optionNodes().forEach((option) => option.setAttribute("aria-selected", String(option.dataset.place === id)));
    updateSummary();
  }

  function commit() {
    const id = state.selected || activeId();
    if (!id) return;
    if (state.mode === "add" && isAdded(id)) {
      hook("onBlocked", id);
      return;
    }
    if (hook("onPick", id, state.mode) !== false) api.close();
  }

  /* -------------------------------------------------------------- events */

  let typingTimer = 0;

  function syncChips() {
    els.chips.forEach((chip) => {
      const active = chip.dataset.filter === state.filter;
      chip.classList.toggle("active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
  }

  function attach() {
    els.list.addEventListener("click", (event) => {
      const option = event.target.closest(".picker-option");
      if (!option) return;
      select(option.dataset.place);
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
        select(activeId());
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
        state.filter = chip.dataset.filter === state.filter ? "all" : chip.dataset.filter;
        syncChips();
        render();
      });
    });
    if (els.useLocation) {
      els.useLocation.addEventListener("click", () => hook("onUseLocation", state.mode));
    }
    if (els.form)
      els.form.addEventListener("submit", (event) => {
        event.preventDefault();
        commit();
      });
    if (els.close) els.close.addEventListener("click", () => api.close());
    if (els.dialog) {
      els.dialog.addEventListener("click", (event) => {
        if (event.target === els.dialog) api.close();
      });
      els.dialog.addEventListener("cancel", (event) => {
        // Escape leaves the dialog, but clears a typed query first.
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

  /* ------------------------------------------------------------------ api */

  const api = {
    open(config = {}) {
      state.mode = config.mode || "home";
      state.homeId = config.homeId || config.homeZone || "";
      state.query = "";
      state.filter = config.filter || "all";
      state.selected = config.selectedId || config.selectedZone || "";
      els.search.value = "";
      syncChips();
      if (els.title) els.title.textContent = config.title || "Choose a place";
      if (els.eyebrow) els.eyebrow.textContent = config.eyebrow || "EVERY PLACE ON EARTH";
      if (els.copy) els.copy.textContent = config.copy || "";
      if (els.submit) els.submit.textContent = config.submitLabel || "Use this place";
      if (els.useLocation) els.useLocation.hidden = config.allowLocation === false;
      render();
      state.open = true;
      if (typeof els.dialog.showModal === "function") els.dialog.showModal();
      else els.dialog.setAttribute("open", "");
      const focus = () => els.search && els.search.focus();
      if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(focus);
      else focus();
    },
    close() {
      if (!state.open) return;
      if (typeof els.dialog.close === "function" && els.dialog.open) els.dialog.close();
      else if (els.dialog) els.dialog.removeAttribute("open");
      state.open = false;
    },
    /** Re-render (offsets move across DST; the app nudges this now and then). */
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
