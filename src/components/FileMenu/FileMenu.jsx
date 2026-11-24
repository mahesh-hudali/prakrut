import { useAnchoredMenu } from "../../hooks/useAnchoredMenu";
import "./FileMenu.css";

export default function FileMenu({
  disabled = false,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onSaveProjectAs,
  onExport,
}) {
  const { open, setOpen, toggle, triggerRef, menuRef, menuStyle } =
    useAnchoredMenu();

  const run = (action) => () => {
    setOpen(false);
    action?.();
  };

  return (
    <div className="file-menu">
      <button
        ref={triggerRef}
        type="button"
        className="toolbar-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
      >
        File ▾
      </button>

      {open && (
        <div
          ref={menuRef}
          className="file-dropdown"
          style={menuStyle}
          role="menu"
          aria-label="File"
        >
          <button
            type="button"
            role="menuitem"
            className="file-dropdown-item"
            onClick={run(onNewProject)}
          >
            New Project
          </button>
          <button
            type="button"
            role="menuitem"
            className="file-dropdown-item"
            onClick={run(onOpenProject)}
          >
            Open Project…
          </button>

          <div className="file-dropdown-sep" role="separator" />

          <button
            type="button"
            role="menuitem"
            className="file-dropdown-item"
            onClick={run(onSaveProject)}
          >
            Save Project
            <span className="file-shortcut">⌘S</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="file-dropdown-item"
            onClick={run(onSaveProjectAs)}
          >
            Save Project As…
          </button>

          <div className="file-dropdown-sep" role="separator" />

          <div className="file-dropdown-title">Export</div>
          <button
            type="button"
            role="menuitem"
            className="file-dropdown-item"
            onClick={run(() => onExport?.("pdf"))}
          >
            PDF
          </button>
          <button
            type="button"
            role="menuitem"
            className="file-dropdown-item"
            onClick={run(() => onExport?.("docx"))}
          >
            DOCX
          </button>
        </div>
      )}
    </div>
  );
}
