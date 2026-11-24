import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildProjectFilename,
  openProjectFile,
  saveProjectFile,
  supportsFileSystemAccess,
} from "../project/projectFile.js";
import {
  deserializeProject,
  serializeProject,
} from "../project/serializer/kbookSerializer.js";
import { validateKbook } from "../project/validator/validateKbook.js";
import {
  clearAutosave,
  getLastSavedInfo,
  loadAutosave,
  saveAutosave,
  saveSnapshot,
  setLastSavedInfo,
} from "../project/storage/indexedDb.js";

const AUTOSAVE_DEBOUNCE_MS = 1200;

export const SAVE_STATUS = Object.freeze({
  SAVED: "saved",
  SAVING: "saving",
  UNSAVED: "unsaved",
  ERROR: "error",
});

/**
 * Project lifecycle: debounced IndexedDB autosave (local recovery) plus
 * explicit `.kbook` save/open (portable source of truth).
 */
export function useProject({ doc, setDoc, editorState, restoreUiState }) {
  const [saveStatus, setSaveStatus] = useState(SAVE_STATUS.SAVED);
  const [statusMessage, setStatusMessage] = useState("");
  const [currentFilename, setCurrentFilename] = useState(() =>
    buildProjectFilename(doc)
  );
  const [recovery, setRecovery] = useState(null);

  const fileHandleRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const latestRef = useRef({ doc, editorState });
  const skipNextAutosaveRef = useRef(true);
  const lastFileSaveRef = useRef(null);

  latestRef.current = { doc, editorState };

  // ---- Startup recovery -------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [autosave, lastSaved] = await Promise.all([
          loadAutosave(),
          getLastSavedInfo(),
        ]);
        if (cancelled || !autosave?.payload) return;

        const newerThanFile =
          !lastSaved?.savedAt ||
          new Date(autosave.savedAt) > new Date(lastSaved.savedAt);

        if (!newerThanFile) return;

        const validation = validateKbook(autosave.payload);
        if (!validation.valid) return;

        setRecovery({
          payload: autosave.payload,
          savedAt: autosave.savedAt,
          title: autosave.payload?.metadata?.title ?? "Untitled",
        });
      } catch {
        // Recovery is best-effort; never block startup.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Debounced autosave to IndexedDB ----------------------------------
  useEffect(() => {
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return undefined;
    }

    setSaveStatus(SAVE_STATUS.UNSAVED);
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(async () => {
      setSaveStatus(SAVE_STATUS.SAVING);
      try {
        const payload = serializeProject(
          latestRef.current.doc,
          latestRef.current.editorState
        );
        await saveAutosave(payload);
        setSaveStatus(SAVE_STATUS.SAVED);
        setStatusMessage("");
      } catch (error) {
        setSaveStatus(SAVE_STATUS.ERROR);
        setStatusMessage("Autosave failed — export or save your project.");
        console.error("Autosave failed:", error);
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [doc, editorState]);

  const acceptRecovery = useCallback(() => {
    if (!recovery?.payload) return;
    try {
      const { doc: recoveredDoc, editorState: recoveredUi } =
        deserializeProject(recovery.payload);
      setDoc(recoveredDoc);
      restoreUiState?.(recoveredUi);
      setCurrentFilename(buildProjectFilename(recoveredDoc));
      setStatusMessage("Unsaved changes were recovered.");
    } catch (error) {
      console.error("Recovery failed:", error);
      setStatusMessage("Recovery failed — the autosave could not be read.");
    } finally {
      setRecovery(null);
    }
  }, [recovery, restoreUiState, setDoc]);

  const discardRecovery = useCallback(async () => {
    setRecovery(null);
    try {
      await clearAutosave();
    } catch {
      // Nothing actionable; the stale record will be overwritten anyway.
    }
  }, []);

  // ---- Save / Save As ---------------------------------------------------
  const saveProject = useCallback(
    async ({ forcePicker = false } = {}) => {
      setSaveStatus(SAVE_STATUS.SAVING);
      setStatusMessage(forcePicker ? "Saving project as…" : "Saving project…");

      const { doc: currentDoc, editorState: currentUi } = latestRef.current;

      try {
        // Keep a recoverable snapshot before we touch the destination file.
        try {
          await saveSnapshot(
            currentDoc.metadata?.id ?? "project",
            serializeProject(currentDoc, currentUi)
          );
        } catch {
          // Snapshotting is a safety net, not a hard requirement.
        }

        const result = await saveProjectFile({
          doc: currentDoc,
          editorState: currentUi,
          handle: fileHandleRef.current,
          forcePicker,
        });

        if (!result.ok) throw new Error("Write did not complete.");

        fileHandleRef.current = result.handle ?? fileHandleRef.current;
        lastFileSaveRef.current = new Date().toISOString();
        setCurrentFilename(result.filename);
        await setLastSavedInfo({
          savedAt: lastFileSaveRef.current,
          filename: result.filename,
          projectId: currentDoc.metadata?.id ?? null,
        });

        setSaveStatus(SAVE_STATUS.SAVED);
        setStatusMessage(
          result.method === "download"
            ? `Downloaded ${result.filename}`
            : `Saved ${result.filename}`
        );
        return { ok: true, filename: result.filename };
      } catch (error) {
        if (error?.name === "AbortError") {
          setSaveStatus(SAVE_STATUS.UNSAVED);
          setStatusMessage("");
          return { ok: false, cancelled: true };
        }
        console.error("Save failed:", error);
        setSaveStatus(SAVE_STATUS.ERROR);
        setStatusMessage("Save failed. Your work is still here — try again.");
        return { ok: false, error };
      }
    },
    []
  );

  // ---- Open -------------------------------------------------------------
  const openProject = useCallback(async () => {
    setStatusMessage("Opening project…");
    try {
      const result = await openProjectFile();

      if (result.cancelled) {
        setStatusMessage("");
        return { ok: false, cancelled: true };
      }

      // Only now, after validation + migration succeeded, replace the document.
      if (!result.ok) {
        setStatusMessage(result.message);
        return { ok: false, message: result.message, errors: result.errors };
      }

      skipNextAutosaveRef.current = true;
      setDoc(result.doc);
      restoreUiState?.(result.editorState);
      fileHandleRef.current = result.handle ?? null;
      setCurrentFilename(result.filename ?? buildProjectFilename(result.doc));
      setSaveStatus(SAVE_STATUS.SAVED);
      setStatusMessage(
        result.migrationsApplied?.length
          ? `Opened and upgraded (schema v${result.migrationsApplied.at(-1)}).`
          : `Opened ${result.filename ?? "project"}`
      );
      return { ok: true };
    } catch (error) {
      if (error?.name === "AbortError") {
        setStatusMessage("");
        return { ok: false, cancelled: true };
      }
      console.error("Open failed:", error);
      setStatusMessage("This project file appears to be damaged or incompatible.");
      return { ok: false, error };
    }
  }, [restoreUiState, setDoc]);

  const newProject = useCallback(
    (createFn) => {
      const fresh = createFn();
      skipNextAutosaveRef.current = false;
      setDoc(fresh);
      fileHandleRef.current = null;
      setCurrentFilename(buildProjectFilename(fresh));
      setSaveStatus(SAVE_STATUS.UNSAVED);
      setStatusMessage("New project created.");
    },
    [setDoc]
  );

  // Warn before losing unsaved work.
  useEffect(() => {
    const handler = (event) => {
      if (saveStatus === SAVE_STATUS.SAVED) return undefined;
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);

  return {
    saveStatus,
    statusMessage,
    setStatusMessage,
    currentFilename,
    recovery,
    acceptRecovery,
    discardRecovery,
    saveProject,
    openProject,
    newProject,
    canUseFileSystemAccess: supportsFileSystemAccess(),
  };
}
