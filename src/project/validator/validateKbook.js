/**
 * .kbook validation.
 *
 * A file is only accepted when the format, version and required fields all
 * check out. Callers must never replace the open project on a failed result.
 */

import {
  KBOOK_FORMAT,
  KBOOK_SCHEMA_VERSION,
  REQUIRED_TOP_LEVEL_KEYS,
} from "../schema/kbookSchema.js";

export const GENERIC_CORRUPT_MESSAGE =
  "This project file appears to be damaged or incompatible.";

function fail(errors) {
  return { valid: false, errors, message: GENERIC_CORRUPT_MESSAGE };
}

export function validateKbook(payload) {
  const errors = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fail(["Project file is not a JSON object."]);
  }

  if (payload.format !== KBOOK_FORMAT) {
    errors.push(`Unexpected format: ${String(payload.format)}`);
  }

  if (!Number.isInteger(payload.version) || payload.version < 1) {
    errors.push(`Unexpected schema version: ${String(payload.version)}`);
  } else if (payload.version > KBOOK_SCHEMA_VERSION) {
    errors.push(
      `Project was created by a newer version (schema ${payload.version}).`
    );
  }

  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in payload)) errors.push(`Missing required field: ${key}`);
  }

  if (payload.metadata && typeof payload.metadata !== "object") {
    errors.push("metadata must be an object.");
  }

  if (payload.settings && typeof payload.settings !== "object") {
    errors.push("settings must be an object.");
  }

  if (!Array.isArray(payload.chapters)) {
    errors.push("chapters must be an array.");
  } else {
    payload.chapters.forEach((chapter, index) => {
      if (!chapter || typeof chapter !== "object") {
        errors.push(`Chapter ${index} is not an object.`);
        return;
      }
      if (!chapter.id) errors.push(`Chapter ${index} is missing an id.`);
      if (!Array.isArray(chapter.blocks)) {
        errors.push(`Chapter ${index} is missing a blocks array.`);
        return;
      }
      chapter.blocks.forEach((block, blockIndex) => {
        if (!block || typeof block !== "object") {
          errors.push(`Block ${blockIndex} in chapter ${index} is invalid.`);
          return;
        }
        if (!block.id) {
          errors.push(`Block ${blockIndex} in chapter ${index} is missing an id.`);
        }
        if (block.runs !== undefined && !Array.isArray(block.runs)) {
          errors.push(
            `Block ${blockIndex} in chapter ${index} has invalid runs.`
          );
        }
      });
    });
  }

  for (const key of ["comments", "highlights"]) {
    if (payload[key] !== undefined && !Array.isArray(payload[key])) {
      errors.push(`${key} must be an array.`);
    }
  }

  if (errors.length > 0) return fail(errors);
  return { valid: true, errors: [], message: "" };
}
