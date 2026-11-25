import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorState } from "@tiptap/react";
import CommentComposer from "../../components/CommentComposer/CommentComposer";
import CommentsPanel from "../../components/CommentsPanel/CommentsPanel";
import LeftPanel from "../../components/LeftPanel/LeftPanel";
import SelectionToolbar from "../../components/SelectionToolbar/SelectionToolbar";
import StatusBar from "../../components/StatusBar/StatusBar";
import { useFitZoom } from "../../hooks/useFitZoom";
import { useFocusMode } from "../../hooks/useFocusMode";
import { createComment, createHighlight } from "../../models/annotations";
import { BLOCK_STYLES, countDocumentStats } from "../../models/documentModel";
import {
  addAnnotation,
  addChapter,
  chapterAtSelection,
  deleteChapter,
  listChapters,
  moveChapter,
  removeComment,
  renameChapter,
  scrollToChapter,
  scrollToComment,
  selectionForAnnotation,
  setCommentResolved,
} from "../commands";
import { pmToModel } from "../convert";
import ManuscriptEditor from "../ManuscriptEditor";
import WriterToolbar from "./WriterToolbar";
import "./BookWorkspace.css";

const SHORTCUT_STYLES = { 0: "normal", 1: "character", 2: "action", 3: "dialogue" };
const VIEW_KEY = "prakrut:view";

function readView() {
  try {
    return { binder: false, comments: false, zoom: 1, ...JSON.parse(localStorage.getItem(VIEW_KEY) || "{}") };
  } catch {
    return { binder: false, comments: false, zoom: 1 };
  }
}

function time(iso) {
  return iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : null;
}

/**
 * One open book: toolbar, binder, pages, comments and status bar, all on top
 * of the ProseMirror editor.
 */
export default function BookWorkspace({ library }) {
  const { book, save, folder } = library;
  const doc = book.doc;
  const [editor, setEditor] = useState(null);
  const [pages, setPages] = useState(null);
  const [stats, setStats] = useState(() => countDocumentStats(doc));
  const [view, setView] = useState(readView);
  const [focusMode, setFocusMode] = useState(false);
  const [commentDraft, setCommentDraft] = useState(null);
  const [focusedCommentId, setFocusedCommentId] = useState(null);
  const [exportStatus, setExportStatus] = useState("");
  const [exporting, setExporting] = useState(false);
  const stageRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(view));
    } catch {
      // Not critical.
    }
  }, [view]);

  const zoom = useFitZoom(stageRef, doc.settings.pageWidth, view.zoom);
  useFocusMode({ enabled: focusMode, stageRef });

  // ---- Editor state for the toolbar, binder and selection bar ------------
  const format = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      const text = e.getAttributes("textStyle");
      const paragraph = e.getAttributes("paragraph");
      const style = paragraph.blockStyle ?? "normal";
      const { from, to, empty } = e.state.selection;
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        fontFamily: text.fontFamily ?? "",
        fontSize: text.fontSize ?? "",
        blockStyle: style,
        textAlign: paragraph.textAlign ?? BLOCK_STYLES[style]?.align ?? "left",
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        from,
        to,
        empty,
        focused: e.isFocused,
        chapters: listChapters(e.state.doc).map(({ id, title }) => ({ id, title })),
        activeChapterId: chapterAtSelection(e.state),
      };
    },
  });

  const { registerLatestDoc, updateDoc, getDoc } = library;
  const onEditor = useCallback(
    (instance) => {
      setEditor(instance);
      registerLatestDoc(() => pmToModel(instance.getJSON(), getDoc()));
    },
    [getDoc, registerLatestDoc]
  );

  const onDocChange = useCallback(
    (next) => {
      updateDoc(next);
      setStats(countDocumentStats(next));
    },
    [updateDoc]
  );

  // ---- Panels and focus mode --------------------------------------------
  const toggleBinder = useCallback(() => setView((v) => ({ ...v, binder: !v.binder })), []);
  const toggleComments = useCallback(() => setView((v) => ({ ...v, comments: !v.comments })), []);

  /** Focus: full screen, only the page. Esc (or ⌘⇧F) leaves. */
  const toggleFocus = useCallback(() => {
    setFocusMode((on) => {
      const next = !on;
      if (next) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      return next;
    });
    editor?.commands.focus();
  }, [editor]);

  useEffect(() => {
    // Leaving full screen (Esc, or the browser's own control) leaves focus mode.
    const onChange = () => {
      if (!document.fullscreenElement) setFocusMode(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ---- Comments and highlights -------------------------------------------
  const selectionRect = useMemo(() => {
    if (!editor || !format || format.empty || !format.focused || commentDraft || focusMode) return null;
    try {
      const start = editor.view.coordsAtPos(format.from);
      const end = editor.view.coordsAtPos(format.to);
      const left = Math.min(start.left, end.left);
      const right = Math.max(start.right, end.right);
      return { top: start.top, bottom: end.bottom, left, right, width: right - left, height: end.bottom - start.top };
    } catch {
      return null;
    }
  }, [editor, format, commentDraft, focusMode]);

  const startComment = useCallback(() => {
    const range = editor && selectionForAnnotation(editor.state);
    if (!range) return;
    const start = editor.view.coordsAtPos(range.from);
    const end = editor.view.coordsAtPos(range.to);
    setCommentDraft({ ...range, rect: { left: start.left, top: start.top, bottom: end.bottom } });
  }, [editor]);

  const submitComment = useCallback(
    (text) => {
      const range = commentDraft;
      if (!range) return;
      const comment = createComment({
        chapterId: range.chapterId,
        paragraphId: range.paragraphId,
        start: range.start,
        end: range.end,
        selectedText: range.text,
        text,
      });
      const highlight = createHighlight({
        chapterId: range.chapterId,
        paragraphId: range.paragraphId,
        start: range.start,
        end: range.end,
        color: comment.color,
        commentId: comment.id,
      });
      // Model first, so the editor's next sync keeps the new comment.
      library.addAnnotationRecords({ comment, highlight });
      addAnnotation(editor, range, {
        highlightId: highlight.id,
        commentId: comment.id,
        color: highlight.color,
        resolved: false,
      });
      setCommentDraft(null);
      setFocusedCommentId(comment.id);
      setView((v) => ({ ...v, comments: true }));
    },
    [commentDraft, editor, library]
  );

  const addHighlight = useCallback(
    (color) => {
      const range = editor && selectionForAnnotation(editor.state);
      if (!range) return;
      const highlight = createHighlight({
        chapterId: range.chapterId,
        paragraphId: range.paragraphId,
        start: range.start,
        end: range.end,
        color,
      });
      library.addAnnotationRecords({ highlight });
      addAnnotation(editor, range, { highlightId: highlight.id, commentId: null, color, resolved: false });
    },
    [editor, library]
  );

  const toggleMark = useCallback(
    (type) => {
      const chain = editor.chain().focus();
      if (type === "bold") chain.toggleBold();
      if (type === "italic") chain.toggleItalic();
      if (type === "underline") chain.toggleUnderline();
      chain.run();
    },
    [editor]
  );

  // ---- Export --------------------------------------------------------------
  const handleExport = useCallback(
    async (formatName) => {
      if (exporting) return;
      setExporting(true);
      try {
        const { exportBook } = await import("../../services/export");
        await exportBook(
          library.currentDoc(),
          {
            format: formatName,
            includeCover: true,
            includeFrontMatter: true,
            includeHeaders: true,
            includePageNumbers: true,
            includeComments: false,
            includeHighlights: false,
          },
          setExportStatus
        );
        setExportStatus(formatName === "pdf" ? "PDF downloaded." : "DOCX downloaded.");
      } catch (error) {
        console.error("Export failed:", error);
        setExportStatus("Export failed. Please try again.");
      } finally {
        setExporting(false);
        setTimeout(() => setExportStatus(""), 4000);
      }
    },
    [exporting, library]
  );

  // ---- Keyboard shortcuts ---------------------------------------------------
  const { saveNow, importBookFile } = library;
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && focusMode && !event.defaultPrevented && !document.fullscreenElement) {
        setFocusMode(false);
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "s" && !event.shiftKey) {
        event.preventDefault();
        saveNow();
      } else if (key === "o" && !event.shiftKey) {
        event.preventDefault();
        importBookFile();
      } else if (key === "b" && event.shiftKey) {
        event.preventDefault();
        toggleBinder();
      } else if (key === "f" && event.shiftKey) {
        event.preventDefault();
        toggleFocus();
      } else if (!event.shiftKey && !event.altKey && SHORTCUT_STYLES[event.key] && editor) {
        event.preventDefault();
        editor.chain().focus().updateAttributes("paragraph", { blockStyle: SHORTCUT_STYLES[event.key], textAlign: null }).run();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor, focusMode, importBookFile, saveNow, toggleBinder, toggleFocus]);

  // ---- Status --------------------------------------------------------------
  const folderMessage =
    folder.status === "granted" && book.folderName
      ? save.savedAt
        ? `Saved to ${folder.handle.name}/${book.folderName} at ${time(save.savedAt)}`
        : save.folderAt
          ? `Backed up to ${folder.handle.name}/${book.folderName} at ${time(save.folderAt)}`
          : `Folder: ${folder.handle.name}/${book.folderName}`
      : null;

  const openComments = (doc.comments ?? []).filter((c) => !c.resolved).length;
  const chapters = format?.chapters ?? doc.chapters.map(({ id, title }) => ({ id, title }));

  return (
    <div ref={rootRef} className={`writer-app ${focusMode ? "is-focus-mode" : ""}`}>
      <WriterToolbar
        editor={editor}
        format={format}
        title={doc.metadata.title}
        onTitleChange={library.setTitle}
        binderOpen={view.binder}
        onToggleBinder={toggleBinder}
        commentsOpen={view.comments}
        onToggleComments={toggleComments}
        openComments={openComments}
        focusMode={focusMode}
        onToggleFocus={toggleFocus}
        canComment={Boolean(format && !format.empty)}
        onComment={startComment}
        exporting={exporting}
        onExport={handleExport}
        onShowLibrary={library.showLibrary}
        onImport={library.importBookFile}
        onSave={library.saveNow}
        onSaveCopy={library.saveCopy}
      />

      <div className="writer-body">
        <LeftPanel
          open={view.binder && !focusMode}
          chapters={chapters}
          activeChapterId={format?.activeChapterId}
          frontMatter={doc.frontMatter}
          settings={doc.settings}
          onChangeSettings={library.setSettings}
          onSelectChapter={(id) => editor && scrollToChapter(editor, id)}
          onAddChapter={() => editor && addChapter(editor, `ಅಧ್ಯಾಯ ${chapters.length + 1}`)}
          onRenameChapter={(id, title) => editor && renameChapter(editor, id, title)}
          onDeleteChapter={(id) => {
            const chapter = chapters.find((c) => c.id === id);
            if (editor && window.confirm(`Delete “${chapter?.title || "this chapter"}”? You can undo this with ⌘Z.`)) {
              deleteChapter(editor, id);
            }
          }}
          onMoveChapter={(id, direction) => editor && moveChapter(editor, id, direction)}
          onToggleFrontMatter={library.setFrontMatter}
          onClose={toggleBinder}
        />

        <ManuscriptEditor
          initialDoc={doc}
          transliterate={doc.metadata.language !== "en"}
          settings={doc.settings}
          zoom={zoom}
          stageRef={stageRef}
          getBaseDoc={getDoc}
          onDocChange={onDocChange}
          onEditor={onEditor}
          onPageCount={setPages}
          onAnnotationClick={(commentId) => {
            setFocusedCommentId(commentId);
            setView((v) => ({ ...v, comments: true }));
          }}
        />

        <CommentsPanel
          open={view.comments && !focusMode}
          comments={doc.comments ?? []}
          chapters={chapters}
          focusedCommentId={focusedCommentId}
          onFocusComment={(comment) => {
            setFocusedCommentId(comment.id);
            if (editor) scrollToComment(editor, comment.id);
          }}
          onResolve={(id, resolved) => {
            library.setCommentResolvedRecord(id, resolved);
            if (editor) setCommentResolved(editor, id, resolved);
          }}
          onDelete={(id) => {
            library.deleteCommentRecord(id);
            if (editor) removeComment(editor, id);
          }}
          onUpdate={library.updateCommentText}
          onClose={toggleComments}
        />
      </div>

      <StatusBar
        saveStatus={save.status === "error" ? "error" : save.status === "saving" ? "saving" : "saved"}
        savedAt={{ browser: save.browserAt, file: save.savedAt }}
        pageCount={pages ?? "…"}
        isPaginating={false}
        stats={stats}
        zoom={view.zoom}
        onZoomChange={(level) => setView((v) => ({ ...v, zoom: level }))}
        message={
          exportStatus ||
          save.error ||
          folderMessage || (
            folder.status === "prompt" || folder.status === "denied" ? (
              <button type="button" className="writer-link" onClick={library.reconnectFolder}>
                Allow access to {folder.handle?.name} to back up there
              </button>
            ) : folder.status !== "unsupported" ? (
              <button type="button" className="writer-link" onClick={library.chooseFolder}>
                Choose a folder to keep this book in
              </button>
            ) : null
          )
        }
      />

      <SelectionToolbar
        selection={selectionRect ? { rect: selectionRect } : null}
        activeMarks={["bold", "italic", "underline"].filter((m) => format?.[m])}
        onToggleMark={toggleMark}
        onHighlight={addHighlight}
        onComment={startComment}
      />
      <CommentComposer
        draft={commentDraft}
        onCancel={() => {
          setCommentDraft(null);
          editor?.commands.focus();
        }}
        onSubmit={submitComment}
      />
    </div>
  );
}
