import { useCallback, useEffect, useRef, useState } from "react";

const PARAGRAPH_SELECTOR = "[data-block-id]";

function closestParagraph(node) {
  const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return element?.closest?.(PARAGRAPH_SELECTOR) ?? null;
}

/** Character offset of a DOM position inside its paragraph element. */
function offsetWithin(element, container, offset) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.setEnd(container, offset);
  return range.toString().length;
}

/**
 * Watches the document selection and reports the selected range in
 * paragraph coordinates so it can be stored in the document model.
 *
 * Works with Kannada, English and mixed text because everything is measured in
 * plain-text character offsets rather than DOM structure.
 */
export function useTextSelection({ enabled = true } = {}) {
  const [selection, setSelection] = useState(null);
  const frozenRef = useRef(false);

  const clearSelectionState = useCallback(() => {
    if (frozenRef.current) return;
    setSelection(null);
  }, []);

  /** Keep the last selection while the user interacts with the toolbar. */
  const freeze = useCallback(() => {
    frozenRef.current = true;
  }, []);

  const unfreeze = useCallback(() => {
    frozenRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const handleSelectionChange = () => {
      if (frozenRef.current) return;

      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0 || domSelection.isCollapsed) {
        setSelection(null);
        return;
      }

      const range = domSelection.getRangeAt(0);
      const startParagraph = closestParagraph(range.startContainer);
      const endParagraph = closestParagraph(range.endContainer);

      if (!startParagraph) {
        setSelection(null);
        return;
      }

      // Multi-paragraph selections are clamped to the first paragraph so the
      // resulting annotation always maps to exactly one stable paragraph id.
      const paragraph = startParagraph;
      const sliceStart = Number(paragraph.dataset.startOffset || 0);

      const localStart = offsetWithin(
        paragraph,
        range.startContainer,
        range.startOffset
      );
      const localEnd =
        endParagraph === paragraph
          ? offsetWithin(paragraph, range.endContainer, range.endOffset)
          : (paragraph.textContent ?? "").length;

      if (localEnd <= localStart) {
        setSelection(null);
        return;
      }

      const text = (paragraph.textContent ?? "").slice(localStart, localEnd);
      const rect = range.getBoundingClientRect();

      setSelection({
        chapterId: paragraph.dataset.chapterId,
        paragraphId: paragraph.dataset.blockId,
        // Absolute offsets inside the paragraph (slice offset + local offset).
        start: sliceStart + localStart,
        end: sliceStart + localEnd,
        localStart,
        localEnd,
        text,
        rect: {
          top: rect.top,
          left: rect.left,
          bottom: rect.bottom,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        },
        element: paragraph,
      });
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [enabled]);

  return { selection, clearSelectionState, freeze, unfreeze };
}
