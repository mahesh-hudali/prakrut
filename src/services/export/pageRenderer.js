/**
 * Offscreen page renderer shared by PDF export.
 * Mirrors BookPage / PageContent visual rules using the layout model.
 */

import {
  BLOCK_STYLES,
  resolveFontStack,
  settingsToCssVars,
} from "../../models/documentModel.js";
import { sliceRuns } from "../../models/runs.js";

function applyCssVars(el, settings) {
  const vars = settingsToCssVars(settings);
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }
}

function findBlock(documentModel, item) {
  for (const chapter of documentModel?.chapters ?? []) {
    if (chapter.id !== item.chapterId) continue;
    return chapter.blocks.find((block) => block.id === item.blockId) ?? null;
  }
  return null;
}

/** Render the slice's runs so bold/italic/underline survive into the PDF. */
function appendRunContent(el, item, documentModel, fallbackText) {
  const block = findBlock(documentModel, item);
  const runs = block
    ? sliceRuns(block.runs ?? [], item.startOffset, item.endOffset)
    : [];

  const hasMarks = runs.some((run) => run.marks?.length);
  if (!hasMarks) {
    el.textContent = fallbackText.length ? fallbackText : "\u00a0";
    return;
  }

  for (const run of runs) {
    if (!run.marks?.length) {
      el.appendChild(document.createTextNode(run.text));
      continue;
    }
    const span = document.createElement("span");
    span.textContent = run.text;
    for (const mark of run.marks) {
      if (mark.type === "bold") span.style.fontWeight = "700";
      if (mark.type === "italic") span.style.fontStyle = "italic";
      if (mark.type === "underline") span.style.textDecoration = "underline";
      if (mark.type === "font") span.style.fontFamily = resolveFontStack(mark.value);
      if (mark.type === "size") span.style.fontSize = `${mark.value}pt`;
    }
    el.appendChild(span);
  }
}

function createParagraphNode(item, settings, documentModel) {
  const styleDef = BLOCK_STYLES[item.style] ?? BLOCK_STYLES.normal;
  const typo = settings.typography;
  const el = document.createElement("div");
  el.className = `export-paragraph style-${item.style || "normal"}`;

  const isSceneBreak = item.style === "sceneBreak";
  const text =
    isSceneBreak && !(item.text || "").trim() ? "* * *" : item.text || "";

  appendRunContent(el, item, documentModel, text);
  el.style.margin = "0";
  el.style.whiteSpace = "pre-wrap";
  el.style.wordBreak = "break-word";
  el.style.overflowWrap = "anywhere";
  el.style.fontSize = `${styleDef.fontSizeScale ?? 1}em`;
  el.style.fontWeight = String(styleDef.fontWeight ?? typo.fontWeight);
  el.style.fontStyle = styleDef.italic ? "italic" : "normal";
  el.style.textAlign = item.align || styleDef.align || typo.textAlign;
  el.style.marginTop = `${styleDef.marginTopEm ?? 0}em`;
  el.style.marginBottom = `calc(${styleDef.marginBottomEm ?? 0}em + var(--paragraph-spacing))`;
  el.style.paddingLeft = styleDef.paddingLeftEm
    ? `${styleDef.paddingLeftEm}em`
    : "0";
  el.style.paddingRight = styleDef.paddingRightEm
    ? `${styleDef.paddingRightEm}em`
    : "0";
  el.style.letterSpacing = `${
    (typo.letterSpacingEm ?? 0) + (styleDef.letterSpacingEm ?? 0)
  }em`;
  el.style.textIndent =
    styleDef.indentFirstLine && !item.isContinuation && text.length > 0
      ? "var(--first-line-indent)"
      : "0";
  if (item.isContinuation) el.style.textIndent = "0";

  return el;
}

/**
 * Build a single manuscript page DOM node (exact book dimensions).
 */
export function createManuscriptPageElement(page, layout, pageNumber) {
  const { settings, options } = layout;
  const isRightPage = page.pageIndex % 2 === 0;

  const pageEl = document.createElement("article");
  pageEl.className = `export-book-page ${isRightPage ? "is-right" : "is-left"}`;
  applyCssVars(pageEl, settings);

  pageEl.style.boxSizing = "border-box";
  pageEl.style.width = "var(--page-width)";
  pageEl.style.height = "var(--page-height)";
  pageEl.style.background = "#ffffff";
  pageEl.style.color = "#1c1914";
  pageEl.style.position = "relative";
  pageEl.style.display = "flex";
  pageEl.style.flexDirection = "column";
  pageEl.style.fontFamily = "var(--font-family)";
  pageEl.style.fontSize = "var(--font-size)";
  pageEl.style.fontWeight = "var(--font-weight)";
  pageEl.style.lineHeight = "var(--line-height)";
  pageEl.style.letterSpacing = "var(--letter-spacing)";
  pageEl.style.overflow = "hidden";

  if (isRightPage) {
    pageEl.style.padding =
      "var(--margin-top) var(--margin-right) var(--margin-bottom) calc(var(--margin-left) + var(--gutter))";
  } else {
    pageEl.style.padding =
      "var(--margin-top) calc(var(--margin-left) + var(--gutter)) var(--margin-bottom) var(--margin-right)";
  }

  // Optional header (book / chapter title) — reserved for future header settings.
  if (options.includeHeaders) {
    const header = document.createElement("div");
    header.style.position = "absolute";
    header.style.left = "0";
    header.style.right = "0";
    header.style.top = "calc(var(--margin-top) * 0.28)";
    header.style.textAlign = "center";
    header.style.fontSize = "0.7em";
    header.style.color = "#6a6256";
    header.style.fontFamily = resolveFontStack(settings.typography.fontFamilyId);
    const chapterTitle =
      layout.document?.chapters?.find(
        (chapter) => chapter.id === page.chapterId
      )?.title ?? "";
    // Verso carries the book title, recto the chapter title.
    header.textContent = isRightPage ? chapterTitle : layout.metadata.title || "";
    if (header.textContent) pageEl.appendChild(header);
  }

  const inner = document.createElement("div");
  inner.style.flex = "1";
  inner.style.minHeight = "0";
  inner.style.overflow = "hidden";

  for (const item of page.items || []) {
    inner.appendChild(createParagraphNode(item, settings, layout.document));
  }

  pageEl.appendChild(inner);

  if (options.includePageNumbers) {
    const footer = document.createElement("div");
    footer.style.position = "absolute";
    footer.style.left = "0";
    footer.style.right = "0";
    footer.style.bottom = "calc(var(--margin-bottom) * 0.35)";
    footer.style.textAlign = "center";
    footer.style.fontSize = "0.85em";
    footer.style.color = "#5a5348";
    footer.style.fontFamily = "var(--font-family)";
    footer.textContent = String(pageNumber);
    pageEl.appendChild(footer);
  }

  return pageEl;
}

/**
 * Cover page from document metadata (when enabled).
 */
export function createCoverPageElement(layout) {
  const { settings, metadata } = layout;
  const pageEl = document.createElement("article");
  applyCssVars(pageEl, settings);

  pageEl.style.boxSizing = "border-box";
  pageEl.style.width = "var(--page-width)";
  pageEl.style.height = "var(--page-height)";
  pageEl.style.background = "#ffffff";
  pageEl.style.color = "#1c1914";
  pageEl.style.display = "flex";
  pageEl.style.flexDirection = "column";
  pageEl.style.alignItems = "center";
  pageEl.style.justifyContent = "center";
  pageEl.style.padding =
    "var(--margin-top) var(--margin-right) var(--margin-bottom) var(--margin-left)";
  pageEl.style.fontFamily = resolveFontStack(settings.typography.fontFamilyId);
  pageEl.style.textAlign = "center";
  pageEl.style.gap = "1.25rem";

  const title = document.createElement("h1");
  title.textContent = metadata.title || "Untitled";
  title.style.margin = "0";
  title.style.fontSize = "2em";
  title.style.fontWeight = "600";
  title.style.lineHeight = "1.3";

  pageEl.appendChild(title);

  if (metadata.subtitle) {
    const subtitle = document.createElement("p");
    subtitle.textContent = metadata.subtitle;
    subtitle.style.margin = "0";
    subtitle.style.fontSize = "1.15em";
    subtitle.style.color = "#5a5348";
    pageEl.appendChild(subtitle);
  }

  if (metadata.author) {
    const author = document.createElement("p");
    author.textContent = metadata.author;
    author.style.margin = "2rem 0 0";
    author.style.fontSize = "1.05em";
    pageEl.appendChild(author);
  }

  return pageEl;
}

/**
 * Mount export pages offscreen for capture; returns host + cleanup.
 */
export function createExportRenderHost() {
  const host = document.createElement("div");
  host.id = "kannada-book-export-host";
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    "z-index:-1",
    "pointer-events:none",
    "background:#fff",
  ].join(";");
  document.body.appendChild(host);
  return {
    host,
    cleanup() {
      host.remove();
    },
  };
}
