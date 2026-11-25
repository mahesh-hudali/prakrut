import {
  Button,
  IconButton,
  MenuButton,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  SegmentedControl,
  Select,
  Toolbar,
  ToolbarDivider,
  ToolbarGroup,
  ToolbarSpacer,
  useTheme,
} from "../../design-system";
import { BLOCK_STYLES, KANNADA_FONTS } from "../../models/documentModel";
import "./WriterToolbar.css";

const STYLE_OPTIONS = Object.values(BLOCK_STYLES).map((s) => ({ value: s.id, label: s.label }));
const SIZES = [10, 11, 11.5, 12, 12.5, 13, 14, 16, 18, 24];
const ALIGN_OPTIONS = [
  { value: "left", label: "Align left", icon: "alignLeft" },
  { value: "center", label: "Center", icon: "alignCenter" },
  { value: "right", label: "Align right", icon: "alignRight" },
  { value: "justify", label: "Justify", icon: "alignJustify" },
];
const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Match system" },
];

/**
 * The writing toolbar. Formatting acts on the selection, like Google Docs:
 * font, size, bold/italic/underline and alignment never change the whole
 * book (book-wide defaults live in Binder › Layout).
 */
export default function WriterToolbar({
  editor,
  format,
  title,
  onTitleChange,
  binderOpen,
  onToggleBinder,
  commentsOpen,
  onToggleComments,
  openComments = 0,
  focusMode,
  onToggleFocus,
  canComment,
  onComment,
  exporting,
  onExport,
  onShowLibrary,
  onImport,
  onSave,
  onSaveCopy,
}) {
  const theme = useTheme();
  const run = (fn) => () => fn(editor.chain().focus()).run();
  const fontId = KANNADA_FONTS.find((f) => f.stack === format?.fontFamily)?.id ?? "";
  const sizePt = format?.fontSize ? parseFloat(format.fontSize) : "";

  return (
    <header className="writer-toolbar" data-print="hide">
      <Toolbar label="Editor toolbar">
        <Button icon="book" onClick={onShowLibrary} title="All books" aria-label="Books" className="writer-books">
          Books
        </Button>
        <IconButton icon="panel" label="Binder" shortcut="⌘⇧B" pressed={binderOpen} onClick={onToggleBinder} preserveSelection />
        <MenuButton label="File" disabled={exporting}>
          <MenuItem icon="book" onSelect={onShowLibrary}>All books…</MenuItem>
          <MenuItem icon="file" onSelect={onImport} shortcut="⌘O">Open a .kbook file…</MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={onSave} shortcut="⌘S">Save to folder</MenuItem>
          <MenuItem onSelect={onSaveCopy}>Save a copy…</MenuItem>
          <MenuSeparator />
          <MenuLabel>Export</MenuLabel>
          <MenuItem icon="download" onSelect={() => onExport("pdf")}>PDF</MenuItem>
          <MenuItem icon="download" onSelect={() => onExport("docx")}>Word (DOCX)</MenuItem>
        </MenuButton>
        <input
          className="writer-title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          aria-label="Book title"
          lang="kn"
        />

        <ToolbarDivider />
        <ToolbarGroup label="History">
          <IconButton icon="undo" label="Undo" shortcut="⌘Z" disabled={!format?.canUndo} onClick={run((c) => c.undo())} preserveSelection />
          <IconButton icon="redo" label="Redo" shortcut="⌘⇧Z" disabled={!format?.canRedo} onClick={run((c) => c.redo())} preserveSelection />
        </ToolbarGroup>
        <ToolbarDivider className="writer-format" />

        <Select
          className="writer-style"
          aria-label="Paragraph style"
          value={format?.blockStyle ?? "normal"}
          options={STYLE_OPTIONS}
          onChange={(e) =>
            editor.chain().focus().updateAttributes("paragraph", { blockStyle: e.target.value, textAlign: null }).run()
          }
        />
        <Select
          className="writer-font writer-format"
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
          className="writer-size writer-format"
          aria-label="Font size"
          value={sizePt}
          placeholder="Size"
          options={SIZES.map((s) => ({ value: s, label: `${s}` }))}
          onChange={(e) => {
            const chain = editor.chain().focus();
            (e.target.value ? chain.setFontSize(`${e.target.value}pt`) : chain.unsetFontSize()).run();
          }}
        />
        <ToolbarGroup label="Text" className="writer-marks">
          <Button pressed={format?.bold} aria-label="Bold" title="Bold (⌘B)" onClick={run((c) => c.toggleBold())} preserveSelection className="writer-mark writer-bold">B</Button>
          <Button pressed={format?.italic} aria-label="Italic" title="Italic (⌘I)" onClick={run((c) => c.toggleItalic())} preserveSelection className="writer-mark writer-italic">I</Button>
          <Button pressed={format?.underline} aria-label="Underline" title="Underline (⌘U)" onClick={run((c) => c.toggleUnderline())} preserveSelection className="writer-mark writer-underline">U</Button>
        </ToolbarGroup>
        <SegmentedControl
          className="writer-format"
          label="Alignment"
          iconOnly
          options={ALIGN_OPTIONS}
          value={format?.textAlign}
          onChange={(value) => editor.chain().focus().setTextAlign(value).run()}
          preserveSelection
        />
        <IconButton
          className="writer-format"
          icon="commentAdd"
          label="Comment on selection"
          disabled={!canComment}
          onClick={onComment}
          preserveSelection
        />

        <ToolbarSpacer />
        <Button icon="focus" pressed={focusMode} onClick={onToggleFocus} title="Focus mode, full screen (⌘⇧F)" preserveSelection className="writer-focus">
          Focus
        </Button>
        <MenuButton label="View" align="right">
          <MenuItem toggle checked={focusMode} onSelect={onToggleFocus} shortcut="⌘⇧F">Focus mode</MenuItem>
          <MenuItem toggle checked={binderOpen} onSelect={onToggleBinder} shortcut="⌘⇧B">Binder</MenuItem>
          <MenuItem toggle checked={commentsOpen} onSelect={onToggleComments}>
            {openComments > 0 ? `Comments (${openComments} open)` : "Comments"}
          </MenuItem>
          <MenuSeparator />
          <MenuLabel>Theme</MenuLabel>
          {THEMES.map((option) => (
            <MenuItem key={option.value} checked={theme.choice === option.value} onSelect={() => theme.setChoice(option.value)}>
              {option.label}
            </MenuItem>
          ))}
        </MenuButton>
        <MenuButton label="Export" variant="primary" align="right" disabled={exporting} menuLabel="Export document" className="writer-export">
          <MenuItem icon="download" onSelect={() => onExport("pdf")}>Export as PDF</MenuItem>
          <MenuItem icon="download" onSelect={() => onExport("docx")}>Export as DOCX</MenuItem>
        </MenuButton>
      </Toolbar>
    </header>
  );
}
