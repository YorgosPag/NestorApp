/**
 * UserSettings — public barrel.
 *
 * @module services/user-settings
 * @enterprise ADR-XXX (UserSettings SSoT — Firestore-backed industry pattern)
 */

export { userSettingsRepository } from './user-settings-repository';
export type { SliceListener } from './user-settings-repository';
export { applySliceToDoc, getSliceFromDoc } from './user-settings-paths';
export type { SliceValueMap } from './user-settings-paths';
export { stableHash } from './user-settings-hash';
export {
  USER_SETTINGS_SCHEMA_VERSION,
  userSettingsSchema,
  type UserSettingsDoc,
  type CursorSettingsSlice,
  type RulersGridSettingsSlice,
  type DxfSettingsSlice,
  type SnapSettingsSlice,
  type DxfViewerSlicePath,
} from './user-settings-schema';
export { buildUserPreferencesDocId } from './user-settings-id';
export {
  migrateUserSettings,
  buildEmptyUserSettings,
  type MigrationResult,
} from './user-settings-migrations';
