/**
 * @file useAutosave — Project auto-save hook (ADR-248 wrapper)
 * @module components/projects/general-tab/hooks/useAutosave
 *
 * 🏢 ENTERPRISE: ADR-248 — Wraps centralized useAutoSave for backward compatibility.
 *
 * Previously this hook was BROKEN — it only showed a fake "saving..." animation
 * without actually persisting to Firestore. Now it uses the centralized
 * useAutoSave hook for actual debounced auto-save.
 *
 * @see src/hooks/useAutoSave.ts (centralized hook)
 * @see src/types/auto-save.ts
 * @created 2026-03-19 (rewritten from broken stub)
 */

'use client';

import { useAutoSave } from '@/hooks/useAutoSave';
import type { SaveStatus } from '@/types/auto-save';

interface UseAutosaveOptions<T> {
  /** Async function that persists data to Firestore */
  saveFn: (data: T) => Promise<void>;
  /** Debounce delay in ms. Default: 2000 */
  debounceMs?: number;
}

interface UseAutosaveReturn {
  /** Whether save is in progress */
  autoSaving: boolean;
  /** Timestamp of last successful save */
  lastSaved: Date | null;
  /** Current save status (for AutoSaveStatusIndicator) */
  status: SaveStatus;
  /** Error message from last failed save */
  error: string | null;
  /** Force immediate save */
  saveNow: () => Promise<void>;
  /** Retry last failed save */
  retry: () => Promise<void>;
}

/**
 * Project auto-save hook with actual Firestore persistence.
 *
 * @param data - Current form data state
 * @param isEditing - Only auto-save while editing
 * @param options - Save function and optional config
 *
 * @example
 * ```tsx
 * const { autoSaving, lastSaved, status } = useAutosave(projectData, isEditing, {
 *   saveFn: (data) => updateProject(projectId, data),
 * });
 * ```
 */
export function useAutosave<T>(
  data: T,
  isEditing: boolean,
  options: UseAutosaveOptions<T>
): UseAutosaveReturn {
  const { saveFn, debounceMs } = options;

  const {
    status,
    lastSaved,
    error,
    saveNow,
    retry,
  } = useAutoSave(data, {
    saveFn,
    enabled: isEditing,
    debounceMs,
  });

  return {
    autoSaving: status === 'saving',
    lastSaved,
    status,
    error,
    saveNow,
    retry,
  };
}
