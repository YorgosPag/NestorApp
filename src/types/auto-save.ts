/**
 * @file auto-save.ts — Centralized Auto-Save Types
 * @module types/auto-save
 *
 * 🏢 ENTERPRISE: ADR-248 — Centralized Auto-Save System
 *
 * Shared types for the auto-save system used across the application.
 * Eliminates 8+ copy-paste boilerplate patterns (~15-25 lines each).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-248-centralized-auto-save.md
 * @created 2026-03-19
 */

// ============================================
// CORE TYPES
// ============================================

/** Auto-save lifecycle status */
export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

/**
 * Configuration for useAutoSave hook
 *
 * @typeParam T - Shape of the data being auto-saved
 *
 * @example
 * ```ts
 * const config: AutoSaveConfig<ProjectFormData> = {
 *   saveFn: (data) => updateProject(projectId, data),
 *   debounceMs: 2000,
 *   enabled: isEditing,
 * };
 * ```
 */
export interface AutoSaveConfig<T> {
  /** Async function that persists the data (e.g. Firestore update) */
  saveFn: (data: T) => Promise<void>;

  /** Debounce delay in ms before triggering save. Default: 2000 */
  debounceMs?: number;

  /**
   * Deep equality check to skip unnecessary saves.
   * Default: JSON.stringify comparison (handles most Firestore form cases).
   * Override for complex objects with cycles or custom comparison logic.
   */
  equalityFn?: (prev: T, next: T) => boolean;

  /** Enable/disable auto-save (e.g. only when editing). Default: true */
  enabled?: boolean;

  /** Max automatic retries on save failure. Default: 2 */
  maxRetries?: number;

  /** How long "Saved" / "Error" status stays before resetting to idle. Default: 3000ms */
  statusResetMs?: number;

  /** Called whenever status changes (useful for parent state sync) */
  onStatusChange?: (status: SaveStatus) => void;

  /** Called on save error with retry count */
  onError?: (error: Error, retryCount: number) => void;

  /** Called on successful save */
  onSuccess?: (data: T, timestamp: Date) => void;
}

/**
 * Return value from useAutoSave hook
 *
 * @typeParam T - Shape of the data being auto-saved
 */
export interface AutoSaveReturn<T> {
  /** Current save lifecycle status */
  status: SaveStatus;

  /** Timestamp of last successful save */
  lastSaved: Date | null;

  /** Error message from last failed save attempt */
  error: string | null;

  /** Whether data has changed since last successful save */
  isDirty: boolean;

  /** Force an immediate save (bypasses debounce timer) */
  saveNow: () => Promise<void>;

  /** Retry the last failed save */
  retry: () => Promise<void>;

  /** Manually mark data as clean (e.g. after external save) */
  markClean: () => void;

  /** Reset all state (status, dirty, error, lastSaved) */
  reset: () => void;
}

// ============================================
// STATUS INDICATOR TYPES
// ============================================

/** Visual variant for the AutoSaveStatusIndicator component */
export type AutoSaveIndicatorVariant = 'inline' | 'badge' | 'compact';

/** Props for AutoSaveStatusIndicator */
export interface AutoSaveStatusIndicatorProps {
  /** Current save status */
  status: SaveStatus;

  /** Timestamp of last successful save */
  lastSaved: Date | null;

  /** Error message to display */
  error?: string | null;

  /** Visual variant */
  variant?: AutoSaveIndicatorVariant;

  /** Show relative timestamp (e.g. "2 min ago") */
  showTimestamp?: boolean;

  /** Retry callback (shown on error state) */
  onRetry?: () => void;

  /** Additional CSS classes */
  className?: string;
}
