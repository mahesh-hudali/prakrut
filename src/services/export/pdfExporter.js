/**
 * PDF exporter — page-by-page from the canonical book layout engine.
 *
 * Flow:
 *   document → buildBookLayout (same pagination as preview)
 *           → render each page DOM
 *           → capture → jsPDF page
 *
 * Does NOT dump the live editor DOM as one giant page.
 */

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { buildBookLayout } from "../../utils/bookLayout.js";
import {
  buildExportFilename,
  downloadBlob,
  waitForDocumentFonts,
} from "../../utils/exportHelpers.js";
import {
  createCoverPageElement,
  createExportRenderHost,
  createManuscriptPageElement,
} from "./pageRenderer.js";

async function captureElement(element, scale = 2) {
  const canvas = await html2canvas(element, {
    scale,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    width: element.offsetWidth,
    height: element.offsetHeight,
    windowWidth: element.offsetWidth,
    windowHeight: element.offsetHeight,
  });
  return canvas;
}

/**
 * @param {object} documentModel
 * @param {object} [options]
 * @param {(status: string) => void} [onStatus]
 * @returns {Promise<{ filename: string, blob: Blob, pageCount: number }>}
 */
export async function exportToPDF(documentModel, options = {}, onStatus) {
  const notify = (msg) => onStatus?.(msg);
  notify("Preparing PDF...");

  await waitForDocumentFonts();

  const layout = buildBookLayout(documentModel, options);
  const { settings } = layout;
  const { host, cleanup } = createExportRenderHost();

  try {
    notify("Generating PDF...");

    const pdf = new jsPDF({
      unit: "in",
      format: [settings.pageWidth, settings.pageHeight],
      orientation:
        settings.pageWidth >= settings.pageHeight ? "landscape" : "portrait",
      compress: true,
    });

    let pdfPageIndex = 0;
    const addCapturedPage = async (element) => {
      host.replaceChildren(element);
      // Allow layout/fonts to settle before rasterizing.
      await new Promise((r) => requestAnimationFrame(() => r()));
      const canvas = await captureElement(element, 2);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);

      if (pdfPageIndex > 0) {
        pdf.addPage(
          [settings.pageWidth, settings.pageHeight],
          settings.pageWidth >= settings.pageHeight ? "landscape" : "portrait"
        );
      }
      pdf.addImage(
        dataUrl,
        "JPEG",
        0,
        0,
        settings.pageWidth,
        settings.pageHeight,
        undefined,
        "FAST"
      );
      pdfPageIndex += 1;
    };

    // Cover (optional) — not part of manuscript pagination.
    if (
      layout.options.includeCover &&
      (layout.frontMatter.cover !== false || layout.metadata.title)
    ) {
      await addCapturedPage(createCoverPageElement(layout));
    }

    // Manuscript pages — same layout.pages as Book Preview.
    let manuscriptNumber = 1;
    for (const page of layout.pages) {
      const pageEl = createManuscriptPageElement(
        page,
        layout,
        layout.options.includePageNumbers ? manuscriptNumber : ""
      );
      await addCapturedPage(pageEl);
      manuscriptNumber += 1;
    }

    if (pdfPageIndex === 0) {
      // Empty manuscript — still emit one blank page.
      await addCapturedPage(createManuscriptPageElement(
        { pageIndex: 0, items: [], chapterId: null },
        layout,
        1
      ));
    }

    const filename = buildExportFilename(documentModel, "pdf");
    const blob = pdf.output("blob");
    downloadBlob(blob, filename);
    notify("PDF downloaded.");

    return { filename, blob, pageCount: pdfPageIndex };
  } finally {
    cleanup();
  }
}
