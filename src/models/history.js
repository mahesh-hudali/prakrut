/**
 * Pure helpers for snapshot-based undo/redo.
 *
 * The document is immutable, so a history entry is simply the previous
 * document object. These helpers decide which consecutive changes belong to
 * one undo step and where the caret should land after jumping between two
 * snapshots. They have no React or DOM dependencies so they can be tested in
 * Node.
 */

import { getParagraphText } from "./documentModel.js";

export const HISTORY_LIMIT = 300;

/** A pause longer than this always starts a new undo step. */
export const TYPING_GROUP_MS = 1200;

function commonPrefixLength(a, b) {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a.charCodeAt(i) === b.charCodeAt(i)) i += 1;
  return i;
}

function commonSuffixLength(a, b, prefix) {
  const max = Math.min(a.length, b.length) - prefix;
  let i = 0;
  while (
    i < max &&
    a.charCodeAt(a.length - 1 - i) === b.charCodeAt(b.length - 1 - i)
  ) {
    i += 1;
  }
  return i;
}

/** Minimal single-region diff between two strings. */
export function diffText(before, after) {
  const prefix = commonPrefixLength(before, after);
  const suffix = commonSuffixLength(before, after, prefix);
  return {
    start: prefix,
    removed: before.slice(prefix, before.length - suffix),
    inserted: after.slice(prefix, after.length - suffix),
    endInAfter: after.length - suffix,
  };
}

/**
 * Classify a change so typing bursts can be grouped.
 *
 * Returns { kind: "text", blockId, inserted, removed } when exactly one
 * paragraph's text changed and nothing structural did; { kind: "meta", key }
 * for a change to a single metadata field (e.g. typing the book title);
 * otherwise { kind: "other" }.
 */
export function describeChange(prev, next) {
  if (
    prev.settings === next.settings &&
    prev.frontMatter === next.frontMatter &&
    prev.chapters === next.chapters &&
    prev.metadata !== next.metadata
  ) {
    const keys = new Set([
      ...Object.keys(prev.metadata ?? {}),
      ...Object.keys(next.metadata ?? {}),
    ]);
    const changed = [...keys].filter(
      (key) => prev.metadata?.[key] !== next.metadata?.[key]
    );
    if (changed.length === 1) return { kind: "meta", key: changed[0] };
    return { kind: "other" };
  }

  if (
    prev.settings !== next.settings ||
    prev.frontMatter !== next.frontMatter ||
    prev.metadata !== next.metadata ||
    prev.chapters.length !== next.chapters.length
  ) {
    return { kind: "other" };
  }

  let changedBlock = null;
  for (let c = 0; c < prev.chapters.length; c += 1) {
    const a = prev.chapters[c];
    const b = next.chapters[c];
    if (a === b) continue;
    if (
      a.id !== b.id ||
      a.title !== b.title ||
      a.blocks.length !== b.blocks.length
    ) {
      return { kind: "other" };
    }
    for (let i = 0; i < a.blocks.length; i += 1) {
      const x = a.blocks[i];
      const y = b.blocks[i];
      if (x === y) continue;
      if (
        changedBlock ||
        x.id !== y.id ||
        x.style !== y.style ||
        x.align !== y.align
      ) {
        return { kind: "other" };
      }
      changedBlock = { before: x, after: y };
    }
  }

  if (!changedBlock) return { kind: "other" };

  const beforeText = getParagraphText(changedBlock.before);
  const afterText = getParagraphText(changedBlock.after);
  // Same text but different runs means a formatting change, not typing.
  if (beforeText === afterText) return { kind: "other" };

  const { inserted, removed } = diffText(beforeText, afterText);
  return { kind: "text", blockId: changedBlock.after.id, inserted, removed };
}

const WHITESPACE = /\s/u;

/**
 * Should `change` be folded into the undo step that `previous` started?
 * Typing in one paragraph groups word by word: a step ends after a pause,
 * when the author moves to another paragraph, switches between typing and
 * deleting, or starts a new word after a space.
 */
export function shouldCoalesce(previous, change, elapsedMs) {
  if (!previous || elapsedMs > TYPING_GROUP_MS) return false;

  if (previous.kind === "meta" && change.kind === "meta") {
    return previous.key === change.key;
  }

  if (previous.kind !== "text" || change.kind !== "text") return false;
  if (previous.blockId !== change.blockId) return false;

  const wasDeleting = previous.removed.length > 0 && !previous.inserted;
  const isDeleting = change.removed.length > 0 && !change.inserted;
  if (wasDeleting !== isDeleting) return false;
  if (isDeleting) return true;

  // A replacement (e.g. a transliteration suggestion) is its own step.
  if (change.removed.length > 0 || previous.removed.length > 0) return false;

  // `previous.inserted` is everything typed so far in this step, so leading
  // spaces stay with the word that follows them.
  const lastTyped = previous.inserted.at(-1) ?? "";
  const firstTyped = change.inserted[0] ?? "";
  const hasWord = /\S/u.test(previous.inserted);
  const endedWord = hasWord && WHITESPACE.test(lastTyped);
  const startsWord = firstTyped !== "" && !WHITESPACE.test(firstTyped);
  return !(endedWord && startsWord);
}

/** The change that describes a whole undo step after `change` joins it. */
export function mergeChanges(previous, change) {
  if (previous?.kind !== "text" || change.kind !== "text") return change;
  return {
    ...change,
    inserted: previous.inserted + change.inserted,
    removed: change.removed + previous.removed,
  };
}

function flattenBlocks(doc) {
  const out = [];
  for (const chapter of doc.chapters) {
    for (const block of chapter.blocks) out.push(block);
  }
  return out;
}

/**
 * Where the caret should go after the document switches from `fromDoc` to
 * `toDoc` (an undo or redo). The caret lands where the two snapshots first
 * differ: at the end of re-inserted text, or where removed text used to be.
 * Returns null when no paragraph text changed (e.g. a settings change), so the
 * caller can leave the caret where it is.
 */
export function findCaretForTransition(fromDoc, toDoc) {
  const from = flattenBlocks(fromDoc);
  const to = flattenBlocks(toDoc);
  const sameShape =
    from.length === to.length && from.every((block, i) => block.id === to[i].id);

  for (let i = 0; i < to.length; i += 1) {
    const a = from[i];
    const b = to[i];
    if (a === b) continue;

    if (!a) {
      return { blockId: b.id, offset: 0 };
    }

    const aText = getParagraphText(a);
    const bText = getParagraphText(b);

    if (a.id === b.id) {
      // Style or formatting only, or a neighbour that was split off or merged
      // in further down: keep looking for the text that changed.
      if (aText === bText) continue;
      const diff = diffText(aText, bText);
      return {
        blockId: b.id,
        offset: sameShape ? diff.endInAfter : diff.start,
      };
    }

    // A paragraph (or whole chapter) came back: put the caret at its start.
    if (!from.some((block) => block.id === b.id)) {
      return { blockId: b.id, offset: 0 };
    }

    // A paragraph disappeared here: end of the one before it.
    const previous = to[i - 1];
    if (previous && from[i - 1]?.id === previous.id) {
      const prevText = getParagraphText(previous);
      return { blockId: previous.id, offset: prevText.length };
    }
    return { blockId: b.id, offset: 0 };
  }

  if (to.length < from.length && to.length > 0) {
    const last = to[to.length - 1];
    return { blockId: last.id, offset: getParagraphText(last).length };
  }

  return null;
}
