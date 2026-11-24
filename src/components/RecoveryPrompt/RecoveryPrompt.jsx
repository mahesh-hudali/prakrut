import { Button, Toast } from "../../design-system";

/** Startup prompt shown when the browser holds newer work than the last save. */
export default function RecoveryPrompt({ recovery, onRestore, onDiscard }) {
  if (!recovery) return null;

  let savedAt = "";
  try {
    savedAt = new Date(recovery.savedAt).toLocaleString();
  } catch {
    savedAt = "";
  }

  return (
    <Toast
      role="alertdialog"
      label="Restore unsaved work"
      title="Restore unsaved work?"
      description={
        savedAt ? `${recovery.title}, autosaved ${savedAt}` : recovery.title
      }
      actions={
        <>
          <Button size="sm" onClick={onDiscard}>
            Discard
          </Button>
          <Button size="sm" variant="primary" onClick={onRestore}>
            Restore
          </Button>
        </>
      }
    />
  );
}
