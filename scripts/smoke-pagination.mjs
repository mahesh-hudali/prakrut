/**
 * Smoke test: measure-based pagination packs content into multiple pages
 * when content exceeds one page height (no word-count estimates).
 */
import { JSDOM } from "jsdom";
import { createDocument, createParagraph } from "../src/models/documentModel.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.NodeFilter = dom.window.NodeFilter;

// Approximate layout metrics for deterministic testing.
const PX_PER_IN = 96;
const CHAR_WIDTH = 8;
const LINE_HEIGHT = 20;

function mockRect(el) {
  const style = el.style || {};
  if (style.height && String(style.height).endsWith("in")) {
    const inches = parseFloat(style.height);
    return {
      width: 0,
      height: inches * PX_PER_IN,
      top: 0,
      left: 0,
      bottom: inches * PX_PER_IN,
      right: 0,
      x: 0,
      y: 0,
      toJSON() {},
    };
  }

  const widthIn = parseFloat(style.width) || 4.5;
  const widthPx = widthIn * PX_PER_IN;
  const text = el.textContent || "";
  const charsPerLine = Math.max(1, Math.floor(widthPx / CHAR_WIDTH));
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
  const marginTop = parseFloat(style.marginTop) || 0;
  const marginBottom = parseFloat(style.marginBottom) || 0;
  // Convert em margins roughly using font size.
  const fontPt = parseFloat(style.fontSize) || 12;
  const fontPx = (fontPt * PX_PER_IN) / 72;
  const height =
    lines * LINE_HEIGHT +
    marginTop * fontPx +
    marginBottom * fontPx;

  return {
    width: widthPx,
    height,
    top: 0,
    left: 0,
    bottom: height,
    right: widthPx,
    x: 0,
    y: 0,
    toJSON() {},
  };
}

dom.window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return mockRect(this);
};

const { paginateDocument } = await import("../src/utils/pagination.js");

const doc = createDocument();
// Force smaller page so sample manuscript spans multiple pages.
doc.settings.pageWidth = 5;
doc.settings.pageHeight = 6;
doc.settings.margins = { top: 0.75, bottom: 0.75, left: 0.8, right: 0.7, gutter: 0.15 };
doc.settings.typography.fontSizePt = 14;
doc.settings.typography.lineHeight = 1.7;

const pages = paginateDocument(doc);
console.log("pageCount=", pages.length);
console.log(
  "itemsPerPage=",
  pages.map((p) => p.items.length).join(",")
);

if (pages.length < 2) {
  // Add more paragraphs and retry.
  for (let i = 0; i < 12; i += 1) {
    doc.chapters[0].blocks.push(
      createParagraph({
        text: "ಇದು ಪರೀಕ್ಷಾ ಪ್ಯಾರಾಗ್ರಾಫ್. ".repeat(8),
        style: "normal",
      })
    );
  }
  const pages2 = paginateDocument(doc);
  console.log("pageCount_after_extra=", pages2.length);
  if (pages2.length < 2) {
    console.error("FAIL: expected multiple pages from measured layout");
    process.exit(1);
  }
}

console.log("PASS: real pagination produced multiple pages");
