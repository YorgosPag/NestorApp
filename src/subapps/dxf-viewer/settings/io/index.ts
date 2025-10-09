/**
 * @file Storage Layer Exports
 * @module settings/io
 *
 * ENTERPRISE STANDARD - Public API for storage operations
 *
 *  - Module #4
 */

// Storage Driver Interface
export type { StorageDriver } from './StorageDriver';
export {
  StoragePolicy,
  StorageError,
  StorageQuotaError,
  StorageUnavailableError
} from './StorageDriver';

// Implementations
export { IndexedDbDriver } from './IndexedDbDriver';
export { LocalStorageDriver } from './LocalStorageDriver';
export { MemoryDriver } from './MemoryDriver';

// Safe Load/Save
export type { LoadResult } from './safeLoad';
export { safeLoad, loadOrDefault, hasSettings } from './safeLoad';

export type { SaveResult } from './safeSave';
export { safeSave, safeSaveWithBackup, safeSaveOrThrow, safeBatchSave } from './safeSave';

// Sync Service
export { SyncService, createSyncService, isSyncSupported } from './SyncService';
