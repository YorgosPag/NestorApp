/**
 * @file useStorageSave - Auto-Save Hook
 * @module settings-provider/storage/useStorageSave
 *
 * ✅ ENTERPRISE: Single Responsibility - Auto-save settings to storage
 *
 * Features:
 * - Debounced saves (500ms) to avoid excessive writes
 * - Deep equality check (stable hash) to skip unnecessary saves
 * - Never throws (graceful error handling)
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { safeSave } from '../../settings/io/safeSave';
import { ENTERPRISE_CONSTANTS } from '../constants';
import type { StorageDriver } from '../../settings/io/StorageDriver';
import type { SettingsState } from '../../settings/core/types';

/**
 * Stable JSON hash for deep equality checking
 *
 * @param obj - Object to hash
 * @returns Stable JSON string (sorted keys, handles cycles)
 */
function stableHash(obj: unknown): string {
  // ✅ ENTERPRISE: WeakSet only accepts objects (not primitives)
  const seen = new WeakSet<object>();
  const s = (x: unknown): string => {
    if (x && typeof x === 'object') {
      if (seen.has(x)) return '"[CYCLE]"';
      seen.add(x);
      if (Array.isArray(x)) return `[${x.map(s).join(',')}]`;
      const keys = Object.keys(x).sort();
      return `{${keys.map(k => `"${k}":${s((x as Record<string, unknown>)[k])}`).join(',')}}`;
    }
    return JSON.stringify(x);
  };
  return s(obj);
}

/**
 * Auto-save settings to storage (debounced)
 *
 * @param driver - Storage driver instance
 * @param settings - Current settings state
 * @param isLoaded - Skip save until settings are loaded
 * @param enabled - Feature flag (skip save if disabled)
 * @param onSaveStart - Callback when save starts
 * @param onSaveSuccess - Callback when save succeeds
 * @param onSaveError - Callback when save fails
 *
 * @example
 * ```tsx
 * useStorageSave(driver, state.settings, state.isLoaded, enabled,
 *   () => dispatch({ type: 'SAVE_START' }),
 *   () => dispatch({ type: 'SAVE_SUCCESS' }),
 *   (error) => dispatch({ type: 'SAVE_ERROR', payload: error })
 * );
 * ```
 */
export function useStorageSave(
  driver: StorageDriver,
  settings: SettingsState,
  isLoaded: boolean,
  enabled: boolean,
  onSaveStart: () => void,
  onSaveSuccess: () => void,
  onSaveError: (error: string) => void
): void {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const settingsHashRef = useRef<string>('');

  // ✅ ENTERPRISE: Stable hash for deep equality (no unnecessary saves)
  const settingsHash = useMemo(() => stableHash(settings), [settings]);

  useEffect(() => {
    if (!enabled || !isLoaded) return; // Skip if disabled or not loaded

    // ✅ ENTERPRISE: Skip save if settings haven't actually changed
    if (settingsHashRef.current === settingsHash) {
      console.log('[Enterprise Storage] Settings unchanged (hash match), skipping auto-save');
      return;
    }

    // First render - initialize hash but don't save
    if (settingsHashRef.current === '') {
      console.log('[Enterprise Storage] First render, initializing settings hash');
      settingsHashRef.current = settingsHash;
      return;
    }

    // Settings changed - update hash and schedule save
    console.log('[Enterprise Storage] Settings changed, scheduling auto-save');
    settingsHashRef.current = settingsHash;

    // ✅ ENTERPRISE: Debounce saves to avoid excessive writes
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      console.log('[Enterprise Storage] Auto-saving settings...');
      onSaveStart();

      // Parse hash back to settings (we know it's valid JSON)
      const settingsToSave = JSON.parse(settingsHash);

      safeSave(driver, settingsToSave, 'settings_state')
        .then(result => {
          if (result.success) {
            console.log('[Enterprise Storage] Settings saved successfully');
            onSaveSuccess();
          } else {
            const error = 'error' in result ? result.error : 'Unknown error';
            console.error('[Enterprise Storage] Save failed:', error);

            // ✅ ENTERPRISE: ChatGPT5 solution - Handle no-space gracefully
            const errorStr = String(error).toLowerCase();
            if (errorStr.includes('file_error_no_space') || errorStr.includes('no space')) {
              console.warn('[Enterprise Storage] Disk full - switching to memory mode');
              onSaveError('STORAGE_OFFLINE'); // Special error code for UI
            } else {
              onSaveError(error);
            }
          }
        })
        .catch(err => {
          console.error('[Enterprise Storage] Save exception:', err);
          const errorStr = String(err).toLowerCase();

          // ✅ ENTERPRISE: ChatGPT5 solution - Handle no-space exceptions
          if (errorStr.includes('file_error_no_space') || errorStr.includes('no space')) {
            console.warn('[Enterprise Storage] Disk full - switching to memory mode');
            onSaveError('STORAGE_OFFLINE'); // Special error code for UI
          } else {
            onSaveError(String(err));
          }
        });
    }, ENTERPRISE_CONSTANTS.AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [driver, settingsHash, enabled, isLoaded, onSaveStart, onSaveSuccess, onSaveError]);
}
