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
  Wordmark,
  useTheme,
} from "../../design-system";
import { BLOCK_STYLES, KANNADA_FONTS } from "../../models/documentModel";
import ExportMenu from "../ExportMenu/ExportMenu";
import FileMenu from "../FileMenu/FileMenu";
import "./EditorToolbar.css";

const SHORTCUTS = { normal: "⌘0", character: "⌘1", action: "⌘2", dialogue: "⌘3" };

const WRITING_MODES = Object.values(BLOCK_STYLES)
  .filter((style) => style.group === "writing")
  .map((style) => ({ value: style.id, label: style.label, shortcut: SHORTCUTS[style.id] }));

const STRUCTURE_STYLES = Object.values(BLOCK_STYLES)
  .filter((style) => style.group === "structure")
  .map((style) => ({ value: style.id, label: style.label }));

const ALIGNMENTS = [
  { value: "left", label: "Align left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Align right" },
  { value: "justify", label: "Justify" },
];

const FONT_SIZES = [11, 11.5, 12, 12.5, 13, 14];
const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Match system" },
];

/**
 * Primary toolbar, kept to seven high-frequency groups (blueprint 1.2,
 * Hick's law): File · Undo/Redo · Paragraph style · Format · Focus · View ·
 * Export. Everything else is one click away inside a labelled menu.
 */
export default function EditorToolbar({
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
  commentsOpen,
  unresolvedComments = 0,
  onToggleComments,
  focusMode,
  onToggleFocusMode,
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
  const theme = useTheme();
  const isStructure = STRUCTURE_STYLES.some((style) => style.value === activeStyle);

  return (
    <header className="app-toolbar" data-print="hide">
      <Toolbar label="Editor toolbar" className="app-toolbar__row">
        <IconButton
          icon="panel"
          label="Binder"
          shortcut="⌘⇧B"
          pressed={leftPanelOpen}
          onClick={onToggleLeftPanel}
          preserveSelection
        />
        <Wordmark className="app-toolbar__wordmark" />
        <FileMenu
          disabled={exporting}
          onNewProject={onNewProject}
          onOpenProject={onOpenProject}
          onSaveProject={onSaveProject}
          onSaveProjectAs={onSaveProjectAs}
          onExport={onExport}
        />

        <input
          className="app-toolbar__title"
          value={title ?? ""}
          aria-label="Book title"
          placeholder="Untitled book"
          title={filename}
          onChange={(event) => onTitleChange?.(event.target.value)}
        />

        <ToolbarDivider className="app-toolbar__history-divider" />

        <ToolbarGroup label="History">
          <IconButton icon="undo" label="Undo" shortcut="⌘Z" disabled={!canUndo} onClick={onUndo} preserveSelection />
          <IconButton icon="redo" label="Redo" shortcut="⌘⇧Z" disabled={!canRedo} onClick={onRedo} preserveSelection />
        </ToolbarGroup>

        <ToolbarDivider className="app-toolbar__format" />

        <ToolbarGroup label="Paragraph style" className="app-toolbar__format">
          <SegmentedControl
            className="app-toolbar__modes"
            label="Paragraph style"
            options={WRITING_MODES}
            value={activeStyle}
            onChange={onStyleChange}
            preserveSelection
          />
          <Select
            className="app-toolbar__structure"
            aria-label="More paragraph styles"
            placeholder="More styles"
            options={STRUCTURE_STYLES}
            value={isStructure ? activeStyle : ""}
            onChange={(event) => event.target.value && onStyleChange?.(event.target.value)}
          />
          {/* Narrow windows: one select holds every paragraph style. */}
          <Select
            className="app-toolbar__modes-compact"
            aria-label="Paragraph style"
            value={activeStyle ?? "normal"}
            onChange={(event) => onStyleChange?.(event.target.value)}
          >
            <optgroup label="Writing">
              {WRITING_MODES.map((style) => (
                <option key={style.value} value={style.value}>{style.label}</option>
              ))}
            </optgroup>
            <optgroup label="Book structure">
              {STRUCTURE_STYLES.map((style) => (
                <option key={style.value} value={style.value}>{style.label}</option>
              ))}
            </optgroup>
          </Select>
        </ToolbarGroup>

        <MenuButton label="Format" className="app-toolbar__format">
          <MenuLabel>Paragraph alignment</MenuLabel>
          {ALIGNMENTS.map((item) => (
            <MenuItem
              key={item.value}
              checked={item.value === align}
              onSelect={() => onAlignChange?.(item.value)}
            >
              {item.label}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuLabel>Book font</MenuLabel>
          {KANNADA_FONTS.map((font) => (
            <MenuItem
              key={font.id}
              checked={typography?.fontFamilyId === font.id}
              onSelect={() => onTypographyChange?.({ fontFamilyId: font.id })}
            >
              {font.label}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuLabel>Text size</MenuLabel>
          {FONT_SIZES.map((size) => (
            <MenuItem
              key={size}
              checked={typography?.fontSizePt === size}
              onSelect={() => onTypographyChange?.({ fontSizePt: size })}
            >
              {size} pt
            </MenuItem>
          ))}
        </MenuButton>

        <ToolbarSpacer />

        <Button
          icon="focus"
          pressed={focusMode}
          onClick={onToggleFocusMode}
          preserveSelection
          title="Focus mode (⌘⇧F)"
          className="app-toolbar__focus"
        >
          Focus
        </Button>

        <MenuButton label="View" align="right" className="app-toolbar__view">
          <MenuItem toggle checked={focusMode} onSelect={onToggleFocusMode} shortcut="⌘⇧F">
            Focus mode
          </MenuItem>
          <MenuItem toggle checked={commentsOpen} onSelect={onToggleComments}>
            {unresolvedComments > 0 ? `Comments (${unresolvedComments} open)` : "Comments"}
          </MenuItem>
          <MenuItem toggle checked={leftPanelOpen} onSelect={onToggleLeftPanel} shortcut="⌘⇧B">
            Binder
          </MenuItem>
          <MenuSeparator />
          <MenuLabel>Theme</MenuLabel>
          {THEMES.map((option) => (
            <MenuItem
              key={option.value}
              checked={theme.choice === option.value}
              onSelect={() => theme.setChoice(option.value)}
            >
              {option.label}
            </MenuItem>
          ))}
        </MenuButton>

        <ExportMenu className="app-toolbar__export" disabled={exporting} onExport={onExport} />
      </Toolbar>
    </header>
  );
}
