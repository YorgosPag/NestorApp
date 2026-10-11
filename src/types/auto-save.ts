/**
 * @file auto-save.ts — Centralized Auto-Save Types
 * @module types/auto-save
 *
 * 🏢 ENTERPRISE: ADR-248 — Centralized Auto-Save System
 *
 * Κοινό λεξιλόγιο κατάστασης αποθήκευσης + τα props της ένδειξης. Το hook `useAutoSave` καταργήθηκε (ADR-248 §2.5).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-248-centralized-auto-save.md
 * @created 2026-03-19
 */

// ============================================
// CORE TYPES
// ============================================

/** Save lifecycle status */
export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

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
