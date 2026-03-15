/**
 * =============================================================================
 * LoanTrackingService — Multi-bank Loan Tracking (ADR-234 Phase 2)
 * =============================================================================
 *
 * Full loan lifecycle management: CRUD, FSM transitions, phased disbursement
 * with auto PaymentRecord creation, and bank communication log.
 *
 * Uses Admin SDK — called exclusively from API routes.
 *
 * @module services/loan-tracking.service
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { generateLoanId, generatePaymentRecordId } from '@/services/enterprise-id.service';
import { PaymentPlanService } from '@/services/payment-plan.service';
import type { PaymentPlan, PaymentRecord } from '@/types/payment-plan';
import type {
  LoanTracking,
  LoanTrackingStatus,
  DisbursementEntry,
  BankCommunicationEntry,
  CreateLoanInput,
  UpdateLoanInput,
  LoanTransitionInput,
  RecordDisbursementInput,
  AddCommunicationLogInput,
} from '@/types/loan-tracking';
import {
  createDefaultLoanTracking,
  isValidLoanTransition,
  migrateLoanInfoToTracking,
} from '@/types/loan-tracking';

const logger = createModuleLogger('LoanTrackingService');

// ============================================================================
// HELPERS
// ============================================================================

function getDb() {
  const db = getAdminFirestore();
  if (!db) throw new Error('Admin Firestore unavailable');
  return db;
}

function planCollectionPath(unitId: string): string {
  return `${COLLECTIONS.UNITS}/${unitId}/${SUBCOLLECTIONS.UNIT_PAYMENT_PLANS}`;
}

function paymentCollectionPath(unitId: string): string {
  return `${COLLECTIONS.UNITS}/${unitId}/${SUBCOLLECTIONS.UNIT_PAYMENTS}`;
}

/** Read loans from plan, with migration fallback for old `loan` field */
function resolveLoans(plan: PaymentPlan): LoanTracking[] {
  if (plan.loans && plan.loans.length > 0) {
    return plan.loans;
  }
  // Migration fallback: old `loan` field → wrap as loans[0]
  if (plan.loan && plan.loan.status !== 'not_applicable') {
    return [migrateLoanInfoToTracking(plan.loan, 'migrated_loan')];
  }
  return [];
}

// ============================================================================
// MAX LOANS
// ============================================================================

const MAX_LOANS_PER_PLAN = 3;

// ============================================================================
// LOAN TRACKING SERVICE
// ============================================================================

interface ServiceResult {
  success: boolean;
  error?: string;
}

interface LoanResult extends ServiceResult {
  loan?: LoanTracking;
}

interface LoansResult extends ServiceResult {
  loans?: LoanTracking[];
}

export class LoanTrackingService {

  // ==========================================================================
  // READ
  // ==========================================================================

  /** Get all loans for a payment plan */
  static async getLoans(
    unitId: string,
    planId: string
  ): Promise<LoansResult> {
    try {
      const plan = await PaymentPlanService.getPaymentPlan(unitId, planId);
      if (!plan) return { success: false, error: 'Payment plan not found' };

      const loans = resolveLoans(plan);
      return { success: true, loans };
    } catch (error) {
      logger.error('[LoanTrackingService] Failed to get loans:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /** Get a single loan by ID */
  static async getLoan(
    unitId: string,
    planId: string,
    loanId: string
  ): Promise<LoanResult> {
    try {
      const plan = await PaymentPlanService.getPaymentPlan(unitId, planId);
      if (!plan) return { success: false, error: 'Payment plan not found' };

      const loans = resolveLoans(plan);
      const loan = loans.find(l => l.loanId === loanId);
      if (!loan) return { success: false, error: `Loan ${loanId} not found` };

      return { success: true, loan };
    } catch (error) {
      logger.error('[LoanTrackingService] Failed to get loan:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ==========================================================================
  // CREATE
  // ==========================================================================

  /** Add a new loan to the payment plan */
  static async addLoan(
    unitId: string,
    planId: string,
    input: CreateLoanInput,
    createdBy: string
  ): Promise<LoanResult> {
    try {
      const plan = await PaymentPlanService.getPaymentPlan(unitId, planId);
      if (!plan) return { success: false, error: 'Payment plan not found' };

      const loans = resolveLoans(plan);

      // V-LOAN-008: Max 3 loans
      if (loans.length >= MAX_LOANS_PER_PLAN) {
        return { success: false, error: `Μέγιστο ${MAX_LOANS_PER_PLAN} δάνεια ανά payment plan` };
      }

      // V-LOAN-001: bankName required
      if (!input.bankName?.trim()) {
        return { success: false, error: 'Απαιτείται όνομα τράπεζας' };
      }

      const loanId = generateLoanId();
      const isPrimary = input.isPrimary ?? loans.length === 0; // First loan is primary by default

      // V-LOAN-009: Exactly 1 primary — if new is primary, demote others
      const updatedLoans = isPrimary
        ? loans.map(l => ({ ...l, isPrimary: false, updatedAt: new Date().toISOString() }))
        : [...loans];

      const newLoan = createDefaultLoanTracking(
        loanId,
        input.bankName.trim(),
        isPrimary,
        input.disbursementType ?? 'lump_sum'
      );

      if (input.requestedAmount !== undefined) {
        newLoan.requestedAmount = input.requestedAmount;
      }
      if (input.interestRateType !== undefined) {
        newLoan.interestRateType = input.interestRateType;
      }
      if (input.notes !== undefined) {
        newLoan.notes = input.notes ?? null;
      }

      updatedLoans.push(newLoan);

      const db = getDb();
      await db.collection(planCollectionPath(unitId)).doc(planId).update({
        loans: updatedLoans,
        updatedAt: new Date().toISOString(),
        updatedBy: createdBy,
      });

      await PaymentPlanService.syncPaymentSummary(unitId, planId);

      logger.info(`[LoanTrackingService] Added loan ${loanId} (${input.bankName}) to plan ${planId}`);
      return { success: true, loan: newLoan };
    } catch (error) {
      logger.error('[LoanTrackingService] Failed to add loan:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  /** Update loan fields (PATCH) */
  static async updateLoan(
    unitId: string,
    planId: string,
    loanId: string,
    input: UpdateLoanInput,
    updatedBy: string
  ): Promise<ServiceResult> {
    try {
      const plan = await PaymentPlanService.getPaymentPlan(unitId, planId);
      if (!plan) return { success: false, error: 'Payment plan not found' };

      const loans = resolveLoans(plan);
      const loanIndex = loans.findIndex(l => l.loanId === loanId);
      if (loanIndex === -1) return { success: false, error: `Loan ${loanId} not found` };

      const loan = { ...loans[loanIndex] };
      const now = new Date().toISOString();

      // Apply updates
      if (input.bankName !== undefined) loan.bankName = input.bankName;
      if (input.bankBranch !== undefined) loan.bankBranch = input.bankBranch ?? null;
      if (input.bankReferenceNumber !== undefined) loan.bankReferenceNumber = input.bankReferenceNumber ?? null;
      if (input.bankContactPerson !== undefined) loan.bankContactPerson = input.bankContactPerson ?? null;
      if (input.bankContactPhone !== undefined) loan.bankContactPhone = input.bankContactPhone ?? null;
      if (input.requestedAmount !== undefined) loan.requestedAmount = input.requestedAmount ?? null;
      if (input.approvedAmount !== undefined) {
        // V-LOAN-002: approvedAmount ≤ totalAmount
        if (input.approvedAmount !== null && input.approvedAmount > plan.totalAmount) {
          return { success: false, error: 'Το εγκεκριμένο ποσό δεν μπορεί να υπερβαίνει το συνολικό ποσό' };
        }
        loan.approvedAmount = input.approvedAmount ?? null;
        loan.remainingDisbursement = (input.approvedAmount ?? 0) - loan.disbursedAmount;
      }
      if (input.ltvPercentage !== undefined) loan.ltvPercentage = input.ltvPercentage ?? null;
      if (input.interestRate !== undefined) loan.interestRate = input.interestRate ?? null;
      if (input.interestRateType !== undefined) loan.interestRateType = input.interestRateType ?? null;
      if (input.termYears !== undefined) loan.termYears = input.termYears ?? null;
      if (input.monthlyPayment !== undefined) loan.monthlyPayment = input.monthlyPayment ?? null;
      if (input.dstiRatio !== undefined) loan.dstiRatio = input.dstiRatio ?? null;
      if (input.bankFees !== undefined) loan.bankFees = input.bankFees ?? null;
      if (input.disbursementType !== undefined) loan.disbursementType = input.disbursementType;
      if (input.collateralType !== undefined) loan.collateralType = input.collateralType ?? null;
      if (input.collateralAmount !== undefined) loan.collateralAmount = input.collateralAmount ?? null;
      if (input.collateralRegistrationNumber !== undefined) loan.collateralRegistrationNumber = input.collateralRegistrationNumber ?? null;
      if (input.collateralRegistrationDate !== undefined) loan.collateralRegistrationDate = input.collateralRegistrationDate ?? null;
      if (input.appraisalValue !== undefined) loan.appraisalValue = input.appraisalValue ?? null;
      if (input.appraisalDate !== undefined) loan.appraisalDate = input.appraisalDate ?? null;
      if (input.appraiserName !== undefined) loan.appraiserName = input.appraiserName ?? null;
      if (input.preApprovalExpiryDate !== undefined) loan.preApprovalExpiryDate = input.preApprovalExpiryDate ?? null;
      if (input.notes !== undefined) loan.notes = input.notes ?? null;

      loan.updatedAt = now;

      const updatedLoans = [...loans];
      updatedLoans[loanIndex] = loan;

      const db = getDb();
      await db.collection(planCollectionPath(unitId)).doc(planId).update({
        loans: updatedLoans,
        updatedAt: now,
        updatedBy,
      });

      await PaymentPlanService.syncPaymentSummary(unitId, planId);

      logger.info(`[LoanTrackingService] Updated loan ${loanId} in plan ${planId}`);
      return { success: true };
    } catch (error) {
      logger.error('[LoanTrackingService] Failed to update loan:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ==========================================================================
  // FSM TRANSITION
  // ==========================================================================

  /** Transition loan status with FSM validation + auto-date population */
  static async transitionLoanStatus(
    unitId: string,
    planId: string,
    loanId: string,
    input: LoanTransitionInput,
    updatedBy: string
  ): Promise<ServiceResult> {
    try {
      const plan = await PaymentPlanService.getPaymentPlan(unitId, planId);
      if (!plan) return { success: false, error: 'Payment plan not found' };

      const loans = resolveLoans(plan);
      const loanIndex = loans.findIndex(l => l.loanId === loanId);
      if (loanIndex === -1) return { success: false, error: `Loan ${loanId} not found` };

      const loan = { ...loans[loanIndex] };

      // FSM validation
      if (!isValidLoanTransition(loan.status, input.targetStatus)) {
        return {
          success: false,
          error: `Μη έγκυρη μετάβαση: ${loan.status} → ${input.targetStatus}`,
        };
      }

      const now = new Date().toISOString();
      loan.status = input.targetStatus;
      loan.updatedAt = now;

      // Auto-populate dates based on target status
      switch (input.targetStatus) {
        case 'applied':
          if (!loan.applicationDate) loan.applicationDate = now;
          break;
        case 'pre_approved':
          if (!loan.preApprovalDate) loan.preApprovalDate = now;
          break;
        case 'appraisal_completed':
          if (!loan.appraisalDate) loan.appraisalDate = now;
          break;
        case 'approved':
          if (!loan.approvalDate) loan.approvalDate = now;
          break;
        case 'collateral_registered':
          if (!loan.collateralRegistrationDate) loan.collateralRegistrationDate = now;
          break;
      }

      // Add transition note to communication log
      if (input.notes) {
        loan.communicationLog = [
          ...loan.communicationLog,
          {
            date: now,
            type: 'note' as const,
            summary: `Status: ${loan.status} → ${input.targetStatus}. ${input.notes}`,
            contactPerson: null,
            nextAction: null,
            nextActionDate: null,
          },
        ];
      }

      const updatedLoans = [...loans];
      updatedLoans[loanIndex] = loan;

      const db = getDb();
      await db.collection(planCollectionPath(unitId)).doc(planId).update({
        loans: updatedLoans,
        updatedAt: now,
        updatedBy,
      });

      await PaymentPlanService.syncPaymentSummary(unitId, planId);

      logger.info(`[LoanTrackingService] Loan ${loanId}: ${loans[loanIndex].status} → ${input.targetStatus}`);
      return { success: true };
    } catch (error) {
      logger.error('[LoanTrackingService] Failed to transition loan:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ==========================================================================
  // DISBURSEMENT
  // ==========================================================================

  /**
   * Record a disbursement — creates DisbursementEntry + PaymentRecord.
   * Auto-links to payment plan via PaymentPlanService.recordPayment().
   */
  static async recordDisbursement(
    unitId: string,
    planId: string,
    loanId: string,
    input: RecordDisbursementInput,
    createdBy: string
  ): Promise<ServiceResult & { paymentId?: string }> {
    try {
      const plan = await PaymentPlanService.getPaymentPlan(unitId, planId);
      if (!plan) return { success: false, error: 'Payment plan not found' };

      const loans = resolveLoans(plan);
      const loanIndex = loans.findIndex(l => l.loanId === loanId);
      if (loanIndex === -1) return { success: false, error: `Loan ${loanId} not found` };

      const loan = { ...loans[loanIndex] };

      if (input.amount <= 0) {
        return { success: false, error: 'Το ποσό εκταμίευσης πρέπει να είναι θετικό' };
      }

      // V-LOAN-003: disbursedAmount ≤ approvedAmount
      if (loan.approvedAmount !== null && (loan.disbursedAmount + input.amount) > loan.approvedAmount) {
        return {
          success: false,
          error: `Η εκταμίευση (€${input.amount}) υπερβαίνει το εγκεκριμένο υπόλοιπο (€${(loan.approvedAmount - loan.disbursedAmount).toFixed(2)})`,
        };
      }

      const now = new Date().toISOString();

      // Create DisbursementEntry
      const disbursementEntry: DisbursementEntry = {
        order: loan.disbursements.length + 1,
        amount: input.amount,
        milestone: input.milestone,
        disbursementDate: input.disbursementDate,
        status: 'disbursed',
        paymentMethod: input.paymentMethod ?? null,
        paymentId: null,
        notes: input.notes ?? null,
      };

      // Create PaymentRecord via PaymentPlanService
      const installmentIndex = input.installmentIndex ?? 0;
      const paymentId = generatePaymentRecordId();
      const paymentRecord: PaymentRecord = {
        id: paymentId,
        paymentPlanId: planId,
        installmentIndex,
        amount: input.amount,
        method: 'bank_loan',
        paymentDate: input.disbursementDate,
        methodDetails: {
          method: 'bank_loan',
          bankName: loan.bankName,
          loanReferenceNumber: loan.bankReferenceNumber,
          disbursementDate: input.disbursementDate,
        },
        splitAllocations: [{ installmentIndex, amount: input.amount }],
        overpaymentAmount: 0,
        invoiceId: null,
        transactionChainId: null,
        notes: input.notes ?? null,
        createdAt: now,
        createdBy,
        updatedAt: now,
      };

      // Link payment to disbursement
      disbursementEntry.paymentId = paymentId;

      // Update loan
      loan.disbursements = [...loan.disbursements, disbursementEntry];
      loan.disbursedAmount += input.amount;
      loan.remainingDisbursement = (loan.approvedAmount ?? 0) - loan.disbursedAmount;

      if (!loan.firstDisbursementDate) {
        loan.firstDisbursementDate = input.disbursementDate;
      }

      // Auto-transition: if fully disbursed
      if (loan.approvedAmount !== null && loan.disbursedAmount >= loan.approvedAmount) {
        loan.status = 'fully_disbursed';
        loan.fullDisbursementDate = input.disbursementDate;
      } else if (loan.status === 'disbursement_pending') {
        loan.status = 'partially_disbursed';
      }

      loan.updatedAt = now;

      const updatedLoans = [...loans];
      updatedLoans[loanIndex] = loan;

      // Batch write: payment record + loan update
      const db = getDb();
      const batch = db.batch();

      batch.set(
        db.collection(paymentCollectionPath(unitId)).doc(paymentId),
        paymentRecord
      );

      batch.update(
        db.collection(planCollectionPath(unitId)).doc(planId),
        {
          loans: updatedLoans,
          updatedAt: now,
          updatedBy: createdBy,
        }
      );

      await batch.commit();

      await PaymentPlanService.syncPaymentSummary(unitId, planId);

      logger.info(
        `[LoanTrackingService] Disbursement recorded: €${input.amount} from ${loan.bankName} (payment: ${paymentId})`
      );
      return { success: true, paymentId };
    } catch (error) {
      logger.error('[LoanTrackingService] Failed to record disbursement:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ==========================================================================
  // COMMUNICATION LOG
  // ==========================================================================

  /** Append a communication log entry (append-only) */
  static async addCommunicationLog(
    unitId: string,
    planId: string,
    loanId: string,
    input: AddCommunicationLogInput,
    createdBy: string
  ): Promise<ServiceResult> {
    try {
      const plan = await PaymentPlanService.getPaymentPlan(unitId, planId);
      if (!plan) return { success: false, error: 'Payment plan not found' };

      const loans = resolveLoans(plan);
      const loanIndex = loans.findIndex(l => l.loanId === loanId);
      if (loanIndex === -1) return { success: false, error: `Loan ${loanId} not found` };

      if (!input.summary?.trim()) {
        return { success: false, error: 'Απαιτείται περιγραφή' };
      }

      const now = new Date().toISOString();

      const entry: BankCommunicationEntry = {
        date: now,
        type: input.type,
        summary: input.summary.trim(),
        contactPerson: input.contactPerson ?? null,
        nextAction: input.nextAction ?? null,
        nextActionDate: input.nextActionDate ?? null,
      };

      const loan = { ...loans[loanIndex] };
      loan.communicationLog = [...loan.communicationLog, entry];
      loan.updatedAt = now;

      const updatedLoans = [...loans];
      updatedLoans[loanIndex] = loan;

      const db = getDb();
      await db.collection(planCollectionPath(unitId)).doc(planId).update({
        loans: updatedLoans,
        updatedAt: now,
        updatedBy: createdBy,
      });

      logger.info(`[LoanTrackingService] Added comm log entry for loan ${loanId}`);
      return { success: true };
    } catch (error) {
      logger.error('[LoanTrackingService] Failed to add comm log:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export default LoanTrackingService;
