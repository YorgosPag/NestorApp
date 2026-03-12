/**
 * =============================================================================
 * STORAGE - CENTRALIZED STORAGE EXPORTS
 * =============================================================================
 *
 * Single entry point for safe localStorage utilities.
 *
 * @module lib/storage
 */

export { STORAGE_KEYS, safeGetItem, safeSetItem, safeRemoveItem } from './safe-storage';
export type { StorageKeyValue } from './safe-storage';
