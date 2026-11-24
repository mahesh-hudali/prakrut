/**
 * .kbook project file schema.
 *
 * `.kbook` is the portable, authoritative source file for an unfinished book.
 * It always contains structured JSON — never serialized editor HTML.
 */

export const KBOOK_FORMAT = "kbook";
export const KBOOK_SCHEMA_VERSION = 1;
export const APPLICATION_VERSION = "1.0.0";
export const KBOOK_EXTENSION = ".kbook";
export const KBOOK_MIME = "application/json";

/** Top-level keys a valid file must contain. */
export const REQUIRED_TOP_LEVEL_KEYS = Object.freeze([
  "format",
  "version",
  "metadata",
  "settings",
  "chapters",
]);

/** Keys we know about. Anything else is preserved verbatim on load/save. */
export const KNOWN_TOP_LEVEL_KEYS = Object.freeze([
  ...REQUIRED_TOP_LEVEL_KEYS,
  "applicationVersion",
  "frontMatter",
  "cover",
  "comments",
  "highlights",
  "kannada",
  "editorState",
]);

export function isSupportedVersion(version) {
  return Number.isInteger(version) && version >= 1 && version <= KBOOK_SCHEMA_VERSION;
}
