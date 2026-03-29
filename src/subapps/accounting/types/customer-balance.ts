/**
 * @fileoverview Accounting Subapp — Customer Balance Types (Phase 1b)
 * @description Hybrid stored balance + reconciliation pattern (SAP B1/NetSuite)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-29
 * @see DECISIONS-PHASE-1b.md Q1-Q4
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

// ============================================================================
// AGING BUCKETS (Q2 — SAP S/4HANA 6-bucket enterprise standard)
// ============================================================================

/**
 * AR Aging buckets — 6 standard intervals (SAP S/4HANA pattern)
 * Hardcoded, not configurable.
 */
export interface AgingBuckets {
  /** Τρέχοντα (εντός πίστωσης) */
  current: number;
  /** 1-30 ημέρες */
  days1_30: number;
  /** 31-60 ημέρες */
  days31_60: number;
  /** 61-90 ημέρες */
  days61_90: number;
  /** 91-120 ημέρες */
  days91_120: number;
  /** 120+ ημέρες */
  days120plus: number;
}

// ============================================================================
// CREDIT MANAGEMENT (Q3 — SAP/NetSuite pattern)
// ============================================================================

/** Κανόνας αυτόματου credit hold */
export type CreditHoldRule = 'auto' | 'manual' | 'off';

/** Κατηγοριοποίηση πιστωτικού κινδύνου */
export type RiskClass = 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// CUSTOMER BALANCE (Q1 — Hybrid stored + reconciliation)
// ============================================================================

/**
 * Stored customer balance — denormalized aggregate
 *
 * Firestore path: `accounting_customer_balances/{customerId}`
 *
 * Updated event-driven on invoice/payment/credit note changes.
 * Periodically reconciled from source documents.
 */
export interface CustomerBalance {
  /** Firestore contact ID */
  customerId: string;
  /** Denormalized customer name */
  customerName: string;

  // — Aggregated Totals —
  /** Σύνολο εκδοθέντων τιμολογίων */
  totalInvoiced: number;
  /** Σύνολο πληρωμών */
  totalPaid: number;
  /** Σύνολο πιστωτικών */
  totalCreditNotes: number;
  /** Καθαρό υπόλοιπο (totalInvoiced - totalPaid - totalCreditNotes) */
  netBalance: number;
  /** Ληξιπρόθεσμο υπόλοιπο */
  overdueBalance: number;

  // — AR Aging (Q2) —
  /** Aging analysis σε 6 buckets */
  aging: AgingBuckets;

  // — Dispute (Q4) —
  /** Σύνολο αμφισβητούμενων τιμολογίων */
  disputedBalance: number;

  // — Credit Management (Q3) —
  /** Πιστωτικό όριο (null = απεριόριστο) */
  creditLimit: number | null;
  /** Κανόνας credit hold */
  creditHoldRule: CreditHoldRule;
  /** Ενεργό credit hold */
  creditHoldActive: boolean;
  /** Κατηγορία κινδύνου */
  riskClass: RiskClass;
  /** Ημερομηνία επόμενης αξιολόγησης (ISO 8601, null = χωρίς) */
  nextReviewDate: string | null;

  // — Statistics —
  /** Ημερομηνία τελευταίου τιμολογίου */
  lastInvoiceDate: string | null;
  /** Ημερομηνία τελευταίας πληρωμής */
  lastPaymentDate: string | null;
  /** Πλήθος ανοιχτών τιμολογίων */
  invoiceCount: number;

  // — Metadata —
  /** Φορολογικό έτος */
  fiscalYear: number;
  /** Timestamp ενημέρωσης (ISO 8601) */
  updatedAt: string;
}

// ============================================================================
// CREDIT CHECK RESULT
// ============================================================================

/** Αποτέλεσμα ελέγχου πιστωτικού ορίου */
export interface CreditCheckResult {
  /** Επιτρέπεται η έκδοση; */
  allowed: boolean;
  /** Μήνυμα warning (ακόμα κι αν allowed) */
  warning: string | null;
  /** Τρέχουσα έκθεση (current AR balance) */
  exposure: number;
  /** Διαθέσιμη πίστωση (creditLimit - netBalance) */
  availableCredit: number | null;
}
