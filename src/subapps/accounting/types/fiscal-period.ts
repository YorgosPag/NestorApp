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
 * Firestore path: `accounting_fiscal_periods/{generateDeterministicFiscalPeriodId(companyId, periodId)}` — ΜΙΑ
 * περίοδος ανά (μισθωτής, κλειδί), όπως οι posting periods του SAP ανά company code (ADR-ACC-010 §2.1.1 Φάση 6).
 */
export interface FiscalPeriod {
  /** Το κλειδί της περιόδου ΜΕΣΑ στον μισθωτή ('2026-01', '2026-13') — ΟΧΙ το id του εγγράφου. */
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

  // — Tenant Isolation (Q3/Q7) —
  /** Ο μισθωτής — το γράφει ΜΟΝΟ ο γραφέας (`createFiscalPeriods`), από το `TenantContext`. */
  companyId: string;

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

/** Περίοδος πριν γραφτεί — τον μισθωτή τον βάζει ο γραφέας, ποτέ ο καλών. */
export type FiscalPeriodDraft = Omit<FiscalPeriod, 'companyId'>;

// ============================================================================
// STATE TRANSITIONS (Q5/Q7 — η απόφαση τρέχει ΜΕΣΑ στη συναλλαγή)
// ============================================================================

/** Τι ζητά ο χρήστης: OPEN→CLOSED · CLOSED→LOCKED · CLOSED→OPEN. */
export type FiscalPeriodAction = 'close' | 'lock' | 'reopen';

/** Το γεγονός ίχνους κάθε επιτρεπτής μετάβασης. */
export type FiscalPeriodTransitionEvent = 'PERIOD_CLOSED' | 'PERIOD_LOCKED' | 'PERIOD_REOPENED';

/** Ένα αίτημα μετάβασης — `reason` υποχρεωτικό μόνο στο `reopen` (το επιβάλλει το route). */
export interface FiscalPeriodTransitionRequest {
  readonly action: FiscalPeriodAction;
  readonly userId: string;
  readonly reason: string | null;
}

/** Η απόφαση πάνω στη ΦΡΕΣΚΙΑ περίοδο: εφαρμογή (με γεγονός ίχνους) ή άρνηση. */
export type FiscalPeriodTransitionDecision =
  | {
      readonly kind: 'apply';
      readonly to: FiscalPeriodStatus;
      readonly updates: Partial<FiscalPeriod>;
      readonly event: FiscalPeriodTransitionEvent;
    }
  | { readonly kind: 'refused' };

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
