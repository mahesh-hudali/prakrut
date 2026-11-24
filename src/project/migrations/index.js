/**
 * .kbook schema migrations.
 *
 * Each migration takes a payload at version N and returns version N+1.
 * Migrations must never drop unknown keys — anything we don't recognise is
 * carried forward untouched so future versions stay round-trippable.
 */

import { KBOOK_SCHEMA_VERSION } from "../schema/kbookSchema.js";

/**
 * @type {Record<number, (payload: object) => object>}
 * Example for the future:
 *   2: (payload) => ({ ...payload, version: 2, newField: [] }),
 */
const MIGRATIONS = {};

export function needsMigration(payload) {
  return Number(payload?.version) < KBOOK_SCHEMA_VERSION;
}

/**
 * Migrate a validated payload up to the current schema version.
 * @returns {{ payload: object, applied: number[] }}
 */
export function migrateKbook(payload) {
  let current = { ...payload };
  const applied = [];

  while (Number(current.version) < KBOOK_SCHEMA_VERSION) {
    const from = Number(current.version);
    const migrate = MIGRATIONS[from];

    if (!migrate) {
      throw new Error(
        `No migration available from schema version ${from} to ${from + 1}.`
      );
    }

    current = migrate(current);
    if (Number(current.version) !== from + 1) {
      current = { ...current, version: from + 1 };
    }
    applied.push(from + 1);
  }

  return { payload: current, applied };
}
