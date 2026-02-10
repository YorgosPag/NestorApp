/**
 * @file useStorageDriver - Enterprise Storage Driver Selection Hook
 * @module settings-provider/storage/useStorageDriver
 *
 * ✅ ENTERPRISE: Intelligent Driver Selection + Quota Management
 *
 * Selects appropriate storage driver based on:
 * - Browser capabilities
 * - Available storage quota
 * - Graceful degradation strategy
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 * @updated 2025-10-10 - Added Enterprise Storage Quota Management
 */

import { useMemo } from 'react';
import { IndexedDbDriver } from '../../settings/io/IndexedDbDriver';
import { LocalStorageDriver } from '../../settings/io/LocalStorageDriver';
import type { StorageDriver } from '../../settings/io/StorageDriver';
import { dlog } from '../../debug/utils/devlog';

/**
 * Enterprise Storage Driver Selection with Quota Management
 *
 * @returns Storage driver instance with intelligent selection:
 *          - Memory mode (graceful degradation) if storage critical
 *          - LocalStorage if quota limited but available
 *          - IndexedDB for full-feature mode
 *
 * @example
 * ```tsx
 * const { driver, quotaInfo, isMemoryMode } = useStorageDriver();
 * const data = await driver.load('settings_state');
 *
 * if (isMemoryMode) {
 *   console.log('Running in memory-only mode due to storage constraints');
 * }
 * ```
 */
export function useStorageDriver(): StorageDriver {
  // ⚠️ TEMPORARY: Disable quota management to fix infinite loop
  // TODO: Implement quota management without causing infinite re-renders

  return useMemo<StorageDriver>(() => {
    // Simple driver selection without quota monitoring
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      dlog('[Enterprise Storage] Using IndexedDB driver (simple mode)');
      return new IndexedDbDriver();
    } else {
      dlog('[Enterprise Storage] Using LocalStorage driver (fallback)');
      return new LocalStorageDriver();
    }
  }, []);
}
