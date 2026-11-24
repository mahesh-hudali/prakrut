import { useCallback, useEffect, useRef, useState } from "react";
import { createBlankDocument } from "../models/documentModel.js";
import {
  chooseLibraryFolder,
  createBookFolder,
  folderPermission,
  listBooks,
  readBook,
  saveBook,
  supportsFolderAccess,
  writeAutosave,
} from "../project/library/bookFolder.js";
import {
  getBookRecord,
  getMeta,
  listBookRecords,
  putBookRecord,
  setMeta,
  takeEmergencyCopy,
  writeEmergencyCopy,
} from "../project/library/libraryStore.js";
import { clearAutosave, loadAutosave } from "../project/storage/indexedDb.js";
import { deserializeProject, serializeProject } from "../project/serializer/kbookSerializer.js";
import { validateKbook } from "../project/validator/validateKbook.js";

const BROWSER_SAVE_MS = 400;
const FOLDER_SAVE_MS = 4000;
/** The old editor's built-in sample; its leftover autosave is dummy data. */
const SAMPLE_TITLE = "ನಮ್ಮೂರಿನ ಒಲಂಪಿಕ್ಸ್";

function loadPayload(payload) {
  if (!payload || !validateKbook(payload).valid) return null;
  try {
    return deserializeProject(payload).doc;
  } catch {
    return null;
  }
}

/**
 * The old editor kept one autosave in its own database. Sample-book leftovers
 * are deleted; anything the writer actually wrote becomes a library book.
 * Runs once.
 */
async function migrateLegacyAutosave() {
  if (await getMeta("legacyChecked")) return;
  try {
    const legacy = await loadAutosave();
    const doc = loadPayload(legacy?.payload);
    if (doc && doc.metadata?.title !== SAMPLE_TITLE) {
      await putBookRecord({
        bookId: doc.metadata.id,
        folderName: null,
        title: doc.metadata.title,
        payload: legacy.payload,
        savedAt: legacy.savedAt ?? new Date().toISOString(),
      });
    }
    if (legacy) await clearAutosave();
  } catch {
    // Nothing to migrate.
  }
  await setMeta("legacyChecked", true);
}

/**
 * The writer's books and the one being edited.
 *
 * Saving happens at three levels, each shown separately in the UI:
 *  1. this browser (IndexedDB) — ~0.4 s after every change; refresh reopens it
 *  2. the book's folder: autosave.kbook — every few seconds while writing
 *  3. the book's folder: book.kbook + a dated backup — on Save (⌘S)
 * On tab close a synchronous emergency copy covers the last fraction of a
 * second.
 */
export function useLibrary() {
  const [phase, setPhase] = useState("loading"); // loading | library | editing
  const [folder, setFolder] = useState({ handle: null, status: supportsFolderAccess() ? "none" : "unsupported" });
  const [books, setBooks] = useState([]);
  const [book, setBook] = useState(null); // { bookId, folderName, doc, openedFrom }
  const [save, setSave] = useState({ status: "idle", browserAt: null, folderAt: null, savedAt: null, error: "" });

  const docRef = useRef(null);
  const bookRef = useRef(null);
  const folderRef = useRef(folder);
  const latestDocGetterRef = useRef(null);
  const timersRef = useRef({ browser: null, folder: null });
  folderRef.current = folder;

  const root = () => (folderRef.current.status === "granted" ? folderRef.current.handle : null);

  // ---- Library listing ---------------------------------------------------
  const refreshBooks = useCallback(async () => {
    const records = await listBookRecords();
    const byId = new Map();
    for (const record of records) {
      byId.set(record.bookId, {
        bookId: record.bookId,
        title: record.title,
        folderName: record.folderName,
        modifiedAt: Date.parse(record.savedAt) || 0,
        inFolder: false,
        inBrowser: true,
      });
    }
    const dir = folderRef.current.status === "granted" ? folderRef.current.handle : null;
    if (dir) {
      for (const entry of await listBooks(dir)) {
        const known = byId.get(entry.bookId);
        byId.set(entry.bookId, {
          ...known,
          bookId: entry.bookId,
          title: entry.title,
          folderName: entry.folderName,
          modifiedAt: Math.max(entry.modifiedAt, known?.modifiedAt ?? 0),
          inFolder: true,
          inBrowser: Boolean(known),
        });
      }
    }
    setBooks([...byId.values()].sort((a, b) => b.modifiedAt - a.modifiedAt));
  }, []);

  // ---- Opening -----------------------------------------------------------
  const startEditing = useCallback(async (doc, folderName, openedFrom) => {
    docRef.current = doc;
    const next = { bookId: doc.metadata.id, folderName, doc, openedFrom };
    bookRef.current = next;
    setBook(next);
    setPhase("editing");
    setSave((prev) => ({ ...prev, status: "saved", error: "" }));
    await setMeta("lastBookId", doc.metadata.id);
  }, []);

  const openBook = useCallback(
    async (entry) => {
      const dir = root();
      // Prefer whichever copy is newest: the folder or this browser.
      const record = await getBookRecord(entry.bookId);
      const browserDoc = loadPayload(record?.payload);
      const browserTime = Date.parse(record?.savedAt) || 0;

      if (dir && entry.folderName) {
        const result = await readBook(dir, entry.folderName);
        if (result.ok && (!browserDoc || result.modifiedAt >= browserTime)) {
          await putBookRecord({
            bookId: result.doc.metadata.id,
            folderName: entry.folderName,
            title: result.doc.metadata.title,
            payload: serializeProject(result.doc, {}),
            savedAt: new Date(result.modifiedAt).toISOString(),
          });
          return startEditing(result.doc, entry.folderName, result.source);
        }
      }
      if (browserDoc) return startEditing(browserDoc, record.folderName ?? entry.folderName ?? null, "browser");
      setSave((prev) => ({ ...prev, error: "This book could not be opened." }));
      return undefined;
    },
    [startEditing]
  );

  const createBook = useCallback(
    async (title = "Untitled book") => {
      const doc = createBlankDocument({ title });
      const dir = root();
      const folderName = dir ? await createBookFolder(dir, title) : null;
      await putBookRecord({
        bookId: doc.metadata.id,
        folderName,
        title,
        payload: serializeProject(doc, {}),
        savedAt: new Date().toISOString(),
      });
      if (dir && folderName) await writeAutosave(dir, folderName, doc, {});
      await startEditing(doc, folderName, "new");
    },
    [startEditing]
  );

  // ---- Folder access -----------------------------------------------------
  const adoptFolder = useCallback(
    async (handle, status) => {
      folderRef.current = { handle, status };
      setFolder({ handle, status });
      if (status === "granted") {
        // A book started before the folder was connected gets its own folder now.
        const current = bookRef.current;
        if (current && !current.folderName && docRef.current) {
          const folderName = await createBookFolder(handle, docRef.current.metadata.title);
          bookRef.current = { ...current, folderName };
          setBook(bookRef.current);
          await writeAutosave(handle, folderName, docRef.current, {});
          setSave((prev) => ({ ...prev, folderAt: new Date().toISOString() }));
        }
      }
      await refreshBooks();
    },
    [refreshBooks]
  );

  const chooseFolder = useCallback(async () => {
    try {
      const handle = await chooseLibraryFolder();
      await setMeta("rootHandle", handle);
      await adoptFolder(handle, "granted");
    } catch (error) {
      if (error?.name !== "AbortError") {
        setSave((prev) => ({ ...prev, error: "That folder could not be used. Try another one." }));
      }
    }
  }, [adoptFolder]);

  /** After a reload the browser asks again before the folder can be used. */
  const reconnectFolder = useCallback(async () => {
    const handle = folderRef.current.handle;
    const status = await folderPermission(handle, { request: true });
    await adoptFolder(handle, status);
  }, [adoptFolder]);

  // ---- Saving ------------------------------------------------------------
  /** The newest text from the editor, with title and settings from here. */
  const currentDoc = () => {
    const latest = latestDocGetterRef.current?.();
    if (!latest || !docRef.current) return docRef.current;
    return {
      ...docRef.current,
      chapters: latest.chapters,
      comments: latest.comments,
      highlights: latest.highlights,
    };
  };

  const saveToBrowser = useCallback(async () => {
    const current = bookRef.current;
    const doc = currentDoc();
    if (!current || !doc) return;
    try {
      const savedAt = new Date().toISOString();
      await putBookRecord({
        bookId: current.bookId,
        folderName: current.folderName,
        title: doc.metadata.title,
        payload: serializeProject(doc, {}),
        savedAt,
      });
      setSave((prev) => ({ ...prev, status: "saved", browserAt: savedAt, error: "" }));
    } catch {
      setSave((prev) => ({ ...prev, status: "error", error: "Could not save in this browser." }));
    }
  }, []);

  const saveToFolderBackup = useCallback(async () => {
    const current = bookRef.current;
    const dir = root();
    const doc = currentDoc();
    if (!current?.folderName || !dir || !doc) return;
    try {
      await writeAutosave(dir, current.folderName, doc, {});
      setSave((prev) => ({ ...prev, folderAt: new Date().toISOString() }));
    } catch {
      setSave((prev) => ({ ...prev, error: "Could not write the backup in your folder." }));
    }
  }, []);

  /** Called with every settled editor change. */
  const updateDoc = useCallback(
    (next) => {
      const merged = { ...docRef.current, ...next, metadata: docRef.current.metadata, settings: docRef.current.settings };
      docRef.current = merged;
      setSave((prev) => ({ ...prev, status: "saving" }));
      const timers = timersRef.current;
      clearTimeout(timers.browser);
      timers.browser = setTimeout(saveToBrowser, BROWSER_SAVE_MS);
      if (!timers.folder) {
        timers.folder = setTimeout(() => {
          timers.folder = null;
          saveToFolderBackup();
        }, FOLDER_SAVE_MS);
      }
    },
    [saveToBrowser, saveToFolderBackup]
  );

  const setTitle = useCallback(
    (title) => {
      docRef.current = { ...docRef.current, metadata: { ...docRef.current.metadata, title } };
      setBook((prev) => (prev ? { ...prev, doc: docRef.current } : prev));
      updateDoc({});
    },
    [updateDoc]
  );

  /** Save (⌘S): book.kbook plus a dated backup in the book's folder. */
  const saveNow = useCallback(async () => {
    await saveToBrowser();
    const current = bookRef.current;
    const dir = root();
    if (!current) return { ok: false };
    if (!dir) {
      setSave((prev) => ({ ...prev, error: "Connect your prakrut-kbooks folder to save a copy there." }));
      return { ok: false, needsFolder: true };
    }
    let folderName = current.folderName;
    if (!folderName) {
      folderName = await createBookFolder(dir, currentDoc().metadata.title);
      bookRef.current = { ...current, folderName };
      setBook(bookRef.current);
    }
    try {
      await saveBook(dir, folderName, currentDoc(), {});
      const at = new Date().toISOString();
      setSave((prev) => ({ ...prev, status: "saved", savedAt: at, folderAt: at, error: "" }));
      await refreshBooks();
      return { ok: true };
    } catch {
      setSave((prev) => ({ ...prev, status: "error", error: "Saving to your folder failed. Your work is still safe in this browser." }));
      return { ok: false };
    }
  }, [refreshBooks, saveToBrowser]);

  const showLibrary = useCallback(async () => {
    clearTimeout(timersRef.current.browser);
    await saveToBrowser();
    await saveToFolderBackup();
    await refreshBooks();
    setPhase("library");
  }, [refreshBooks, saveToBrowser, saveToFolderBackup]);

  const registerLatestDoc = useCallback((getter) => {
    latestDocGetterRef.current = getter;
  }, []);

  // ---- Start-up: reopen the last book, exactly as it was -----------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await migrateLegacyAutosave();
      const handle = await getMeta("rootHandle");
      if (handle) {
        const status = await folderPermission(handle);
        folderRef.current = { handle, status };
        if (!cancelled) setFolder({ handle, status });
      }
      await refreshBooks();

      const lastId = await getMeta("lastBookId");
      if (lastId) {
        const record = await getBookRecord(lastId);
        const emergency = takeEmergencyCopy(lastId);
        const useEmergency =
          emergency && (!record || Date.parse(emergency.savedAt) > Date.parse(record.savedAt));
        const doc = loadPayload(useEmergency ? emergency.payload : record?.payload);
        if (doc && !cancelled) {
          if (useEmergency) {
            await putBookRecord({ ...(record ?? {}), bookId: lastId, title: doc.metadata.title, payload: emergency.payload, savedAt: emergency.savedAt });
          }
          await startEditing(doc, record?.folderName ?? null, "browser");
          return;
        }
      }
      if (!cancelled) setPhase("library");
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshBooks, startEditing]);

  // Closing or reloading the tab: keep the very latest text.
  useEffect(() => {
    const onPageHide = () => {
      const current = bookRef.current;
      const doc = currentDoc();
      if (current && doc && phase === "editing") {
        writeEmergencyCopy(current.bookId, serializeProject(doc, {}), new Date().toISOString());
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [phase]);

  useEffect(() => () => {
    clearTimeout(timersRef.current.browser);
    clearTimeout(timersRef.current.folder);
  }, []);

  return {
    phase,
    folder,
    books,
    book,
    save,
    refreshBooks,
    openBook,
    createBook,
    chooseFolder,
    reconnectFolder,
    updateDoc,
    setTitle,
    saveNow,
    showLibrary,
    registerLatestDoc,
  };
}
