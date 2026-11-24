/**
 * Comments and highlights.
 *
 * Annotations reference the document through stable ids
 * (chapterId + paragraphId) plus a character range inside that paragraph.
 * Ranges are re-mapped whenever the paragraph text changes, so annotations
 * survive normal editing, pagination and reloads.
 */

import { createId } from "./ids.js";

export const HIGHLIGHT_COLORS = Object.freeze({
  neonYellow: { id: "neonYellow", label: "Neon Yellow", css: "#F5FF3D" },
  neonGreen: { id: "neonGreen", label: "Neon Green", css: "#5CFF8F" },
  blue: { id: "blue", label: "Blue", css: "#9BD8FF" },
  pink: { id: "pink", label: "Pink", css: "#FFA8D8" },
  orange: { id: "orange", label: "Orange", css: "#FFC46B" },
});

export const DEFAULT_COMMENT_COLOR = "neonYellow";

/**
 * @typedef {Object} Comment
 * @property {string} id
 * @property {string} chapterId
 * @property {string} paragraphId
 * @property {string|null} runId
 * @property {number} start
 * @property {number} end
 * @property {string} selectedText
 * @property {string} text
 * @property {boolean} resolved
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export function createComment({
  chapterId,
  paragraphId,
  runId = null,
  start,
  end,
  selectedText = "",
  text = "",
  color = DEFAULT_COMMENT_COLOR,
}) {
  const now = new Date().toISOString();
  return {
    id: createId("cmt"),
    chapterId,
    paragraphId,
    runId,
    start,
    end,
    selectedText,
    text,
    color,
    resolved: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * @typedef {Object} Highlight
 * @property {string} id
 * @property {string|null} commentId
 * @property {string} chapterId
 * @property {string} paragraphId
 * @property {number} start
 * @property {number} end
 * @property {string} color
 * @property {boolean} resolved
 */

export function createHighlight({
  chapterId,
  paragraphId,
  start,
  end,
  color = DEFAULT_COMMENT_COLOR,
  commentId = null,
}) {
  return {
    id: createId("hl"),
    commentId,
    chapterId,
    paragraphId,
    start,
    end,
    color,
    resolved: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Shift/clip an annotation range after a paragraph edit.
 *
 * The edit is described as a replacement of [editStart, editEnd) with
 * `insertedLength` characters. Returns `null` when the annotated text was
 * entirely deleted.
 */
export function remapRange(range, editStart, editEnd, insertedLength) {
  const delta = insertedLength - (editEnd - editStart);
  let { start, end } = range;

  // Edit entirely after the annotation — nothing to do.
  if (editStart >= end) return { start, end };

  // Edit entirely before the annotation — shift it.
  if (editEnd <= start) {
    return { start: start + delta, end: end + delta };
  }

  // Overlapping edit: keep whatever survives on either side.
  const survivingBefore = Math.max(0, editStart - start);
  const survivingAfter = Math.max(0, end - editEnd);

  if (survivingBefore + survivingAfter === 0) return null;

  start = Math.min(start, editStart);
  end = start + survivingBefore + insertedLength + survivingAfter;

  if (end <= start) return null;
  return { start, end };
}

/**
 * Compute the minimal edit between two versions of a paragraph's text.
 * Used to remap annotations without a full diff library.
 */
export function diffTextEdit(previousText, nextText) {
  if (previousText === nextText) return null;

  const maxPrefix = Math.min(previousText.length, nextText.length);
  let prefix = 0;
  while (prefix < maxPrefix && previousText[prefix] === nextText[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < maxPrefix - prefix &&
    previousText[previousText.length - 1 - suffix] ===
      nextText[nextText.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return {
    editStart: prefix,
    editEnd: previousText.length - suffix,
    insertedLength: nextText.length - suffix - prefix,
  };
}

/**
 * Remap every annotation attached to `paragraphId` after a text change.
 * Annotations whose text disappeared are dropped from the list and reported
 * so the caller can also detach the related comment.
 */
export function remapAnnotationsForParagraph(
  annotations,
  paragraphId,
  previousText,
  nextText
) {
  const edit = diffTextEdit(previousText, nextText);
  if (!edit) return { annotations, orphanedIds: [] };

  const orphanedIds = [];
  const next = [];

  for (const annotation of annotations ?? []) {
    if (annotation.paragraphId !== paragraphId) {
      next.push(annotation);
      continue;
    }

    const remapped = remapRange(
      annotation,
      edit.editStart,
      edit.editEnd,
      edit.insertedLength
    );

    if (!remapped) {
      orphanedIds.push(annotation.id);
      continue;
    }

    const clampedEnd = Math.min(remapped.end, nextText.length);
    const clampedStart = Math.max(0, Math.min(remapped.start, clampedEnd));

    if (clampedEnd <= clampedStart) {
      orphanedIds.push(annotation.id);
      continue;
    }

    next.push({
      ...annotation,
      start: clampedStart,
      end: clampedEnd,
      selectedText:
        annotation.selectedText !== undefined
          ? nextText.slice(clampedStart, clampedEnd)
          : annotation.selectedText,
    });
  }

  return { annotations: next, orphanedIds };
}

/** Annotations that intersect a rendered page slice, in slice-local coords. */
export function getRangesForSlice(annotations, paragraphId, sliceStart, sliceEnd) {
  const result = [];
  for (const annotation of annotations ?? []) {
    if (annotation.paragraphId !== paragraphId) continue;
    const start = Math.max(annotation.start, sliceStart);
    const end = Math.min(annotation.end, sliceEnd);
    if (end <= start) continue;
    result.push({
      ...annotation,
      localStart: start - sliceStart,
      localEnd: end - sliceStart,
    });
  }
  return result.sort((a, b) => a.localStart - b.localStart);
}

export function resolveHighlightCss(colorId) {
  return HIGHLIGHT_COLORS[colorId]?.css ?? HIGHLIGHT_COLORS.neonYellow.css;
}
