export interface SelectionContext {
  selectedText: string;
  contextSentence?: string;
  sourceUrl: string;
  sourceTitle: string;
}

const MAX_CONTEXT_LENGTH = 250;

export function buildSelectionContext(selectedText: string, documentText: string): Omit<SelectionContext, "sourceUrl" | "sourceTitle"> {
  return {
    selectedText,
    contextSentence: extractContextSentence(documentText, selectedText)
  };
}

export function extractContextSentence(documentText: string, selectedText: string): string | undefined {
  const normalizedSelection = normalizeWhitespace(selectedText);
  const normalizedText = normalizeWhitespace(documentText);

  if (!normalizedSelection || !normalizedText) {
    return undefined;
  }

  const selectionIndex = normalizedText.toLowerCase().indexOf(normalizedSelection.toLowerCase());

  if (selectionIndex < 0) {
    return clampContext(normalizedText, 0);
  }

  const before = normalizedText.slice(0, selectionIndex);
  const after = normalizedText.slice(selectionIndex + normalizedSelection.length);
  const sentenceStart = Math.max(
    before.lastIndexOf("."),
    before.lastIndexOf("?"),
    before.lastIndexOf("!"),
    before.lastIndexOf("\n")
  );
  const sentenceEndCandidates = [after.indexOf("."), after.indexOf("?"), after.indexOf("!")].filter(
    (index) => index >= 0
  );
  const sentenceEnd =
    sentenceEndCandidates.length > 0
      ? selectionIndex + normalizedSelection.length + Math.min(...sentenceEndCandidates) + 1
      : normalizedText.length;

  const rawSentence = normalizedText.slice(sentenceStart + 1, sentenceEnd).trim();
  return clampContext(rawSentence, rawSentence.toLowerCase().indexOf(normalizedSelection.toLowerCase()));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clampContext(value: string, selectedIndex: number): string {
  if (value.length <= MAX_CONTEXT_LENGTH) {
    return value;
  }

  const safeIndex = Math.max(0, selectedIndex);
  const half = Math.floor(MAX_CONTEXT_LENGTH / 2);
  const start = Math.max(0, safeIndex - half);
  const end = Math.min(value.length, start + MAX_CONTEXT_LENGTH);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < value.length ? "..." : "";

  return `${prefix}${value.slice(start, end).trim()}${suffix}`;
}

const BLOCK_SELECTOR = "p, li, dd, dt, td, th, blockquote, figcaption, h1, h2, h3, h4, h5, h6, article, section, main";

/**
 * The sentence around the selection itself, not the first match of the word
 * elsewhere on the page (menus, titles). Only the tail of `before` since its
 * last sentence break is kept, so the search below lands in the right sentence.
 */
export function extractContextAround(before: string, selectedText: string, after: string): string | undefined {
  const start = Math.max(...[".", "?", "!", "\n"].map((mark) => before.lastIndexOf(mark)));
  return extractContextSentence(before.slice(start + 1) + selectedText + after, selectedText);
}

/** Context sentence for a live selection range, read from its nearest text block. */
export function contextFromRange(range: Range): string | undefined {
  const node = range.startContainer;
  const element = node instanceof Element ? node : node.parentElement;
  const block = element?.closest(BLOCK_SELECTOR) ?? document.body;
  const before = document.createRange();
  before.setStart(block, 0);
  before.setEnd(range.startContainer, range.startOffset);
  const after = document.createRange();
  after.setStart(range.endContainer, range.endOffset);
  after.setEnd(block, block.childNodes.length);
  return extractContextAround(before.toString(), range.toString(), after.toString());
}
