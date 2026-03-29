/**
 * @fileoverview Accounting Subapp — Fiscal Period Types (Phase 1b)
 * @description 3-state period management: OPEN → CLOSED → LOCKED (Entersoft/SAP)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-29
 * @see DECISIONS-PHASE-1b.md Q5-Q8
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

// ============================================================================
// FISCAL PERIOD STATUS (Q5 — Greek legislation + Entersoft pattern)
// ============================================================================

/**
 * Κατάσταση λογιστικής περιόδου
 *
 * OPEN   → Δέχεται εγγραφές κανονικά
 * CLOSED → Μπλοκ μετά υποβολή ΦΠΑ (reversible, admin ξανανοίγει)
 * LOCKED → Permanent μετά φορολογική δήλωση (Ε3/Ε1)
 */
export type FiscalPeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED';

// ============================================================================
// FISCAL PERIOD (Q6 — Monthly + Period 13 adjustment)
// ============================================================================

/**
 * Λογιστική περίοδος
 *
 * 12 μηνιαίες + 1 adjustment period (Period 13).
 * Period 13 μοιράζεται ημερομηνίες Δεκεμβρίου (manual assignment).
 *
 * Firestore path: `accounting_fiscal_periods/{periodId}`
 */
export interface FiscalPeriod {
  /** Μοναδικό ID (format: '2026-01', '2026-13') */
  periodId: string;
  /** Φορολογικό έτος */
  fiscalYear: number;
  /** Αριθμός περιόδου (1-13) */
  periodNumber: number;
  /** Ετικέτα UI (π.χ. 'Ιανουάριος 2026', 'Περίοδος Κλεισίματος 2026') */
  label: string;
  /** Ημερομηνία έναρξης (ISO 8601) */
  startDate: string;
  /** Ημερομηνία λήξης (ISO 8601) */
  endDate: string;
  /** Κατάσταση */
  status: FiscalPeriodStatus;

  // — Close audit trail —
  /** Πότε κλείστηκε (ISO 8601) */
  closedAt: string | null;
  /** Ποιος έκλεισε (user ID) */
  closedBy: string | null;

  // — Lock audit trail —
  /** Πότε κλειδώθηκε (ISO 8601) */
  lockedAt: string | null;
  /** Ποιος κλείδωσε (user ID) */
  lockedBy: string | null;

  // — Reopen audit trail (CLOSED → OPEN only) —
  /** Πότε ξανάνοιξε τελευταία φορά (ISO 8601) */
  reopenedAt: string | null;
  /** Ποιος ξανάνοιξε */
  reopenedBy: string | null;
  /** Λόγος reopening */
  reopenReason: string | null;

  // — Timestamps —
  /** Timestamp δημιουργίας (ISO 8601) */
  createdAt: string;
  /** Timestamp τελευταίας ενημέρωσης (ISO 8601) */
  updatedAt: string;
}

// ============================================================================
// YEAR-END CHECKLIST (Q8 — Entersoft pattern)
// ============================================================================

/** Βήμα checklist κλεισίματος χρήσης */
export interface YearEndChecklistStep {
  /** Αριθμός βήματος (1-6) */
  step: number;
  /** Περιγραφή */
  label: string;
  /** Ολοκληρώθηκε; */
  completed: boolean;
  /** Πότε ολοκληρώθηκε */
  completedAt: string | null;
}

/** Checklist κλεισίματος χρήσης */
export interface YearEndChecklist {
  /** Φορολογικό έτος */
  fiscalYear: number;
  /** 6 βήματα */
  steps: YearEndChecklistStep[];
  /** Όλα ολοκληρωμένα; */
  allComplete: boolean;
}

// ============================================================================
// POSTING VALIDATION RESULT
// ============================================================================

/** Αποτέλεσμα ελέγχου αν επιτρέπεται καταχώρηση */
export interface PostingValidationResult {
  /** Επιτρέπεται; */
  allowed: boolean;
  /** Λόγος απόρριψης (αν δεν επιτρέπεται) */
  reason: string | null;
  /** ID περιόδου που αφορά */
  periodId: string | null;
  /** Κατάσταση περιόδου */
  periodStatus: FiscalPeriodStatus | null;
}
