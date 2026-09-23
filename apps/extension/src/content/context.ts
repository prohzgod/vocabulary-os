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
