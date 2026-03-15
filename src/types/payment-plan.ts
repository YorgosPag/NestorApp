/**
 * =============================================================================
 * Payment Plan & Installment Types — ADR-234
 * =============================================================================
 *
 * Core types for payment plan management, installment tracking, and payment
 * recording in real estate sales.
 *
 * @module types/payment-plan
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import type { Timestamp } from 'firebase/firestore';
import type { LoanTracking, LoanTrackingStatus } from './loan-tracking';

// =============================================================================
// 🏦 PAYMENT PLAN STATUS
// =============================================================================

/**
 * Κατάσταση προγράμματος αποπληρωμής
 *
 * Ροή:
 *   negotiation → draft → active → completed
 *                                → cancelled
 */
export type PaymentPlanStatus =
  | 'negotiation' // Διαπραγμάτευση — ελεύθερη τροποποίηση
  | 'draft'       // Κράτηση — μπορεί να αλλάξει μέχρι προσύμφωνο
  | 'active'      // Κλειδωμένο — προσύμφωνο/οριστικό υπογράφηκε
  | 'completed'   // Ολοκληρωμένο — πλήρης εξόφληση
  | 'cancelled';  // Ακυρωμένο

// =============================================================================
// 🏦 INSTALLMENT (Δόση)
// =============================================================================

/** Κατάσταση μεμονωμένης δόσης */
export type InstallmentStatus =
  | 'pending'     // Αναμένεται (μελλοντική ημερομηνία)
  | 'due'         // Ληξιπρόθεσμη (πέρασε η ημερομηνία, δεν πληρώθηκε)
  | 'paid'        // Πληρωμένη
  | 'partial'     // Μερικώς πληρωμένη
  | 'waived';     // Παραιτήθηκε (π.χ. εμπορική έκπτωση)

/** Τύπος δόσης */
export type InstallmentType =
  | 'reservation'    // Κράτηση (reservation fee)
  | 'down_payment'   // Προκαταβολή (στο προσύμφωνο)
  | 'stage_payment'  // Δόση κατασκευής (milestone-based)
  | 'final_payment'  // Τελική πληρωμή (στο οριστικό συμβόλαιο)
  | 'custom';        // Προσαρμοσμένη δόση

/** Μεμονωμένη δόση στο πρόγραμμα αποπληρωμής */
export interface Installment {
  /** Αύξων αριθμός δόσης (0-based) */
  index: number;

  /** Ετικέτα εμφάνισης (π.χ. "Κράτηση", "Θεμελίωση 30%") */
  label: string;

  /** Τύπος δόσης */
  type: InstallmentType;

  /** Ποσό δόσης (gross, συμπ. ΦΠΑ αν ισχύει) */
  amount: number;

  /** Ποσοστό επί της τελικής τιμής (π.χ. 10 = 10%) */
  percentage: number;

  /** Ημερομηνία λήξης (due date) — ISO string for Firestore compatibility */
  dueDate: string;

  /** Κατάσταση */
  status: InstallmentStatus;

  /** Ποσό που έχει πληρωθεί (για partial payments) */
  paidAmount: number;

  /** Ημερομηνία πληρωμής (αν πληρώθηκε) — ISO string */
  paidDate: string | null;

  /** IDs πληρωμών στο payments subcollection */
  paymentIds: string[];

  /** Σημειώσεις */
  notes: string | null;
}

// =============================================================================
// 🏦 PAYMENT METHOD (Μέσο Πληρωμής)
// =============================================================================

/** Φορολογικό καθεστώς πώλησης */
export type SaleTaxRegime =
  | 'vat_24'              // Νεόδμητο — ΦΠΑ 24%
  | 'vat_suspension_3'    // Νεόδμητο — Αναστολή ΦΠΑ, 3% ΦΜΑ
  | 'transfer_tax_3'      // Μεταχειρισμένο — 3% Φόρος Μεταβίβασης
  | 'custom';             // Custom ποσοστό

/** Μέσο πληρωμής */
export type PaymentMethod =
  | 'bank_transfer'    // Τραπεζική μεταφορά (IBAN)
  | 'bank_cheque'      // Τραπεζική επιταγή
  | 'personal_cheque'  // Προσωπική επιταγή
  | 'bank_loan'        // Εκταμίευση δανείου
  | 'cash'             // Μετρητά
  | 'promissory_note'  // Συναλλαγματική
  | 'offset';          // Συμψηφισμός

// =============================================================================
// 🏦 PAYMENT METHOD DETAILS (Discriminated Union)
// =============================================================================

export interface BankTransferDetails {
  method: 'bank_transfer';
  bankName: string;
  iban: string | null;
  referenceNumber: string | null;
}

export interface ChequeDetails {
  method: 'bank_cheque' | 'personal_cheque';
  chequeNumber: string;
  bankName: string;
  issueDate: string;
  maturityDate: string | null;
  drawerName: string | null;
}

export interface BankLoanDetails {
  method: 'bank_loan';
  bankName: string;
  loanReferenceNumber: string | null;
  disbursementDate: string;
}

export interface CashDetails {
  method: 'cash';
  receiptNumber: string | null;
}

export interface PromissoryNoteDetails {
  method: 'promissory_note';
  noteNumber: string;
  issueDate: string;
  maturityDate: string;
  drawerName: string;
}

export interface OffsetDetails {
  method: 'offset';
  offsetReason: string;
  relatedDocumentId: string | null;
}

/** Λεπτομέρειες ανά μέσο πληρωμής (discriminated union) */
export type PaymentMethodDetails =
  | BankTransferDetails
  | ChequeDetails
  | BankLoanDetails
  | CashDetails
  | PromissoryNoteDetails
  | OffsetDetails;

// =============================================================================
// 🏦 PAYMENT RECORD (Καταγραφή Πληρωμής)
// =============================================================================

/** Μεμονωμένη πληρωμή — subcollection units/{unitId}/payments */
export interface PaymentRecord {
  /** Document ID */
  id: string;

  /** Reference → payment plan */
  paymentPlanId: string;

  /** Index δόσης στην οποία αντιστοιχεί (primary) */
  installmentIndex: number;

  /** Ποσό πληρωμής (gross) */
  amount: number;

  /** Μέσο πληρωμής */
  method: PaymentMethod;

  /** Ημερομηνία πληρωμής — ISO string */
  paymentDate: string;

  /** Στοιχεία μέσου πληρωμής */
  methodDetails: PaymentMethodDetails;

  /** Split allocations (αν η πληρωμή καλύπτει πολλές δόσεις) */
  splitAllocations: SplitAllocation[];

  /** Overpayment amount (> 0 αν υπάρχει περίσσεια) */
  overpaymentAmount: number;

  /** Reference → accounting invoice (ADR-198) */
  invoiceId: string | null;

  /** Reference → transaction chain (ADR-198) */
  transactionChainId: string | null;

  /** Ελεύθερες σημειώσεις */
  notes: string | null;

  /** Audit fields */
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

/** Allocation ανά δόση (split payment) */
export interface SplitAllocation {
  installmentIndex: number;
  amount: number;
}

// =============================================================================
// 🏦 LOAN TRACKING (Παρακολούθηση Δανείου)
// =============================================================================

/** Κατάσταση δανείου */
export type LoanStatus =
  | 'not_applicable'
  | 'pending'
  | 'applied'
  | 'pre_approved'
  | 'approved'
  | 'disbursed'
  | 'rejected';

/** Στοιχεία τραπεζικού δανείου */
export interface LoanInfo {
  status: LoanStatus;
  bankName: string | null;
  loanAmount: number | null;
  financingPercentage: number | null;
  interestRate: number | null;
  termYears: number | null;
  approvalDate: string | null;
  disbursementDate: string | null;
  bankReferenceNumber: string | null;
  notes: string | null;
}

// =============================================================================
// 🏦 PAYMENT PLAN CONFIG
// =============================================================================

/** Configurable settings ανά Payment Plan */
export interface PaymentPlanConfig {
  defaultGracePeriodDays: number;        // Default: 0 (OFF)
  defaultLateFeeType: 'none' | 'fixed_percentage' | 'daily_percentage';
  defaultLateFeeRate: number;            // Default: 0
  defaultLateFeeCapPercentage: number | null;
  sequentialPaymentRequired: boolean;    // Default: true
  allowPartialPayments: boolean;         // Default: true
  allowOverpayments: boolean;            // Default: true
  autoApplyOverpayment: boolean;         // Default: true
  currency: 'EUR';
}

/** Default config — grace/fees OFF, sequential ON */
export const DEFAULT_PAYMENT_PLAN_CONFIG: PaymentPlanConfig = {
  defaultGracePeriodDays: 0,
  defaultLateFeeType: 'none',
  defaultLateFeeRate: 0,
  defaultLateFeeCapPercentage: 10,
  sequentialPaymentRequired: true,
  allowPartialPayments: true,
  allowOverpayments: true,
  autoApplyOverpayment: true,
  currency: 'EUR',
};

// =============================================================================
// 🏦 PAYMENT PLAN (Πρόγραμμα Αποπληρωμής)
// =============================================================================

/** Πρόγραμμα αποπληρωμής — subcollection units/{unitId}/payment_plans */
export interface PaymentPlan {
  id: string;
  unitId: string;
  buildingId: string;
  projectId: string;
  buyerContactId: string;
  buyerName: string;
  status: PaymentPlanStatus;

  // --- Ποσά ---
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currency: 'EUR';

  // --- Δόσεις ---
  installments: Installment[];

  // --- Δάνειο ---
  /** @deprecated Use `loans` array instead (Phase 2 — SPEC-234C) */
  loan: LoanInfo;
  /** Multi-bank loan tracking (Phase 2 — SPEC-234C). Empty = no loan. */
  loans?: LoanTracking[];

  // --- Config ---
  config: PaymentPlanConfig;

  // --- Φορολογικό Καθεστώς ---
  taxRegime: SaleTaxRegime;
  taxRate: number;

  // --- Audit ---
  notes: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

// =============================================================================
// 🏦 PAYMENT SUMMARY (Denormalized στο unit.commercial)
// =============================================================================

/** Σύνοψη πληρωμών — denormalized στο unit.commercial.paymentSummary */
export interface PaymentSummary {
  planStatus: PaymentPlanStatus;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paidPercentage: number;
  totalInstallments: number;
  paidInstallments: number;
  overdueInstallments: number;
  nextInstallmentAmount: number | null;
  nextInstallmentDate: string | null;
  loanStatus: LoanStatus;
  /** Primary loan status (Phase 2 — SPEC-234C) */
  primaryLoanStatus?: LoanTrackingStatus;
  /** Primary loan bank name */
  primaryLoanBank?: string | null;
  /** Total approved loan amount across all loans */
  totalApprovedLoanAmount?: number | null;
  /** Total disbursed amount across all loans */
  totalDisbursedAmount?: number;
  paymentPlanId: string;
}

// =============================================================================
// 🏦 INPUT TYPES (API/Service layer)
// =============================================================================

/** Input για δημιουργία payment plan */
export interface CreatePaymentPlanInput {
  unitId: string;
  buildingId: string;
  projectId: string;
  buyerContactId: string;
  buyerName: string;
  totalAmount: number;
  taxRegime: SaleTaxRegime;
  taxRate: number;
  installments: CreateInstallmentInput[];
  config?: Partial<PaymentPlanConfig>;
  loan?: Partial<LoanInfo>;
  /** Phase 2 — multi-bank loan inputs */
  loans?: import('./loan-tracking').CreateLoanInput[];
  notes?: string;
}

/** Input για δημιουργία installment */
export interface CreateInstallmentInput {
  label: string;
  type: InstallmentType;
  amount: number;
  percentage: number;
  dueDate: string;
  notes?: string;
}

/** Input για ενημέρωση installment */
export interface UpdateInstallmentInput {
  label?: string;
  amount?: number;
  percentage?: number;
  dueDate?: string;
  notes?: string;
}

/** Input για ενημέρωση payment plan */
export interface UpdatePaymentPlanInput {
  notes?: string;
  config?: Partial<PaymentPlanConfig>;
  taxRegime?: SaleTaxRegime;
  taxRate?: number;
}

/** Input για καταγραφή πληρωμής */
export interface CreatePaymentInput {
  paymentPlanId: string;
  installmentIndex: number;
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  methodDetails: PaymentMethodDetails;
  notes?: string;
}

// =============================================================================
// 🏦 TEMPLATE TYPES
// =============================================================================

/** Template slot for wizard */
export interface TemplateSlot {
  type: InstallmentType;
  labelKey: string;
  defaultLabel: string;
  percentage: number;
  amountType: 'percentage' | 'fixed';
  fixedAmount: number | null;
}

/** Payment plan template definition */
export interface PaymentPlanTemplate {
  id: string;
  nameKey: string;
  defaultName: string;
  descriptionKey: string;
  defaultDescription: string;
  slots: TemplateSlot[];
  defaultConfig: PaymentPlanConfig;
}

// =============================================================================
// 🏦 FSM HELPERS
// =============================================================================

/** Valid status transitions */
const VALID_PLAN_TRANSITIONS: Record<PaymentPlanStatus, PaymentPlanStatus[]> = {
  negotiation: ['draft', 'cancelled'],
  draft: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/** Check if transition is valid */
export function isValidPlanTransition(
  from: PaymentPlanStatus,
  to: PaymentPlanStatus
): boolean {
  return VALID_PLAN_TRANSITIONS[from].includes(to);
}

/** Default loan info (no loan) */
export const DEFAULT_LOAN_INFO: LoanInfo = {
  status: 'not_applicable',
  bankName: null,
  loanAmount: null,
  financingPercentage: null,
  interestRate: null,
  termYears: null,
  approvalDate: null,
  disbursementDate: null,
  bankReferenceNumber: null,
  notes: null,
};
