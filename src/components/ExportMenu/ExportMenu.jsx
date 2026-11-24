import { MenuButton, MenuItem } from "../../design-system";

/** The primary action of the toolbar: turn the manuscript into a file. */
export default function ExportMenu({ disabled = false, onExport, className = "" }) {
  return (
    <MenuButton
      label="Export"
      variant="primary"
      align="right"
      disabled={disabled}
      menuLabel="Export document"
      className={className}
    >
      <MenuItem icon="download" onSelect={() => onExport?.("pdf")}>
        Export as PDF
      </MenuItem>
      <MenuItem icon="download" onSelect={() => onExport?.("docx")}>
        Export as DOCX
      </MenuItem>
    </MenuButton>
  );
}
