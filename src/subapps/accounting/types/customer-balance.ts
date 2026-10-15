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
 *
 * 🔑 Σημασιολογία (ADR-ACC-010 §2.1.1 Φάση 3, 2026-10-15): **ανοιχτά στοιχεία όλων των χρήσεων σε ημερομηνία
 * αναφοράς** (`asOf`) — SAP FI-AR open items / Xero & QuickBooks aged receivables. ΟΧΙ ανά χρήση: ένα απλήρωτο
 * τιμολόγιο του Δεκεμβρίου οφείλεται και τον Ιανουάριο. Ταυτότητα: Σ `aging` = `netBalance`.
 */
export interface CustomerBalance {
  /** Firestore contact ID */
  customerId: string;
  /** Denormalized customer name */
  customerName: string;

  // — Aggregated Totals —
  /** Σύνολο εκδοθέντων τιμολογίων ως το `asOf` (χωρίς ακυρωμένα) */
  totalInvoiced: number;
  /** Σύνολο πληρωμών ως το `asOf` */
  totalPaid: number;
  /** Σύνολο πιστωτικών ως το `asOf`, καθαρό από επιστροφές χρημάτων */
  totalCreditNotes: number;
  /** Καθαρό υπόλοιπο = Σ ανοιχτών στοιχείων (= totalInvoiced − totalPaid − totalCreditNotes) */
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

  // — Tenant Isolation (Q3/Q7) —
  /** Company ID for tenant isolation */
  companyId?: string;

  // — Metadata —
  /** Ημερομηνία αναφοράς (`YYYY-MM-DD`, ημέρα Αθήνας) στην οποία ισχύουν τα ποσά */
  asOf: string;
  /** Timestamp ενημέρωσης (ISO 8601) */
  updatedAt: string;
}

/** Η θέση απαιτήσεων ενός πελάτη, όπως βγαίνει από τα πρωτογενή παραστατικά (χωρίς ρυθμίσεις πίστωσης). */
export type ReceivablesPosition = Pick<
  CustomerBalance,
  | 'customerId' | 'customerName' | 'totalInvoiced' | 'totalPaid' | 'totalCreditNotes' | 'netBalance'
  | 'overdueBalance' | 'aging' | 'disputedBalance' | 'lastInvoiceDate' | 'lastPaymentDate' | 'invoiceCount' | 'asOf'
>;

// ============================================================================
// INVOICE LEDGER SCAN (ADR-ACC-010 §2.1.1 — Φάση 3)
// ============================================================================

/**
 * Εμβέλεια πλήρους σάρωσης τιμολογίων για ΥΠΟΛΟΓΙΣΜΟ απαιτήσεων: όλα τα παραστατικά που εκδόθηκαν ως και το
 * `asOf` — ενός πελάτη ή όλης της εταιρείας. Χωρίς `fiscalYear`: οι απαιτήσεις είναι διαχρονικές.
 */
export type InvoiceLedgerScope =
  | { readonly kind: 'customer'; readonly customerId: string; readonly asOf: string }
  | { readonly kind: 'receivables'; readonly asOf: string };

/** Ερώτημα σάρωσης τιμολογίων — χωρίς `pageSize`, ώστε το κόψιμο να είναι αδύνατο από τον τύπο. */
export interface InvoiceLedgerQuery {
  readonly scope: InvoiceLedgerScope;
}

// ============================================================================
// CREDIT CHECK RESULT
// ============================================================================

/** Αποτέλεσμα ελέγχου πιστωτικού ορίου — δομημένο· το κείμενο το αποδίδει ο παραλήπτης (N.11). */
export interface CreditCheckResult {
  /** Επιτρέπεται η έκδοση; */
  allowed: boolean;
  /** `true` όταν η έκθεση μετά την έκδοση ξεπερνά το όριο (μπλοκ σε `auto`, προειδοποίηση σε `manual`) */
  exceedsLimit: boolean;
  /** Τρέχουσα έκθεση (ανοιχτές απαιτήσεις όλων των χρήσεων) */
  exposure: number;
  /** Έκθεση μετά το νέο παραστατικό */
  projectedExposure: number;
  /** Διαθέσιμη πίστωση (creditLimit - exposure) */
  availableCredit: number | null;
}
