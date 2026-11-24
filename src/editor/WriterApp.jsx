import { useCallback, useEffect, useState } from "react";
import { useEditorState } from "@tiptap/react";
import {
  Button,
  Icon,
  IconButton,
  Select,
  Toolbar,
  ToolbarDivider,
  ToolbarGroup,
  ToolbarSpacer,
  SegmentedControl,
  useTheme,
} from "../design-system";
import { useLibrary } from "../hooks/useLibrary";
import { BLOCK_STYLES, KANNADA_FONTS, countDocumentStats } from "../models/documentModel";
import { pmToModel } from "./convert";
import LibraryView from "./LibraryView";
import ManuscriptEditor from "./ManuscriptEditor";
import "./WriterApp.css";

const STYLE_OPTIONS = Object.values(BLOCK_STYLES).map((s) => ({ value: s.id, label: s.label }));
const SIZES = [10, 11, 11.5, 12, 12.5, 13, 14, 16, 18, 24];
const ALIGN_OPTIONS = [
  { value: "left", label: "Align left", icon: "alignLeft" },
  { value: "center", label: "Center", icon: "alignCenter" },
  { value: "right", label: "Align right", icon: "alignRight" },
  { value: "justify", label: "Justify", icon: "alignJustify" },
];

function time(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Library ↔ writing. Refresh reopens the last book exactly as it was. */
export default function WriterApp() {
  const library = useLibrary();
  if (library.phase === "loading") return <div className="writer-app" aria-busy="true" />;
  if (library.phase === "library") {
    return (
      <div className="writer-app writer-app--library">
        <LibraryView library={library} />
      </div>
    );
  }
  return <BookWorkspace key={library.book.bookId} library={library} />;
}

function BookWorkspace({ library }) {
  const { book, save, folder } = library;
  const [editor, setEditor] = useState(null);
  const [pages, setPages] = useState(null);
  const [stats, setStats] = useState(() => countDocumentStats(book.doc));
  const theme = useTheme();

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      const text = e.getAttributes("textStyle");
      const paragraph = e.getAttributes("paragraph");
      const style = paragraph.blockStyle ?? "normal";
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
      };
    },
  });

  const { registerLatestDoc, updateDoc, saveNow } = library;
  const onEditor = useCallback(
    (instance) => {
      setEditor(instance);
      registerLatestDoc(() => pmToModel(instance.getJSON(), book.doc));
    },
    [book.doc, registerLatestDoc]
  );

  const onDocChange = useCallback(
    (next) => {
      updateDoc(next);
      setStats(countDocumentStats(next));
    },
    [updateDoc]
  );

  // ⌘S / Ctrl+S: save to the book's folder.
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveNow();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveNow]);

  const run = (fn) => () => fn(editor.chain().focus()).run();
  const fontId = KANNADA_FONTS.find((f) => f.stack === state?.fontFamily)?.id ?? "";
  const sizePt = state?.fontSize ? parseFloat(state.fontSize) : "";

  const folderReady = folder.status === "granted" && book.folderName;
  const saveLabel =
    save.status === "error" ? "Attention required" : save.status === "saving" ? "Saving…" : "Saved locally";

  return (
    <div className="writer-app">
      <header className="writer-toolbar">
        <Toolbar label="Formatting">
          <Button icon="book" onClick={library.showLibrary} title="All books">
            Books
          </Button>
          <input
            className="writer-title"
            value={book.doc.metadata.title}
            onChange={(event) => library.setTitle(event.target.value)}
            aria-label="Book title"
            lang="kn"
          />
          <ToolbarDivider />
          <ToolbarGroup label="History">
            <IconButton icon="undo" label="Undo" shortcut="⌘Z" disabled={!state?.canUndo} onClick={run((c) => c.undo())} preserveSelection />
            <IconButton icon="redo" label="Redo" shortcut="⌘⇧Z" disabled={!state?.canRedo} onClick={run((c) => c.redo())} preserveSelection />
          </ToolbarGroup>
          <ToolbarDivider />
          <Select
            aria-label="Paragraph style"
            value={state?.blockStyle ?? "normal"}
            options={STYLE_OPTIONS}
            onChange={(e) => editor.chain().focus().updateAttributes("paragraph", { blockStyle: e.target.value }).run()}
          />
          <Select
            aria-label="Font"
            value={fontId}
            placeholder="Book font"
            options={KANNADA_FONTS.map((f) => ({ value: f.id, label: f.label }))}
            onChange={(e) => {
              const font = KANNADA_FONTS.find((f) => f.id === e.target.value);
              const chain = editor.chain().focus();
              (font ? chain.setFontFamily(font.stack) : chain.unsetFontFamily()).run();
            }}
          />
          <Select
            aria-label="Font size"
            value={sizePt}
            placeholder="Size"
            className="writer-size"
            options={SIZES.map((s) => ({ value: s, label: `${s}` }))}
            onChange={(e) => {
              const chain = editor.chain().focus();
              (e.target.value ? chain.setFontSize(`${e.target.value}pt`) : chain.unsetFontSize()).run();
            }}
          />
          <ToolbarGroup label="Text">
            <Button pressed={state?.bold} aria-label="Bold" title="Bold (⌘B)" onClick={run((c) => c.toggleBold())} preserveSelection className="writer-mark writer-bold">B</Button>
            <Button pressed={state?.italic} aria-label="Italic" title="Italic (⌘I)" onClick={run((c) => c.toggleItalic())} preserveSelection className="writer-mark writer-italic">I</Button>
            <Button pressed={state?.underline} aria-label="Underline" title="Underline (⌘U)" onClick={run((c) => c.toggleUnderline())} preserveSelection className="writer-mark writer-underline">U</Button>
          </ToolbarGroup>
          <SegmentedControl
            label="Alignment"
            iconOnly
            options={ALIGN_OPTIONS}
            value={state?.textAlign}
            onChange={(value) => editor.chain().focus().setTextAlign(value).run()}
            preserveSelection
          />
          <ToolbarSpacer />
          <Select
            aria-label="Theme"
            value={theme.choice}
            className="writer-theme"
            onChange={(e) => theme.setChoice(e.target.value)}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "Match system" },
            ]}
          />
          <Button variant="primary" onClick={saveNow} title="Save to your folder (⌘S)">
            Save
          </Button>
        </Toolbar>
      </header>

      <ManuscriptEditor
        initialDoc={book.doc}
        settings={book.doc.settings}
        onDocChange={onDocChange}
        onEditor={onEditor}
        onPageCount={setPages}
      />

      <footer className="writer-status" data-testid="status">
        <span className={`writer-status__save ${save.status === "error" ? "is-error" : ""}`} role="status">
          <Icon name={save.status === "error" ? "alert" : "check"} size={14} />
          {saveLabel}
        </span>
        {folderReady ? (
          <span className="writer-status__folder">
            {save.savedAt
              ? `Saved to folder at ${time(save.savedAt)}`
              : save.folderAt
                ? `Folder backup at ${time(save.folderAt)}`
                : `Folder: ${folder.handle.name}/${book.folderName}`}
          </span>
        ) : folder.status === "prompt" || folder.status === "denied" ? (
          <button type="button" className="writer-status__action" onClick={library.reconnectFolder}>
            Allow access to {folder.handle?.name} to back up there
          </button>
        ) : folder.status !== "unsupported" ? (
          <button type="button" className="writer-status__action" onClick={library.chooseFolder}>
            Choose a folder to keep this book in
          </button>
        ) : null}
        {save.error ? <span className="writer-status__error">{save.error}</span> : null}
        <span className="writer-status__counts">
          <span>Words {stats.words.toLocaleString("en-IN")}</span>
          <span>Pages {pages ?? "…"}</span>
        </span>
      </footer>
    </div>
  );
}
