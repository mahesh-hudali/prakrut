/**
 * Offscreen text measurement for pagination.
 *
 * We mirror the page content box (width + typography) in a hidden container,
 * then measure real rendered heights — never estimated word counts.
 */

import {
  BLOCK_STYLES,
  getParagraphText,
  resolveFontStack,
  getContentWidthInches,
} from "../models/documentModel.js";

const MEASURE_HOST_ID = "kannada-book-measure-host";

function ensureMeasureHost() {
  let host = document.getElementById(MEASURE_HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = MEASURE_HOST_ID;
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = [
      "position:absolute",
      "left:-10000px",
      "top:0",
      "visibility:hidden",
      "pointer-events:none",
      "height:auto",
      "overflow:visible",
      "z-index:-1",
    ].join(";");
    document.body.appendChild(host);
  }
  return host;
}

function applyBaseStyles(el, settings) {
  const typo = settings.typography;
  el.style.boxSizing = "border-box";
  el.style.width = `${getContentWidthInches(settings)}in`;
  el.style.fontFamily = resolveFontStack(typo.fontFamilyId);
  el.style.fontSize = `${typo.fontSizePt}pt`;
  el.style.fontWeight = String(typo.fontWeight);
  el.style.lineHeight = String(typo.lineHeight);
  el.style.letterSpacing = `${typo.letterSpacingEm}em`;
  el.style.whiteSpace = "pre-wrap";
  el.style.wordBreak = "break-word";
  el.style.overflowWrap = "anywhere";
}

function applyBlockStyles(el, block, settings) {
  const styleDef = BLOCK_STYLES[block.style] ?? BLOCK_STYLES.normal;
  const typo = settings.typography;
  const fontSize = typo.fontSizePt * (styleDef.fontSizeScale ?? 1);

  el.style.fontSize = `${fontSize}pt`;
  el.style.fontWeight = String(styleDef.fontWeight ?? typo.fontWeight);
  el.style.fontStyle = styleDef.italic ? "italic" : "normal";
  el.style.textAlign = block.align || styleDef.align || typo.textAlign;
  el.style.letterSpacing = `${
    (typo.letterSpacingEm ?? 0) + (styleDef.letterSpacingEm ?? 0)
  }em`;
  el.style.margin = "0";
  el.style.padding = "0";
  el.style.paddingLeft = styleDef.paddingLeftEm
    ? `${styleDef.paddingLeftEm}em`
    : "0";
  el.style.paddingRight = styleDef.paddingRightEm
    ? `${styleDef.paddingRightEm}em`
    : "0";
  el.style.marginTop = `${styleDef.marginTopEm ?? 0}em`;
  el.style.marginBottom = `${
    (styleDef.marginBottomEm ?? 0) + typo.paragraphSpacingEm
  }em`;
  el.style.textIndent =
    styleDef.indentFirstLine && (getParagraphText(block) || "").length > 0
      ? `${typo.firstLineIndentEm}em`
      : "0";
}

/**
 * Measure a single block (or text slice of a block) in pixels.
 */
export function measureBlockHeight(block, settings, textOverride = null) {
  const host = ensureMeasureHost();
  host.replaceChildren();

  const el = document.createElement("div");
  el.className = `measure-block style-${block.style || "normal"}`;
  applyBaseStyles(el, settings);
  applyBlockStyles(el, block, settings);

  const text =
    textOverride !== null ? textOverride : getParagraphText(block) || "\u00a0";
  el.textContent = text.length ? text : "\u00a0";

  host.appendChild(el);
  const height = el.getBoundingClientRect().height;
  host.replaceChildren();
  return height;
}

/**
 * Binary-search the largest prefix of `text` that fits in `maxHeightPx`
 * when rendered with the given block style.
 */
export function findFittingPrefix(block, settings, text, maxHeightPx) {
  if (!text) return { prefix: "", rest: "" };
  if (measureBlockHeight(block, settings, text) <= maxHeightPx) {
    return { prefix: text, rest: "" };
  }

  // Prefer splitting on whitespace when possible.
  let low = 0;
  let high = text.length;
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = text.slice(0, mid);
    const h = measureBlockHeight(block, settings, candidate || "\u00a0");
    if (h <= maxHeightPx) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (best <= 0) {
    // Even one character overflows — force at least one grapheme cluster-ish char.
    best = Math.min(1, text.length);
  }

  // Soft-break at last whitespace in the fitting prefix when remaining text exists.
  let splitAt = best;
  if (best < text.length) {
    const window = text.slice(0, best);
    const ws = Math.max(window.lastIndexOf(" "), window.lastIndexOf("\n"));
    if (ws > 0 && ws > best * 0.4) {
      splitAt = ws + 1;
    }
  }

  return {
    prefix: text.slice(0, splitAt),
    rest: text.slice(splitAt),
  };
}

/**
 * Usable content height of a page in pixels (matches rendered page box).
 */
export function getUsablePageHeightPx(settings) {
  const host = ensureMeasureHost();
  host.replaceChildren();
  const probe = document.createElement("div");
  probe.style.width = "0";
  probe.style.height = `${Math.max(
    1,
    settings.pageHeight - settings.margins.top - settings.margins.bottom
  )}in`;
  host.appendChild(probe);
  const px = probe.getBoundingClientRect().height;
  host.replaceChildren();
  return px;
}

export function cleanupMeasureHost() {
  const host = document.getElementById(MEASURE_HOST_ID);
  if (host) host.remove();
}
