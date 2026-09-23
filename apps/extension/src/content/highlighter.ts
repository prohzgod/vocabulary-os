import type { HighlightWord } from "../lib/messages.js";
import { PASSIVE_HIGHLIGHT_CLASS, isTextNodeSafeForMutation } from "./dom-safety.js";

const STYLE_ID = "vocab-os-highlight-style";
const MAX_HIGHLIGHTS = 200;

/** Wrap occurrences of saved words in readable page text. Returns how many were wrapped. */
export function highlightWords(words: HighlightWord[], root: ParentNode = document.body): number {
  const byWord = new Map<string, HighlightWord>();
  for (const word of words) {
    const key = word.word.trim().toLowerCase();
    if (key.length >= 2 && !byWord.has(key)) byWord.set(key, word);
  }
  if (byWord.size === 0) return 0;

  ensureStyles();
  // Longest first so "look up" wins over "look".
  const pattern = [...byWord.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
  const regex = new RegExp(`(?<![\\p{L}\\p{N}_])(${pattern})(?![\\p{L}\\p{N}_])`, "giu");

  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      regex.lastIndex = 0;
      return isTextNodeSafeForMutation(node) && regex.test(node.textContent ?? "")
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    }
  });
  while (nodes.length < MAX_HIGHLIGHTS && walker.nextNode()) nodes.push(walker.currentNode as Text);

  let count = 0;
  for (const node of nodes) {
    const text = node.textContent ?? "";
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    regex.lastIndex = 0; // matchAll starts from lastIndex, which regex.test above moved.
    for (const match of text.matchAll(regex)) {
      const word = byWord.get(match[0].toLowerCase());
      if (!word || match.index === undefined || count >= MAX_HIGHLIGHTS) continue;
      fragment.append(text.slice(cursor, match.index), mark(match[0], word));
      cursor = match.index + match[0].length;
      count += 1;
    }
    if (cursor > 0) {
      fragment.append(text.slice(cursor));
      node.replaceWith(fragment);
    }
  }
  return count;
}

function mark(text: string, word: HighlightWord): HTMLElement {
  const element = document.createElement("span");
  element.className = PASSIVE_HIGHLIGHT_CLASS;
  element.textContent = text;
  element.dataset.translation = word.translation;
  element.dataset.state = word.state;
  return element;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${PASSIVE_HIGHLIGHT_CLASS} { background:linear-gradient(transparent 62%, rgb(255 216 77 / 80%) 62%); color:inherit; cursor:help; padding:0 1px; position:relative; }
    .${PASSIVE_HIGHLIGHT_CLASS}[data-state="mastered"] { background:linear-gradient(transparent 82%, rgb(255 216 77 / 80%) 82%); }
    .${PASSIVE_HIGHLIGHT_CLASS}:hover::after { content:attr(data-translation); position:absolute; left:50%; bottom:calc(100% + 8px); transform:translateX(-50%); z-index:2147483646; width:max-content; max-width:240px; padding:6px 10px; border-radius:8px; background:#1c1a17; color:#f7f4ee; font:13px/1.35 system-ui, sans-serif; white-space:normal; text-align:left; }
  `;
  document.head.append(style);
}
