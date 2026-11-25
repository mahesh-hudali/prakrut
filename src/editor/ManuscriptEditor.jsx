import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import { closeHistory } from "@tiptap/pm/history";
import { Focus } from "@tiptap/extensions";
import TransliterationSuggestions from "../components/TransliterationSuggestions/TransliterationSuggestions";
import { useTransliteration } from "../hooks/useTransliteration";
import { settingsToCssVars } from "../models/documentModel";
import { modelToPm, pmToModel } from "./convert";
import { PageLayout } from "./pageLayout";
import { Annotation, BookDocument, BookParagraph, Chapter, ExactTextInput, UniqueIds } from "./schema";
import "../components/PageContent/PageContent.css";
import "./ManuscriptEditor.css";

const CSS_PX_PER_INCH = 96;
const PAGE_GAP_PX = 32;
const MODEL_SYNC_MS = 300;

function pageGeometry(settings) {
  const pageHeight = settings.pageHeight * CSS_PX_PER_INCH;
  return {
    pageHeight,
    pitch: pageHeight + PAGE_GAP_PX,
    contentHeight: (settings.pageHeight - settings.margins.top - settings.margins.bottom) * CSS_PX_PER_INCH,
  };
}

/**
 * The writing surface: a ProseMirror editor laid out as book pages.
 *
 * Typing, Enter, selection, formatting and undo are all ProseMirror
 * transactions on the document — the page is never rebuilt from scratch, so
 * the caret stays put and nothing jumps. Pages are drawn behind the text;
 * pageLayout.js decides where each page breaks.
 *
 * Props:
 *   initialDoc   app document model (loaded once; remount with a new `key`
 *                to open a different project)
 *   settings     page and typography settings (live)
 *   zoom         visual zoom factor
 *   onDocChange  receives the updated app model shortly after edits
 *   onEditor     receives the Tiptap editor instance (toolbar wiring)
 *   onPageCount  receives the number of pages after each layout pass
 *   getBaseDoc   returns the app's current model (comments, metadata…)
 *                that converted editor content is merged into
 *   stageRef     ref to the scrolling stage (focus-mode typewriter scroll)
 *   onAnnotationClick(commentId)  a comment highlight was clicked
 */
export default function ManuscriptEditor({
  initialDoc,
  settings,
  zoom = 1,
  onDocChange,
  onEditor,
  onPageCount,
  getBaseDoc,
  stageRef,
  onAnnotationClick,
  transliterate = true,
}) {
  const [pageCount, setPageCount] = useState(1);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const xlit = useTransliteration();
  const [anchorRect, setAnchorRect] = useState(null);

  const settingsRef = useRef(settings);
  const modelRef = useRef(initialDoc);
  const xlitRef = useRef(xlit);
  const callbacksRef = useRef({ onDocChange, onPageCount, getBaseDoc, onAnnotationClick });
  const syncTimerRef = useRef(null);
  useLayoutEffect(() => {
    settingsRef.current = settings;
    xlitRef.current = xlit;
    callbacksRef.current = { onDocChange, onPageCount, getBaseDoc, onAnnotationClick };
  });

  const acceptRef = useRef(() => {});
  const transliterateRef = useRef(transliterate);
  const relayoutRef = useRef(null);

  const editor = useEditor({
    extensions: [
      BookDocument,
      Chapter,
      BookParagraph,
      StarterKit.configure({
        document: false,
        paragraph: false,
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        link: false,
        trailingNode: false,
      }),
      TextStyle,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ["paragraph"] }),
      Annotation,
      UniqueIds,
      ExactTextInput,
      // Marks the paragraph being written (focus mode keeps it in full ink).
      Focus.configure({ className: "has-focus", mode: "deepest" }),
      PageLayout.configure({
        getGeometry: () => pageGeometry(settingsRef.current),
        onLayout: ({ pageCount: count }) => {
          if (!mountedRef.current) return;
          setPageCount(count);
          callbacksRef.current.onPageCount?.(count);
        },
        onReady: (relayout) => {
          relayoutRef.current = relayout;
        },
      }),
    ],
    content: modelToPm(initialDoc),
    editorProps: {
      attributes: {
        class: "manuscript",
        spellcheck: transliterate ? "false" : "true",
        lang: transliterate ? "kn" : "en",
        "aria-label": "Manuscript",
      },
      // Suggestion keys (↑ ↓ Enter Space Esc) go to the transliteration
      // popup while it is open; everything else is normal editing.
      handleKeyDown: (_view, event) =>
        xlitRef.current.handleSuggestionKeys(event, {
          onAccept: (suggestion, options) => acceptRef.current(suggestion, options),
        }),
      handleDOMEvents: {
        click: (_view, event) => {
          const mark = event.target?.closest?.(".comment-mark[data-comment-id]");
          const commentId = mark?.dataset.commentId;
          if (commentId) callbacksRef.current.onAnnotationClick?.(commentId);
          return false;
        },
      },
    },
    onUpdate: ({ editor: instance }) => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        const base = callbacksRef.current.getBaseDoc?.() ?? modelRef.current;
        const next = pmToModel(instance.getJSON(), { ...base, settings: settingsRef.current });
        modelRef.current = next;
        callbacksRef.current.onDocChange?.(next);
      }, MODEL_SYNC_MS);
    },
    // Suggestions come from typing only. Moving the caret (click, arrows)
    // closes them, so an existing English word is never converted by a
    // Space the writer meant as a space.
    onTransaction: ({ editor: instance, transaction }) => {
      if (transaction.docChanged) syncTransliteration(instance);
      else if (transaction.selectionSet) xlitRef.current.clearSuggestions();
    },
  });

  /** Look at the Roman word at the caret and ask for Kannada suggestions. */
  function syncTransliteration(instance) {
    const { view, state } = instance;
    if (view.composing || !transliterateRef.current) return;
    const { selection } = state;
    if (!selection.empty) {
      xlitRef.current.clearSuggestions();
      return;
    }
    const { $from } = selection;
    const text = $from.parent.textBetween(0, $from.parent.content.size, undefined, "\n");
    xlitRef.current.syncFromCaret(text, $from.parentOffset);
    const coords = view.coordsAtPos(selection.from);
    setAnchorRect({ left: coords.left, top: coords.top, bottom: coords.bottom });
  }

  /** Replace the Roman word with the chosen Kannada word. */
  useLayoutEffect(() => {
    acceptRef.current = (suggestion, { appendSpace = false } = {}) => {
    if (!editor || !suggestion) return;
    const { state, view } = editor;
    const { $from } = state.selection;
    const { start, end } = xlitRef.current.wordRange;
    const paragraphStart = $from.start();
    const text = suggestion + (appendSpace ? " " : "");
    // Its own undo step: ⌘Z turns the Kannada word back into the Roman one.
    view.dispatch(closeHistory(state.tr.insertText(text, paragraphStart + start, paragraphStart + end)));
    xlitRef.current.clearSuggestions();
    const caret = start + text.length;
    xlitRef.current.setWordRange({ start: caret, end: caret, word: "" });
    };
  });

  useEffect(() => {
    if (editor) onEditor?.(editor);
  }, [editor, onEditor]);

  // Page size, margins or zoom changed: lay pages out again.
  const geometry = useMemo(() => pageGeometry(settings), [settings]);
  useEffect(() => {
    relayoutRef.current?.();
  }, [editor, geometry, zoom, settings.typography]);

  useEffect(() => () => syncTimerRef.current && clearTimeout(syncTimerRef.current), []);

  const cssVars = useMemo(() => settingsToCssVars(settings), [settings]);
  const { margins } = settings;
  const sheets = Array.from({ length: pageCount }, (_, index) => index);

  return (
    <div className="manuscript-stage" data-scroll-root ref={stageRef}>
      <div
        className="manuscript-stack"
        style={{
          ...cssVars,
          zoom,
          width: `${settings.pageWidth}in`,
          height: `${pageCount * geometry.pitch - PAGE_GAP_PX}px`,
        }}
      >
        {sheets.map((index) => (
          <div
            key={index}
            className="manuscript-sheet"
            style={{ top: `${index * geometry.pitch}px`, height: `${geometry.pageHeight}px` }}
            aria-hidden="true"
          >
            <span className="manuscript-sheet__number">{index + 1}</span>
          </div>
        ))}
        <div
          className="manuscript-column"
          style={{
            top: `${margins.top}in`,
            left: `${margins.left + margins.gutter}in`,
            width: `${settings.pageWidth - margins.left - margins.right - margins.gutter}in`,
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      <TransliterationSuggestions
        open={xlit.open}
        suggestions={xlit.suggestions}
        selectedIndex={xlit.selectedIndex}
        word={xlit.wordRange.word}
        anchorRect={anchorRect}
        onHover={xlit.setSelectedIndex}
        onSelect={(item) => acceptRef.current(item, { appendSpace: false })}
      />
    </div>
  );
}
