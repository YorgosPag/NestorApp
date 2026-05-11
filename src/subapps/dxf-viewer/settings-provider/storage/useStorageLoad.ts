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
import { migrateFromLegacyProvider, isLegacyFormat } from '../../settings/io/legacyMigration';
import type { StorageDriver } from '../../settings/io/StorageDriver';
import type { SettingsState } from '../../settings/core/types';

// Minimum grip size introduced in standards_version 2.
// Old defaults (5, 8) are too small on modern displays — bump on first load.
const GRIP_SIZE_V2 = 14;

function applyV2Migration(s: SettingsState): { settings: SettingsState; changed: boolean } {
  if ((s.__standards_version ?? 1) >= 2) return { settings: s, changed: false };
  const oldSize = (s.grip?.general as { gripSize?: number })?.gripSize ?? 0;
  const newSize = oldSize < GRIP_SIZE_V2 ? GRIP_SIZE_V2 : oldSize;
  const migrated: SettingsState = {
    ...s,
    __standards_version: 2,
    grip: {
      ...s.grip,
      general: {
        ...s.grip.general,
        gripSize: newSize,
      },
    },
  };
  return { settings: migrated, changed: true };
}

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
        let finalData: SettingsState;

        if (isLegacyFormat(enterpriseData)) {
          finalData = migrateFromLegacyProvider(enterpriseData);
        } else {
          finalData = enterpriseData;
        }

        // v2 migration: bump gripSize if below comfortable threshold
        const { settings: v2Data, changed } = applyV2Migration(finalData);
        if (changed) {
          safeSave(driver, v2Data, 'settings_state').catch(() => { /* Silent failure */ });
        }

        onLoadSuccess(v2Data);

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
