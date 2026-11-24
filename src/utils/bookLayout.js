/**
 * Canonical book layout engine.
 *
 * Document Model → Book Layout → Preview / PDF / Print
 *
 * Preview and PDF must share this path so pagination matches.
 */

import { paginateDocument } from "./pagination.js";

/**
 * @typedef {Object} BookLayout
 * @property {import('../models/documentModel').*} document
 * @property {object} settings
 * @property {Array} pages  — same model as editor pagination
 * @property {object} options
 */

/**
 * Build the layout used by Book Preview and PDF export.
 */
export function buildBookLayout(documentModel, options = {}) {
  if (!documentModel?.settings) {
    throw new Error("Document settings are required for book layout.");
  }

  const pages = paginateDocument(documentModel);

  return {
    document: documentModel,
    settings: documentModel.settings,
    metadata: documentModel.metadata ?? {},
    frontMatter: documentModel.frontMatter ?? {},
    pages,
    options: {
      includeCover: options.includeCover !== false,
      includeFrontMatter: options.includeFrontMatter !== false,
      includeHeaders: options.includeHeaders !== false,
      includePageNumbers: options.includePageNumbers !== false,
      includeComments: Boolean(options.includeComments),
      includeHighlights: Boolean(options.includeHighlights),
    },
  };
}
