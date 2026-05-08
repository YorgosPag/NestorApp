/**
 * UserSettings — schema migration pipeline.
 *
 * Each migration takes a raw object at its source schemaVersion and returns
 * an object at the next version. The repository runs the chain on every read
 * if the document is older than the current `USER_SETTINGS_SCHEMA_VERSION`,
 * then writes back the migrated value (one-shot, idempotent).
 *
 * Initial release ships with v1; future versions append migrations here.
 *
 * @module services/user-settings/user-settings-migrations
 * @enterprise ADR-XXX (UserSettings SSoT)
 */

import { USER_SETTINGS_SCHEMA_VERSION, type UserSettingsDoc } from './user-settings-schema';

type MigrationFn = (raw: Record<string, unknown>) => Record<string, unknown>;

/** Ordered list of migrations: index N migrates from version N to N+1. */
const MIGRATIONS: ReadonlyArray<MigrationFn> = [
  // v0 → v1 — initial schema. Documents written before schema versioning are
  // treated as v0; we just stamp the version field. Any malformed nested
  // shape will be caught by the Zod validator on the consumer side.
  (raw) => ({ ...raw, schemaVersion: 1 }),
];

export interface MigrationResult {
  data: Record<string, unknown>;
  migrated: boolean;
  fromVersion: number;
  toVersion: number;
}

/**
 * Run all required migrations to bring a raw Firestore document up to the
 * current `USER_SETTINGS_SCHEMA_VERSION`. Pure function — no IO.
 */
export function migrateUserSettings(raw: Record<string, unknown>): MigrationResult {
  const fromVersion = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  const toVersion = USER_SETTINGS_SCHEMA_VERSION;

  if (fromVersion === toVersion) {
    return { data: raw, migrated: false, fromVersion, toVersion };
  }

  if (fromVersion > toVersion) {
    // Forward-incompatible: client is older than the document. Surface the raw
    // value untouched and let the Zod validator fail loudly so we don't silently
    // strip new fields written by a newer client.
    return { data: raw, migrated: false, fromVersion, toVersion };
  }

  let cursor = raw;
  for (let v = fromVersion; v < toVersion; v += 1) {
    const fn = MIGRATIONS[v];
    if (!fn) break;
    cursor = fn(cursor);
  }
  return { data: cursor, migrated: true, fromVersion, toVersion };
}

/**
 * Build a fresh document for a user that has never written before.
 * Returns a minimal, schema-valid skeleton — slices are filled in lazily by
 * each subsystem on first write.
 */
export function buildEmptyUserSettings(
  userId: string,
  companyId: string,
): UserSettingsDoc {
  return {
    userId,
    companyId,
    schemaVersion: USER_SETTINGS_SCHEMA_VERSION,
  };
}
