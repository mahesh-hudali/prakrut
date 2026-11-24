import { BLOCK_STYLES, KANNADA_FONTS } from "../../models/documentModel";
import ExportMenu from "../ExportMenu/ExportMenu";
import FileMenu from "../FileMenu/FileMenu";
import "./EditorToolbar.css";

const WRITING_MODES = Object.values(BLOCK_STYLES).filter(
  (style) => style.group === "writing"
);
const STRUCTURE_STYLES = Object.values(BLOCK_STYLES).filter(
  (style) => style.group === "structure"
);

const MODE_SHORTCUTS = {
  normal: "⌘0",
  character: "⌘1",
  action: "⌘2",
  dialogue: "⌘3",
};

const FONT_SIZES = [9, 9.5, 10, 10.5, 11, 11.5, 12, 13, 14, 16];

/**
 * Compact primary toolbar.
 * Everything advanced lives in the left drawer or the File menu.
 */
export default function EditorToolbar({
  compact = false,
  leftPanelOpen,
  onToggleLeftPanel,
  title,
  onTitleChange,
  activeStyle,
  onStyleChange,
  align,
  onAlignChange,
  typography,
  onTypographyChange,
  canComment = false,
  onComment,
  commentsOpen,
  unresolvedComments = 0,
  onToggleComments,
  focusMode,
  onToggleFocusMode,
  saveStatusLabel,
  filename,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  exporting = false,
  onExport,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onSaveProjectAs,
}) {
  const hold = (event) => event.preventDefault();

  return (
    <header
      className={`editor-toolbar ${compact ? "is-compact" : ""}`}
      role="toolbar"
      aria-label="Editor toolbar"
    >
      <button
        type="button"
        className="toolbar-icon-btn"
        aria-label="Toggle book panel"
        aria-pressed={leftPanelOpen}
        title="Toggle panel (⌘⇧B)"
        onMouseDown={hold}
        onClick={onToggleLeftPanel}
      >
        ☰
      </button>

      <FileMenu
        disabled={exporting}
        onNewProject={onNewProject}
        onOpenProject={onOpenProject}
        onSaveProject={onSaveProject}
        onSaveProjectAs={onSaveProjectAs}
        onExport={onExport}
      />

      <div className="toolbar-group" role="group" aria-label="History">
        <button
          type="button"
          className="toolbar-icon-btn"
          aria-label="Undo"
          title="Undo (⌘Z)"
          disabled={!canUndo}
          onMouseDown={hold}
          onClick={onUndo}
        >
          ↶
        </button>
        <button
          type="button"
          className="toolbar-icon-btn"
          aria-label="Redo"
          title="Redo (⌘⇧Z)"
          disabled={!canRedo}
          onMouseDown={hold}
          onClick={onRedo}
        >
          ↷
        </button>
      </div>

      <input
        className="toolbar-title"
        value={title ?? ""}
        aria-label="Book title"
        placeholder="Untitled book"
        onChange={(event) => onTitleChange?.(event.target.value)}
      />

      {!compact && (
        <>
          <div className="toolbar-group" role="group" aria-label="Writing mode">
            {WRITING_MODES.map((style) => (
              <button
                key={style.id}
                type="button"
                className={
                  activeStyle === style.id
                    ? "toolbar-btn is-active"
                    : "toolbar-btn"
                }
                onMouseDown={hold}
                onClick={() => onStyleChange?.(style.id)}
                title={`${style.label} (${MODE_SHORTCUTS[style.id] ?? ""})`}
              >
                {style.label}
              </button>
            ))}

            <select
              className="toolbar-select"
              aria-label="Book structure style"
              value={
                STRUCTURE_STYLES.some((style) => style.id === activeStyle)
                  ? activeStyle
                  : ""
              }
              onChange={(event) =>
                event.target.value && onStyleChange?.(event.target.value)
              }
            >
              <option value="">Structure…</option>
              {STRUCTURE_STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </select>
          </div>

          <select
            className="toolbar-select toolbar-font"
            aria-label="Font family"
            value={typography?.fontFamilyId ?? ""}
            onChange={(event) =>
              onTypographyChange?.({ fontFamilyId: event.target.value })
            }
          >
            {Object.values(KANNADA_FONTS).map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>

          <select
            className="toolbar-select toolbar-size"
            aria-label="Font size"
            value={typography?.fontSizePt ?? 11}
            onChange={(event) =>
              onTypographyChange?.({ fontSizePt: Number(event.target.value) })
            }
          >
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}pt
              </option>
            ))}
          </select>

          <div className="toolbar-group" role="group" aria-label="Alignment">
            {[
              ["left", "⯇", "Left"],
              ["center", "≡", "Center"],
              ["right", "⯈", "Right"],
              ["justify", "☰", "Justify"],
            ].map(([value, glyph, label]) => (
              <button
                key={value}
                type="button"
                className={
                  align === value ? "toolbar-btn is-active" : "toolbar-btn"
                }
                title={label}
                aria-label={label}
                onMouseDown={hold}
                onClick={() => onAlignChange?.(value)}
              >
                {glyph}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="toolbar-btn"
            disabled={!canComment}
            title="Comment on selected text"
            onMouseDown={hold}
            onClick={onComment}
          >
            💬 Comment
          </button>
        </>
      )}

      <div className="toolbar-spacer" />

      <button
        type="button"
        className={`toolbar-btn ${commentsOpen ? "is-active" : ""}`}
        onMouseDown={hold}
        onClick={onToggleComments}
        title="Comments panel"
      >
        Comments{unresolvedComments > 0 ? ` (${unresolvedComments})` : ""}
      </button>

      <button
        type="button"
        className={`toolbar-btn ${focusMode ? "is-active" : ""}`}
        onMouseDown={hold}
        onClick={onToggleFocusMode}
        title="Focus mode (⌘⇧F)"
      >
        Focus
      </button>

      <span className="toolbar-file" title={filename}>
        <strong>{filename}</strong>
        <em>{saveStatusLabel}</em>
      </span>

      <ExportMenu disabled={exporting} onExport={onExport} />
    </header>
  );
}
