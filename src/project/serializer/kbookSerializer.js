/**
 * .kbook serializer / deserializer.
 *
 * The canonical document model is the single source of truth; this module only
 * translates it to and from the portable project payload. Unknown fields found
 * in a file are preserved so nothing is silently discarded.
 */

import {
  APPLICATION_VERSION,
  KBOOK_FORMAT,
  KBOOK_SCHEMA_VERSION,
  KNOWN_TOP_LEVEL_KEYS,
} from "../schema/kbookSchema.js";
import { createDefaultSettings, createId } from "../../models/documentModel.js";
import { normalizeRuns } from "../../models/runs.js";

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/**
 * Build the .kbook payload from the in-memory document + editor UI state.
 *
 * @param {object} doc canonical document model
 * @param {object} [editorState] view-only state (panels, zoom, mode…)
 */
export function serializeProject(doc, editorState = {}) {
  const now = new Date().toISOString();

  return {
    format: KBOOK_FORMAT,
    version: KBOOK_SCHEMA_VERSION,
    applicationVersion: APPLICATION_VERSION,
    metadata: {
      id: doc.metadata?.id ?? createId("proj"),
      title: doc.metadata?.title ?? "Untitled",
      subtitle: doc.metadata?.subtitle ?? "",
      author: doc.metadata?.author ?? "",
      language: doc.metadata?.language ?? "kn",
      createdAt: doc.metadata?.createdAt ?? now,
      updatedAt: now,
    },
    settings: cloneJson(doc.settings ?? createDefaultSettings()),
    frontMatter: cloneJson(doc.frontMatter ?? {}),
    chapters: (doc.chapters ?? []).map((chapter) => ({
      id: chapter.id,
      title: chapter.title ?? "",
      blocks: (chapter.blocks ?? []).map((block) => ({
        id: block.id,
        type: block.type ?? "paragraph",
        // `style` doubles as the paragraph type (normal/character/action/dialogue…)
        style: block.style ?? "normal",
        align: block.align ?? null,
        runs: normalizeRuns(block.runs).map((run) => ({
          id: run.id,
          text: run.text,
          marks: run.marks ?? [],
        })),
      })),
    })),
    comments: cloneJson(doc.comments ?? []),
    highlights: cloneJson(doc.highlights ?? []),
    kannada: cloneJson(
      doc.kannada ?? {
        customDictionary: [],
        preferredSpellings: {},
        characterNames: [],
      }
    ),
    editorState: cloneJson(editorState ?? {}),
    // Anything a future/foreign version added is carried through untouched.
    ...pickUnknown(doc.__unknown),
  };
}

function pickUnknown(unknown) {
  if (!unknown || typeof unknown !== "object") return {};
  const result = {};
  for (const [key, value] of Object.entries(unknown)) {
    if (KNOWN_TOP_LEVEL_KEYS.includes(key)) continue;
    result[key] = value;
  }
  return result;
}

/**
 * Convert a validated (and migrated) payload back into the document model.
 * Defensive defaults keep older/partial files usable without data loss.
 */
export function deserializeProject(payload) {
  const defaults = createDefaultSettings();
  const settings = {
    ...defaults,
    ...(payload.settings ?? {}),
    margins: { ...defaults.margins, ...(payload.settings?.margins ?? {}) },
    typography: {
      ...defaults.typography,
      ...(payload.settings?.typography ?? {}),
    },
  };

  const unknown = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!KNOWN_TOP_LEVEL_KEYS.includes(key)) unknown[key] = value;
  }

  const doc = {
    version: 1,
    metadata: {
      id: payload.metadata?.id ?? createId("proj"),
      title: payload.metadata?.title ?? "Untitled",
      subtitle: payload.metadata?.subtitle ?? "",
      author: payload.metadata?.author ?? "",
      language: payload.metadata?.language ?? "kn",
      createdAt: payload.metadata?.createdAt ?? new Date().toISOString(),
      updatedAt: payload.metadata?.updatedAt ?? new Date().toISOString(),
    },
    settings,
    frontMatter: {
      cover: true,
      titlePage: false,
      copyright: false,
      dedication: false,
      contents: false,
      coverImage: null,
      copyrightText: "",
      dedicationText: "",
      ...(payload.frontMatter ?? {}),
    },
    chapters: (payload.chapters ?? []).map((chapter) => ({
      id: chapter.id ?? createId("ch"),
      title: chapter.title ?? "",
      blocks: (chapter.blocks ?? []).map((block) => ({
        id: block.id ?? createId("p"),
        type: block.type ?? "paragraph",
        style: block.style ?? "normal",
        align: block.align ?? null,
        runs: normalizeRuns(
          block.runs?.length ? block.runs : [{ text: block.text ?? "", marks: [] }]
        ),
      })),
    })),
    comments: Array.isArray(payload.comments) ? payload.comments : [],
    highlights: Array.isArray(payload.highlights) ? payload.highlights : [],
    kannada: {
      customDictionary: [],
      preferredSpellings: {},
      characterNames: [],
      ...(payload.kannada ?? {}),
    },
  };

  if (Object.keys(unknown).length > 0) {
    doc.__unknown = unknown;
  }

  return { doc, editorState: payload.editorState ?? {} };
}

export function serializeProjectToJson(doc, editorState) {
  return JSON.stringify(serializeProject(doc, editorState), null, 2);
}

export function parseKbookJson(text) {
  try {
    return { ok: true, payload: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error };
  }
}
