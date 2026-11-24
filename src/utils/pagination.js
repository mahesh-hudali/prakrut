/**
 * Measure-based pagination.
 *
 * Packs manuscript blocks into pages by measuring real rendered heights
 * against the usable content box (page height − margins).
 */

import { getParagraphText } from "../models/documentModel.js";
import {
  findFittingPrefix,
  getUsablePageHeightPx,
  measureBlockHeight,
} from "./textMeasurement.js";

/**
 * @typedef {Object} PageItem
 * @property {string} blockId
 * @property {string} chapterId
 * @property {string} style
 * @property {string|null} align
 * @property {string} text
 * @property {number} startOffset  offset into original paragraph text
 * @property {number} endOffset
 * @property {number} blockLength  length of the whole paragraph at pagination time
 * @property {boolean} isContinuation  true if this is a continuation from previous page
 * @property {boolean} continuesOnNext
 */

/**
 * @typedef {Object} PageModel
 * @property {number} pageIndex  0-based
 * @property {PageItem[]} items
 * @property {string} chapterId  primary chapter for this page
 */

/**
 * Paginate all chapters into visual pages.
 */
export function paginateDocument(doc) {
  const settings = doc.settings;
  const pageHeightPx = getUsablePageHeightPx(settings);
  /** @type {PageModel[]} */
  const pages = [];

  let currentItems = [];
  let usedHeight = 0;
  let currentChapterId = doc.chapters[0]?.id ?? null;

  const flushPage = () => {
    pages.push({
      pageIndex: pages.length,
      items: currentItems,
      chapterId: currentItems[0]?.chapterId ?? currentChapterId,
    });
    currentItems = [];
    usedHeight = 0;
  };

  for (const chapter of doc.chapters) {
    currentChapterId = chapter.id;

    for (const block of chapter.blocks) {
      const blockText = getParagraphText(block);
      const blockLength = blockText.length;
      let remaining = blockText;
      let offset = 0;
      let isContinuation = false;

      // Empty paragraphs still consume one line of space.
      if (remaining.length === 0) {
        const h = measureBlockHeight(block, settings, "\u00a0");
        if (usedHeight > 0 && usedHeight + h > pageHeightPx + 0.5) {
          flushPage();
        }
        currentItems.push({
          blockId: block.id,
          chapterId: chapter.id,
          style: block.style,
          align: block.align,
          text: "",
          startOffset: 0,
          endOffset: 0,
          blockLength: 0,
          isContinuation: false,
          continuesOnNext: false,
        });
        usedHeight += h;
        continue;
      }

      while (remaining.length > 0) {
        const available = pageHeightPx - usedHeight;

        // If nothing fits on this page, start a new one (unless page is empty —
        // then we must place at least a partial block).
        if (available < 8 && usedHeight > 0) {
          flushPage();
          continue;
        }

        const fullHeight = measureBlockHeight(block, settings, remaining);

        if (fullHeight <= available + 0.5) {
          currentItems.push({
            blockId: block.id,
            chapterId: chapter.id,
            style: block.style,
            align: block.align,
            text: remaining,
            startOffset: offset,
            endOffset: offset + remaining.length,
            blockLength,
            isContinuation,
            continuesOnNext: false,
          });
          usedHeight += fullHeight;
          remaining = "";
          break;
        }

        // Block overflows remaining space — split by measured prefix.
        const { prefix, rest } = findFittingPrefix(
          block,
          settings,
          remaining,
          Math.max(available, 1)
        );

        if (!prefix && usedHeight > 0) {
          // Could not fit anything — new page and retry.
          flushPage();
          continue;
        }

        const safePrefix = prefix || remaining.slice(0, 1);
        const safeRest = prefix ? rest : remaining.slice(safePrefix.length);

        currentItems.push({
          blockId: block.id,
          chapterId: chapter.id,
          style: block.style,
          align: block.align,
          text: safePrefix,
          startOffset: offset,
          endOffset: offset + safePrefix.length,
          blockLength,
          isContinuation,
          continuesOnNext: safeRest.length > 0,
        });

        offset += safePrefix.length;
        remaining = safeRest;
        isContinuation = true;
        flushPage();
      }
    }
  }

  if (currentItems.length > 0 || pages.length === 0) {
    flushPage();
  }

  return pages;
}
