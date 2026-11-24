/**
 * Browser-side store for the book library (IndexedDB "prakrut-library").
 *
 *   books: { bookId, folderName, title, payload, savedAt }
 *          the latest autosave of every book — what makes refresh instant
 *          and safe even before the writer allows folder access again
 *   meta:  { key: "rootHandle", value: FileSystemDirectoryHandle }
 *          { key: "lastBookId", value: string }
 *
 * The prakrut-kbooks folder on disk is the durable, portable copy; this is
 * the fast local layer in front of it.
 */

const DB_NAME = "prakrut-library";
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("books")) db.createObjectStore("books", { keyPath: "bookId" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function run(store, mode, operation) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = operation(tx.objectStore(store));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const getMeta = async (key) => (await run("meta", "readonly", (s) => s.get(key)))?.value ?? null;
export const setMeta = (key, value) => run("meta", "readwrite", (s) => s.put({ key, value }));
export const deleteMeta = (key) => run("meta", "readwrite", (s) => s.delete(key));

export const getBookRecord = (bookId) => run("books", "readonly", (s) => s.get(bookId));
export const putBookRecord = (record) => run("books", "readwrite", (s) => s.put(record));
export const deleteBookRecord = (bookId) => run("books", "readwrite", (s) => s.delete(bookId));
export const listBookRecords = async () => (await run("books", "readonly", (s) => s.getAll())) ?? [];

/**
 * Last-moment copy written synchronously when the tab closes or reloads
 * (IndexedDB writes may not finish in time). Read back on the next start.
 */
const emergencyKey = (bookId) => `prakrut:unsaved:${bookId}`;

export function writeEmergencyCopy(bookId, payload, savedAt) {
  try {
    localStorage.setItem(emergencyKey(bookId), JSON.stringify({ payload, savedAt }));
  } catch {
    // Too large or storage blocked: the IndexedDB autosave still applies.
  }
}

export function takeEmergencyCopy(bookId) {
  try {
    const raw = localStorage.getItem(emergencyKey(bookId));
    localStorage.removeItem(emergencyKey(bookId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
