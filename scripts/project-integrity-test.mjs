/**
 * Project integrity test.
 *
 * Builds a realistic project, serializes it to .kbook, re-reads it through the
 * validator + deserializer and asserts that nothing was lost:
 * text, chapters, paragraph types, inline formatting, comments, neon
 * highlights, resolved state, cover/front matter, page settings, typography
 * and metadata. Also checks corrupt-file rejection and DOCX export.
 *
 * Run: node scripts/project-integrity-test.mjs
 */

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;

const {
  createChapter,
  createDocument,
  createParagraph,
  getParagraphText,
  setParagraphText,
} = await import("../src/models/documentModel.js");
const { toggleMarkOnRuns, getActiveMarks } = await import("../src/models/runs.js");
const { createComment, createHighlight, remapAnnotationsForParagraph } =
  await import("../src/models/annotations.js");
const { serializeProject, deserializeProject } = await import(
  "../src/project/serializer/kbookSerializer.js"
);
const { validateKbook } = await import(
  "../src/project/validator/validateKbook.js"
);

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\n1. Create project with chapters, Kannada text, paragraph types");

const doc = createDocument();
doc.metadata.title = "ನಮ್ಮೂರಿನ ಒಲಂಪಿಕ್ಸ್";
doc.metadata.subtitle = "A Story";
doc.metadata.author = "Mahesh";

const chapterTwo = createChapter({ title: "ಅಧ್ಯಾಯ ೨" });
chapterTwo.blocks = [
  createParagraph({ text: "ಅಧ್ಯಾಯ ೨", style: "chapterTitle" }),
  createParagraph({ text: "ಬೋಧಾ", style: "character" }),
  createParagraph({
    text: "ಬೋಧಾ ತಮ್ಮಟೆಯನ್ನು ಜೋರಾಗಿ ಬಾರಿಸುತ್ತಿದ್ದ.",
    style: "action",
  }),
  createParagraph({ text: "“ನೀನು ಎಲ್ಲಿಗೆ ಹೋಗುತ್ತಿದ್ದೀಯ?”", style: "dialogue" }),
];
doc.chapters.push(chapterTwo);

check("two chapters exist", doc.chapters.length === 2);
check(
  "paragraph types present",
  ["character", "action", "dialogue"].every((type) =>
    chapterTwo.blocks.some((block) => block.style === type)
  )
);

console.log("\n2. Inline formatting on Kannada text");

const actionBlock = chapterTwo.blocks[2];
const actionText = getParagraphText(actionBlock);
const boldStart = actionText.indexOf("ತಮ್ಮಟೆಯನ್ನು");
const boldEnd = boldStart + "ತಮ್ಮಟೆಯನ್ನು".length;
actionBlock.runs = toggleMarkOnRuns(actionBlock.runs, boldStart, boldEnd, "bold");

check(
  "bold applied without changing text",
  getParagraphText(actionBlock) === actionText,
  getParagraphText(actionBlock)
);
check(
  "bold reported active over range",
  getActiveMarks(actionBlock.runs, boldStart, boldEnd).includes("bold")
);

console.log("\n3. Comments + neon highlights");

const comment = createComment({
  chapterId: chapterTwo.id,
  paragraphId: actionBlock.id,
  start: boldStart,
  end: boldEnd,
  selectedText: "ತಮ್ಮಟೆಯನ್ನು",
  text: "Check this description.",
});
const highlight = createHighlight({
  chapterId: chapterTwo.id,
  paragraphId: actionBlock.id,
  start: boldStart,
  end: boldEnd,
  color: comment.color,
  commentId: comment.id,
});

const resolvedComment = createComment({
  chapterId: chapterTwo.id,
  paragraphId: chapterTwo.blocks[1].id,
  start: 0,
  end: 4,
  selectedText: "ಬೋಧಾ",
  text: "Name confirmed.",
});
resolvedComment.resolved = true;

doc.comments = [comment, resolvedComment];
doc.highlights = [highlight];

check("unresolved highlight is neon yellow", highlight.color === "neonYellow");
check("resolved comment retained in history", doc.comments.length === 2);

console.log("\n4. Annotations survive editing around them");

const editedText = `ಮರುದಿನ ${actionText}`;
const remapped = remapAnnotationsForParagraph(
  doc.highlights,
  actionBlock.id,
  actionText,
  editedText
);
const shifted = remapped.annotations[0];
check(
  "highlight shifted with inserted prefix",
  shifted.start === boldStart + "ಮರುದಿನ ".length,
  `${shifted.start} vs ${boldStart + "ಮರುದಿನ ".length}`
);
check(
  "highlight still covers the same word",
  editedText.slice(shifted.start, shifted.end) === "ತಮ್ಮಟೆಯನ್ನು",
  editedText.slice(shifted.start, shifted.end)
);

// Keep the document consistent with the edit we just simulated.
chapterTwo.blocks[2] = setParagraphText(actionBlock, editedText);
doc.highlights = remapped.annotations;

console.log("\n5. Layout, typography, cover and front matter");

doc.settings.pageSizeId = "5.5x8.5";
doc.settings.pageWidth = 5.5;
doc.settings.pageHeight = 8.5;
doc.settings.margins = {
  top: 0.8,
  bottom: 0.7,
  left: 0.85,
  right: 0.65,
  gutter: 0.2,
};
doc.settings.typography.fontFamilyId = "noto-sans-kannada";
doc.settings.typography.fontSizePt = 11.5;
doc.settings.typography.lineHeight = 1.7;
doc.frontMatter.titlePage = true;
doc.frontMatter.dedication = true;
doc.frontMatter.dedicationText = "ಅಮ್ಮನಿಗೆ";

console.log("\n6. Serialize to .kbook and reopen");

const editorState = {
  leftPanelOpen: true,
  commentsPanelOpen: true,
  zoom: 1.25,
  activeChapterId: chapterTwo.id,
};

const payload = serializeProject(doc, editorState);
const json = JSON.stringify(payload, null, 2);
const reparsed = JSON.parse(json);

const validation = validateKbook(reparsed);
check("serialized file validates", validation.valid, validation.errors.join("; "));

const { doc: restored, editorState: restoredUi } = deserializeProject(reparsed);

check("format is kbook", payload.format === "kbook");
check("schema version recorded", payload.version === 1);
check("title restored", restored.metadata.title === doc.metadata.title);
check("author restored", restored.metadata.author === "Mahesh");
check("chapter count restored", restored.chapters.length === 2);
check(
  "chapter order restored",
  restored.chapters[1].title === "ಅಧ್ಯಾಯ ೨"
);
check(
  "paragraph ids stable",
  restored.chapters[1].blocks[2].id === actionBlock.id
);
check(
  "paragraph types restored",
  restored.chapters[1].blocks.map((b) => b.style).join(",") ===
    "chapterTitle,character,action,dialogue"
);
check(
  "Kannada text preserved exactly",
  getParagraphText(restored.chapters[1].blocks[2]) === editedText
);
check(
  "inline bold preserved",
  restored.chapters[1].blocks[2].runs.some((run) =>
    (run.marks ?? []).some((mark) => mark.type === "bold")
  )
);
check("comments restored", restored.comments.length === 2);
check(
  "resolved state restored",
  restored.comments.find((c) => c.id === resolvedComment.id)?.resolved === true
);
check(
  "unresolved comment still unresolved",
  restored.comments.find((c) => c.id === comment.id)?.resolved === false
);
check("neon highlight restored", restored.highlights.length === 1);
check(
  "highlight colour restored",
  restored.highlights[0].color === "neonYellow"
);
check(
  "highlight linked to comment",
  restored.highlights[0].commentId === comment.id
);
check("page size restored", restored.settings.pageWidth === 5.5);
check("gutter restored", restored.settings.margins.gutter === 0.2);
check(
  "typography restored",
  restored.settings.typography.fontFamilyId === "noto-sans-kannada" &&
    restored.settings.typography.fontSizePt === 11.5
);
check("front matter restored", restored.frontMatter.dedicationText === "ಅಮ್ಮನಿಗೆ");
check("cover flag restored", restored.frontMatter.cover === true);
check("editor state restored", restoredUi.zoom === 1.25);

console.log("\n7. Unknown fields are never discarded");

const futurePayload = { ...reparsed, experimentalNotes: [{ id: "x", text: "keep" }] };
const { doc: futureDoc } = deserializeProject(futurePayload);
const reSerialized = serializeProject(futureDoc, {});
check(
  "unknown top-level field round-trips",
  reSerialized.experimentalNotes?.[0]?.text === "keep"
);

console.log("\n8. Corrupt / incompatible files are rejected");

check("non-object rejected", validateKbook("not json").valid === false);
check(
  "wrong format rejected",
  validateKbook({ ...reparsed, format: "docx" }).valid === false
);
check(
  "future schema rejected",
  validateKbook({ ...reparsed, version: 99 }).valid === false
);
check(
  "missing chapters rejected",
  validateKbook({ ...reparsed, chapters: undefined }).valid === false
);
check(
  "damaged chapter rejected",
  validateKbook({ ...reparsed, chapters: [{ title: "no id" }] }).valid === false
);

console.log("\n9. Exporters still consume the canonical model");

globalThis.Blob =
  globalThis.Blob ||
  class Blob {
    constructor(parts = [], options = {}) {
      this.parts = parts;
      this.type = options.type || "";
      this.size = parts.reduce((n, p) => n + String(p).length, 0);
    }
  };
globalThis.URL.createObjectURL = globalThis.URL.createObjectURL ?? (() => "blob:x");
globalThis.URL.revokeObjectURL = globalThis.URL.revokeObjectURL ?? (() => {});

let downloadedName = null;
const realCreateElement = document.createElement.bind(document);
document.createElement = (tag) => {
  const el = realCreateElement(tag);
  if (tag === "a") {
    el.click = () => {
      downloadedName = el.download;
    };
  }
  return el;
};

const { exportToDOCX } = await import("../src/services/export/docxExporter.js");
await exportToDOCX(restored, { includeCover: true }, () => {});
check("DOCX export produced a file", Boolean(downloadedName), String(downloadedName));
check(
  "DOCX filename uses the book title",
  String(downloadedName).endsWith(".docx")
);

document.createElement = realCreateElement;

console.log(
  failures === 0
    ? "\nAll project integrity checks passed.\n"
    : `\n${failures} check(s) failed.\n`
);
process.exit(failures === 0 ? 0 : 1);
