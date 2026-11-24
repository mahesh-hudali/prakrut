import { useLayoutEffect, useRef } from "react";
import { syncPageDom } from "../../utils/pageDom.js";
import "./PageContent.css";

/**
 * One page = one continuous editing surface.
 *
 * The container is the only contentEditable element; its paragraphs are built
 * from the document model (see `syncPageDom`) rather than rendered by React, so
 * selection, arrow keys and multi-paragraph edits behave like a normal document
 * instead of a stack of separate inputs.
 */
export default function PageContent({
  items,
  pageIndex,
  activeBlockId,
  placeholderBlockId,
  getItemDecorations,
  decorationsKey,
  onPageInput,
  onPageKeyDown,
  onPagePaste,
  onCommentMarkClick,
  readOnly = false,
}) {
  const containerRef = useRef(null);
  const decorationsRef = useRef(getItemDecorations);
  decorationsRef.current = getItemDecorations;

  useLayoutEffect(() => {
    syncPageDom(containerRef.current, items ?? [], {
      pageIndex,
      activeBlockId,
      placeholderBlockId,
      getDecorations: decorationsRef.current,
    });
  }, [items, pageIndex, activeBlockId, placeholderBlockId, decorationsKey]);

  return (
    <div
      ref={containerRef}
      className={`page-content ${items?.length ? "" : "is-empty"}`}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="Manuscript page"
      spellCheck={false}
      data-page-index={pageIndex}
      onInput={(event) => onPageInput?.(pageIndex, event)}
      onKeyDown={(event) => onPageKeyDown?.(pageIndex, event)}
      onPaste={(event) => onPagePaste?.(pageIndex, event)}
      onClick={(event) => {
        const commentId = event.target?.closest?.(".comment-mark")?.dataset
          ?.commentId;
        if (commentId) onCommentMarkClick?.(commentId);
      }}
    />
  );
}
