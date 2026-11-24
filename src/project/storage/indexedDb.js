/**
 * IndexedDB working store.
 *
 * This is the *local recovery* layer: it holds the live project so a crash,
 * tab close or restart never loses work. The portable `.kbook` file remains
 * the authoritative project artifact.
 */

const DB_NAME = "kannada-book-editor";
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";
const STORE_META = "meta";

const AUTOSAVE_KEY = "autosave";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function runTransaction(storeName, mode, operation) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result;

        try {
          result = operation(store);
        } catch (error) {
          reject(error);
          return;
        }

        tx.oncomplete = () =>
          resolve(result && "result" in result ? result.result : result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export async function isAvailable() {
  try {
    await openDb();
    return true;
  } catch {
    return false;
  }
}

/**
 * Persist the working project. Called from a debounced autosave, never
 * synchronously on each keystroke.
 */
export async function saveAutosave(payload) {
  const record = {
    key: AUTOSAVE_KEY,
    payload,
    savedAt: new Date().toISOString(),
  };
  await runTransaction(STORE_PROJECTS, "readwrite", (store) =>
    store.put(record)
  );
  return record;
}

export async function loadAutosave() {
  return runTransaction(STORE_PROJECTS, "readonly", (store) =>
    store.get(AUTOSAVE_KEY)
  );
}

export async function clearAutosave() {
  return runTransaction(STORE_PROJECTS, "readwrite", (store) =>
    store.delete(AUTOSAVE_KEY)
  );
}

/** Snapshot kept as an extra safety net before overwriting a project file. */
export async function saveSnapshot(projectId, payload) {
  const record = {
    key: `snapshot:${projectId}`,
    payload,
    savedAt: new Date().toISOString(),
  };
  await runTransaction(STORE_PROJECTS, "readwrite", (store) =>
    store.put(record)
  );
  return record;
}

export async function loadSnapshot(projectId) {
  return runTransaction(STORE_PROJECTS, "readonly", (store) =>
    store.get(`snapshot:${projectId}`)
  );
}

/** Last successfully written .kbook info — used to detect newer autosaves. */
export async function setLastSavedInfo(info) {
  await runTransaction(STORE_META, "readwrite", (store) =>
    store.put({ key: "lastSaved", ...info })
  );
}

export async function getLastSavedInfo() {
  return runTransaction(STORE_META, "readonly", (store) =>
    store.get("lastSaved")
  );
}

export async function setRecentProject(info) {
  await runTransaction(STORE_META, "readwrite", (store) =>
    store.put({ key: "recentProject", ...info })
  );
}

export async function getRecentProject() {
  return runTransaction(STORE_META, "readonly", (store) =>
    store.get("recentProject")
  );
}
