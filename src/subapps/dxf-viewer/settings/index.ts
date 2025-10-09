/**
 * @file Settings Module - Public API
 * @module settings
 *
 * ENTERPRISE STANDARD - Centralized Settings Platform
 *
 * **SINGLE IMPORT FOR EVERYTHING:**
 * ```typescript
 * import {
 *   computeEffective,
 *   IndexedDbDriver,
 *   FACTORY_DEFAULTS,
 *   validateSettingsState
 * } from '@/settings';
 * ```
 *
 * 
 */

// ============================================================================
// CORE - Types & Logic
// ============================================================================

export type {
  ViewerMode,
  StorageMode,
  EntityType,
  LineSettings,
  TextSettings,
  GripSettings,
  EntitySettings,
  OverrideFlags,
  SettingsState,
  Template,
  TemplateRegistry
} from './core/types';

export {
  SUPPORTED_MODES,
  ENTITY_TYPES,
  isViewerMode,
  isEntityType,
  isStorageMode
} from './core/types';

export {
  modeMap,
  ensureStorageMode
} from './core/modeMap';

export {
  computeEffective,
  computeBase,
  hasActiveOverrides,
  getOverriddenKeys,
  settingsEqual
} from './core/computeEffective';

// ============================================================================
// STORAGE - Drivers & Persistence
// ============================================================================

export type { StorageDriver } from './io/StorageDriver';
export {
  StoragePolicy,
  StorageError,
  StorageQuotaError,
  StorageUnavailableError
} from './io/StorageDriver';

export { IndexedDbDriver } from './io/IndexedDbDriver';
export { LocalStorageDriver } from './io/LocalStorageDriver';
export { MemoryDriver } from './io/MemoryDriver';

// Safe Load/Save
export type { LoadResult } from './io/safeLoad';
export {
  safeLoad,
  loadOrDefault,
  hasSettings
} from './io/safeLoad';

export type { SaveResult } from './io/safeSave';
export {
  safeSave,
  safeSaveWithBackup,
  safeSaveOrThrow,
  safeBatchSave
} from './io/safeSave';

// Sync Service
export { SyncService, createSyncService, isSyncSupported } from './io/SyncService';

// ============================================================================
// VALIDATION - Schema & Migrations
// ============================================================================

export {
  ViewerModeSchema,
  StorageModeSchema,
  LineSettingsSchema,
  TextSettingsSchema,
  GripSettingsSchema,
  SettingsStateSchema,
  validateSettingsState,
  validateAndCoerce,
  validateLineSettingsUpdate,
  validateTextSettingsUpdate,
  validateGripSettingsUpdate
} from './io/schema';

export type {
  LineSettingsType,
  TextSettingsType,
  GripSettingsType,
  SettingsStateType
} from './io/schema';

export type { MigrationFn, Migration } from './io/migrationRegistry';
export {
  migrations,
  migrateToVersion,
  needsMigration,
  rollbackToVersion,
  createBackup,
  validateMigration
} from './io/migrationRegistry';

// ============================================================================
// STANDARDS - CAD Defaults
// ============================================================================

export {
  ACI_PALETTE,
  ACI_COLOR_NAMES,
  getAciColor,
  getAciColorName,
  findClosestAci
} from './standards/aci';

export {
  CURRENT_VERSION,
  FACTORY_DEFAULTS,
  DEFAULT_LINE_SETTINGS,
  DEFAULT_TEXT_SETTINGS,
  DEFAULT_GRIP_SETTINGS,
  getFactoryDefaults,
  getEntityFactoryDefaults
} from './FACTORY_DEFAULTS';

// ============================================================================
// STATE MANAGEMENT - Actions, Reducer, Selectors
// ============================================================================

export type { SettingsAction } from './state/actions';
export { settingsActions } from './state/actions';

export { settingsReducer } from './state/reducer';

export {
  selectLineSettings,
  selectTextSettings,
  selectGripSettings,
  selectIsOverrideEnabled,
  selectVersion
} from './state/selectors';

// ============================================================================
// TEMPLATES (TODO - Not implemented yet)
// ============================================================================

// TODO: Export when templates are implemented
// export { TemplateEngine } from './templates/TemplateEngine';

// ============================================================================
// TELEMETRY - Logging & Metrics
// ============================================================================

export type { LogEntry, LogOutput } from './telemetry/Logger';
export {
  Logger,
  LogLevel,
  ConsoleOutput,
  DevNullOutput,
  getLogger,
  setLogger,
  createLogger
} from './telemetry/Logger';

export {
  Metrics,
  getMetrics,
  setMetrics,
  createMetrics
} from './telemetry/Metrics';
