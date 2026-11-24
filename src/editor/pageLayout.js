/**
 * Page view for a continuous ProseMirror document.
 *
 * The editor is one column as wide as the page's text block. Pages are drawn
 * behind it (see ManuscriptEditor). This plugin decides where each page ends
 * and inserts invisible gaps so text never runs into a margin:
 *
 *   - a block gap before a paragraph that does not fit (or starts a chapter)
 *   - an inline gap at the start of the first line that does not fit, which
 *     splits a long paragraph across pages exactly at a real line break —
 *     so a Kannada conjunct can never be cut in half
 *
 * Layout runs after edits settle. Old gaps are removed, the natural layout is
 * measured and new gaps are added within the same task, so the screen never
 * paints the intermediate state. It never runs mid-composition (IME).
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const pageLayoutKey = new PluginKey("pageLayout");

const SETTLE_MS = 60;

function gapWidget(height, inline, pageIndex) {
  return (view) => {
    const el = document.createElement(inline ? "span" : "div");
    el.className = "page-gap";
    el.contentEditable = "false";
    el.dataset.page = String(pageIndex);
    el.style.display = "block";
    el.style.height = `${Math.max(0, height)}px`;
    el.setAttribute("aria-hidden", "true");
    void view;
    return el;
  };
}

/** Visual lines of a paragraph element: [{ top, bottom, left }] in client px. */
function lineBoxes(element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const lines = [];
  for (const rect of range.getClientRects()) {
    if (!rect.height) continue;
    const last = lines[lines.length - 1];
    // Fragments on the same line overlap vertically.
    if (last && rect.top < last.bottom - 1 && rect.bottom > last.top + 1) {
      last.top = Math.min(last.top, rect.top);
      last.bottom = Math.max(last.bottom, rect.bottom);
      last.left = Math.min(last.left, rect.left);
    } else {
      lines.push({ top: rect.top, bottom: rect.bottom, left: rect.left });
    }
  }
  return lines;
}

/**
 * Compute gap decorations for the current, gap-free layout.
 * geometry: { contentHeight, pitch } in CSS px (pitch = page height + gap
 * between pages); page k's text area is [k·pitch, k·pitch + contentHeight).
 */
function computeLayout(view, geometry) {
  const { contentHeight, pitch } = geometry;
  const root = view.dom;
  const rootRect = root.getBoundingClientRect();
  // CSS zoom scales client rects; convert back to layout px.
  const zoom = root.offsetHeight ? rootRect.height / root.offsetHeight : 1;
  const toY = (clientY) => (clientY - rootRect.top) / zoom;

  const decorations = [];
  let page = 0;
  let shift = 0; // total height of gaps inserted so far

  view.state.doc.forEach((chapter, chapterOffset, chapterIndex) => {
    chapter.forEach((paragraph, paragraphOffset, paragraphIndex) => {
      const pos = chapterOffset + 1 + paragraphOffset;
      const element = view.nodeDOM(pos);
      if (!(element instanceof HTMLElement)) return;
      const rect = element.getBoundingClientRect();
      const top = toY(rect.top) + shift;
      const bottom = toY(rect.bottom) + shift;

      // Every chapter after the first starts on a new page.
      if (chapterIndex > 0 && paragraphIndex === 0 && top > page * pitch) {
        const height = (page + 1) * pitch - top;
        decorations.push(Decoration.widget(pos, gapWidget(height, false, page), { side: -1, key: `c${page}:${Math.round(height)}` }));
        shift += height;
        page += 1;
        return checkSplit(element, pos, toY(rect.top) + shift, toY(rect.bottom) + shift);
      }

      checkSplit(element, pos, top, bottom);
    });
  });

  function checkSplit(element, pos, top, bottom) {
    let limit = page * pitch + contentHeight;
    if (bottom <= limit) return;

    const lines = lineBoxes(element);
    if (lines.length === 0 || toY(lines[0].bottom) + shift > limit) {
      // Not even the first line fits: move the whole paragraph.
      const height = (page + 1) * pitch - top;
      if (height > 0 && top > page * pitch) {
        decorations.push(Decoration.widget(pos, gapWidget(height, false, page), { side: -1, key: `b${page}:${Math.round(height)}` }));
        shift += height;
        page += 1;
        limit = page * pitch + contentHeight;
      }
    }

    for (let i = 0; i < lines.length; i += 1) {
      const lineTop = toY(lines[i].top) + shift;
      const lineBottom = toY(lines[i].bottom) + shift;
      if (lineBottom <= limit) continue;
      if (i === 0) {
        // A single line taller than the remaining page was handled above.
        continue;
      }
      const hit = view.posAtCoords({
        left: lines[i].left + 1,
        top: (lines[i].top + lines[i].bottom) / 2,
      });
      if (!hit) continue;
      const height = (page + 1) * pitch - lineTop;
      decorations.push(Decoration.widget(hit.pos, gapWidget(height, true, page), { side: -1, key: `l${page}:${Math.round(height)}` }));
      shift += height;
      page += 1;
      limit = page * pitch + contentHeight;
    }
  }

  return { decorations, pageCount: page + 1 };
}

/**
 * options.getGeometry(): { contentHeight, pitch } | null
 * options.onLayout({ pageCount }): called after each layout pass
 * options.onReady(relayout): receives a function that re-runs layout
 */
export const PageLayout = Extension.create({
  name: "pageLayout",

  addOptions() {
    return { getGeometry: () => null, onLayout: () => {}, onReady: () => {} };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: pageLayoutKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const meta = tr.getMeta(pageLayoutKey);
            if (meta) return meta.decorations;
            return set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return pageLayoutKey.getState(state);
          },
        },
        view(view) {
          let timer = null;
          let destroyed = false;

          const run = () => {
            timer = null;
            if (destroyed) return;
            if (view.composing) {
              schedule();
              return;
            }
            const geometry = options.getGeometry();
            if (!geometry) return;

            performance.mark("page-layout-start");
            const scroller = view.dom.closest("[data-scroll-root]");
            const scrollTop = scroller?.scrollTop ?? 0;

            // 1. Natural layout (no gaps)…
            view.dispatch(
              view.state.tr
                .setMeta(pageLayoutKey, { decorations: DecorationSet.empty })
                .setMeta("addToHistory", false)
            );
            // 2. …measured (this forces a synchronous reflow)…
            const { decorations, pageCount } = computeLayout(view, geometry);
            // 3. …then the real gaps, before the browser paints.
            view.dispatch(
              view.state.tr
                .setMeta(pageLayoutKey, {
                  decorations: DecorationSet.create(view.state.doc, decorations),
                })
                .setMeta("addToHistory", false)
            );
            if (scroller) scroller.scrollTop = scrollTop;
            performance.measure("page-layout", "page-layout-start");
            options.onLayout({ pageCount });
          };

          const schedule = (delay = SETTLE_MS) => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(run, delay);
          };

          // Page size, margins, fonts or zoom changed: callers re-run layout.
          options.onReady(() => schedule(0));

          // Fonts change line breaks; lay out again once they arrive.
          document.fonts?.ready.then(() => schedule(0));
          schedule(0);

          return {
            update(updatedView, previousState) {
              if (updatedView.state.doc !== previousState.doc) schedule();
            },
            destroy() {
              destroyed = true;
              if (timer) clearTimeout(timer);
            },
          };
        },
      }),
    ];
  },
});
