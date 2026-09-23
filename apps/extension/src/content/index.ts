import { send, type TranslateResult } from "../lib/messages.js";
import { isOwnSurface, isSiteDisabled, type Settings } from "../lib/settings.js";
import { extractContextSentence } from "./context.js";
import { EXTENSION_ROOT_ID, isSelectionSafe } from "./dom-safety.js";
import { highlightWords } from "./highlighter.js";

const MAX_SELECTION = 120;
const POPUP_WIDTH = 300;

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
setTimeout(() => void refreshHighlights(), 800);

async function onSelection() {
  const selection = window.getSelection();
  const text = selection?.toString().trim() ?? "";
  if (!text || text.length > MAX_SELECTION || !isSelectionSafe(selection)) return close();

  const settings = await send("getSettings").catch(() => null);
  if (!settings?.inlineEnabled || isSiteDisabled(settings, location.hostname)) return close();

  const rect = selection!.getRangeAt(0).getBoundingClientRect();
  const root = open(rect);
  const button = el("button", { className: "fab", title: "Translate with Vocabulary OS", textContent: "V" });
  button.addEventListener("click", () => void showTranslation(root, rect, text, settings));
  root.append(button);
}

async function showTranslation(root: HTMLElement, rect: DOMRect, text: string, settings: Settings) {
  const context = extractContextSentence(document.body.innerText, text) ?? null;
  const card = el("div", { className: "card" });
  root.replaceChildren(card);
  place(rect, true);

  const render = (...children: Node[]) => card.replaceChildren(el("div", { className: "word", textContent: text }), ...children);
  render(el("p", { className: "muted", textContent: "Translating… The first time can take a minute while the offline model downloads." }));

  let result: TranslateResult;
  try {
    result = await send("translate", { text });
  } catch (error) {
    const retry = el("button", { textContent: "Try again" });
    retry.addEventListener("click", () => void showTranslation(root, rect, text, settings));
    return render(el("p", { className: "error", textContent: message(error) }), retry);
  }

  const save = el("button", { className: "primary", textContent: "Save word" });
  const saveCard = async () => {
    save.disabled = true;
    save.textContent = "Saving…";
    try {
      const { duplicate } = await send("saveCard", {
        word: text,
        translation: result.translation,
        sourceLanguage: settings.sourceLanguage,
        targetLanguage: settings.targetLanguage,
        context,
        sourceUrl: location.href,
        sourceTitle: document.title
      });
      save.textContent = duplicate ? "Already saved" : "Saved ✓";
      if (!duplicate) void refreshHighlights();
    } catch (error) {
      save.disabled = false;
      save.textContent = "Save word";
      card.append(el("p", { className: "error", textContent: message(error) }));
    }
  };
  save.addEventListener("click", () => void saveCard());
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !save.disabled) void saveCard();
  });

  render(
    el("div", { className: "translation", textContent: result.translation }),
    ...(context ? [el("p", { className: "context", textContent: context })] : []),
    el("div", { className: "row" }, save, el("span", { className: "muted", textContent: result.engine === "chrome" ? "Chrome translator" : "Offline model" }))
  );
  save.focus();
}

async function refreshHighlights() {
  const settings = await send("getSettings").catch(() => null);
  if (!settings?.highlightEnabled || isSiteDisabled(settings, location.hostname) || isOwnSurface(settings, location.href)) {
    return;
  }
  highlightWords(await send("highlightWords").catch(() => []));
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
  const width = expanded ? POPUP_WIDTH : 32;
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  const below = rect.bottom + 8;
  const top = expanded && below + 220 > window.innerHeight ? Math.max(8, rect.top - 228) : below;
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

const STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .fab { width: 32px; height: 32px; border: 0; border-radius: 50%; background: #7c3aed; color: #fff; font-weight: 700; cursor: pointer; box-shadow: 0 4px 14px rgb(124 58 237 / 40%); }
  .card { width: ${POPUP_WIDTH}px; padding: 14px; border-radius: 14px; background: #fff; color: #111827; box-shadow: 0 12px 40px rgb(17 24 39 / 18%); color-scheme: light; }
  .word { font-size: 13px; font-weight: 600; color: #6b7280; margin-bottom: 4px; }
  .translation { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
  .context { font-size: 13px; line-height: 1.4; color: #374151; border-left: 3px solid #ddd6fe; padding-left: 8px; margin: 0 0 12px; }
  .muted { font-size: 12px; color: #6b7280; margin: 0; }
  .error { font-size: 13px; color: #b91c1c; margin: 8px 0; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  button { font-size: 13px; padding: 7px 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; cursor: pointer; }
  button.primary { background: #7c3aed; border-color: #7c3aed; color: #fff; font-weight: 600; }
  button:disabled { opacity: .7; cursor: default; }
  button:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }
`;
