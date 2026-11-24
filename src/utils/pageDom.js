/**
 * Builds the paragraphs inside a page's single editable surface.
 *
 * The whole page content box is one contentEditable region so selection,
 * arrow keys and multi-paragraph editing behave like a normal document.
 * React never renders children inside that region — we build them here from
 * the document model instead, which keeps the caret stable and stops React
 * reconciliation from fighting the browser's own editing.
 */

import { BLOCK_STYLES } from "../models/documentModel.js";
import { syncParagraphDom } from "./paragraphDom.js";

export function getDisplayText(item) {
  const isSceneBreak = item.style === "sceneBreak";
  return isSceneBreak && !item.text.trim() ? "* * *" : item.text;
}

function paragraphKey(item) {
  return `${item.blockId}:${item.startOffset}`;
}

function applyParagraphAttributes(el, item, { placeholderBlockId, activeBlockId, pageIndex }) {
  const styleDef = BLOCK_STYLES[item.style] ?? BLOCK_STYLES.normal;
  const displayText = getDisplayText(item);

  el.className = [
    "page-paragraph",
    `style-${item.style || "normal"}`,
    item.isContinuation ? "is-continuation" : "",
    activeBlockId === item.blockId ? "is-active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  el.dataset.blockId = item.blockId;
  el.dataset.chapterId = item.chapterId;
  el.dataset.startOffset = String(item.startOffset);
  el.dataset.endOffset = String(item.endOffset);
  el.dataset.blockLength = String(item.blockLength ?? item.endOffset);
  el.dataset.pageIndex = String(pageIndex);

  // Only one placeholder is ever shown, so the page never reads
  // "Type here… Type here… Type here…".
  if (item.blockId === placeholderBlockId) {
    el.dataset.placeholder =
      item.style === "chapterTitle" ? "Chapter title" : "Start writing…";
  } else {
    delete el.dataset.placeholder;
  }

  const style = el.style;
  style.textAlign = item.align || styleDef.align || "";
  style.fontStyle = styleDef.italic ? "italic" : "";
  style.paddingLeft = styleDef.paddingLeftEm ? `${styleDef.paddingLeftEm}em` : "";
  style.paddingRight = styleDef.paddingRightEm
    ? `${styleDef.paddingRightEm}em`
    : "";
  style.letterSpacing = styleDef.letterSpacingEm
    ? `calc(var(--letter-spacing) + ${styleDef.letterSpacingEm}em)`
    : "";
  style.marginTop = `${styleDef.marginTopEm ?? 0}em`;
  style.marginBottom = `calc(${styleDef.marginBottomEm ?? 0}em + var(--paragraph-spacing))`;
  style.fontSize = `${styleDef.fontSizeScale ?? 1}em`;
  style.fontWeight = String(styleDef.fontWeight ?? "");
  style.textIndent =
    styleDef.indentFirstLine && !item.isContinuation && displayText.length > 0
      ? "var(--first-line-indent)"
      : "0";
}

/** Caret position expressed against the model, so it survives a rebuild. */
export function captureCaret(container) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer)) return null;

  const paragraph =
    range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement?.closest("[data-block-id]")
      : range.startContainer.closest?.("[data-block-id]");

  if (!paragraph) return null;

  const measure = document.createRange();
  measure.selectNodeContents(paragraph);
  measure.setEnd(range.startContainer, range.startOffset);

  return {
    key: paragraph.dataset.blockId
      ? `${paragraph.dataset.blockId}:${paragraph.dataset.startOffset}`
      : null,
    offset: measure.toString().length,
    collapsed: selection.isCollapsed,
  };
}

export function placeCaret(paragraph, offset) {
  if (!paragraph) return false;
  const selection = window.getSelection();
  if (!selection) return false;

  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let node = walker.nextNode();

  while (node) {
    const next = consumed + node.textContent.length;
    if (offset <= next) {
      const range = document.createRange();
      range.setStart(node, Math.max(0, offset - consumed));
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    }
    consumed = next;
    node = walker.nextNode();
  }

  // Empty paragraph (or offset past the end): collapse into the element.
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function restoreCaret(container, snapshot) {
  if (!snapshot?.key || !snapshot.collapsed) return;
  const [blockId, startOffset] = snapshot.key.split(":");
  const paragraph = container.querySelector(
    `[data-block-id="${blockId}"][data-start-offset="${startOffset}"]`
  );
  if (paragraph) placeCaret(paragraph, snapshot.offset);
}

/**
 * Reconcile a page's paragraphs with the model.
 * Existing nodes are reused by key so untouched paragraphs keep their DOM
 * identity (and the caret inside them).
 */
export function syncPageDom(container, items, options = {}) {
  if (!container) return;

  const wasFocused = container.contains(document.activeElement) ||
    document.activeElement === container;
  const caret = wasFocused ? captureCaret(container) : null;

  const existing = new Map();
  for (const child of Array.from(container.children)) {
    if (child.dataset?.key) existing.set(child.dataset.key, child);
  }

  const nodes = items.map((item) => {
    const key = paragraphKey(item);
    let el = existing.get(key);
    if (!el) {
      el = document.createElement("div");
      el.dataset.key = key;
    }

    applyParagraphAttributes(el, item, options);

    const decorations = options.getDecorations?.(item) ?? {
      markSegments: [],
      highlightRanges: [],
    };
    syncParagraphDom(
      el,
      getDisplayText(item),
      decorations.markSegments,
      decorations.highlightRanges
    );

    return el;
  });

  const unchanged =
    nodes.length === container.children.length &&
    nodes.every((node, index) => container.children[index] === node);

  if (!unchanged) {
    container.replaceChildren(...nodes);
    if (caret) restoreCaret(container, caret);
  }
}
