/**
 * Undo/redo history logic: change classification, typing-burst grouping and
 * caret placement after a jump between snapshots.
 *
 * Run: node scripts/history-test.mjs
 */
import assert from "node:assert/strict";
import {
  createDocument,
  createParagraph,
  getParagraphText,
  setParagraphText,
} from "../src/models/documentModel.js";
import {
  describeChange,
  diffText,
  findCaretForTransition,
  mergeChanges,
  shouldCoalesce,
  TYPING_GROUP_MS,
} from "../src/models/history.js";

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function setText(doc, blockIndex, text) {
  return {
    ...doc,
    chapters: doc.chapters.map((chapter, c) =>
      c !== 0
        ? chapter
        : {
            ...chapter,
            blocks: chapter.blocks.map((block, i) =>
              i === blockIndex ? setParagraphText(block, text) : block
            ),
          }
    ),
  };
}

function splitBlock(doc, blockIndex, offset) {
  const chapter = doc.chapters[0];
  const source = chapter.blocks[blockIndex];
  const full = getParagraphText(source);
  const blocks = [...chapter.blocks];
  blocks.splice(
    blockIndex,
    1,
    setParagraphText(source, full.slice(0, offset)),
    createParagraph({ text: full.slice(offset) })
  );
  return { ...doc, chapters: [{ ...chapter, blocks }] };
}

console.log("history");

const base = createDocument("ನಮಸ್ಕಾರ\nಎರಡನೇ ಸಾಲು");
const bodyIndex = 1; // block 0 is the chapter title
const bodyText = getParagraphText(base.chapters[0].blocks[bodyIndex]);

test("diffText finds a single inserted region", () => {
  assert.deepEqual(diffText("abcdef", "abXYcdef"), {
    start: 2,
    removed: "",
    inserted: "XY",
    endInAfter: 4,
  });
});

test("typing in one paragraph is a text change", () => {
  const next = setText(base, bodyIndex, `${bodyText} ಕ`);
  const change = describeChange(base, next);
  assert.equal(change.kind, "text");
  assert.equal(change.inserted, " ಕ");
  assert.equal(change.blockId, base.chapters[0].blocks[bodyIndex].id);
});

test("splitting a paragraph is structural", () => {
  assert.equal(describeChange(base, splitBlock(base, bodyIndex, 2)).kind, "other");
});

test("settings change is structural", () => {
  const next = { ...base, settings: { ...base.settings, pageWidth: 7 } };
  assert.equal(describeChange(base, next).kind, "other");
});

test("title typing is a meta change", () => {
  const next = { ...base, metadata: { ...base.metadata, title: "x" } };
  assert.deepEqual(describeChange(base, next), { kind: "meta", key: "title" });
});

const text = (inserted, removed = "", blockId = "b1") => ({
  kind: "text",
  blockId,
  inserted,
  removed,
});

test("letters of one word group together", () => {
  assert.equal(shouldCoalesce(text("ಕ"), text("ನ"), 100), true);
});

test("a pause starts a new step", () => {
  assert.equal(shouldCoalesce(text("ಕ"), text("ನ"), TYPING_GROUP_MS + 1), false);
});

test("a new word after a space starts a new step", () => {
  assert.equal(shouldCoalesce(text("ಕಥೆ "), text("ಮ"), 100), false);
  assert.equal(shouldCoalesce(text("ಕ"), text(" "), 100), true);
});

test("a leading space stays with the word after it", () => {
  assert.equal(shouldCoalesce(text(" "), text("ಕ"), 100), true);
});

test("mergeChanges accumulates the step's typing", () => {
  assert.equal(mergeChanges(text(" ಕ"), text("ಥೆ")).inserted, " ಕಥೆ");
});

test("switching between typing and deleting starts a new step", () => {
  assert.equal(shouldCoalesce(text("ಕ"), text("", "ಕ"), 100), false);
  assert.equal(shouldCoalesce(text("", "ಕ"), text("", "ನ"), 100), true);
});

test("a different paragraph starts a new step", () => {
  assert.equal(shouldCoalesce(text("ಕ"), text("ನ", "", "b2"), 100), false);
});

test("a replacement (transliteration accept) is its own step", () => {
  assert.equal(shouldCoalesce(text("a"), text("ನಾನು", "naanu"), 100), false);
});

test("structural changes never group", () => {
  assert.equal(shouldCoalesce({ kind: "other" }, { kind: "other" }, 10), false);
});

test("undo of typing puts the caret where the text was", () => {
  const typed = setText(base, bodyIndex, `${bodyText.slice(0, 3)}XYZ${bodyText.slice(3)}`);
  const caret = findCaretForTransition(typed, base);
  assert.deepEqual(caret, { blockId: base.chapters[0].blocks[bodyIndex].id, offset: 3 });
});

test("redo of typing puts the caret after the restored text", () => {
  const typed = setText(base, bodyIndex, `${bodyText.slice(0, 3)}XYZ${bodyText.slice(3)}`);
  const caret = findCaretForTransition(base, typed);
  assert.deepEqual(caret, { blockId: base.chapters[0].blocks[bodyIndex].id, offset: 6 });
});

test("undo of a paragraph split returns to the split point", () => {
  const split = splitBlock(base, bodyIndex, 4);
  const caret = findCaretForTransition(split, base);
  assert.deepEqual(caret, { blockId: base.chapters[0].blocks[bodyIndex].id, offset: 4 });
});

test("undo of a paragraph merge returns to the join point", () => {
  const split = splitBlock(base, bodyIndex, 4);
  const caret = findCaretForTransition(base, split);
  assert.equal(caret.blockId, base.chapters[0].blocks[bodyIndex].id);
  assert.equal(caret.offset, 4);
});

test("restoring a deleted paragraph puts the caret at its start", () => {
  const chapter = base.chapters[0];
  const without = {
    ...base,
    chapters: [{ ...chapter, blocks: chapter.blocks.filter((_, i) => i !== bodyIndex) }],
  };
  const caret = findCaretForTransition(without, base);
  assert.deepEqual(caret, { blockId: chapter.blocks[bodyIndex].id, offset: 0 });
});

test("settings-only change leaves the caret alone", () => {
  const next = { ...base, settings: { ...base.settings, pageWidth: 7 } };
  assert.equal(findCaretForTransition(next, base), null);
});

console.log(`\n${passed} history tests passed.`);
