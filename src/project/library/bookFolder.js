/**
 * The prakrut-kbooks folder on disk (File System Access API, Chrome/Edge).
 *
 *   prakrut-kbooks/
 *     <Book title>/
 *       book.kbook        saved copy — written on Save (⌘S)
 *       autosave.kbook    local backup — kept current while writing
 *       backups/<time>.kbook   one per Save, the newest BACKUPS_KEPT kept
 *
 * Every write goes through createWritable(), which replaces the file only
 * when the write completes, so a crash never leaves a half-written book.
 */
import { sanitizeProjectFilename, readProjectFile } from "../projectFile.js";
import { serializeProjectToJson } from "../serializer/kbookSerializer.js";

export const LIBRARY_FOLDER_NAME = "prakrut-kbooks";
export const SAVED_FILE = "book.kbook";
export const AUTOSAVE_FILE = "autosave.kbook";
export const BACKUP_FOLDER = "backups";
const BACKUPS_KEPT = 20;

export function supportsFolderAccess() {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(location.search).get("library") === "opfs") return true;
  return typeof window.showDirectoryPicker === "function";
}

/**
 * Ask the writer for the library folder. Picking Documents (or anything else)
 * uses — and creates if needed — a prakrut-kbooks folder inside it.
 */
export async function chooseLibraryFolder() {
  // Automated tests cannot drive the native picker; ?library=opfs uses the
  // browser's private file system, which has the same API.
  if (new URLSearchParams(location.search).get("library") === "opfs") {
    const opfs = await navigator.storage.getDirectory();
    return opfs.getDirectoryHandle(LIBRARY_FOLDER_NAME, { create: true });
  }
  const picked = await window.showDirectoryPicker({
    id: "prakrut-kbooks",
    mode: "readwrite",
    startIn: "documents",
  });
  if (picked.name === LIBRARY_FOLDER_NAME) return picked;
  return picked.getDirectoryHandle(LIBRARY_FOLDER_NAME, { create: true });
}

/**
 * "granted" | "prompt" | "denied". With `request`, asks the browser (this
 * needs a click or key press from the writer).
 */
export async function folderPermission(handle, { request = false } = {}) {
  if (!handle) return "denied";
  const options = { mode: "readwrite" };
  try {
    let state = await handle.queryPermission(options);
    if (state === "prompt" && request) state = await handle.requestPermission(options);
    return state;
  } catch {
    return "denied";
  }
}

async function fileIfExists(directory, name) {
  try {
    return await directory.getFileHandle(name);
  } catch {
    return null;
  }
}

async function writeText(directory, name, text) {
  const fileHandle = await directory.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}

/** A folder name for a new book that does not clash with an existing one. */
export async function createBookFolder(root, title) {
  const base = sanitizeProjectFilename(title, "untitled-book");
  for (let n = 1; n < 1000; n += 1) {
    const name = n === 1 ? base : `${base}-${n}`;
    try {
      await root.getDirectoryHandle(name);
    } catch {
      await root.getDirectoryHandle(name, { create: true });
      return name;
    }
  }
  throw new Error("Could not create a folder for this book.");
}

/**
 * Every book in the library, newest first:
 *   { folderName, title, bookId, modifiedAt, hasSaved, hasAutosave }
 */
export async function listBooks(root) {
  const books = [];
  for await (const [name, entry] of root.entries()) {
    if (entry.kind !== "directory") continue;
    const saved = await fileIfExists(entry, SAVED_FILE);
    const autosave = await fileIfExists(entry, AUTOSAVE_FILE);
    if (!saved && !autosave) continue;
    const newest = await newestFile(saved, autosave);
    const result = await readProjectFile(newest.file);
    if (!result.ok) continue;
    books.push({
      folderName: name,
      title: result.doc.metadata?.title || name,
      bookId: result.doc.metadata?.id ?? name,
      modifiedAt: newest.file.lastModified,
      hasSaved: Boolean(saved),
      hasAutosave: Boolean(autosave),
    });
  }
  return books.sort((a, b) => b.modifiedAt - a.modifiedAt);
}

async function newestFile(...handles) {
  let best = null;
  for (const handle of handles) {
    if (!handle) continue;
    const file = await handle.getFile();
    if (!best || file.lastModified > best.file.lastModified) best = { handle, file };
  }
  return best;
}

/**
 * Open a book: the newer of the saved copy and the local backup, so work
 * written after the last Save is never hidden. Returns readProjectFile()'s
 * result plus `source` ("saved" | "autosave") and `modifiedAt`.
 */
export async function readBook(root, folderName) {
  const folder = await root.getDirectoryHandle(folderName);
  const newest = await newestFile(
    await fileIfExists(folder, SAVED_FILE),
    await fileIfExists(folder, AUTOSAVE_FILE)
  );
  if (!newest) return { ok: false, message: "This book folder has no .kbook file." };
  const result = await readProjectFile(newest.file);
  return {
    ...result,
    source: newest.handle.name === SAVED_FILE ? "saved" : "autosave",
    modifiedAt: newest.file.lastModified,
  };
}

/** Local backup, written continuously while the writer works. */
export async function writeAutosave(root, folderName, doc, editorState) {
  const folder = await root.getDirectoryHandle(folderName, { create: true });
  await writeText(folder, AUTOSAVE_FILE, serializeProjectToJson(doc, editorState));
}

function backupName(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_` +
    `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.kbook`
  );
}

/** Save: the saved copy, the backup, and a dated copy in backups/. */
export async function saveBook(root, folderName, doc, editorState) {
  const folder = await root.getDirectoryHandle(folderName, { create: true });
  const text = serializeProjectToJson(doc, editorState);
  await writeText(folder, SAVED_FILE, text);
  await writeText(folder, AUTOSAVE_FILE, text);

  const backups = await folder.getDirectoryHandle(BACKUP_FOLDER, { create: true });
  await writeText(backups, backupName(), text);

  const names = [];
  for await (const [name, entry] of backups.entries()) {
    if (entry.kind === "file" && name.endsWith(".kbook")) names.push(name);
  }
  names.sort();
  for (const old of names.slice(0, Math.max(0, names.length - BACKUPS_KEPT))) {
    await backups.removeEntry(old);
  }
}
