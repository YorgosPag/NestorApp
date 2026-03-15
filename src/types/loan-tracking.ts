/**
 * =============================================================================
 * Loan Tracking Types — ADR-234 Phase 2 (SPEC-234C)
 * =============================================================================
 *
 * Full loan tracking: multi-bank support, 15-stage FSM, phased disbursement,
 * bank communication log, LTV/DSTI indicators, collateral tracking.
 *
 * @module types/loan-tracking
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import type { LoanInfo, LoanStatus } from './payment-plan';

// =============================================================================
// 🏦 LOAN TRACKING STATUS — 15-stage FSM
// =============================================================================

/**
 * Extended loan status — 15 stages reflecting Greek banking practice.
 *
 * Flow: not_applicable → exploring → applied → pre_approved → appraisal_pending →
 *       appraisal_completed → legal_review → approved → collateral_pending →
 *       collateral_registered → disbursement_pending → partially_disbursed →
 *       fully_disbursed
 *
 * Exit from ANY state: → rejected | cancelled
 */
export type LoanTrackingStatus =
  | 'not_applicable'
  | 'exploring'
  | 'applied'
  | 'pre_approved'
  | 'appraisal_pending'
  | 'appraisal_completed'
  | 'legal_review'
  | 'approved'
  | 'collateral_pending'
  | 'collateral_registered'
  | 'disbursement_pending'
  | 'partially_disbursed'
  | 'fully_disbursed'
  | 'rejected'
  | 'cancelled';

// =============================================================================
// 🏦 SUPPORTING ENUMS
// =============================================================================

/** Τύπος εκταμίευσης */
export type DisbursementType = 'lump_sum' | 'phased';

/** Τύπος εγγύησης */
export type CollateralType = 'mortgage' | 'pre_notation' | 'personal_guarantee' | 'other';

/** Τύπος επιτοκίου */
export type InterestRateType = 'fixed' | 'variable' | 'mixed';

/** Τύπος εγγραφής επικοινωνίας */
export type CommunicationEntryType = 'phone' | 'email' | 'meeting' | 'document' | 'note';

/** Κατάσταση εκταμίευσης */
export type DisbursementStatus = 'pending' | 'requested' | 'approved' | 'disbursed';

// =============================================================================
// 🏦 LOAN TRACKING INTERFACE
// =============================================================================

/**
 * Full Loan Tracking — replaces the simple LoanInfo.
 * Embedded in PaymentPlan.loans[] (array — supports multi-bank).
 */
export interface LoanTracking {
  /** Internal ID */
  loanId: string;

  /** Primary or Secondary loan */
  isPrimary: boolean;

  /** Current status (15-stage FSM) */
  status: LoanTrackingStatus;

  // --- Bank Info ---
  bankName: string;
  bankBranch: string | null;
  bankReferenceNumber: string | null;
  bankContactPerson: string | null;
  bankContactPhone: string | null;

  // --- Amounts ---
  requestedAmount: number | null;
  approvedAmount: number | null;
  disbursedAmount: number;
  remainingDisbursement: number;

  // --- Financial Terms ---
  ltvPercentage: number | null;
  interestRate: number | null;
  interestRateType: InterestRateType | null;
  termYears: number | null;
  monthlyPayment: number | null;
  dstiRatio: number | null;
  bankFees: number | null;

  // --- Disbursement ---
  disbursementType: DisbursementType;
  disbursements: DisbursementEntry[];

  // --- Collateral ---
  collateralType: CollateralType | null;
  collateralAmount: number | null;
  collateralRegistrationNumber: string | null;
  collateralRegistrationDate: string | null;

  // --- Appraisal ---
  appraisalValue: number | null;
  appraisalDate: string | null;
  appraiserName: string | null;

  // --- Key Dates (ISO strings) ---
  applicationDate: string | null;
  preApprovalDate: string | null;
  approvalDate: string | null;
  firstDisbursementDate: string | null;
  fullDisbursementDate: string | null;
  preApprovalExpiryDate: string | null;

  // --- Communication Log ---
  communicationLog: BankCommunicationEntry[];

  // --- Notes ---
  notes: string | null;

  // --- Audit ---
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// 🏦 DISBURSEMENT ENTRY
// =============================================================================

/** Single disbursement record (for phased disbursement) */
export interface DisbursementEntry {
  /** Order (1, 2, 3...) */
  order: number;

  /** Disbursement amount */
  amount: number;

  /** Milestone label (e.g. "Θεμελίωση", "Σκελετός") */
  milestone: string;

  /** Disbursement date (ISO string) */
  disbursementDate: string | null;

  /** Status */
  status: DisbursementStatus;

  /** Payment method */
  paymentMethod: 'crossed_cheque' | 'wire_transfer' | null;

  /** Reference → PaymentRecord (if created) */
  paymentId: string | null;

  /** Notes */
  notes: string | null;
}

// =============================================================================
// 🏦 BANK COMMUNICATION ENTRY
// =============================================================================

/** Structured bank communication log entry */
export interface BankCommunicationEntry {
  /** Date (ISO string) */
  date: string;

  /** Type of communication */
  type: CommunicationEntryType;

  /** Short summary */
  summary: string;

  /** Contact person */
  contactPerson: string | null;

  /** Expected next action */
  nextAction: string | null;

  /** Next action deadline (ISO string) */
  nextActionDate: string | null;
}

// =============================================================================
// 🏦 FSM — VALID TRANSITIONS
// =============================================================================

/**
 * Valid loan status transitions.
 * "rejected" and "cancelled" are reachable from ANY state.
 */
const VALID_LOAN_TRANSITIONS: Record<LoanTrackingStatus, LoanTrackingStatus[]> = {
  not_applicable: ['exploring'],
  exploring: ['applied', 'rejected', 'cancelled'],
  applied: ['pre_approved', 'rejected', 'cancelled'],
  pre_approved: ['appraisal_pending', 'applied', 'rejected', 'cancelled'],
  appraisal_pending: ['appraisal_completed', 'rejected', 'cancelled'],
  appraisal_completed: ['legal_review', 'rejected', 'cancelled'],
  legal_review: ['approved', 'rejected', 'cancelled'],
  approved: ['collateral_pending', 'disbursement_pending', 'rejected', 'cancelled'],
  collateral_pending: ['collateral_registered', 'rejected', 'cancelled'],
  collateral_registered: ['disbursement_pending', 'rejected', 'cancelled'],
  disbursement_pending: ['partially_disbursed', 'fully_disbursed', 'rejected', 'cancelled'],
  partially_disbursed: ['fully_disbursed', 'cancelled'],
  fully_disbursed: [],
  rejected: [],
  cancelled: [],
};

/** Check if a loan status transition is valid */
export function isValidLoanTransition(
  from: LoanTrackingStatus,
  to: LoanTrackingStatus
): boolean {
  return VALID_LOAN_TRANSITIONS[from].includes(to);
}

/** Get valid next statuses for a given status */
export function getValidNextStatuses(status: LoanTrackingStatus): LoanTrackingStatus[] {
  return VALID_LOAN_TRANSITIONS[status];
}

/**
 * Ordered list of statuses for timeline display.
 * Terminal states (rejected, cancelled) excluded.
 */
export const LOAN_STATUS_ORDER: LoanTrackingStatus[] = [
  'not_applicable',
  'exploring',
  'applied',
  'pre_approved',
  'appraisal_pending',
  'appraisal_completed',
  'legal_review',
  'approved',
  'collateral_pending',
  'collateral_registered',
  'disbursement_pending',
  'partially_disbursed',
  'fully_disbursed',
];

// =============================================================================
// 🏦 INPUT TYPES
// =============================================================================

/** Input for creating a new loan */
export interface CreateLoanInput {
  bankName: string;
  isPrimary?: boolean;
  requestedAmount?: number;
  disbursementType?: DisbursementType;
  interestRateType?: InterestRateType;
  notes?: string;
}

/** Input for updating a loan */
export interface UpdateLoanInput {
  bankName?: string;
  bankBranch?: string;
  bankReferenceNumber?: string;
  bankContactPerson?: string;
  bankContactPhone?: string;
  requestedAmount?: number;
  approvedAmount?: number;
  ltvPercentage?: number;
  interestRate?: number;
  interestRateType?: InterestRateType;
  termYears?: number;
  monthlyPayment?: number;
  dstiRatio?: number;
  bankFees?: number;
  disbursementType?: DisbursementType;
  collateralType?: CollateralType;
  collateralAmount?: number;
  collateralRegistrationNumber?: string;
  collateralRegistrationDate?: string;
  appraisalValue?: number;
  appraisalDate?: string;
  appraiserName?: string;
  preApprovalExpiryDate?: string;
  notes?: string;
}

/** Input for transitioning loan status */
export interface LoanTransitionInput {
  targetStatus: LoanTrackingStatus;
  notes?: string;
}

/** Input for recording a disbursement */
export interface RecordDisbursementInput {
  amount: number;
  milestone: string;
  disbursementDate: string;
  paymentMethod?: 'crossed_cheque' | 'wire_transfer';
  installmentIndex?: number;
  notes?: string;
}

/** Input for adding a communication log entry */
export interface AddCommunicationLogInput {
  type: CommunicationEntryType;
  summary: string;
  contactPerson?: string;
  nextAction?: string;
  nextActionDate?: string;
}

// =============================================================================
// 🏦 FACTORY
// =============================================================================

/** Create a default LoanTracking with sensible defaults */
export function createDefaultLoanTracking(
  loanId: string,
  bankName: string,
  isPrimary: boolean = true,
  disbursementType: DisbursementType = 'lump_sum'
): LoanTracking {
  const now = new Date().toISOString();
  return {
    loanId,
    isPrimary,
    status: 'exploring',
    bankName,
    bankBranch: null,
    bankReferenceNumber: null,
    bankContactPerson: null,
    bankContactPhone: null,
    requestedAmount: null,
    approvedAmount: null,
    disbursedAmount: 0,
    remainingDisbursement: 0,
    ltvPercentage: null,
    interestRate: null,
    interestRateType: null,
    termYears: null,
    monthlyPayment: null,
    dstiRatio: null,
    bankFees: null,
    disbursementType,
    disbursements: [],
    collateralType: null,
    collateralAmount: null,
    collateralRegistrationNumber: null,
    collateralRegistrationDate: null,
    appraisalValue: null,
    appraisalDate: null,
    appraiserName: null,
    applicationDate: null,
    preApprovalDate: null,
    approvalDate: null,
    firstDisbursementDate: null,
    fullDisbursementDate: null,
    preApprovalExpiryDate: null,
    communicationLog: [],
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
}

// =============================================================================
// 🏦 PURE FUNCTIONS — LTV Compliance
// =============================================================================

/**
 * Calculate LTV (Loan-to-Value) ratio.
 * Returns null if data insufficient.
 */
export function calculateLTV(
  approvedAmount: number | null,
  appraisalValue: number | null
): number | null {
  if (!approvedAmount || !appraisalValue || appraisalValue <= 0) return null;
  return Math.round((approvedAmount / appraisalValue) * 10000) / 100;
}

/** LTV compliance level */
export type LtvComplianceLevel = 'ok' | 'warning' | 'exceeded';

/**
 * Get LTV compliance level based on Greek banking guidelines.
 * @param ltv - LTV percentage
 * @param isFirstTimeBuyer - First-time buyer gets 90%, others 80%
 */
export function getLtvComplianceLevel(
  ltv: number | null,
  isFirstTimeBuyer: boolean = false
): LtvComplianceLevel {
  if (ltv === null) return 'ok';
  const limit = isFirstTimeBuyer ? 90 : 80;
  if (ltv > limit) return 'exceeded';
  if (ltv > limit - 5) return 'warning';
  return 'ok';
}

// =============================================================================
// 🏦 MIGRATION — LoanInfo → LoanTracking
// =============================================================================

/**
 * Maps old LoanStatus (7 values) → new LoanTrackingStatus (15 values).
 */
const LOAN_STATUS_MIGRATION_MAP: Record<LoanStatus, LoanTrackingStatus> = {
  not_applicable: 'not_applicable',
  pending: 'exploring',
  applied: 'applied',
  pre_approved: 'pre_approved',
  approved: 'approved',
  disbursed: 'fully_disbursed',
  rejected: 'rejected',
};

/**
 * Migrate old LoanInfo (Phase 1) → LoanTracking (Phase 2).
 * Used for backward compatibility when reading Firestore docs with `loan: LoanInfo`.
 */
export function migrateLoanInfoToTracking(
  oldLoan: LoanInfo,
  loanId: string = 'migrated_loan'
): LoanTracking {
  const now = new Date().toISOString();
  return {
    loanId,
    isPrimary: true,
    status: LOAN_STATUS_MIGRATION_MAP[oldLoan.status],
    bankName: oldLoan.bankName ?? '',
    bankBranch: null,
    bankReferenceNumber: oldLoan.bankReferenceNumber ?? null,
    bankContactPerson: null,
    bankContactPhone: null,
    requestedAmount: oldLoan.loanAmount,
    approvedAmount: oldLoan.status === 'approved' || oldLoan.status === 'disbursed'
      ? oldLoan.loanAmount
      : null,
    disbursedAmount: oldLoan.status === 'disbursed' && oldLoan.loanAmount
      ? oldLoan.loanAmount
      : 0,
    remainingDisbursement: 0,
    ltvPercentage: oldLoan.financingPercentage,
    interestRate: oldLoan.interestRate,
    interestRateType: null,
    termYears: oldLoan.termYears,
    monthlyPayment: null,
    dstiRatio: null,
    bankFees: null,
    disbursementType: 'lump_sum',
    disbursements: [],
    collateralType: null,
    collateralAmount: null,
    collateralRegistrationNumber: null,
    collateralRegistrationDate: null,
    appraisalValue: null,
    appraisalDate: null,
    appraiserName: null,
    applicationDate: null,
    preApprovalDate: null,
    approvalDate: oldLoan.approvalDate,
    firstDisbursementDate: oldLoan.disbursementDate,
    fullDisbursementDate: oldLoan.disbursementDate,
    preApprovalExpiryDate: null,
    communicationLog: [],
    notes: oldLoan.notes,
    createdAt: now,
    updatedAt: now,
  };
}
