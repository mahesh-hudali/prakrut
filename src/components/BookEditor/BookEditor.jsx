import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import BookPage from "../BookPage/BookPage";
import CommentComposer from "../CommentComposer/CommentComposer";
import CommentsPanel from "../CommentsPanel/CommentsPanel";
import EditorToolbar from "../EditorToolbar/EditorToolbar";
import LeftPanel from "../LeftPanel/LeftPanel";
import RecoveryPrompt from "../RecoveryPrompt/RecoveryPrompt";
import SelectionToolbar from "../SelectionToolbar/SelectionToolbar";
import StatusBar from "../StatusBar/StatusBar";
import TransliterationSuggestions from "../TransliterationSuggestions/TransliterationSuggestions";
import { useComments } from "../../hooks/useComments";
import { useDocument, usePagination } from "../../hooks/useDocument";
import { useFitZoom } from "../../hooks/useFitZoom";
import { useFocusMode } from "../../hooks/useFocusMode";
import { useHistoryShortcuts } from "../../hooks/useHistoryShortcuts";
import { SAVE_STATUS, useProject } from "../../hooks/useProject";
import { useTextSelection } from "../../hooks/useTextSelection";
import { useTransliteration } from "../../hooks/useTransliteration";
import { useUiState } from "../../hooks/useUiState";
import {
  BLOCK_STYLES,
  createDocument,
  getParagraphText,
  settingsToCssVars,
} from "../../models/documentModel";
import { getActiveMarks, runsToSegments } from "../../models/runs";
import { getRangesForSlice } from "../../models/annotations";
import {
  getCaretCharacterOffset,
  getCaretClientRect,
  getPlainTextFromEditable,
} from "../../utils/domSelection";
import { placeCaret } from "../../utils/pageDom";
import "./BookEditor.css";

const MemoBookPage = memo(BookPage);

const WRITING_MODE_SHORTCUTS = {
  0: "normal",
  1: "character",
  2: "action",
  3: "dialogue",
};

/**
 * Splice a page slice back into its paragraph.
 *
 * Slice offsets come from the last pagination pass, which lags typing by a
 * debounce, so `endOffset` cannot be used against the current text — it would
 * re-append the characters typed since. The number of characters before and
 * after the slice is stable (edits only happen at the caret, inside one slice),
 * so anchor on those instead.
 */
function spliceSlice(fullText, sliceText, { startOffset, endOffset, blockLength }) {
  const head = Math.min(startOffset, fullText.length);
  const tail = Math.max(0, (blockLength ?? fullText.length) - endOffset);
  return (
    fullText.slice(0, head) +
    sliceText +
    (tail > 0 ? fullText.slice(fullText.length - tail) : "")
  );
}

function findBlock(doc, chapterId, blockId) {
  const chapter = doc.chapters.find((ch) => ch.id === chapterId);
  if (!chapter) return null;
  const block = chapter.blocks.find((b) => b.id === blockId);
  return block ? { chapter, block } : null;
}

/** Every paragraph id touched by the current DOM selection. */
function getSelectedBlockIds() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return [];
  const range = selection.getRangeAt(0);
  const nodes = document.querySelectorAll("[data-block-id]");
  const ids = new Set();
  for (const node of nodes) {
    if (range.intersectsNode(node)) ids.add(node.dataset.blockId);
  }
  return [...ids];
}

export default function BookEditor() {
  const {
    doc,
    setDoc,
    stats,
    history,
    updateSettings,
    updateMetadata,
    updateBlockText,
    applyPageEdits,
    updateBlockStyle,
    updateBlockAlign,
    toggleBlockMark,
    splitBlockAt,
    mergeWithPrevious,
    mergeWithNext,
    addChapter,
    renameChapter,
    deleteChapter,
    moveChapter,
  } = useDocument();

  const { pages, isPaginating, pageCount } = usePagination(doc, {
    immediateToken: history.historyRevision,
  });
  const xlit = useTransliteration();
  const {
    ui,
    patchUi,
    toggleLeftPanel,
    toggleCommentsPanel,
    toggleFocusMode,
    setZoom,
    restoreUiState,
    serializableUi,
  } = useUiState();

  const commentsApi = useComments(doc, setDoc);
  const { selection, freeze, unfreeze, clearSelectionState } = useTextSelection();

  // Opening, recovering or starting a project replaces the document outright
  // and starts a fresh undo history.
  const project = useProject({
    doc,
    setDoc: history.resetDocument,
    editorState: serializableUi,
    restoreUiState,
  });

  const [activeBlock, setActiveBlock] = useState(null);
  const [anchorRect, setAnchorRect] = useState(null);
  const [commentDraft, setCommentDraft] = useState(null);
  const [focusedCommentId, setFocusedCommentId] = useState(null);
  const [exportStatus, setExportStatus] = useState("");
  const [exporting, setExporting] = useState(false);

  const caretRestoreRef = useRef(null);
  const stageRef = useRef(null);
  const exportStatusTimerRef = useRef(null);
  const docRef = useRef(doc);
  const pagesRef = useRef(pages);
  const handlersRef = useRef({});

  // Assigned during render on purpose: paragraph ref callbacks read decorations
  // during commit, which happens before layout effects would run.
  docRef.current = doc;
  pagesRef.current = pages;

  const cssVars = useMemo(() => settingsToCssVars(doc.settings), [doc.settings]);

  const activeChapterId =
    activeBlock?.chapterId ?? ui.activeChapterId ?? doc.chapters[0]?.id ?? null;

  const activeMeta = useMemo(() => {
    if (!activeBlock) {
      return { style: "normal", align: doc.settings.typography.textAlign };
    }
    const found = findBlock(doc, activeBlock.chapterId, activeBlock.blockId);
    if (!found) {
      return { style: "normal", align: doc.settings.typography.textAlign };
    }
    const styleDef = BLOCK_STYLES[found.block.style] ?? BLOCK_STYLES.normal;
    return {
      style: found.block.style,
      align: found.block.align || styleDef.align || doc.settings.typography.textAlign,
    };
  }, [activeBlock, doc]);

  const activeMarks = useMemo(() => {
    if (!selection) return [];
    const found = findBlock(doc, selection.chapterId, selection.paragraphId);
    if (!found) return [];
    return getActiveMarks(found.block.runs, selection.start, selection.end);
  }, [doc, selection]);

  // ---- Decorations (inline marks + comment highlights) ------------------
  // Read through a ref so the callback stays stable and memoized pages only
  // re-render when the decoration signature actually changes.
  const getItemDecorations = useCallback((item) => {
    const current = docRef.current;
    const found = findBlock(current, item.chapterId, item.blockId);
    if (!found) return { markSegments: [], highlightRanges: [] };

    const markSegments = runsToSegments(found.block.runs)
      .filter(
        (segment) =>
          segment.marks.length > 0 &&
          segment.end > item.startOffset &&
          segment.start < item.endOffset
      )
      .map((segment) => ({
        start: Math.max(segment.start, item.startOffset) - item.startOffset,
        end: Math.min(segment.end, item.endOffset) - item.startOffset,
        marks: segment.marks,
      }));

    const highlightRanges = getRangesForSlice(
      current.highlights,
      item.blockId,
      item.startOffset,
      item.endOffset
    );

    return { markSegments, highlightRanges };
  }, []);

  const decorationsKey = useMemo(() => {
    const highlights = (doc.highlights ?? [])
      .map((h) => `${h.id}:${h.start}-${h.end}:${h.resolved ? 1 : 0}:${h.color}`)
      .join("|");
    const marks = doc.chapters
      .map((chapter) =>
        chapter.blocks
          .map((block) =>
            (block.runs ?? [])
              .filter((run) => run.marks?.length)
              .map((run) => `${block.id}:${run.text.length}:${run.marks
                .map((mark) => mark.type)
                .join(",")}`)
              .join(",")
          )
          .join(";")
      )
      .join("#");
    return `${highlights}||${marks}`;
  }, [doc.highlights, doc.chapters]);

  /**
   * At most one paragraph ever shows a prompt: the caret's own paragraph while
   * it is empty, or the very first one in a brand-new manuscript. Marking every
   * empty paragraph made the page read "Type here" over and over.
   */
  const placeholderBlockId = useMemo(() => {
    if (stats.characters === 0) {
      return doc.chapters[0]?.blocks[0]?.id ?? null;
    }
    if (!activeBlock) return null;
    const found = findBlock(doc, activeBlock.chapterId, activeBlock.blockId);
    if (!found || getParagraphText(found.block).length > 0) return null;
    return activeBlock.blockId;
  }, [stats.characters, doc, activeBlock]);

  /**
   * Move the caret to a position in the model, choosing whichever page slice
   * actually contains that offset. This is what carries the caret onto the
   * next page when a paragraph reflows across a page break.
   */
  const focusModelPosition = useCallback((blockId, absoluteOffset) => {
    const slices = document.querySelectorAll(
      `.page-content [data-block-id="${CSS.escape(blockId)}"]`
    );
    if (slices.length === 0) return false;

    let target = slices[0];
    for (const slice of slices) {
      const start = Number(slice.dataset.startOffset || 0);
      const end = Number(slice.dataset.endOffset || 0);
      if (absoluteOffset >= start && absoluteOffset <= end) {
        target = slice;
        break;
      }
      if (absoluteOffset > end) target = slice;
    }

    target.closest(".page-content")?.focus({ preventScroll: true });
    placeCaret(target, absoluteOffset - Number(target.dataset.startOffset || 0));
    return true;
  }, []);

  // Restore the caret after pagination rebuilds the page surfaces.
  useLayoutEffect(() => {
    const pending = caretRestoreRef.current;
    if (!pending) return undefined;

    if (focusModelPosition(pending.blockId, pending.absoluteOffset)) {
      caretRestoreRef.current = null;
      return undefined;
    }

    const id = requestAnimationFrame(() => {
      if (focusModelPosition(pending.blockId, pending.absoluteOffset)) {
        caretRestoreRef.current = null;
      }
    });
    return () => cancelAnimationFrame(id);
  }, [pages, focusModelPosition]);

  // ---- Editing ----------------------------------------------------------
  // Handlers are re-created every render but reached through a ref, so the
  // memoized pages never re-render just because a closure changed identity.
  const latestHandlers = {};

  /** Where the caret sits, expressed in document-model coordinates. */
  const getCaretContext = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const node = selection.getRangeAt(0).startContainer;
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const paragraph = element?.closest?.("[data-block-id]");
    if (!paragraph || !paragraph.closest(".page-content")) return null;

    const sliceStart = Number(paragraph.dataset.startOffset || 0);
    const sliceEnd = Number(paragraph.dataset.endOffset || 0);
    const blockLength = Number(paragraph.dataset.blockLength || sliceEnd);
    const localCaret = getCaretCharacterOffset(paragraph);
    const sliceText = getPlainTextFromEditable(paragraph);

    return {
      paragraph,
      surface: paragraph.closest(".page-content"),
      blockId: paragraph.dataset.blockId,
      chapterId: paragraph.dataset.chapterId,
      sliceStart,
      sliceEnd,
      blockLength,
      // Characters of the paragraph living on other pages. Both stay constant
      // while the caret edits this slice, unlike the raw offsets.
      headLength: sliceStart,
      tailLength: Math.max(0, blockLength - sliceEnd),
      sliceText,
      localCaret,
      absoluteOffset: sliceStart + localCaret,
    };
  };

  const caretContextRef = useRef(getCaretContext);
  caretContextRef.current = getCaretContext;

  const syncTransliterationFromCaret = () => {
    const context = getCaretContext();
    if (!context) return;
    xlit.syncFromCaret(context.sliceText, context.localCaret);
    setAnchorRect(getCaretClientRect(context.paragraph));
  };

  /** Continue editing on the neighbouring page. */
  const jumpToPage = (targetIndex, atEnd) => {
    const surface = document.querySelector(
      `.page-content[data-page-index="${targetIndex}"]`
    );
    const paragraphs = surface?.querySelectorAll("[data-block-id]");
    if (!paragraphs?.length) return false;

    const paragraph = atEnd ? paragraphs[paragraphs.length - 1] : paragraphs[0];
    surface.focus({ preventScroll: true });
    placeCaret(paragraph, atEnd ? getPlainTextFromEditable(paragraph).length : 0);
    paragraph.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return true;
  };

  latestHandlers.onPageInput = (pageIndex) => {
    const surface = document.querySelector(
      `.page-content[data-page-index="${pageIndex}"]`
    );
    const page = pagesRef.current.find((p) => p.pageIndex === pageIndex);
    if (!surface || !page) return;

    const context = getCaretContext();
    if (context) {
      caretRestoreRef.current = {
        blockId: context.blockId,
        absoluteOffset: context.absoluteOffset,
      };
    }

    // Read back every paragraph on the page: one keystroke can touch several
    // of them when a selection spanning paragraphs is replaced.
    const domText = new Map();
    for (const node of surface.querySelectorAll("[data-block-id]")) {
      domText.set(
        `${node.dataset.blockId}:${node.dataset.startOffset}`,
        getPlainTextFromEditable(node)
      );
    }

    const edits = [];
    const removedBlockIds = [];

    for (const item of page.items) {
      const key = `${item.blockId}:${item.startOffset}`;
      const present = domText.has(key);
      const sliceText = present ? domText.get(key) : "";

      const found = findBlock(docRef.current, item.chapterId, item.blockId);
      if (!found) continue;

      const full = getParagraphText(found.block);
      const nextFull = spliceSlice(full, sliceText, item);

      if (!present) removedBlockIds.push(item.blockId);
      if (nextFull !== full) {
        edits.push({
          chapterId: item.chapterId,
          blockId: item.blockId,
          text: nextFull,
        });
      }
    }

    // One update, so comments and highlights are remapped alongside the text.
    if (edits.length > 0 || removedBlockIds.length > 0) {
      applyPageEdits(edits, removedBlockIds);
    }

    syncTransliterationFromCaret();
  };

  const acceptSuggestion = useCallback(
    (suggestion, { appendSpace = false } = {}) => {
      if (!suggestion) return;

      const context = caretContextRef.current();
      if (!context) return;

      const { start, end } = xlit.wordRange;
      const suffix = appendSpace ? " " : "";
      const nextSlice =
        context.sliceText.slice(0, start) +
        suggestion +
        suffix +
        context.sliceText.slice(end);
      const caret = start + suggestion.length + suffix.length;

      const found = findBlock(docRef.current, context.chapterId, context.blockId);
      if (!found) return;

      caretRestoreRef.current = {
        blockId: context.blockId,
        absoluteOffset: context.sliceStart + caret,
      };

      // Accepting a suggestion is its own undo step, separate from typing.
      history.checkpoint();
      const full = getParagraphText(found.block);
      updateBlockText(
        context.chapterId,
        context.blockId,
        spliceSlice(full, nextSlice, context)
      );

      xlit.clearSuggestions();
      xlit.setWordRange({ start: caret, end: caret, word: "" });
    },
    [history, updateBlockText, xlit]
  );

  latestHandlers.onPageKeyDown = (pageIndex, event) => {
    if (xlit.handleSuggestionKeys(event, { onAccept: acceptSuggestion })) {
      return;
    }

    const context = getCaretContext();
    if (!context) return;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      splitBlockAt(
        context.chapterId,
        context.blockId,
        context.absoluteOffset,
        (created) => {
          caretRestoreRef.current = { blockId: created.id, absoluteOffset: 0 };
        }
      );
      xlit.clearSuggestions();
      return;
    }

    // Joining paragraphs happens in the model, so the DOM the browser sees
    // never diverges from what we rendered.
    const collapsed = window.getSelection()?.isCollapsed ?? true;

    if (
      event.key === "Backspace" &&
      collapsed &&
      context.localCaret === 0 &&
      context.headLength === 0
    ) {
      event.preventDefault();
      mergeWithPrevious(context.chapterId, context.blockId, (position) => {
        caretRestoreRef.current = {
          blockId: position.blockId,
          absoluteOffset: position.offset,
        };
      });
      return;
    }

    if (event.key === "Delete" && collapsed) {
      const atBlockEnd =
        context.tailLength === 0 &&
        context.localCaret >= context.sliceText.length;
      if (atBlockEnd) {
        event.preventDefault();
        mergeWithNext(context.chapterId, context.blockId, (position) => {
          caretRestoreRef.current = {
            blockId: position.blockId,
            absoluteOffset: position.offset,
          };
        });
        return;
      }
    }

    // Page-crossing navigation: let the browser move the caret first, and only
    // hop to the neighbouring page when it could not move any further.
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowLeft"
    ) {
      const surface = context.surface;
      const before = getCaretCharacterOffset(surface);
      const forward = event.key === "ArrowDown" || event.key === "ArrowRight";

      requestAnimationFrame(() => {
        if (!surface.contains(document.activeElement) &&
          document.activeElement !== surface) {
          return;
        }
        if (getCaretCharacterOffset(surface) !== before) {
          syncTransliterationFromCaret();
          return;
        }
        jumpToPage(pageIndex + (forward ? 1 : -1), !forward);
      });
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      requestAnimationFrame(syncTransliterationFromCaret);
    }
  };

  latestHandlers.onPagePaste = (pageIndex, event) => {
    // Plain text only: pasted markup would desync the DOM from the model.
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (text) document.execCommand("insertText", false, text.replace(/\r\n?/g, "\n"));
  };

  useLayoutEffect(() => {
    handlersRef.current = latestHandlers;
  });

  // Stable wrappers keep memoized pages from re-rendering on every keystroke.
  const onPageInput = useCallback(
    (pageIndex, event) => handlersRef.current.onPageInput?.(pageIndex, event),
    []
  );
  const onPageKeyDown = useCallback(
    (pageIndex, event) => handlersRef.current.onPageKeyDown?.(pageIndex, event),
    []
  );
  const onPagePaste = useCallback(
    (pageIndex, event) => handlersRef.current.onPagePaste?.(pageIndex, event),
    []
  );

  // One listener tracks the paragraph under the caret for the toolbar, instead
  // of every paragraph carrying its own focus handler.
  useEffect(() => {
    const onSelectionChange = () => {
      const context = caretContextRef.current();
      if (!context) return;
      setActiveBlock((previous) =>
        previous?.blockId === context.blockId &&
        previous?.startOffset === context.sliceStart
          ? previous
          : {
              chapterId: context.chapterId,
              blockId: context.blockId,
              startOffset: context.sliceStart,
              endOffset: context.sliceEnd,
            }
      );
    };

    // A click is the author choosing where to be; drop any caret position we
    // were holding for the next reflow so it cannot pull them back.
    const onPointerDown = () => {
      caretRestoreRef.current = null;
    };

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  // ---- Undo / redo ---------------------------------------------------------
  const { undo, redo } = history;

  const runHistory = useCallback(
    (action) => {
      // Read the caret before the jump: the DOM still shows the old document.
      const context = caretContextRef.current();
      const result = action();
      if (!result) return;
      xlit.clearSuggestions();
      const caret =
        result.caret ??
        (context
          ? { blockId: context.blockId, offset: context.absoluteOffset }
          : null);
      caretRestoreRef.current = caret
        ? { blockId: caret.blockId, absoluteOffset: caret.offset }
        : null;
    },
    [xlit]
  );

  const handleUndo = useCallback(() => runHistory(undo), [runHistory, undo]);
  const handleRedo = useCallback(() => runHistory(redo), [runHistory, redo]);

  useHistoryShortcuts({ undo: handleUndo, redo: handleRedo });

  // ---- Paragraph type / alignment ---------------------------------------
  const applyParagraphStyle = useCallback(
    (style) => {
      const selectedIds = getSelectedBlockIds();
      const targets = selectedIds.length
        ? selectedIds
        : activeBlock
          ? [activeBlock.blockId]
          : [];

      if (targets.length === 0) return;

      for (const blockId of targets) {
        const chapter = docRef.current.chapters.find((ch) =>
          ch.blocks.some((b) => b.id === blockId)
        );
        if (chapter) updateBlockStyle(chapter.id, blockId, style);
      }
    },
    [activeBlock, updateBlockStyle]
  );

  const onAlignChange = useCallback(
    (align) => {
      if (!activeBlock) {
        updateSettings((settings) => ({
          ...settings,
          typography: { ...settings.typography, textAlign: align },
        }));
        return;
      }
      updateBlockAlign(activeBlock.chapterId, activeBlock.blockId, align);
    },
    [activeBlock, updateBlockAlign, updateSettings]
  );

  const onTypographyChange = useCallback(
    (partial) => {
      updateSettings((settings) => ({
        ...settings,
        typography: { ...settings.typography, ...partial },
      }));
    },
    [updateSettings]
  );

  // ---- Selection actions -------------------------------------------------
  const handleToggleMark = useCallback(
    (markType) => {
      if (!selection) return;
      toggleBlockMark(
        selection.chapterId,
        selection.paragraphId,
        selection.start,
        selection.end,
        markType
      );
    },
    [selection, toggleBlockMark]
  );

  const handleHighlight = useCallback(
    (colorId) => {
      if (!selection) return;
      commentsApi.addHighlight({
        chapterId: selection.chapterId,
        paragraphId: selection.paragraphId,
        start: selection.start,
        end: selection.end,
        color: colorId,
      });
    },
    [commentsApi, selection]
  );

  const startComment = useCallback(() => {
    if (!selection) return;
    freeze();
    setCommentDraft({
      chapterId: selection.chapterId,
      paragraphId: selection.paragraphId,
      start: selection.start,
      end: selection.end,
      text: selection.text,
      rect: selection.rect,
    });
  }, [freeze, selection]);

  const submitComment = useCallback(
    (text) => {
      if (!commentDraft) return;
      const created = commentsApi.addComment({
        chapterId: commentDraft.chapterId,
        paragraphId: commentDraft.paragraphId,
        start: commentDraft.start,
        end: commentDraft.end,
        selectedText: commentDraft.text,
        text,
      });
      setCommentDraft(null);
      unfreeze();
      clearSelectionState();
      window.getSelection()?.removeAllRanges();
      setFocusedCommentId(created.id);
      patchUi({ commentsPanelOpen: true });
    },
    [clearSelectionState, commentDraft, commentsApi, patchUi, unfreeze]
  );

  const cancelComment = useCallback(() => {
    setCommentDraft(null);
    unfreeze();
  }, [unfreeze]);

  // ---- Comment ↔ text focus ---------------------------------------------
  const focusCommentText = useCallback((comment) => {
    setFocusedCommentId(comment.id);
    const node = document.querySelector(
      `[data-block-id="${comment.paragraphId}"]`
    );
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleCommentMarkClick = useCallback(
    (commentId) => {
      setFocusedCommentId(commentId);
      patchUi({ commentsPanelOpen: true });
    },
    [patchUi]
  );

  // Mirror the focused comment onto its rendered marks.
  useEffect(() => {
    const marks = document.querySelectorAll(".comment-mark");
    for (const mark of marks) {
      mark.classList.toggle(
        "is-focused",
        Boolean(focusedCommentId) && mark.dataset.commentId === focusedCommentId
      );
    }
  }, [focusedCommentId, pages, decorationsKey]);

  // ---- Keyboard shortcuts -------------------------------------------------
  const { saveProject, openProject } = project;
  const { chromeVisible } = useFocusMode({ enabled: ui.focusMode, stageRef });
  const effectiveZoom = useFitZoom(stageRef, doc.settings.pageWidth, ui.zoom);

  useEffect(() => {
    const onKeyDown = (event) => {
      // Escape leaves focus mode once nothing else (suggestions, menus) used it.
      if (event.key === "Escape" && ui.focusMode && !event.defaultPrevented) {
        toggleFocusMode();
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      if (!event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        openProject();
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleLeftPanel();
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFocusMode();
        return;
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveProject({ forcePicker: event.shiftKey });
        return;
      }

      if (!event.shiftKey && WRITING_MODE_SHORTCUTS[event.key]) {
        event.preventDefault();
        applyParagraphStyle(WRITING_MODE_SHORTCUTS[event.key]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyParagraphStyle, openProject, saveProject, toggleFocusMode, toggleLeftPanel, ui.focusMode]);

  // ---- Export -------------------------------------------------------------
  const flashExportStatus = useCallback((message, persistMs = 3500) => {
    setExportStatus(message);
    if (exportStatusTimerRef.current) clearTimeout(exportStatusTimerRef.current);
    exportStatusTimerRef.current = setTimeout(() => setExportStatus(""), persistMs);
  }, []);

  const handleExport = useCallback(
    async (format) => {
      if (exporting) return;
      setExporting(true);
      try {
        const { exportBook } = await import("../../services/export");
        await exportBook(
          docRef.current,
          {
            format,
            includeCover: true,
            includeFrontMatter: true,
            includeHeaders: true,
            includePageNumbers: true,
            // Draft annotations stay out of the finished document.
            includeComments: false,
            includeHighlights: false,
          },
          (status) => setExportStatus(status)
        );
        flashExportStatus(format === "pdf" ? "PDF downloaded." : "DOCX downloaded.");
      } catch (error) {
        console.error("Export failed:", error);
        flashExportStatus("Export failed. Please try again.", 5000);
      } finally {
        setExporting(false);
      }
    },
    [exporting, flashExportStatus]
  );

  useEffect(
    () => () => {
      if (exportStatusTimerRef.current) clearTimeout(exportStatusTimerRef.current);
    },
    []
  );

  // ---- Chapters / front matter -------------------------------------------
  const handleSelectChapter = useCallback((chapterId) => {
    patchUi({ activeChapterId: chapterId });
    const page = document.querySelector(
      `[data-chapter-id="${chapterId}"]`
    );
    page?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [patchUi]);

  const handleDeleteChapter = useCallback(
    (chapterId) => {
      const chapter = docRef.current.chapters.find((c) => c.id === chapterId);
      const confirmed = window.confirm(
        `Delete “${chapter?.title || "this chapter"}” and its comments? This cannot be undone.`
      );
      if (confirmed) deleteChapter(chapterId);
    },
    [deleteChapter]
  );

  const handleToggleFrontMatter = useCallback(
    (key, value) => {
      setDoc((prev) => ({
        ...prev,
        frontMatter: { ...prev.frontMatter, [key]: value },
      }));
    },
    [setDoc]
  );

  const handleNewProject = useCallback(() => {
    const confirmed =
      project.saveStatus === SAVE_STATUS.SAVED ||
      project.saveStatus === SAVE_STATUS.NEW ||
      window.confirm(
        "Start a new project? Unsaved changes remain recoverable from autosave."
      );
    if (!confirmed) return;
    project.newProject(createDocument);
    setActiveBlock(null);
    setFocusedCommentId(null);
  }, [project]);

  const chapterTitleById = useMemo(() => {
    const map = new Map();
    for (const chapter of doc.chapters) map.set(chapter.id, chapter.title);
    return map;
  }, [doc.chapters]);

  const renderedPages = pages.length
    ? pages
    : [{ pageIndex: 0, items: [], chapterId: null }];

  return (
    <div
      className={[
        "book-editor",
        ui.focusMode ? "is-focus-mode" : "",
        ui.focusMode && chromeVisible ? "is-chrome-visible" : "",
        activeBlock ? "has-active-paragraph" : "",
      ].join(" ")}
      data-zoom={ui.zoom}
    >
      {ui.focusMode ? <div className="focus-reveal" aria-hidden="true" /> : null}
      <EditorToolbar
        leftPanelOpen={ui.leftPanelOpen}
        onToggleLeftPanel={toggleLeftPanel}
        title={doc.metadata.title}
        onTitleChange={(title) => updateMetadata({ title })}
        activeStyle={activeMeta.style}
        onStyleChange={applyParagraphStyle}
        align={activeMeta.align}
        onAlignChange={onAlignChange}
        typography={doc.settings.typography}
        onTypographyChange={onTypographyChange}
        commentsOpen={ui.commentsPanelOpen}
        unresolvedComments={commentsApi.stats.unresolved}
        onToggleComments={toggleCommentsPanel}
        focusMode={ui.focusMode}
        onToggleFocusMode={toggleFocusMode}
        filename={project.currentFilename}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        exporting={exporting}
        onExport={handleExport}
        onNewProject={handleNewProject}
        onOpenProject={project.openProject}
        onSaveProject={() => project.saveProject()}
        onSaveProjectAs={() => project.saveProject({ forcePicker: true })}
      />

      <div className="book-editor-body">
        <LeftPanel
          open={ui.leftPanelOpen && !ui.focusMode}
          chapters={doc.chapters}
          activeChapterId={activeChapterId}
          frontMatter={doc.frontMatter}
          settings={doc.settings}
          onChangeSettings={updateSettings}
          onSelectChapter={handleSelectChapter}
          onAddChapter={addChapter}
          onRenameChapter={renameChapter}
          onDeleteChapter={handleDeleteChapter}
          onMoveChapter={moveChapter}
          onToggleFrontMatter={handleToggleFrontMatter}
          onClose={toggleLeftPanel}
        />

        <main className="book-stage" style={cssVars} ref={stageRef}>
          <div
            className="book-stack"
            style={{
              // CSS zoom (not transform) so the scaled pages also take up
              // scaled space: no sideways scrolling on small screens.
              // Pagination measures off-screen, so it is unaffected.
              zoom: effectiveZoom,
            }}
          >
            {renderedPages.map((page, index) => (
              <MemoBookPage
                key={`page-${page.pageIndex}`}
                page={page}
                pageNumber={index + 1}
                totalPages={pageCount}
                isRightPage={index % 2 === 0}
                headerText={
                  index % 2 === 0
                    ? chapterTitleById.get(page.chapterId) ?? ""
                    : doc.metadata.title
                }
                activeBlockId={activeBlock?.blockId}
                placeholderBlockId={placeholderBlockId}
                getItemDecorations={getItemDecorations}
                decorationsKey={decorationsKey}
                onPageInput={onPageInput}
                onPageKeyDown={onPageKeyDown}
                onPagePaste={onPagePaste}
                onCommentMarkClick={handleCommentMarkClick}
              />
            ))}
          </div>
        </main>

        <CommentsPanel
          open={ui.commentsPanelOpen && !ui.focusMode}
          comments={commentsApi.comments}
          chapters={doc.chapters}
          focusedCommentId={focusedCommentId}
          onFocusComment={focusCommentText}
          onResolve={commentsApi.resolveComment}
          onDelete={commentsApi.deleteComment}
          onUpdate={commentsApi.updateComment}
          onClose={toggleCommentsPanel}
        />
      </div>

      <StatusBar
        saveStatus={project.saveStatus}
        savedAt={project.savedAt}
        pageCount={pageCount}
        isPaginating={isPaginating}
        stats={stats}
        zoom={ui.zoom}
        onZoomChange={setZoom}
        message={
          exportStatus ||
          project.statusMessage ||
          (xlit.loading ? "Transliterating…" : xlit.error || "")
        }
      />

      <SelectionToolbar
        selection={commentDraft ? null : selection}
        activeMarks={activeMarks}
        onToggleMark={handleToggleMark}
        onHighlight={handleHighlight}
        onComment={startComment}
        onFreeze={freeze}
        onUnfreeze={unfreeze}
      />

      <CommentComposer
        draft={commentDraft}
        onCancel={cancelComment}
        onSubmit={submitComment}
      />

      <TransliterationSuggestions
        open={xlit.open}
        suggestions={xlit.suggestions}
        selectedIndex={xlit.selectedIndex}
        word={xlit.wordRange.word}
        anchorRect={anchorRect}
        onHover={xlit.setSelectedIndex}
        onSelect={(item) => acceptSuggestion(item, { appendSpace: false })}
      />

      <RecoveryPrompt
        recovery={project.recovery}
        onRestore={project.acceptRecovery}
        onDiscard={project.discardRecovery}
      />
    </div>
  );
}
