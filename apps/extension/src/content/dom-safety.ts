export const EXTENSION_ROOT_ID = "vocab-os-selection-root";
export const PASSIVE_HIGHLIGHT_CLASS = "vocab-os-passive-highlight";

const UNSAFE_ANCESTOR_SELECTOR = [
  `#${EXTENSION_ROOT_ID}`,
  `.${PASSIVE_HIGHLIGHT_CLASS}`,
  "a",
  "area",
  "[href]",
  "button",
  "input",
  "textarea",
  "select",
  "option",
  "script",
  "style",
  "code",
  "pre",
  "kbd",
  "samp",
  "label",
  "svg",
  "canvas",
  "iframe",
  "[contenteditable]",
  "[role='button']"
].join(",");

export function isInsideUnsafeDom(element: Element): boolean {
  return Boolean(element.closest(UNSAFE_ANCESTOR_SELECTOR));
}

export function isTextNodeSafeForMutation(node: Node): boolean {
  if (!node.isConnected) {
    return false;
  }

  const text = node.textContent;
  const parent = node.parentElement;

  if (!text?.trim() || !parent || isInsideUnsafeDom(parent)) {
    return false;
  }

  return !isHiddenLike(parent);
}

export function isSelectionSafe(selection: Selection | null): boolean {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return false;
  }

  const anchorElement = getSelectionBoundaryElement(selection.anchorNode);
  const focusElement = getSelectionBoundaryElement(selection.focusNode);

  if (!anchorElement || !focusElement) {
    return false;
  }

  return !isInsideUnsafeDom(anchorElement) && !isInsideUnsafeDom(focusElement);
}

function getSelectionBoundaryElement(node: Node | null): Element | undefined {
  if (!node) {
    return undefined;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    return node as Element;
  }

  return node.parentElement ?? undefined;
}

function isHiddenLike(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute("aria-hidden") === "true") {
    return true;
  }

  const style = window.getComputedStyle(element);
  return style.display === "none" || style.visibility === "hidden";
}
