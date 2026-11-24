import { useAnchoredMenu } from "../../hooks/useAnchoredMenu";
import "./ExportMenu.css";

export default function ExportMenu({ disabled = false, onExport }) {
  const { open, setOpen, toggle, triggerRef, menuRef, menuStyle } =
    useAnchoredMenu({ align: "right" });

  const run = (format) => () => {
    setOpen(false);
    onExport?.(format);
  };

  return (
    <div className="export-menu">
      <button
        ref={triggerRef}
        type="button"
        className="toolbar-btn export-trigger"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        Export ▾
      </button>

      {open && (
        <div
          ref={menuRef}
          className="export-dropdown"
          style={menuStyle}
          role="menu"
          aria-label="Export Document"
        >
          <div className="export-dropdown-title">Export Document</div>
          <button
            type="button"
            role="menuitem"
            className="export-dropdown-item"
            disabled={disabled}
            onClick={run("pdf")}
          >
            Export as PDF
          </button>
          <button
            type="button"
            role="menuitem"
            className="export-dropdown-item"
            disabled={disabled}
            onClick={run("docx")}
          >
            Export as DOCX
          </button>
        </div>
      )}
    </div>
  );
}
