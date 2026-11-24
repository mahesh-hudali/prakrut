/**
 * Selection / caret helpers for contentEditable paragraphs.
 */

export function getPlainTextFromEditable(el) {
  return (el?.innerText ?? el?.textContent ?? "").replace(/\n$/, "");
}

/** True when the live caret/selection actually sits inside `element`. */
export function hasCaretInside(element) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !element) return false;
  return element.contains(selection.getRangeAt(0).startContainer);
}

/** Caret offset within the element's plain text. */
export function getCaretCharacterOffset(element) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !element) return 0;

  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return 0;

  const pre = range.cloneRange();
  pre.selectNodeContents(element);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

/** Place caret at a character offset within element. */
export function setCaretCharacterOffset(element, offset) {
  if (!element) return;
  const selection = window.getSelection();
  if (!selection) return;

  const total = (element.textContent ?? "").length;
  const target = Math.max(0, Math.min(offset, total));

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let current = 0;
  let node = walker.nextNode();

  while (node) {
    const next = current + node.textContent.length;
    if (target <= next) {
      const range = document.createRange();
      range.setStart(node, target - current);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    current = next;
    node = walker.nextNode();
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function getCaretClientRect(element) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return element?.getBoundingClientRect?.() ?? null;
  }
  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rects = range.getClientRects();
  if (rects.length > 0) return rects[0];
  return element?.getBoundingClientRect?.() ?? null;
}
