/**
 * DOCX exporter — structured manuscript via the `docx` library.
 * Preserves chapters, styles, typography, page size, and margins.
 * Word performs its own pagination (by design).
 */

import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
  convertInchesToTwip,
} from "docx";
import {
  BLOCK_STYLES,
  getParagraphText,
  resolveFontStack,
} from "../../models/documentModel.js";
import { buildExportFilename, downloadBlob } from "../../utils/exportHelpers.js";

function mapAlign(align) {
  switch (align) {
    case "center":
      return AlignmentType.CENTER;
    case "right":
      return AlignmentType.RIGHT;
    case "justify":
      return AlignmentType.BOTH;
    default:
      return AlignmentType.LEFT;
  }
}

function primaryFontName(fontFamilyId) {
  const stack = resolveFontStack(fontFamilyId);
  const match = stack.match(/"([^"]+)"/);
  return match?.[1] || "Noto Serif Kannada";
}

function styleToHeading(style) {
  if (style === "chapterTitle") return HeadingLevel.HEADING_1;
  if (style === "sectionHeading") return HeadingLevel.HEADING_2;
  if (style === "subheading") return HeadingLevel.HEADING_3;
  return undefined;
}

function buildTextRuns(block, settings, displayText) {
  const styleDef = BLOCK_STYLES[block.style] ?? BLOCK_STYLES.normal;
  const typo = settings.typography;
  const font = primaryFontName(typo.fontFamilyId);
  const fontSizePt = typo.fontSizePt * (styleDef.fontSizeScale ?? 1);
  const size = Math.round(fontSizePt * 2);
  const baseBold = (styleDef.fontWeight ?? typo.fontWeight) >= 600;
  const baseItalic = Boolean(styleDef.italic);

  // Fall back to the display text so placeholders (e.g. scene breaks) survive.
  const hasRunText = (block.runs ?? []).some((run) => run.text?.length);
  const sourceRuns = hasRunText
    ? block.runs
    : [{ text: displayText, marks: [] }];

  return sourceRuns.map((run) => {
    const marks = run.marks || [];
    const highlight = marks.find((m) => m.type === "highlight");
    return new TextRun({
      text: run.text ?? "",
      font,
      size,
      bold: baseBold || marks.some((m) => m.type === "bold"),
      italics: baseItalic || marks.some((m) => m.type === "italic"),
      underline: marks.some((m) => m.type === "underline")
        ? { type: "single" }
        : undefined,
      highlight: highlight?.color || undefined,
    });
  });
}

function blockToParagraph(block, settings, { pageBreakBefore = false } = {}) {
  const styleDef = BLOCK_STYLES[block.style] ?? BLOCK_STYLES.normal;
  const typo = settings.typography;
  const text = getParagraphText(block);
  const display =
    block.style === "sceneBreak" && !text.trim() ? "* * *" : text;
  const align = mapAlign(block.align || styleDef.align || typo.textAlign);
  const heading = styleToHeading(block.style);

  const indent =
    styleDef.indentFirstLine && display.length > 0
      ? { firstLine: convertInchesToTwip((typo.firstLineIndentEm || 0) * 0.12) }
      : styleDef.paddingLeftEm
        ? { left: convertInchesToTwip(styleDef.paddingLeftEm * 0.12) }
        : undefined;

  return new Paragraph({
    heading,
    alignment: align,
    pageBreakBefore,
    spacing: {
      line: Math.round(typo.lineHeight * 240),
      after: Math.round(
        ((styleDef.marginBottomEm ?? 0) + typo.paragraphSpacingEm) * 200
      ),
      before: Math.round((styleDef.marginTopEm ?? 0) * 200),
    },
    indent,
    children: buildTextRuns(block, settings, display),
  });
}

function buildCoverParagraphs(documentModel, settings) {
  const font = primaryFontName(settings.typography.fontFamilyId);
  const meta = documentModel.metadata || {};
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 400 },
      children: [
        new TextRun({
          text: meta.title || "Untitled",
          font,
          bold: true,
          size: 48,
        }),
      ],
    }),
  ];

  if (meta.subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [
          new TextRun({ text: meta.subtitle, font, size: 28, italics: true }),
        ],
      })
    );
  }

  if (meta.author) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 800 },
        children: [new TextRun({ text: meta.author, font, size: 26 })],
      })
    );
  }

  return children;
}

/**
 * @param {object} documentModel
 * @param {object} [options]
 * @param {(status: string) => void} [onStatus]
 */
export async function exportToDOCX(documentModel, options = {}, onStatus) {
  const notify = (msg) => onStatus?.(msg);
  notify("Preparing DOCX...");

  const settings = documentModel.settings;
  const includeCover = options.includeCover !== false;
  const includePageNumbers = options.includePageNumbers !== false;
  const includeHeaders = options.includeHeaders !== false;
  const font = primaryFontName(settings.typography.fontFamilyId);
  const hasCover =
    includeCover && documentModel.frontMatter?.cover !== false;

  notify("Generating DOCX...");

  /** @type {Paragraph[]} */
  const children = [];

  if (hasCover) {
    children.push(...buildCoverParagraphs(documentModel, settings));
  }

  for (const [chapterIndex, chapter] of (
    documentModel.chapters || []
  ).entries()) {
    const pageBreakBefore = hasCover || chapterIndex > 0;
    const blocks = chapter.blocks || [];

    if (blocks.length === 0) {
      children.push(
        new Paragraph({
          pageBreakBefore,
          children: [new TextRun({ text: chapter.title || "", font, size: 28 })],
        })
      );
      continue;
    }

    blocks.forEach((block, blockIndex) => {
      children.push(
        blockToParagraph(block, settings, {
          pageBreakBefore: pageBreakBefore && blockIndex === 0,
        })
      );
    });
  }

  if (children.length === 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "", font, size: 24 })],
      })
    );
  }

  const doc = new Document({
    creator: documentModel.metadata?.author || "Kannada Book Editor",
    title: documentModel.metadata?.title || "Kannada Book",
    description: documentModel.metadata?.subtitle || "",
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertInchesToTwip(settings.pageWidth),
              height: convertInchesToTwip(settings.pageHeight),
            },
            margin: {
              top: convertInchesToTwip(settings.margins.top),
              bottom: convertInchesToTwip(settings.margins.bottom),
              left: convertInchesToTwip(
                settings.margins.left + (settings.margins.gutter || 0)
              ),
              right: convertInchesToTwip(settings.margins.right),
            },
          },
        },
        headers: includeHeaders
          ? {
              default: new Header({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: documentModel.metadata?.title || "",
                        font,
                        size: 18,
                        color: "6A6256",
                      }),
                    ],
                  }),
                ],
              }),
            }
          : undefined,
        footers: includePageNumbers
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        children: [PageNumber.CURRENT],
                        font,
                        size: 18,
                      }),
                    ],
                  }),
                ],
              }),
            }
          : undefined,
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = buildExportFilename(documentModel, "docx");
  downloadBlob(blob, filename);
  notify("DOCX downloaded.");

  return { filename, blob };
}
