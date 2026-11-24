/**
 * Renders a paragraph slice into a contentEditable node as DOM nodes.
 *
 * We build the DOM imperatively (instead of via React children) so that:
 *   - typing never fights React reconciliation,
 *   - inline marks and neon comment highlights come from the document model,
 *   - nothing relies on dangerouslySetInnerHTML.
 *
 * A content signature is stored on the node so rebuilds only happen when the
 * text, marks or annotations actually changed.
 */

import { resolveHighlightCss } from "../models/annotations.js";

const SIGNATURE_ATTR = "data-content-sig";

/**
 * Split a slice into segments where both inline marks and highlights are
 * constant, using every boundary as a cut point.
 */
function buildSegments(text, markSegments, highlightRanges) {
  const boundaries = new Set([0, text.length]);

  for (const segment of markSegments) {
    boundaries.add(Math.max(0, Math.min(segment.start, text.length)));
    boundaries.add(Math.max(0, Math.min(segment.end, text.length)));
  }
  for (const range of highlightRanges) {
    boundaries.add(Math.max(0, Math.min(range.localStart, text.length)));
    boundaries.add(Math.max(0, Math.min(range.localEnd, text.length)));
  }

  const points = [...boundaries].sort((a, b) => a - b);
  const segments = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;

    const marks = markSegments
      .filter((segment) => segment.start <= start && segment.end >= end)
      .flatMap((segment) => segment.marks);

    const highlight = highlightRanges.find(
      (range) => range.localStart <= start && range.localEnd >= end
    );

    segments.push({
      text: text.slice(start, end),
      marks: [...new Set(marks)],
      highlight: highlight ?? null,
    });
  }

  return segments;
}

function computeSignature(text, markSegments, highlightRanges) {
  const marks = markSegments
    .map((segment) => `${segment.start}-${segment.end}:${segment.marks.join(",")}`)
    .join("|");
  const highlights = highlightRanges
    .map(
      (range) =>
        `${range.localStart}-${range.localEnd}:${range.color}:${
          range.resolved ? "r" : "u"
        }:${range.commentId ?? ""}`
    )
    .join("|");
  return `${text.length}\u0000${text}\u0000${marks}\u0000${highlights}`;
}

function createSegmentNode(segment) {
  if (!segment.marks.length && !segment.highlight) {
    return document.createTextNode(segment.text);
  }

  const span = document.createElement("span");
  span.textContent = segment.text;

  const classNames = [];
  if (segment.marks.includes("bold")) classNames.push("mark-bold");
  if (segment.marks.includes("italic")) classNames.push("mark-italic");
  if (segment.marks.includes("underline")) classNames.push("mark-underline");

  if (segment.highlight) {
    const { highlight } = segment;
    classNames.push(
      highlight.resolved ? "comment-mark is-resolved" : "comment-mark is-unresolved"
    );
    span.dataset.commentId = highlight.commentId ?? "";
    span.dataset.highlightId = highlight.id ?? "";
    if (!highlight.resolved) {
      span.style.setProperty(
        "--comment-highlight",
        resolveHighlightCss(highlight.color)
      );
    }
  }

  span.className = classNames.join(" ");
  return span;
}

/**
 * Sync a paragraph node's DOM to the model.
 * @returns {boolean} true when the DOM was rebuilt
 */
export function syncParagraphDom(node, text, markSegments = [], highlightRanges = []) {
  if (!node) return false;

  const signature = computeSignature(text, markSegments, highlightRanges);
  if (node.getAttribute(SIGNATURE_ATTR) === signature) return false;

  const segments = buildSegments(text, markSegments, highlightRanges);
  const fragment = document.createDocumentFragment();

  if (segments.length === 0) {
    // Empty blocks need a <br> or the browser gives them no caret target.
    fragment.appendChild(document.createElement("br"));
  } else {
    for (const segment of segments) {
      fragment.appendChild(createSegmentNode(segment));
    }
  }

  node.replaceChildren(fragment);
  node.setAttribute(SIGNATURE_ATTR, signature);
  return true;
}

/** Invalidate the cached signature (used after direct DOM edits). */
export function invalidateParagraphDom(node) {
  node?.removeAttribute?.(SIGNATURE_ATTR);
}
