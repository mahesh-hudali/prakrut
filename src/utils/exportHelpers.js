/**
 * Shared export helpers — filename sanitization, downloads, default options.
 * Format-agnostic so EPUB/HTML/Markdown can plug in later.
 */

export const EXPORT_FORMATS = Object.freeze({
  PDF: "pdf",
  DOCX: "docx",
  // Future: EPUB: "epub", HTML: "html", MARKDOWN: "markdown", TEXT: "text"
});

export function createDefaultExportOptions(overrides = {}) {
  return {
    format: EXPORT_FORMATS.PDF,
    includeCover: true,
    includeFrontMatter: true,
    includeHeaders: true,
    includePageNumbers: true,
    includeComments: false,
    includeHighlights: false,
    ...overrides,
  };
}

/**
 * Build a safe download basename from the book title.
 * Example: "ನಮ್ಮೂರಿನ ಒಲಂಪಿಕ್ಸ್" → "ನಮ್ಮೂರಿನ-ಒಲಂಪಿಕ್ಸ್"
 * Falls back to ASCII slug when needed for maximum filesystem safety.
 */
export function sanitizeFilename(title, fallback = "kannada-book") {
  const raw = (title || "").trim() || fallback;
  const cleaned = raw
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");

  if (!cleaned) return fallback;

  // Keep Unicode letters, marks (matras), numbers, underscore, hyphen.
  const unicodeSafe = cleaned.replace(/[^\p{L}\p{M}\p{N}_-]+/gu, "");
  return unicodeSafe || fallback;
}

export function buildExportFilename(doc, extension) {
  const base = sanitizeFilename(doc?.metadata?.title, "kannada-book");
  const ext = extension.startsWith(".") ? extension.slice(1) : extension;
  return `${base}.${ext}`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Delay revoke so Safari finishes the download handshake.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function waitForDocumentFonts() {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }
}

export function inchesToPoints(inches) {
  return inches * 72;
}

export function inchesToTwips(inches) {
  // 1 inch = 1440 twips (DOCX / Word)
  return Math.round(inches * 1440);
}

export function ptToHalfPoints(pt) {
  return Math.round(pt * 2);
}
