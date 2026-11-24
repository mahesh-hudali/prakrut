/**
 * Smoke test for export helpers + DOCX generation.
 */
import { JSDOM } from "jsdom";
import { Packer } from "docx";
import { createDocument } from "../src/models/documentModel.js";
import {
  buildExportFilename,
  sanitizeFilename,
} from "../src/utils/exportHelpers.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Blob =
  globalThis.Blob ||
  class Blob {
    constructor(parts = [], options = {}) {
      this.parts = parts;
      this.type = options.type || "";
      this.size = parts.reduce((n, p) => n + String(p).length, 0);
    }
  };

const title = "ನಮ್ಮೂರಿನ ಒಲಂಪಿಕ್ಸ್ / Nammurina Olympics";
const safe = sanitizeFilename(title);
console.log("sanitize=", safe);
if (!safe || /[<>:"/\\|?*]/.test(safe)) {
  console.error("FAIL: filename not sanitized");
  process.exit(1);
}

const docModel = createDocument();
docModel.metadata.title = "Nammurina Olympics";
const pdfName = buildExportFilename(docModel, "pdf");
const docxName = buildExportFilename(docModel, "docx");
console.log("pdf name=", pdfName);
console.log("docx name=", docxName);
if (pdfName !== "Nammurina-Olympics.pdf" || docxName !== "Nammurina-Olympics.docx") {
  console.error("FAIL: unexpected export filenames");
  process.exit(1);
}

// Build DOCX blob without triggering browser download by using Packer through exporter internals:
// Import exporter module and spy on document.createElement('a').click
let clickedDownload = null;
const createEl = document.createElement.bind(document);
document.createElement = (tag) => {
  const el = createEl(tag);
  if (tag === "a") {
    el.click = () => {
      clickedDownload = el.getAttribute("download") || el.download;
    };
  }
  return el;
};
globalThis.URL = {
  createObjectURL: () => "blob:mock-docx",
  revokeObjectURL: () => {},
};

const { exportToDOCX } = await import("../src/services/export/docxExporter.js");
const statuses = [];
const result = await exportToDOCX(
  docModel,
  { includeCover: true, includePageNumbers: true, includeHeaders: true },
  (s) => statuses.push(s)
);

console.log("statuses=", statuses.join(" | "));
console.log("result.filename=", result.filename);
console.log("clickedDownload=", clickedDownload);
console.log("blobSize=", result.blob?.size);

if (!result.filename?.endsWith(".docx")) {
  console.error("FAIL: missing docx filename");
  process.exit(1);
}
if (!statuses.includes("Preparing DOCX...") || !statuses.includes("DOCX downloaded.")) {
  console.error("FAIL: missing status messages");
  process.exit(1);
}
if (!(result.blob instanceof Blob) && !result.blob?.size) {
  // jsdom/vite may use different Blob; accept non-zero size from Packer
  if (!result.blob) {
    console.error("FAIL: missing blob");
    process.exit(1);
  }
}

console.log("PASS: export helpers + DOCX");
void Packer;
