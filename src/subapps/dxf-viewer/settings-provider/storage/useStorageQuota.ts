/**
 * @file useStorageQuota - Enterprise Storage Quota Management Hook
 * @module settings-provider/storage/useStorageQuota
 *
 * ✅ ENTERPRISE: Graceful Storage Management
 *
 * Monitors storage quota, prevents FILE_ERROR_NO_SPACE errors,
 * and provides graceful degradation to memory-only mode.
 *
 * Based on Web Storage API and Navigator Storage API.
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-10
 */

import { useState, useEffect, useCallback } from 'react';
import { dlog, dwarn, derr } from '../../debug/utils/devlog';

// ============================================================================
// TYPES
// ============================================================================

export interface StorageQuotaInfo {
  /** Available storage in bytes */
  quota: number;
  /** Used storage in bytes */
  usage: number;
  /** Free storage in bytes */
  available: number;
  /** Usage percentage (0-100) */
  usagePercent: number;
  /** Is storage critically low? */
  isStorageCritical: boolean;
  /** Should we enable memory-only mode? */
  shouldUseMemoryMode: boolean;
}

export interface StorageQuotaState {
  info: StorageQuotaInfo | null;
  isLoading: boolean;
  error: string | null;
  lastChecked: Date | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ENTERPRISE_STORAGE_CONSTANTS = {
  /** Check quota every 30 seconds */
  QUOTA_CHECK_INTERVAL: 30000,
  /** Switch to memory mode when less than 50MB available */
  MEMORY_MODE_THRESHOLD: 50 * 1024 * 1024, // 50MB
  /** Warn when storage usage > 85% */
  WARNING_THRESHOLD: 85,
  /** Critical when storage usage > 95% */
  CRITICAL_THRESHOLD: 95,
  /** Fallback quota for browsers without Storage API (100MB) */
  FALLBACK_QUOTA: 100 * 1024 * 1024,
  /** Max settings size estimate (1MB) */
  MAX_SETTINGS_SIZE: 1024 * 1024,
} as const;

// ============================================================================
// HOOK
// ============================================================================

/**
 * Enterprise Storage Quota Management Hook
 *
 * Monitors storage quota and provides graceful degradation strategies.
 *
 * @example
 * ```tsx
 * const { info, checkQuota, canSafelyStore } = useStorageQuota();
 *
 * if (info?.shouldUseMemoryMode) {
 *   // Use memory-only storage
 * } else {
 *   // Safe to use IndexedDB/LocalStorage
 * }
 * ```
 */
export function useStorageQuota() {
  const [state, setState] = useState<StorageQuotaState>({
    info: null,
    isLoading: false,
    error: null,
    lastChecked: null
  });

  // ========================================================================
  // QUOTA CALCULATION
  // ========================================================================

  const calculateQuotaInfo = useCallback(async (): Promise<StorageQuotaInfo | null> => {
    try {
      if (!navigator.storage || !navigator.storage.estimate) {
        dlog('[Storage Quota] Navigator Storage API not available, using fallback');

        // Fallback for browsers without Storage API
        const fallbackInfo: StorageQuotaInfo = {
          quota: ENTERPRISE_STORAGE_CONSTANTS.FALLBACK_QUOTA,
          usage: 0,
          available: ENTERPRISE_STORAGE_CONSTANTS.FALLBACK_QUOTA,
          usagePercent: 0,
          isStorageCritical: false,
          shouldUseMemoryMode: false
        };

        return fallbackInfo;
      }

      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || ENTERPRISE_STORAGE_CONSTANTS.FALLBACK_QUOTA;
      const usage = estimate.usage || 0;
      const available = quota - usage;
      const usagePercent = (usage / quota) * 100;

      const isStorageCritical = usagePercent > ENTERPRISE_STORAGE_CONSTANTS.CRITICAL_THRESHOLD;
      const shouldUseMemoryMode = available < ENTERPRISE_STORAGE_CONSTANTS.MEMORY_MODE_THRESHOLD;

      const info: StorageQuotaInfo = {
        quota,
        usage,
        available,
        usagePercent,
        isStorageCritical,
        shouldUseMemoryMode
      };

      // ✅ ENTERPRISE: Conditional Logging
      if (shouldUseMemoryMode) {
        dwarn('[Storage Quota] MEMORY MODE activated - storage critically low:', {
          availableMB: Math.round(available / 1024 / 1024),
          usagePercent: Math.round(usagePercent)
        });
      } else if (isStorageCritical) {
        dwarn('[Storage Quota] Storage usage critical:', {
          usagePercent: Math.round(usagePercent),
          availableMB: Math.round(available / 1024 / 1024)
        });
      } else if (usagePercent > ENTERPRISE_STORAGE_CONSTANTS.WARNING_THRESHOLD) {
        dlog('[Storage Quota] Storage usage warning:', {
          usagePercent: Math.round(usagePercent),
          availableMB: Math.round(available / 1024 / 1024)
        });
      }

      return info;
    } catch (error) {
      derr('[Storage Quota] Failed to calculate quota:', error);
      return null;
    }
  }, []);

  // ========================================================================
  // QUOTA CHECK
  // ========================================================================

  const checkQuota = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const info = await calculateQuotaInfo();
      setState(prev => ({
        ...prev,
        info,
        isLoading: false,
        lastChecked: new Date()
      }));

      return info;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      derr('[Storage Quota] Check failed:', error);

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));

      return null;
    }
  }, [calculateQuotaInfo]);

  // ========================================================================
  // PERIODIC CHECK
  // ========================================================================

  useEffect(() => {
    // Initial check
    checkQuota();

    // Periodic checks
    const interval = setInterval(checkQuota, ENTERPRISE_STORAGE_CONSTANTS.QUOTA_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [checkQuota]);

  // ========================================================================
  // UTILITY FUNCTIONS
  // ========================================================================

  const canSafelyStore = useCallback((estimatedSize: number = ENTERPRISE_STORAGE_CONSTANTS.MAX_SETTINGS_SIZE): boolean => {
    if (!state.info) return true; // Assume safe if unknown

    return state.info.available > estimatedSize * 2; // 2x safety margin
  }, [state.info]);

  const getStorageRecommendation = useCallback((): 'indexeddb' | 'localstorage' | 'memory' => {
    if (!state.info) return 'indexeddb'; // Default to IndexedDB

    if (state.info.shouldUseMemoryMode) {
      return 'memory';
    } else if (state.info.isStorageCritical) {
      return 'localstorage'; // LocalStorage is more efficient for small data
    } else {
      return 'indexeddb'; // Full feature mode
    }
  }, [state.info]);

  const formatSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
    return `${Math.round(bytes / (1024 * 1024 * 1024))} GB`;
  }, []);

  // ========================================================================
  // RETURN
  // ========================================================================

  return {
    // State
    ...state,

    // Actions
    checkQuota,

    // Utilities
    canSafelyStore,
    getStorageRecommendation,
    formatSize,

    // Constants for external use
    constants: ENTERPRISE_STORAGE_CONSTANTS
  };
}