/**
 * Run utilities.
 *
 * A paragraph stores its text as an ordered list of runs:
 *   runs: [{ id, text, marks: [{ type: 'bold' | 'italic' | 'underline' }
 *                            | { type: 'font', value: fontId }
 *                            | { type: 'size', value: points }] }]
 *
 * Runs are the canonical storage for inline formatting. All helpers here are
 * pure so they can be reused by the editor, exporters and the .kbook
 * serializer without touching React state directly.
 */

import { createId } from "./ids.js";

export const INLINE_MARK_TYPES = Object.freeze(["bold", "italic", "underline"]);
/** Marks that carry a value (Google Docs-style per-selection formatting). */
export const VALUE_MARK_TYPES = Object.freeze(["font", "size"]);

export function createRun(text = "", marks = []) {
  return { id: createId("r"), text, marks: normalizeMarks(marks) };
}

/** Deduplicate + sort marks so run comparison is stable. */
export function normalizeMarks(marks) {
  const seen = new Set();
  const result = [];
  for (const mark of marks ?? []) {
    const type = typeof mark === "string" ? mark : mark?.type;
    if (!type || seen.has(type)) continue;
    if (VALUE_MARK_TYPES.includes(type)) {
      if (mark?.value === undefined || mark?.value === null || mark?.value === "") continue;
      seen.add(type);
      result.push({ type, value: mark.value });
      continue;
    }
    seen.add(type);
    result.push({ type });
  }
  result.sort((a, b) => a.type.localeCompare(b.type));
  return result;
}

export function marksEqual(a, b) {
  const left = normalizeMarks(a);
  const right = normalizeMarks(b);
  if (left.length !== right.length) return false;
  return left.every(
    (mark, index) => mark.type === right[index].type && mark.value === right[index].value
  );
}

export function hasMark(marks, type) {
  return (marks ?? []).some((mark) => (mark?.type ?? mark) === type);
}

export function runsToText(runs) {
  if (!runs?.length) return "";
  return runs.map((run) => run.text ?? "").join("");
}

/** Merge neighbouring runs that carry identical marks, drop empty runs. */
export function normalizeRuns(runs) {
  const result = [];
  for (const run of runs ?? []) {
    if (!run || !run.text) continue;
    const previous = result[result.length - 1];
    if (previous && marksEqual(previous.marks, run.marks)) {
      previous.text += run.text;
      continue;
    }
    result.push({
      id: run.id ?? createId("r"),
      text: run.text,
      marks: normalizeMarks(run.marks),
    });
  }
  if (result.length === 0) {
    result.push(createRun(""));
  }
  return result;
}

/**
 * Split runs at a character offset. Returns the run index boundary so callers
 * can slice cleanly without losing marks.
 */
function splitRunsAt(runs, offset) {
  const result = [];
  let consumed = 0;

  for (const run of runs) {
    const length = run.text.length;
    const start = consumed;
    const end = consumed + length;

    if (offset > start && offset < end) {
      const cut = offset - start;
      result.push({
        id: run.id ?? createId("r"),
        text: run.text.slice(0, cut),
        marks: normalizeMarks(run.marks),
      });
      result.push({
        id: createId("r"),
        text: run.text.slice(cut),
        marks: normalizeMarks(run.marks),
      });
    } else {
      result.push({
        id: run.id ?? createId("r"),
        text: run.text,
        marks: normalizeMarks(run.marks),
      });
    }
    consumed = end;
  }

  return result;
}

/**
 * Toggle an inline mark across [start, end).
 * When every character in range already has the mark it is removed,
 * otherwise it is applied to the whole range (same behaviour as word processors).
 */
export function toggleMarkOnRuns(runs, start, end, markType) {
  if (start >= end) return normalizeRuns(runs);

  let working = splitRunsAt(normalizeRuns(runs), start);
  working = splitRunsAt(working, end);

  let cursor = 0;
  const inRange = [];
  for (const run of working) {
    const runStart = cursor;
    const runEnd = cursor + run.text.length;
    if (runStart >= start && runEnd <= end) inRange.push(run);
    cursor = runEnd;
  }

  const shouldRemove =
    inRange.length > 0 && inRange.every((run) => hasMark(run.marks, markType));

  cursor = 0;
  const next = working.map((run) => {
    const runStart = cursor;
    const runEnd = cursor + run.text.length;
    cursor = runEnd;

    if (runStart < start || runEnd > end) return run;

    const marks = shouldRemove
      ? run.marks.filter((mark) => mark.type !== markType)
      : [...run.marks, { type: markType }];

    return { ...run, marks: normalizeMarks(marks) };
  });

  return normalizeRuns(next);
}

/** Which marks are active across the entire range (used by the toolbar). */
export function getActiveMarks(runs, start, end) {
  if (start >= end) return [];
  const normalized = normalizeRuns(runs);
  let cursor = 0;
  const covering = [];

  for (const run of normalized) {
    const runStart = cursor;
    const runEnd = cursor + run.text.length;
    cursor = runEnd;
    if (runEnd <= start || runStart >= end) continue;
    covering.push(run);
  }

  if (covering.length === 0) return [];
  return INLINE_MARK_TYPES.filter((type) =>
    covering.every((run) => hasMark(run.marks, type))
  );
}

/**
 * Replace paragraph text while keeping marks on the untouched prefix/suffix.
 * This is what keeps bold/italic (and comment ranges) alive during typing.
 */
export function replaceTextPreservingRuns(runs, nextText) {
  const normalized = normalizeRuns(runs);
  const previousText = runsToText(normalized);
  if (previousText === nextText) return normalized;

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

  const removedEnd = previousText.length - suffix;
  const insertedText = nextText.slice(prefix, nextText.length - suffix);

  // Marks for inserted text follow the run at the insertion point.
  let cursor = 0;
  let inheritedMarks = [];
  for (const run of normalized) {
    const runEnd = cursor + run.text.length;
    if (prefix > cursor && prefix <= runEnd) {
      inheritedMarks = run.marks;
      break;
    }
    cursor = runEnd;
  }

  const head = sliceRuns(normalized, 0, prefix);
  const tail = sliceRuns(normalized, removedEnd, previousText.length);
  const middle = insertedText ? [createRun(insertedText, inheritedMarks)] : [];

  return normalizeRuns([...head, ...middle, ...tail]);
}

/** Extract runs covering [start, end). */
export function sliceRuns(runs, start, end) {
  if (start >= end) return [];
  const result = [];
  let cursor = 0;

  for (const run of runs) {
    const runStart = cursor;
    const runEnd = cursor + run.text.length;
    cursor = runEnd;

    if (runEnd <= start || runStart >= end) continue;

    const from = Math.max(0, start - runStart);
    const to = Math.min(run.text.length, end - runStart);
    const text = run.text.slice(from, to);
    if (!text) continue;

    result.push({
      id: createId("r"),
      text,
      marks: normalizeMarks(run.marks),
    });
  }

  return result;
}

/**
 * Flatten runs into non-overlapping segments annotated with their marks.
 * Used by the renderer to build DOM spans.
 */
export function runsToSegments(runs) {
  const normalized = normalizeRuns(runs);
  const segments = [];
  let cursor = 0;
  for (const run of normalized) {
    if (!run.text) continue;
    segments.push({
      start: cursor,
      end: cursor + run.text.length,
      text: run.text,
      marks: run.marks.map((mark) => mark.type),
    });
    cursor += run.text.length;
  }
  return segments;
}
