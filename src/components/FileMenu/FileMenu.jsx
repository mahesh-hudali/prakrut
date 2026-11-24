import { MenuButton, MenuItem, MenuLabel, MenuSeparator } from "../../design-system";

export default function FileMenu({
  disabled = false,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onSaveProjectAs,
  onExport,
}) {
  return (
    <MenuButton label="File" disabled={disabled}>
      <MenuItem icon="file" onSelect={onNewProject}>New project</MenuItem>
      <MenuItem onSelect={onOpenProject} shortcut="⌘O">Open project…</MenuItem>
      <MenuSeparator />
      <MenuItem onSelect={onSaveProject} shortcut="⌘S">Save</MenuItem>
      <MenuItem onSelect={onSaveProjectAs} shortcut="⌘⇧S">Save as…</MenuItem>
      <MenuSeparator />
      <MenuLabel>Export</MenuLabel>
      <MenuItem icon="download" onSelect={() => onExport?.("pdf")}>PDF</MenuItem>
      <MenuItem icon="download" onSelect={() => onExport?.("docx")}>Word (DOCX)</MenuItem>
    </MenuButton>
  );
}
