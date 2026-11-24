/**
 * Unified export facade.
 *
 * Extensible for future formats: EPUB, HTML, Markdown, plain text, etc.
 */

import {
  EXPORT_FORMATS,
  createDefaultExportOptions,
} from "../../utils/exportHelpers.js";
import { exportToDOCX } from "./docxExporter.js";
import { exportToPDF } from "./pdfExporter.js";

export { exportToPDF } from "./pdfExporter.js";
export { exportToDOCX } from "./docxExporter.js";
export {
  EXPORT_FORMATS,
  createDefaultExportOptions,
  sanitizeFilename,
  buildExportFilename,
} from "../../utils/exportHelpers.js";

/**
 * Export the entire book.
 *
 * @param {object} documentModel
 * @param {object} [options]
 * @param {(status: string) => void} [onStatus]
 */
export async function exportBook(documentModel, options = {}, onStatus) {
  const opts = createDefaultExportOptions(options);
  const format = String(opts.format || "").toLowerCase();

  if (format === EXPORT_FORMATS.PDF || format === "pdf") {
    return exportToPDF(documentModel, opts, onStatus);
  }

  if (format === EXPORT_FORMATS.DOCX || format === "docx") {
    return exportToDOCX(documentModel, opts, onStatus);
  }

  throw new Error(
    `Unsupported export format: ${opts.format}. Supported: PDF, DOCX.`
  );
}
