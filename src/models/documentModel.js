import { createId } from "./ids.js";
import {
  createRun as createRunInternal,
  normalizeRuns,
  replaceTextPreservingRuns,
  runsToText,
} from "./runs.js";

export { createId } from "./ids.js";
export {
  INLINE_MARK_TYPES,
  getActiveMarks,
  normalizeRuns,
  runsToSegments,
  toggleMarkOnRuns,
} from "./runs.js";

/** Page size presets in inches (CSS `in` units). */
export const PAGE_PRESETS = {
  A5: { id: "A5", label: "A5", width: 5.83, height: 8.27 },
  "5x8": { id: "5x8", label: '5 × 8"', width: 5, height: 8 },
  "5.5x8.5": { id: "5.5x8.5", label: '5.5 × 8.5"', width: 5.5, height: 8.5 },
  "6x9": { id: "6x9", label: '6 × 9"', width: 6, height: 9 },
  custom: { id: "custom", label: "Custom", width: 6, height: 9 },
};

export const KANNADA_FONTS = [
  {
    id: "noto-serif-kannada",
    label: "Noto Serif Kannada",
    stack:
      '"Noto Serif Kannada", "Noto Sans Kannada", "Nirmala UI", serif, sans-serif',
  },
  {
    id: "noto-sans-kannada",
    label: "Noto Sans Kannada",
    stack: '"Noto Sans Kannada", "Nirmala UI", sans-serif, serif',
  },
  {
    id: "nirmala",
    label: "Nirmala UI",
    stack: '"Nirmala UI", "Noto Sans Kannada", sans-serif',
  },
  {
    id: "system",
    label: "System",
    stack: 'system-ui, "Noto Sans Kannada", sans-serif',
  },
];

/**
 * Paragraph types (stored on `block.style`).
 *
 * `writing` group = script-style types available from the main toolbar,
 * `structure` group = book structure styles kept in the secondary menu.
 */
export const BLOCK_STYLES = {
  normal: {
    id: "normal",
    label: "Normal",
    group: "writing",
    fontSizeScale: 1,
    fontWeight: 400,
    align: "justify",
    indentFirstLine: true,
    uppercase: false,
    marginTopEm: 0,
    marginBottomEm: 0,
  },
  character: {
    id: "character",
    label: "Character",
    group: "writing",
    fontSizeScale: 1,
    fontWeight: 700,
    align: "left",
    indentFirstLine: false,
    uppercase: false,
    letterSpacingEm: 0.04,
    marginTopEm: 1,
    marginBottomEm: 0.15,
  },
  action: {
    id: "action",
    label: "Action",
    group: "writing",
    fontSizeScale: 1,
    fontWeight: 400,
    align: "justify",
    indentFirstLine: true,
    uppercase: false,
    marginTopEm: 0,
    marginBottomEm: 0,
  },
  dialogue: {
    id: "dialogue",
    label: "Dialogue",
    group: "writing",
    fontSizeScale: 1,
    fontWeight: 400,
    align: "left",
    indentFirstLine: false,
    uppercase: false,
    paddingLeftEm: 1.6,
    paddingRightEm: 0.8,
    marginTopEm: 0.35,
    marginBottomEm: 0.35,
  },
  chapterTitle: {
    id: "chapterTitle",
    label: "Chapter Title",
    group: "structure",
    fontSizeScale: 1.45,
    fontWeight: 600,
    align: "center",
    indentFirstLine: false,
    uppercase: false,
    marginTopEm: 2.5,
    marginBottomEm: 2,
  },
  sectionHeading: {
    id: "sectionHeading",
    label: "Section Heading",
    group: "structure",
    fontSizeScale: 1.2,
    fontWeight: 600,
    align: "left",
    indentFirstLine: false,
    uppercase: false,
    marginTopEm: 1.4,
    marginBottomEm: 0.6,
  },
  subheading: {
    id: "subheading",
    label: "Subheading",
    group: "structure",
    fontSizeScale: 1.08,
    fontWeight: 500,
    align: "left",
    indentFirstLine: false,
    uppercase: false,
    marginTopEm: 1,
    marginBottomEm: 0.4,
  },
  quote: {
    id: "quote",
    label: "Quote",
    group: "structure",
    fontSizeScale: 1,
    fontWeight: 400,
    align: "left",
    indentFirstLine: false,
    uppercase: false,
    marginTopEm: 0.8,
    marginBottomEm: 0.8,
    italic: true,
    paddingLeftEm: 1.2,
  },
  sceneBreak: {
    id: "sceneBreak",
    label: "Scene Break",
    group: "structure",
    fontSizeScale: 1,
    fontWeight: 400,
    align: "center",
    indentFirstLine: false,
    uppercase: false,
    marginTopEm: 1.2,
    marginBottomEm: 1.2,
  },
};

export function createRun(text = "", marks = []) {
  return createRunInternal(text, marks);
}

export function createParagraph({
  text = "",
  style = "normal",
  align = null,
  runs = null,
} = {}) {
  return {
    id: createId("p"),
    type: "paragraph",
    style,
    align,
    runs: runs ? normalizeRuns(runs) : [createRunInternal(text)],
  };
}

export function createChapter({
  title = "ಅಧ್ಯಾಯ ೧",
  blocks = null,
} = {}) {
  return {
    id: createId("ch"),
    title,
    blocks:
      blocks ??
      [
        createParagraph({ text: title, style: "chapterTitle" }),
        createParagraph({
          text: "",
          style: "normal",
        }),
      ],
  };
}

export function createDefaultSettings() {
  const preset = PAGE_PRESETS["6x9"];
  return {
    pageSizeId: preset.id,
    pageWidth: preset.width,
    pageHeight: preset.height,
    margins: {
      top: 0.75,
      bottom: 0.75,
      left: 0.8,
      right: 0.7,
      gutter: 0.15,
    },
    typography: {
      fontFamilyId: "noto-serif-kannada",
      fontSizePt: 12,
      fontWeight: 400,
      lineHeight: 1.6,
      letterSpacingEm: 0,
      paragraphSpacingEm: 0.35,
      textAlign: "justify",
      firstLineIndentEm: 1.5,
    },
  };
}

export function createDocument(seedText = "") {
  const longSample = [
    "ಬೋಧಾ ತಮ್ಮಟೆಯನ್ನು ಜೋರಾಗಿ ಬಾರಿಸುತ್ತಿದ್ದ. ಊರಿನ ಜನರು ಎಲ್ಲಾ ಕಡೆಯಿಂದ ಓಡೋಡಿ ಬಂದು ಸೇರತೊಡಗಿದರು. ನಾನು ಊರಿಗೆ ಹೋಗುತ್ತಿದ್ದೇನೆ ಎಂದು ಅವನು ಹೇಳಿದಾಗ ಯಾರೂ ನಂಬಲಿಲ್ಲ.",
    "ಸಂಜೆಯ ಬೆಳಕು ಮರಗಳ ಎಲೆಗಳ ಮೂಲಕ ಸೋರಿ ಬರುತ್ತಿತ್ತು. ಮಕ್ಕಳ ಅಬ್ಬರ, ಡೋಲು-ತಮ್ಮಟೆಯ ನಾದ, ಅಂಗಳದಲ್ಲಿ ಹರಡಿದ್ದ ನಗೆ—ಎಲ್ಲವೂ ಒಂದು ಹೊಸ ಕಥೆಯನ್ನು ಪ್ರಾರಂಭಿಸುತ್ತಿರುವಂತೆ ಅನಿಸುತ್ತಿತ್ತು.",
    "ಅವನ ಕೂಗು ದೂರದ ಬೆಟ್ಟಗಳವರೆಗೂ ತಲುಪಿತು. ಹಳ್ಳಿಯ ಹಿರಿಯರು ಬಂದು ಕುಳಿತರು. ಯುವಕರು ಸಾಲಾಗಿ ನಿಂತರು. ಯಾರೋ ಒಬ್ಬರು “ಇದು ನಮ್ಮ ಒಲಂಪಿಕ್ಸ್!” ಎಂದು ಕೂಗಿದರು.",
    "Type Roman here: Naanu oorige hoguttiddene",
    "ಮರುದಿನ ಬೆಳಗ್ಗೆ ಮೈದಾನ ತುಂಬಿತ್ತು. ಓಟ, ಜಿಗಿತ, ಕುಸ್ತಿ—ಪ್ರತಿಯೊಂದು ಆಟಕ್ಕೂ ನಿಯಮಗಳನ್ನು ಬರೆದಿಟ್ಟಿದ್ದರು. ಯಾರೂ ಸೋಲನ್ನು ಭಯಪಡುತ್ತಿರಲಿಲ್ಲ; ಎಲ್ಲರೂ ಭಾಗವಹಿಸುವ ಸಂತೋಷದಲ್ಲಿದ್ದರು.",
    "ರಾತ್ರಿ ಊಟದ ನಂತರ ಕಥೆಗಳು ಶುರುವಾದವು. ಯಾರೋ ಹಿರಿಯರು ಹಳೆಯ ದಿನಗಳ ಕುಸ್ತಿ ಪಂದ್ಯಗಳನ್ನು ನೆನೆಸಿದರು. ಮಕ್ಕಳ ಕಣ್ಣುಗಳಲ್ಲಿ ಕನಸುಗಳು ಮಿನುಗುತ್ತಿದ್ದವು.",
    "ಹೀಗೆ ನಮ್ಮೂರಿನ ಒಲಂಪಿಕ್ಸ್ ಪ್ರಾರಂಭವಾಯಿತು—ದೊಡ್ಡ ಸ್ಟೇಡಿಯಂಗಳಿಲ್ಲದೆ, ಚಿನ್ನದ ಪದಕಗಳಿಲ್ಲದೆ, ಆದರೆ ಹೃದಯ ತುಂಬಿದ ಉತ್ಸಾಹದಿಂದ.",
  ];

  const sampleBlocks = [
    createParagraph({ text: "ಅಧ್ಯಾಯ ೧", style: "chapterTitle" }),
    ...longSample.map((text) => createParagraph({ text, style: "action" })),
    createParagraph({ text: "ಬೋಧಾ", style: "character" }),
    createParagraph({ text: "“ನೀನು ಎಲ್ಲಿಗೆ ಹೋಗುತ್ತಿದ್ದೀಯ?”", style: "dialogue" }),
    createParagraph({ text: "“ಊರಿಗೆ.”", style: "dialogue" }),
    createParagraph({ text: "", style: "normal" }),
  ];

  const chapter = createChapter({
    title: "ಅಧ್ಯಾಯ ೧",
    blocks: seedText
      ? [
          createParagraph({ text: "ಅಧ್ಯಾಯ ೧", style: "chapterTitle" }),
          ...seedText
            .split(/\n+/)
            .filter((line) => line.length > 0)
            .map((line) => createParagraph({ text: line, style: "normal" })),
          createParagraph({ text: "", style: "normal" }),
        ]
      : sampleBlocks,
  });

  const now = new Date().toISOString();

  return {
    version: 1,
    metadata: {
      id: createId("proj"),
      title: "ನಮ್ಮೂರಿನ ಒಲಂಪಿಕ್ಸ್",
      subtitle: "",
      author: "",
      language: "kn",
      createdAt: now,
      updatedAt: now,
    },
    settings: createDefaultSettings(),
    frontMatter: {
      cover: true,
      titlePage: false,
      copyright: false,
      dedication: false,
      contents: false,
      coverImage: null,
      copyrightText: "",
      dedicationText: "",
    },
    chapters: [chapter],
    /** @type {import('./annotations').Comment[]} */
    comments: [],
    /** @type {import('./annotations').Highlight[]} */
    highlights: [],
    /** Kannada-specific authoring aids persisted with the project. */
    kannada: {
      customDictionary: [],
      preferredSpellings: {},
      characterNames: [],
    },
  };
}

/** Flatten paragraph runs into plain text. */
export function getParagraphText(paragraph) {
  return runsToText(paragraph?.runs);
}

/**
 * Replace paragraph text while preserving inline marks on the untouched
 * prefix/suffix, so bold/italic survive normal typing.
 */
export function setParagraphText(paragraph, text) {
  return {
    ...paragraph,
    runs: replaceTextPreservingRuns(paragraph?.runs ?? [], text),
  };
}

export function getChapterPlainText(chapter) {
  return (chapter?.blocks ?? [])
    .map((block) => getParagraphText(block))
    .join("\n");
}

export function countWords(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function countDocumentStats(doc) {
  const parts = [];
  for (const chapter of doc.chapters ?? []) {
    for (const block of chapter.blocks ?? []) {
      parts.push(getParagraphText(block));
    }
  }
  const text = parts.join("\n");
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, "").length;
  return {
    words: countWords(text),
    characters,
    charactersNoSpaces,
  };
}

export function resolveFontStack(fontFamilyId) {
  return (
    KANNADA_FONTS.find((font) => font.id === fontFamilyId)?.stack ??
    KANNADA_FONTS[0].stack
  );
}

export function getContentWidthInches(settings, { isRightPage = true } = {}) {
  const { pageWidth, margins } = settings;
  const gutter = margins.gutter || 0;
  // Mirrored margins: gutter adds to the inner edge.
  const left = isRightPage ? margins.left + gutter : margins.right + gutter;
  const right = isRightPage ? margins.right : margins.left;
  return Math.max(1, pageWidth - left - right);
}

export function getContentHeightInches(settings) {
  const { pageHeight, margins } = settings;
  return Math.max(1, pageHeight - margins.top - margins.bottom);
}

export function settingsToCssVars(settings) {
  const fontStack = resolveFontStack(settings.typography.fontFamilyId);
  return {
    "--page-width": `${settings.pageWidth}in`,
    "--page-height": `${settings.pageHeight}in`,
    "--margin-top": `${settings.margins.top}in`,
    "--margin-bottom": `${settings.margins.bottom}in`,
    "--margin-left": `${settings.margins.left}in`,
    "--margin-right": `${settings.margins.right}in`,
    "--gutter": `${settings.margins.gutter}in`,
    "--font-family": fontStack,
    "--font-size": `${settings.typography.fontSizePt}pt`,
    "--font-weight": String(settings.typography.fontWeight),
    "--line-height": String(settings.typography.lineHeight),
    "--letter-spacing": `${settings.typography.letterSpacingEm}em`,
    "--paragraph-spacing": `${settings.typography.paragraphSpacingEm}em`,
    "--text-align": settings.typography.textAlign,
    "--first-line-indent": `${settings.typography.firstLineIndentEm}em`,
  };
}

/** A new, empty book: one chapter, ready to type. No sample text. */
export function createBlankDocument({ title = "Untitled book" } = {}) {
  const doc = createDocument();
  return {
    ...doc,
    metadata: { ...doc.metadata, title },
    chapters: [createChapter({ title: "ಅಧ್ಯಾಯ ೧" })],
  };
}
