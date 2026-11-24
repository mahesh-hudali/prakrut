import "./RecoveryPrompt.css";

/** Startup prompt shown when IndexedDB holds newer work than the last save. */
export default function RecoveryPrompt({ recovery, onRestore, onDiscard }) {
  if (!recovery) return null;

  const savedAt = (() => {
    try {
      return new Date(recovery.savedAt).toLocaleString();
    } catch {
      return "";
    }
  })();

  return (
    <div className="recovery-prompt" role="alertdialog" aria-label="Recover work">
      <div className="recovery-body">
        <strong>Unsaved changes were recovered.</strong>
        <span>
          {recovery.title}
          {savedAt ? ` · autosaved ${savedAt}` : ""}
        </span>
      </div>
      <div className="recovery-actions">
        <button type="button" className="ghost-btn" onClick={onDiscard}>
          Discard
        </button>
        <button type="button" className="primary-btn" onClick={onRestore}>
          Restore
        </button>
      </div>
    </div>
  );
}
