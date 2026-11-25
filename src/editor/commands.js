/**
 * Book-level editing operations as ProseMirror transactions, so each one is a
 * single undo step: chapters (add, rename, delete, move, jump) and
 * annotations (comment and highlight ranges).
 */
import { TextSelection } from "@tiptap/pm/state";
import { createId } from "../models/ids.js";

/** Chapters in order: { id, title, pos, index }. */
export function listChapters(doc) {
  const chapters = [];
  doc.forEach((node, offset, index) => {
    const first = node.firstChild;
    const pageTitle = first?.attrs.blockStyle === "chapterTitle" ? first.textContent : "";
    chapters.push({ id: node.attrs.id, title: pageTitle || node.attrs.title || "", pos: offset, index });
  });
  return chapters;
}

function findChapter(doc, chapterId) {
  return listChapters(doc).find((chapter) => chapter.id === chapterId) ?? null;
}

/** The chapter that holds the caret. */
export function chapterAtSelection(state) {
  const { $from } = state.selection;
  return $from.depth >= 1 ? $from.node(1).attrs.id : null;
}

export function addChapter(editor, title) {
  const { state, view } = editor;
  const { schema } = state;
  const chapter = schema.nodes.chapter.create({ id: createId("ch"), title }, [
    schema.nodes.paragraph.create({ id: createId("p"), blockStyle: "chapterTitle" }, title ? schema.text(title) : null),
    schema.nodes.paragraph.create({ id: createId("p"), blockStyle: "normal" }),
  ]);
  const end = state.doc.content.size;
  const tr = state.tr.insert(end, chapter);
  // Caret in the empty first paragraph, ready to write.
  const bodyPos = end + 1 + chapter.firstChild.nodeSize + 1;
  tr.setSelection(TextSelection.create(tr.doc, bodyPos)).scrollIntoView();
  view.dispatch(tr);
  view.focus();
}

/** Rename in the binder; the on-page chapter title follows. */
export function renameChapter(editor, chapterId, title) {
  const { state, view } = editor;
  const chapter = findChapter(state.doc, chapterId);
  if (!chapter) return;
  const node = state.doc.nodeAt(chapter.pos);
  const tr = state.tr.setNodeMarkup(chapter.pos, undefined, { ...node.attrs, title });
  const first = node.firstChild;
  if (first?.attrs.blockStyle === "chapterTitle") {
    const start = chapter.pos + 2;
    tr.replaceWith(start, start + first.content.size, title ? state.schema.text(title) : []);
  }
  view.dispatch(tr);
}

export function deleteChapter(editor, chapterId) {
  const { state, view } = editor;
  if (state.doc.childCount <= 1) return;
  const chapter = findChapter(state.doc, chapterId);
  if (!chapter) return;
  const node = state.doc.nodeAt(chapter.pos);
  view.dispatch(state.tr.delete(chapter.pos, chapter.pos + node.nodeSize));
}

export function moveChapter(editor, chapterId, direction) {
  const { state, view } = editor;
  const chapters = listChapters(state.doc);
  const index = chapters.findIndex((c) => c.id === chapterId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= chapters.length) return;
  const node = state.doc.nodeAt(chapters[index].pos);
  const tr = state.tr.delete(chapters[index].pos, chapters[index].pos + node.nodeSize);
  // With the chapter removed, its neighbour now sits at `index - 1` (up) or
  // `index` (down) in the remaining list.
  const others = listChapters(tr.doc);
  const neighbour = direction < 0 ? others[index - 1] : others[index];
  const insertAt =
    direction < 0 ? neighbour.pos : neighbour.pos + tr.doc.nodeAt(neighbour.pos).nodeSize;
  tr.insert(insertAt, node);
  view.dispatch(tr);
}

export function scrollToChapter(editor, chapterId) {
  const chapter = findChapter(editor.state.doc, chapterId);
  if (!chapter) return;
  const dom = editor.view.nodeDOM(chapter.pos);
  dom?.scrollIntoView({ behavior: "smooth", block: "start" });
  const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, chapter.pos + 2));
  editor.view.dispatch(tr);
  editor.view.focus();
}

/**
 * The current selection, clamped to the paragraph it starts in (annotations
 * are stored per paragraph): { from, to, text, chapterId, paragraphId }.
 */
export function selectionForAnnotation(state) {
  const { from, to, $from, empty } = state.selection;
  if (empty || $from.parent.type.name !== "paragraph") return null;
  const end = Math.min(to, $from.end());
  if (end <= from) return null;
  return {
    from,
    to: end,
    // Offsets inside the paragraph, as the .kbook model stores them.
    start: $from.parentOffset,
    end: $from.parentOffset + (end - from),
    text: state.doc.textBetween(from, end, " "),
    chapterId: $from.node(1).attrs.id,
    paragraphId: $from.parent.attrs.id,
  };
}

export function addAnnotation(editor, range, attrs) {
  const { state, view } = editor;
  const mark = state.schema.marks.annotation.create(attrs);
  view.dispatch(state.tr.addMark(range.from, range.to, mark));
}

/** Apply `change(attrs)` to every annotation mark matching `match`. */
function rewriteAnnotations(editor, match, change) {
  const { state, view } = editor;
  const type = state.schema.marks.annotation;
  const tr = state.tr;
  state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type !== type || !match(mark.attrs)) continue;
      tr.removeMark(pos, pos + node.nodeSize, mark);
      const next = change(mark.attrs);
      if (next) tr.addMark(pos, pos + node.nodeSize, type.create(next));
    }
  });
  if (tr.docChanged) view.dispatch(tr);
}

export function setCommentResolved(editor, commentId, resolved) {
  rewriteAnnotations(editor, (a) => a.commentId === commentId, (a) => ({ ...a, resolved }));
}

export function removeComment(editor, commentId) {
  rewriteAnnotations(editor, (a) => a.commentId === commentId, () => null);
}

export function scrollToComment(editor, commentId) {
  const el = editor.view.dom.querySelector(`[data-comment-id="${CSS.escape(commentId)}"]`);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
}
