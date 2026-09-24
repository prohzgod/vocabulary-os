import type { Sense } from "@vocab-os/shared";
import { send, type TranslateResult } from "../lib/messages.js";
import { isOwnSurface, isSiteDisabled, type Settings } from "../lib/settings.js";
import { contextFromRange } from "./context.js";
import { EXTENSION_ROOT_ID, isSelectionSafe } from "./dom-safety.js";
import { startHighlightScheduler } from "./highlight-scheduler.js";
import { highlightWords } from "./highlighter.js";

const MAX_SELECTION = 120;
const POPUP_WIDTH = 340;
const CHIP_SIZE = 32;

let host: HTMLElement | null = null;

document.addEventListener("mouseup", (event) => {
  if (!isFromExtension(event)) void onSelection();
});
document.addEventListener("mousedown", (event) => {
  if (!isFromExtension(event)) close();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") close();
});
const highlights = startHighlightScheduler(highlightPass);

async function onSelection() {
  const selection = window.getSelection();
  const text = selection?.toString().trim() ?? "";
  if (!text || text.length > MAX_SELECTION || !isSelectionSafe(selection)) return close();

  const settings = await send("getSettings").catch(() => null);
  if (!settings?.inlineEnabled || isSiteDisabled(settings, location.hostname)) return close();

  const range = selection!.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const context = contextFromRange(range) ?? null;
  const root = open(rect);
  const button = el("button", { className: "chip", title: "Translate with Vocabulary OS" });
  button.setAttribute("aria-label", "Translate selection");
  button.innerHTML = MARK_SVG;
  button.addEventListener("click", () => void showTranslation(root, rect, text, context, settings));
  root.append(button);
}

async function showTranslation(root: HTMLElement, rect: DOMRect, text: string, context: string | null, settings: Settings) {
  const card = el("div", { className: "card" });
  root.replaceChildren(card);
  place(rect, true);

  const head = el(
    "div",
    { className: "head" },
    el("span", { className: "word", textContent: text }),
    el("span", { className: "pair", textContent: `${settings.sourceLanguage} → ${settings.targetLanguage}`.toUpperCase() })
  );
  const render = (...children: Node[]) => card.replaceChildren(head, ...children);
  render(el("p", { className: "muted", textContent: "Translating… The first time can take a minute while the offline model downloads." }));

  let result: TranslateResult;
  try {
    result = await send("translate", { text });
  } catch (error) {
    const retry = el("button", { textContent: "Try again" });
    retry.addEventListener("click", () => void showTranslation(root, rect, text, context, settings));
    return render(el("p", { className: "error", textContent: message(error) }), retry);
  }

  const save = el("button", { className: "primary", textContent: "Save word" });
  const footer = el("div", { className: "row" });
  const showSave = () => {
    save.disabled = false;
    save.textContent = "Save word";
    footer.replaceChildren(save, el("span", { className: "muted", textContent: result.engine === "dictionary" ? "From the dictionary" : "Translated on this device" }));
  };
  const saveCard = async () => {
    save.disabled = true;
    save.textContent = "Saving…";
    try {
      const { card: saved, duplicate } = await send("saveCard", {
        word: text,
        translation: result.translation,
        sourceLanguage: settings.sourceLanguage,
        targetLanguage: settings.targetLanguage,
        context,
        sourceUrl: location.href,
        sourceTitle: document.title
      });
      if (duplicate) {
        footer.replaceChildren(el("span", { className: "saved", textContent: "Already in your list" }));
        return;
      }
      highlights.refreshNow();
      const undo = el("button", { className: "link", textContent: "Undo" });
      undo.addEventListener("click", () => {
        undo.disabled = true;
        void send("deleteCard", { id: saved.id }).then(showSave, () => (undo.disabled = false));
      });
      const check = el("span", { className: "check" });
      check.innerHTML = CHECK_SVG;
      footer.replaceChildren(el("span", { className: "saved" }, check, document.createTextNode("Saved · in today's review")), undo);
      undo.focus();
    } catch (error) {
      showSave();
      card.append(el("p", { className: "error", textContent: message(error) }));
    }
  };
  save.addEventListener("click", () => void saveCard());
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && footer.contains(save) && !save.disabled) void saveCard();
  });

  showSave();
  render(
    ...(result.senses ? senseList(result.senses, result.headword) : [el("div", { className: "translation", textContent: result.translation })]),
    ...(context ? [contextLine(context, text)] : []),
    footer
  );
  save.focus();
}

/** Dictionary meanings, one row per part of speech, plus "from run" when a base form matched. */
function senseList(senses: Sense[], headword: string | undefined): HTMLElement[] {
  const rows = senses.map(([pos, meanings]) =>
    el("div", { className: "sense" }, el("span", { className: "pos", textContent: pos.toUpperCase() }), el("span", { className: "meanings", textContent: meanings.join(" · ") }))
  );
  const note = headword ? [el("p", { className: "muted" }, document.createTextNode("from "), el("em", { textContent: headword }))] : [];
  return [el("div", { className: "senses" }, ...rows), ...note];
}

/** The sentence with the selected word marked in highlighter yellow. */
function contextLine(context: string, word: string): HTMLElement {
  const line = el("p", { className: "context" });
  const index = context.toLowerCase().indexOf(word.toLowerCase());
  if (index < 0) {
    line.textContent = context;
  } else {
    line.append(context.slice(0, index), el("mark", { textContent: context.slice(index, index + word.length) }), context.slice(index + word.length));
  }
  return line;
}

/** One highlighting pass; returns how many words it wrapped. */
async function highlightPass(): Promise<number> {
  const settings = await send("getSettings").catch(() => null);
  if (!settings?.highlightEnabled || isSiteDisabled(settings, location.hostname) || isOwnSurface(settings, location.href)) {
    return 0;
  }
  return highlightWords(await send("highlightWords").catch(() => []));
}

// --- Shadow DOM UI helpers ---

/** Mount an isolated (Shadow DOM) container near the selection and return it. */
function open(rect: DOMRect): HTMLElement {
  close();
  host = el("div", { id: EXTENSION_ROOT_ID });
  const root = el("div");
  host.attachShadow({ mode: "open" }).append(el("style", { textContent: STYLES }), root);
  document.documentElement.append(host);
  place(rect, false);
  return root;
}

function place(rect: DOMRect, expanded: boolean) {
  if (!host) return;
  // The chip sits at the selection's top-right corner; the card opens below (above near the bottom edge).
  const width = expanded ? POPUP_WIDTH : CHIP_SIZE;
  const left = Math.min(Math.max(8, expanded ? rect.left - 12 : rect.right + 4), window.innerWidth - width - 8);
  const below = rect.bottom + 10;
  const above = rect.top - CHIP_SIZE - 2;
  const top = expanded ? (below + 240 > window.innerHeight ? Math.max(8, rect.top - 250) : below) : above < 8 ? below : above;
  Object.assign(host.style, { position: "fixed", left: `${left}px`, top: `${top}px`, zIndex: "2147483647" });
}

function close() {
  host?.remove();
  host = null;
}

function isFromExtension(event: Event): boolean {
  return host !== null && event.composedPath().includes(host);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: Node[]) {
  const element = Object.assign(document.createElement(tag), props);
  element.append(...children);
  return element;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

const MARK_SVG = `<svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="32" width="44" height="16" rx="3" fill="#FFD84D" transform="rotate(-6 32 40)"/><path d="M18 16L32 46L46 16" fill="none" stroke="#1C1A17" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHECK_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1C1A17" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>`;

// The extension's bundled fonts don't reach arbitrary pages, so the card uses system faces with the same paper-and-ink palette.
const STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .chip { width: ${CHIP_SIZE}px; height: ${CHIP_SIZE}px; padding: 0; border: 1px solid #e0d9cc; border-radius: 10px; background: #fffefb; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgb(28 26 23 / 16%), 0 1px 2px rgb(28 26 23 / 8%); }
  .chip:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgb(28 26 23 / 20%), 0 1px 2px rgb(28 26 23 / 8%); }
  .card { width: ${POPUP_WIDTH}px; padding: 18px 20px 16px; border-radius: 16px; border: 1px solid #e6e0d4; background: #fffefb; color: #1c1a17; box-shadow: 0 16px 40px rgb(28 26 23 / 14%), 0 2px 6px rgb(28 26 23 / 6%); color-scheme: light; display: grid; gap: 12px; line-height: 1.4; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .word { font-size: 13px; color: #5b564d; overflow-wrap: anywhere; }
  .pair { font-size: 11px; font-weight: 500; letter-spacing: .06em; color: #6e685e; white-space: nowrap; }
  .translation { font-family: Georgia, "Times New Roman", serif; font-size: 26px; font-weight: 500; line-height: 1.15; overflow-wrap: anywhere; }
  /* Dictionary glosses can be long; cap the list so Save stays on screen. */
  .senses { display: grid; gap: 8px; max-height: 176px; overflow-y: auto; overscroll-behavior: contain; }
  .sense { display: grid; grid-template-columns: 44px 1fr; gap: 8px; align-items: baseline; }
  .pos { font-size: 11px; font-weight: 600; letter-spacing: .06em; color: #6e685e; }
  .meanings { font-family: Georgia, "Times New Roman", serif; font-size: 16px; line-height: 1.35; overflow-wrap: anywhere; }
  .sense:first-child .meanings { font-size: 20px; font-weight: 500; line-height: 1.25; }
  .context { font-size: 14px; line-height: 1.55; color: #3d3932; margin: 0; }
  mark { background: linear-gradient(transparent 58%, #ffd84d 58%); color: inherit; padding: 0 1px; }
  .muted { font-size: 12px; color: #6e685e; margin: 0; }
  .error { font-size: 13px; color: #b3412e; margin: 0; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 4px; min-height: 40px; }
  .saved { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
  .check { width: 24px; height: 24px; border-radius: 12px; background: #ffd84d; display: flex; align-items: center; justify-content: center; }
  button { font-size: 14px; height: 40px; padding: 0 16px; border-radius: 10px; border: 1px solid #d6cfc2; background: #fffefb; color: #1c1a17; cursor: pointer; }
  button.primary { background: #1c1a17; border-color: #1c1a17; color: #f7f4ee; font-weight: 600; }
  button.link { height: 32px; padding: 0 4px; border: 0; background: none; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
  button:disabled { opacity: .7; cursor: default; }
  button:focus-visible { outline: 2px solid #1c1a17; outline-offset: 2px; }
`;
