/**
 * @file useAutoSave — Centralized Auto-Save Hook
 * @module hooks/useAutoSave
 *
 * 🏢 ENTERPRISE: ADR-248 — Centralized Auto-Save System (Google-Level)
 *
 * Eliminates 8+ copy-paste auto-save boilerplate patterns across the app.
 * Google Docs pattern: consumer provides data, hook decides when to save.
 *
 * Features:
 * - Debounced saves with configurable delay
 * - Deep equality check to skip unnecessary saves
 * - Automatic retry on failure (configurable)
 * - Race condition protection via version counter
 * - Stale closure protection via refs
 * - Flush on unmount (fire-and-forget) to prevent data loss
 * - Status lifecycle: idle → saving → success|error → idle
 *
 * @example
 * ```tsx
 * const { status, lastSaved, error, saveNow } = useAutoSave(formData, {
 *   saveFn: (data) => updateProject(projectId, data),
 *   enabled: isEditing,
 *   debounceMs: 2000,
 * });
 * ```
 *
 * @see src/types/auto-save.ts (types)
 * @see src/config/auto-save-config.ts (timing constants)
 * @see docs/centralized-systems/reference/adrs/ADR-248-centralized-auto-save.md
 * @created 2026-03-19
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTO_SAVE_TIMING } from '@/config/auto-save-config';
import type { AutoSaveConfig, AutoSaveReturn, SaveStatus } from '@/types/auto-save';

// ============================================
// DEFAULT EQUALITY FUNCTION
// ============================================

/**
 * Deep equality via JSON.stringify.
 * Sufficient for Firestore form data (flat objects, no cycles).
 * Override via `equalityFn` for complex structures.
 */
function defaultEqualityFn<T>(prev: T, next: T): boolean {
  try {
    return JSON.stringify(prev) === JSON.stringify(next);
  } catch {
    // If serialization fails (circular refs), assume not equal
    return false;
  }
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

/**
 * Centralized auto-save hook with debounce, retry, and race condition protection.
 *
 * @typeParam T - Shape of the data being auto-saved
 * @param data - Current data state (hook watches for changes)
 * @param config - Auto-save configuration
 * @returns Auto-save state and control functions
 */
export function useAutoSave<T>(
  data: T,
  config: AutoSaveConfig<T>
): AutoSaveReturn<T> {
  const {
    saveFn,
    debounceMs = AUTO_SAVE_TIMING.FORM_DEBOUNCE,
    equalityFn = defaultEqualityFn,
    enabled = true,
    maxRetries = AUTO_SAVE_TIMING.MAX_RETRIES,
    statusResetMs = AUTO_SAVE_TIMING.STATUS_RESET,
    onStatusChange,
    onError,
    onSuccess,
  } = config;

  // ── State ──────────────────────────────────────────────
  const [status, setStatusState] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // ── Refs (stale closure & race condition protection) ───
  const saveFnRef = useRef(saveFn);
  const dataRef = useRef(data);
  const previousDataRef = useRef(data);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const statusResetTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const versionRef = useRef(0);
  const retryCountRef = useRef(0);
  const isFirstRenderRef = useRef(true);
  const mountedRef = useRef(true);
  const equalityFnRef = useRef(equalityFn);
  const onStatusChangeRef = useRef(onStatusChange);
  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);

  // ── Keep refs fresh ────────────────────────────────────
  saveFnRef.current = saveFn;
  dataRef.current = data;
  equalityFnRef.current = equalityFn;
  onStatusChangeRef.current = onStatusChange;
  onErrorRef.current = onError;
  onSuccessRef.current = onSuccess;

  // ── Status setter with callback ────────────────────────
  const setStatus = useCallback((newStatus: SaveStatus) => {
    setStatusState(newStatus);
    onStatusChangeRef.current?.(newStatus);
  }, []);

  // ── Schedule status reset to idle ──────────────────────
  const scheduleStatusReset = useCallback((delayMs: number) => {
    if (statusResetTimerRef.current) {
      clearTimeout(statusResetTimerRef.current);
    }
    statusResetTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setStatus('idle');
      }
    }, delayMs);
  }, [setStatus]);

  // ── Core save execution ────────────────────────────────
  const executeSave = useCallback(async (dataToSave: T, saveVersion: number) => {
    if (!mountedRef.current) return;

    setStatus('saving');
    setError(null);

    try {
      await saveFnRef.current(dataToSave);

      // Race condition check: ignore result if newer save started
      if (saveVersion !== versionRef.current || !mountedRef.current) return;

      setStatus('success');
      setLastSaved(new Date());
      setIsDirty(false);
      retryCountRef.current = 0;
      previousDataRef.current = dataToSave;

      onSuccessRef.current?.(dataToSave, new Date());
      scheduleStatusReset(statusResetMs);

    } catch (err) {
      // Race condition check
      if (saveVersion !== versionRef.current || !mountedRef.current) return;

      const errorObj = err instanceof Error ? err : new Error(String(err));
      const errorMessage = errorObj.message || 'Auto-save failed';

      setError(errorMessage);
      onErrorRef.current?.(errorObj, retryCountRef.current);

      // Auto-retry if under limit
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current += 1;

        retryTimerRef.current = setTimeout(() => {
          if (mountedRef.current && versionRef.current === saveVersion) {
            executeSave(dataToSave, saveVersion);
          }
        }, AUTO_SAVE_TIMING.RETRY_DELAY);
      } else {
        // All retries exhausted
        setStatus('error');
        scheduleStatusReset(AUTO_SAVE_TIMING.ERROR_RESET);
      }
    }
  }, [maxRetries, statusResetMs, setStatus, scheduleStatusReset]);

  // ── Force immediate save ───────────────────────────────
  const saveNow = useCallback(async () => {
    // Clear pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    }

    versionRef.current += 1;
    retryCountRef.current = 0;
    await executeSave(dataRef.current, versionRef.current);
  }, [executeSave]);

  // ── Retry last failed save ─────────────────────────────
  const retry = useCallback(async () => {
    retryCountRef.current = 0;
    versionRef.current += 1;
    await executeSave(dataRef.current, versionRef.current);
  }, [executeSave]);

  // ── Manual state controls ──────────────────────────────
  const markClean = useCallback(() => {
    setIsDirty(false);
    previousDataRef.current = dataRef.current;
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setLastSaved(null);
    setError(null);
    setIsDirty(false);
    retryCountRef.current = 0;
    previousDataRef.current = dataRef.current;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    }
    if (statusResetTimerRef.current) {
      clearTimeout(statusResetTimerRef.current);
      statusResetTimerRef.current = undefined;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = undefined;
    }
  }, [setStatus]);

  // ── Data change detection & debounced save ─────────────
  useEffect(() => {
    // Skip first render — don't save initial data
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      previousDataRef.current = data;
      return;
    }

    // Skip if disabled
    if (!enabled) return;

    // Deep equality check — skip if unchanged
    if (equalityFnRef.current(previousDataRef.current, data)) return;

    // Data changed — mark dirty
    setIsDirty(true);

    // Clear any pending timers
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }

    // Schedule debounced save
    versionRef.current += 1;
    const currentVersion = versionRef.current;
    retryCountRef.current = 0;

    debounceTimerRef.current = setTimeout(() => {
      executeSave(data, currentVersion);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [data, enabled, debounceMs, executeSave]);

  // ── Flush on unmount (fire-and-forget) ─────────────────
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      // Cleanup all timers
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (statusResetTimerRef.current) clearTimeout(statusResetTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

      // Fire-and-forget: if dirty data pending, attempt final save
      // (Google Docs pattern — never lose data on navigation)
      if (debounceTimerRef.current) {
        const finalData = dataRef.current;
        saveFnRef.current(finalData).catch(() => {
          // Silent fail — component already unmounted
        });
      }
    };
  }, []);

  return {
    status,
    lastSaved,
    error,
    isDirty,
    saveNow,
    retry,
    markClean,
    reset,
  };
}
