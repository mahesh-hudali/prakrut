/**
 * Conversion between the app's document model (the .kbook format) and the
 * ProseMirror document used by the editor.
 *
 * Model → editor: runs become text nodes with marks; comment/highlight
 * ranges (stored as paragraph offsets) become `annotation` marks, so they
 * travel with the text as the author edits.
 *
 * Editor → model: the reverse. Annotation marks are read back into offsets,
 * so the .kbook format, autosave and the exporters are unchanged.
 */
import { KANNADA_FONTS, resolveFontStack } from "../models/documentModel.js";
import { normalizeRuns } from "../models/runs.js";

const SIMPLE_MARKS = ["bold", "italic", "underline"];

function fontIdFromStack(stack) {
  if (!stack) return null;
  return KANNADA_FONTS.find((font) => font.stack === stack)?.id ?? null;
}

function pointsFromCss(size) {
  const match = /^([\d.]+)pt$/.exec(size ?? "");
  return match ? Number(match[1]) : null;
}

/** Model marks of one run → ProseMirror marks. */
function runMarksToPm(marks) {
  const result = [];
  let fontFamily = null;
  let fontSize = null;
  for (const mark of marks ?? []) {
    if (SIMPLE_MARKS.includes(mark.type)) result.push({ type: mark.type });
    if (mark.type === "font") fontFamily = resolveFontStack(mark.value);
    if (mark.type === "size") fontSize = `${mark.value}pt`;
  }
  if (fontFamily || fontSize) {
    result.push({ type: "textStyle", attrs: { fontFamily, fontSize } });
  }
  return result;
}

/** Text with "\n" becomes text nodes separated by hard breaks. */
function pushText(content, text, marks) {
  const parts = text.split("\n");
  parts.forEach((part, index) => {
    if (index > 0) content.push({ type: "hardBreak" });
    if (part) content.push({ type: "text", text: part, ...(marks.length ? { marks } : {}) });
  });
}

function paragraphToPm(block, highlightsByParagraph) {
  const highlights = highlightsByParagraph.get(block.id) ?? [];
  const runs = normalizeRuns(block.runs);

  // Cut points: run boundaries and annotation boundaries.
  const cuts = new Set([0]);
  let length = 0;
  for (const run of runs) {
    length += run.text.length;
    cuts.add(length);
  }
  for (const h of highlights) {
    cuts.add(Math.max(0, Math.min(h.start, length)));
    cuts.add(Math.max(0, Math.min(h.end, length)));
  }
  const points = [...cuts].sort((a, b) => a - b);

  const content = [];
  let runIndex = 0;
  let runStart = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    if (to <= from) continue;
    while (runIndex < runs.length && runStart + runs[runIndex].text.length <= from) {
      runStart += runs[runIndex].text.length;
      runIndex += 1;
    }
    const run = runs[runIndex];
    const text = run.text.slice(from - runStart, to - runStart);
    const marks = runMarksToPm(run.marks);
    for (const h of highlights) {
      if (h.start <= from && h.end >= to) {
        marks.push({
          type: "annotation",
          attrs: {
            highlightId: h.id,
            commentId: h.commentId ?? null,
            color: h.color ?? "neonYellow",
            resolved: Boolean(h.resolved),
          },
        });
      }
    }
    pushText(content, text, marks);
  }

  return {
    type: "paragraph",
    attrs: { id: block.id, blockStyle: block.style || "normal", textAlign: block.align || null },
    ...(content.length ? { content } : {}),
  };
}

export function modelToPm(doc) {
  const highlightsByParagraph = new Map();
  for (const h of doc.highlights ?? []) {
    if (!highlightsByParagraph.has(h.paragraphId)) highlightsByParagraph.set(h.paragraphId, []);
    highlightsByParagraph.get(h.paragraphId).push(h);
  }

  return {
    type: "doc",
    content: doc.chapters.map((chapter) => ({
      type: "chapter",
      attrs: { id: chapter.id, title: chapter.title ?? "" },
      content: (chapter.blocks.length ? chapter.blocks : [{ id: null, style: "normal", runs: [] }]).map(
        (block) => paragraphToPm(block, highlightsByParagraph)
      ),
    })),
  };
}

/** ProseMirror marks on a text node → model run marks. */
function pmMarksToRun(marks) {
  const result = [];
  for (const mark of marks ?? []) {
    if (SIMPLE_MARKS.includes(mark.type)) result.push({ type: mark.type });
    if (mark.type === "textStyle") {
      const font = fontIdFromStack(mark.attrs?.fontFamily);
      const size = pointsFromCss(mark.attrs?.fontSize);
      if (font) result.push({ type: "font", value: font });
      if (size) result.push({ type: "size", value: size });
    }
  }
  return result;
}

/**
 * Convert the editor document back into the model. `previous` supplies
 * everything the editor does not own (metadata, settings, comment bodies).
 */
export function pmToModel(pmJson, previous) {
  const ranges = new Map(); // highlightId → { paragraphId, chapterId, start, end }

  const chapters = (pmJson.content ?? []).map((chapterNode) => {
    const chapterId = chapterNode.attrs?.id;
    const blocks = (chapterNode.content ?? []).map((paragraph) => {
      const runs = [];
      let offset = 0;
      for (const child of paragraph.content ?? []) {
        const text = child.type === "hardBreak" ? "\n" : child.text ?? "";
        if (!text) continue;
        runs.push({ text, marks: pmMarksToRun(child.marks) });
        for (const mark of child.marks ?? []) {
          if (mark.type !== "annotation" || !mark.attrs?.highlightId) continue;
          const id = mark.attrs.highlightId;
          const range = ranges.get(id);
          if (!range) {
            ranges.set(id, {
              paragraphId: paragraph.attrs.id,
              chapterId,
              start: offset,
              end: offset + text.length,
            });
          } else if (range.paragraphId === paragraph.attrs.id) {
            range.end = offset + text.length;
          }
        }
        offset += text.length;
      }
      return {
        id: paragraph.attrs.id,
        type: "paragraph",
        style: paragraph.attrs.blockStyle || "normal",
        align: paragraph.attrs.textAlign || null,
        runs: normalizeRuns(runs),
      };
    });

    // Keep the binder's chapter name in step with an on-page chapter title.
    const first = blocks[0];
    const titleFromPage =
      first?.style === "chapterTitle" ? first.runs.map((r) => r.text).join("") : null;

    return {
      id: chapterId,
      title: titleFromPage || chapterNode.attrs?.title || "",
      blocks,
    };
  });

  // Annotations follow their text; ones whose text was deleted disappear.
  const highlights = (previous.highlights ?? [])
    .filter((h) => ranges.has(h.id))
    .map((h) => ({ ...h, ...ranges.get(h.id) }));
  const byComment = new Map(highlights.filter((h) => h.commentId).map((h) => [h.commentId, h]));
  const comments = (previous.comments ?? [])
    .filter((c) => byComment.has(c.id))
    .map((c) => {
      const h = byComment.get(c.id);
      return { ...c, chapterId: h.chapterId, paragraphId: h.paragraphId, start: h.start, end: h.end };
    });

  return { ...previous, chapters, highlights, comments };
}
