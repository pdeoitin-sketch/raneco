/**
 * Remarks & feedback — kept in your browser, handed to your mail client.
 *
 * The About section invites a remark (an idea, a bug, a question, a kind
 * word), and this module is the whole machinery behind it:
 *
 *   • remarks are **tagged**, so "the timer is broken" and "this is lovely"
 *     can be told apart at a glance;
 *   • they are **saved in localStorage** and only there — no account, no
 *     backend, no contact record. Nothing leaves the device unless the
 *     reader decides it should;
 *   • **"Send by email"** does not send anything. It builds a `mailto:` link
 *     with the remarks in the body and hands it to the reader's own mail
 *     client — the most a static page can honestly do. The mail is addressed
 *     and sent *by the reader*, not by Tempo.
 *
 * "No contact records" is a deliberate choice, not a limitation of effort:
 * a clock that starts keeping files on its readers would be a different
 * (and worse) clock.
 */

import { escapeHTML } from "./ui.js";

export const REMARK_STORE_KEY = "tempo-remarks";

/** The tags on offer; ids are stable because they are persisted. */
export const REMARK_TAGS = [
  { id: "idea", label: "Idea", symbol: "✦" },
  { id: "bug", label: "Bug", symbol: "✗" },
  { id: "question", label: "Question", symbol: "?" },
  { id: "praise", label: "Praise", symbol: "❤" },
];

export const DEFAULT_REMARK_TAG = "idea";

function makeId() {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function isKnownTag(tag) {
  return REMARK_TAGS.some((entry) => entry.id === tag);
}

/** Wash one stored remark, or reject it with null. */
export function sanitiseRemark(raw) {
  if (!raw || typeof raw !== "object") return null;
  const text = String(raw.text ?? "").trim().slice(0, 1000);
  if (!text) return null;
  const tag = isKnownTag(raw.tag) ? raw.tag : DEFAULT_REMARK_TAG;
  const at = Number.isFinite(Number(raw.at)) && Number(raw.at) > 0 ? Number(raw.at) : Date.now();
  return { id: String(raw.id ?? "").trim() || makeId(), tag, text, at };
}

/** A stored list into clean remarks, dropping junk, newest first. */
export function parseStoredRemarks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => sanitiseRemark(entry))
    .filter(Boolean)
    .sort((a, b) => b.at - a.at);
}

/**
 * The `mailto:` that "send by email" opens.
 *
 * No recipient is baked in: the reader addresses it, which is the honest
 * version of "send feedback" for a page with no backend and no inbox of its
 * own. The subject says what it is; the body carries every remark, tagged
 * and dated, so the email needs no editing to be useful.
 */
export function buildMailto(remarks, { subject = "Tempo — remarks & feedback" } = {}) {
  const body = remarks.length
    ? remarks
        .map((remark) => {
          const tag = REMARK_TAGS.find((entry) => entry.id === remark.tag);
          const day = new Date(remark.at).toISOString().slice(0, 10);
          return `[${tag ? tag.label : remark.tag}] ${remark.text} (${day})`;
        })
        .join("\n\n")
    : "(no remarks saved yet)";
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${subject}\n\n${body}`)}`;
}

/**
 * The controller behind the About section's remarks card.
 *
 * @param {object} options
 *   @param {object} options.elements ids from the About section
 *   @param {(message: string, symbol?: string, duration?: number) => void} [options.notify]
 */
export function createRemarks({ elements = {}, notify } = {}) {
  const remarks = load();

  function load() {
    try {
      return parseStoredRemarks(JSON.parse(localStorage.getItem(REMARK_STORE_KEY)));
    } catch (_) {
      return [];
    }
  }

  function persist() {
    try {
      localStorage.setItem(REMARK_STORE_KEY, JSON.stringify(remarks));
    } catch (_) {
      /* private mode: the remarks last for this visit only */
    }
  }

  function selectedTag() {
    if (!elements.tagRow) return DEFAULT_REMARK_TAG;
    const active = elements.tagRow.querySelector("[data-remark-tag][aria-pressed='true']");
    return active ? active.dataset.remarkTag : DEFAULT_REMARK_TAG;
  }

  function syncTagButtons(tag) {
    if (!elements.tagRow) return;
    for (const button of elements.tagRow.querySelectorAll("[data-remark-tag]")) {
      const active = button.dataset.remarkTag === tag;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("active", active);
    }
  }

  function add() {
    const text = elements.input ? String(elements.input.value || "").trim().slice(0, 1000) : "";
    if (!text) {
      if (notify) notify("Write the remark first — even three words will do.", "!");
      return;
    }
    remarks.unshift({ id: makeId(), tag: selectedTag(), text, at: Date.now() });
    persist();
    if (elements.input) elements.input.value = "";
    render();
    if (notify) notify("Remark saved — in this browser, and nowhere else.", "✦");
  }

  function remove(id) {
    const index = remarks.findIndex((remark) => remark.id === id);
    if (index < 0) return;
    remarks.splice(index, 1);
    persist();
    render();
  }

  function clearAll() {
    if (!remarks.length) return;
    remarks.length = 0;
    persist();
    render();
    if (notify) notify("All remarks cleared.");
  }

  function render() {
    if (elements.list) {
      elements.list.innerHTML = remarks.length
        ? remarks
            .map((remark) => {
              const tag = REMARK_TAGS.find((entry) => entry.id === remark.tag) || REMARK_TAGS[0];
              return `<li class="remark-item" data-remark-id="${escapeHTML(remark.id)}">
                <span class="remark-tag tag-${escapeHTML(tag.id)}">${escapeHTML(tag.symbol)} ${escapeHTML(tag.label)}</span>
                <p class="remark-text">${escapeHTML(remark.text)}</p>
                <button type="button" class="remark-remove" data-remark-remove="${escapeHTML(remark.id)}" aria-label="Remove this remark">✕</button>
              </li>`;
            })
            .join("")
        : `<li class="remark-empty">Nothing saved yet — a remark you write stays in this browser until you clear it.</li>`;
    }
    if (elements.count) elements.count.textContent = remarks.length ? `${remarks.length} saved` : "";
    if (elements.mailto) {
      elements.mailto.href = buildMailto(remarks);
      elements.mailto.hidden = false;
    }
    if (elements.clearAll) elements.clearAll.hidden = !remarks.length;
  }

  function bindEvents() {
    if (elements.add) elements.add.addEventListener("click", add);
    if (elements.tagRow) {
      elements.tagRow.addEventListener("click", (event) => {
        const button = event.target.closest("[data-remark-tag]");
        if (button) syncTagButtons(button.dataset.remarkTag);
      });
    }
    if (elements.list) {
      elements.list.addEventListener("click", (event) => {
        const button = event.target.closest("[data-remark-remove]");
        if (button) remove(button.dataset.remarkRemove);
      });
    }
    if (elements.clearAll) elements.clearAll.addEventListener("click", clearAll);
  }

  return {
    init() {
      syncTagButtons(DEFAULT_REMARK_TAG);
      bindEvents();
      render();
    },
    render,
    get remarks() {
      return remarks;
    },
  };
}
