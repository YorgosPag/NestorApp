/**
 * @file useStorageLoad - Storage Load Hook
 * @module settings-provider/storage/useStorageLoad
 *
 * ✅ ENTERPRISE: Single Responsibility - Load settings from storage
 *
 * Handles:
 * - Loading from IndexedDB/LocalStorage
 * - Legacy format detection and migration
 * - Error handling (never throws)
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

import { useEffect, useRef } from 'react';
import { loadOrDefault } from '../../settings/io/safeLoad';
import { safeSave } from '../../settings/io/safeSave';
import { migrateFromLegacyProvider, isLegacyFormat, getMigrationInfo } from '../../settings/io/legacyMigration';
import type { StorageDriver } from '../../settings/io/StorageDriver';
import type { SettingsState } from '../../settings/core/types';

/**
 * Load settings from storage (with automatic legacy migration)
 *
 * @param driver - Storage driver instance
 * @param enabled - Feature flag (skip load if disabled)
 * @param onLoadSuccess - Callback when settings loaded successfully
 * @param onLoadError - Callback when load fails
 *
 * @example
 * ```tsx
 * useStorageLoad(driver, enabled,
 *   (settings) => dispatch({ type: 'LOAD_SUCCESS', payload: settings }),
 *   (error) => dispatch({ type: 'LOAD_ERROR', payload: error })
 * );
 * ```
 */
export function useStorageLoad(
  driver: StorageDriver,
  enabled: boolean,
  onLoadSuccess: (settings: SettingsState) => void,
  onLoadError: (error: string) => void
): void {
  // ✅ ENTERPRISE: ChatGPT5 Solution - Track driver to avoid re-loads
  const hasLoadedRef = useRef(false);
  const lastDriverKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return; // Skip if disabled

    // ✅ ENTERPRISE: Create stable driver key (ChatGPT5 solution)
    const driverKey = driver ? `${driver.constructor.name}` : 'no-driver';

    // ✅ ENTERPRISE: Skip if already loaded with same driver
    if (hasLoadedRef.current && lastDriverKeyRef.current === driverKey) {
      return;
    }

    lastDriverKeyRef.current = driverKey;

    // Try to load from enterprise storage first
    loadOrDefault(driver, 'settings_state')
      .then(enterpriseData => {
        // Check if this is enterprise format or legacy
        if (isLegacyFormat(enterpriseData)) {
          // Migrate legacy → enterprise
          const migratedData = migrateFromLegacyProvider(enterpriseData);

          // Save migrated data immediately (one-time migration)
          safeSave(driver, migratedData, 'settings_state')
            .catch(() => { /* Silent failure */ });

          onLoadSuccess(migratedData);
        } else {
          // Already enterprise format
          onLoadSuccess(enterpriseData);
        }

        // ✅ ENTERPRISE: Mark as loaded successfully
        hasLoadedRef.current = true;
      })
      .catch(error => {
        console.error('[Enterprise Storage] Failed to load settings:', error);
        onLoadError(error.message);
        // Factory defaults will be used (already in state)
      });
  }, [driver, enabled, onLoadSuccess, onLoadError]);
}
