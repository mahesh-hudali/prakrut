/**
 * .kbook file I/O.
 *
 * Uses the File System Access API when available so "Save Project" updates the
 * same file. Falls back to a download + file picker everywhere else.
 *
 * Nothing here touches React state; callers decide what to do with results.
 */

import { KBOOK_EXTENSION, KBOOK_MIME } from "./schema/kbookSchema.js";
import { migrateKbook, needsMigration } from "./migrations/index.js";
import {
  deserializeProject,
  parseKbookJson,
  serializeProjectToJson,
} from "./serializer/kbookSerializer.js";
import {
  GENERIC_CORRUPT_MESSAGE,
  validateKbook,
} from "./validator/validateKbook.js";

export function supportsFileSystemAccess() {
  return (
    typeof window !== "undefined" &&
    typeof window.showSaveFilePicker === "function" &&
    typeof window.showOpenFilePicker === "function"
  );
}

export function sanitizeProjectFilename(title, fallback = "kannada-book") {
  const raw = (title || "").trim() || fallback;
  const cleaned = raw
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  const safe = cleaned.replace(/[^\p{L}\p{M}\p{N}_-]+/gu, "");
  return safe || fallback;
}

export function buildProjectFilename(doc) {
  return `${sanitizeProjectFilename(doc?.metadata?.title)}${KBOOK_EXTENSION}`;
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: KBOOK_MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Write the project.
 *
 * @param {object} params
 * @param {object} params.doc canonical document model
 * @param {object} params.editorState
 * @param {FileSystemFileHandle|null} [params.handle] reuse for plain "Save"
 * @param {boolean} [params.forcePicker] true for "Save As"
 * @returns {Promise<{ ok: boolean, handle: any, filename: string, method: string }>}
 */
export async function saveProjectFile({
  doc,
  editorState,
  handle = null,
  forcePicker = false,
}) {
  const json = serializeProjectToJson(doc, editorState);
  const filename = buildProjectFilename(doc);

  if (supportsFileSystemAccess()) {
    let targetHandle = handle;

    if (!targetHandle || forcePicker) {
      targetHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "Kannada Book Project",
            accept: { [KBOOK_MIME]: [KBOOK_EXTENSION] },
          },
        ],
      });
    }

    // Writable streams only replace the destination once close() succeeds.
    const writable = await targetHandle.createWritable();
    await writable.write(json);
    await writable.close();

    return {
      ok: true,
      handle: targetHandle,
      filename: targetHandle.name || filename,
      method: "fileSystemAccess",
    };
  }

  downloadText(json, filename);
  return { ok: true, handle: null, filename, method: "download" };
}

/** Read + validate + migrate a File into a document model. */
export async function readProjectFile(file) {
  const text = await file.text();
  const parsed = parseKbookJson(text);

  if (!parsed.ok) {
    return {
      ok: false,
      message: GENERIC_CORRUPT_MESSAGE,
      errors: [parsed.error?.message ?? "Invalid JSON."],
    };
  }

  const validation = validateKbook(parsed.payload);
  if (!validation.valid) {
    return {
      ok: false,
      message: validation.message,
      errors: validation.errors,
    };
  }

  let payload = parsed.payload;
  let migrationsApplied = [];

  if (needsMigration(payload)) {
    try {
      const migrated = migrateKbook(payload);
      payload = migrated.payload;
      migrationsApplied = migrated.applied;
    } catch (error) {
      return {
        ok: false,
        message: GENERIC_CORRUPT_MESSAGE,
        errors: [error.message],
      };
    }

    // Re-validate after migration so we never load a half-converted file.
    const revalidated = validateKbook(payload);
    if (!revalidated.valid) {
      return {
        ok: false,
        message: revalidated.message,
        errors: revalidated.errors,
      };
    }
  }

  const { doc, editorState } = deserializeProject(payload);
  return {
    ok: true,
    doc,
    editorState,
    migrationsApplied,
    filename: file.name,
  };
}

/** Open a .kbook through the picker (or a hidden input as fallback). */
export async function openProjectFile() {
  if (supportsFileSystemAccess()) {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: "Kannada Book Project",
          accept: { [KBOOK_MIME]: [KBOOK_EXTENSION] },
        },
      ],
    });
    const file = await handle.getFile();
    const result = await readProjectFile(file);
    return { ...result, handle: result.ok ? handle : null };
  }

  const file = await pickFileWithInput();
  if (!file) return { ok: false, cancelled: true };
  const result = await readProjectFile(file);
  return { ...result, handle: null };
}

function pickFileWithInput() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = `${KBOOK_EXTENSION},application/json`;
    input.style.display = "none";
    document.body.appendChild(input);

    const cleanup = () => input.remove();

    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0] ?? null;
        cleanup();
        resolve(file);
      },
      { once: true }
    );

    // `cancel` is not universally supported; the promise simply stays pending
    // until the user picks a file or reloads, which is safe here.
    input.addEventListener("cancel", () => {
      cleanup();
      resolve(null);
    });

    input.click();
  });
}
