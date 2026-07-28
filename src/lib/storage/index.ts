/**
 * =============================================================================
 * STORAGE - CENTRALIZED STORAGE EXPORTS
 * =============================================================================
 *
 * Single entry point for safe localStorage utilities.
 *
 * @module lib/storage
 */

export {
  STORAGE_KEYS,
  isStorageAvailable,
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
  safeRemoveItemsByPrefix,
} from './safe-storage';
export type { StorageKeyValue } from './safe-storage';
