/**
 * =============================================================================
 * Loan Tracking Operations — Disbursement + Communication Log (ADR-234)
 * =============================================================================
 *
 * Extracted from LoanTrackingService for file-size compliance.
 * Contains: recordDisbursement, addCommunicationLog.
 *
 * @module services/loan-tracking-operations
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { generatePaymentRecordId } from '@/services/enterprise-id.service';
import { PaymentPlanService } from '@/services/payment-plan.service';
import type { PaymentPlan, PaymentRecord } from '@/types/payment-plan';
import type {
  LoanTracking,
  DisbursementEntry,
  BankCommunicationEntry,
  RecordDisbursementInput,
  AddCommunicationLogInput,
} from '@/types/loan-tracking';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('LoanTrackingOperations');

// ============================================================================
// HELPERS (shared with main service)
// ============================================================================

function getDb() {
  const db = getAdminFirestore();
  if (!db) throw new Error('Admin Firestore unavailable');
  return db;
}

function planCollectionPath(propertyId: string): string {
  return `${COLLECTIONS.PROPERTIES}/${propertyId}/${SUBCOLLECTIONS.PROPERTY_PAYMENT_PLANS}`;
}

function paymentCollectionPath(propertyId: string): string {
  return `${COLLECTIONS.PROPERTIES}/${propertyId}/${SUBCOLLECTIONS.PROPERTY_PAYMENTS}`;
}

interface ServiceResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// DISBURSEMENT
// ============================================================================

/**
 * Record a disbursement — creates DisbursementEntry + PaymentRecord.
 * Auto-links to payment plan via PaymentPlanService.recordPayment().
 */
export async function recordDisbursement(
  propertyId: string,
  planId: string,
  loanId: string,
  input: RecordDisbursementInput,
  createdBy: string,
  resolveLoans: (plan: PaymentPlan) => LoanTracking[]
): Promise<ServiceResult & { paymentId?: string }> {
  try {
    const plan = await PaymentPlanService.getPaymentPlan(propertyId, planId);
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

    const now = nowISO();

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

    disbursementEntry.paymentId = paymentId;

    loan.disbursements = [...loan.disbursements, disbursementEntry];
    loan.disbursedAmount += input.amount;
    loan.remainingDisbursement = (loan.approvedAmount ?? 0) - loan.disbursedAmount;

    if (!loan.firstDisbursementDate) {
      loan.firstDisbursementDate = input.disbursementDate;
    }

    if (loan.approvedAmount !== null && loan.disbursedAmount >= loan.approvedAmount) {
      loan.status = 'fully_disbursed';
      loan.fullDisbursementDate = input.disbursementDate;
    } else if (loan.status === 'disbursement_pending') {
      loan.status = 'partially_disbursed';
    }

    loan.updatedAt = now;

    const updatedLoans = [...loans];
    updatedLoans[loanIndex] = loan;

    const db = getDb();
    const batch = db.batch();

    batch.set(db.collection(paymentCollectionPath(propertyId)).doc(paymentId), paymentRecord);
    batch.update(db.collection(planCollectionPath(propertyId)).doc(planId), {
      loans: updatedLoans,
      updatedAt: now,
      updatedBy: createdBy,
    });

    await batch.commit();
    await PaymentPlanService.syncPaymentSummary(propertyId, planId);

    logger.info(`[LoanTrackingOps] Disbursement: €${input.amount} from ${loan.bankName} (payment: ${paymentId})`);
    return { success: true, paymentId };
  } catch (error) {
    logger.error('[LoanTrackingOps] Failed to record disbursement:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ============================================================================
// COMMUNICATION LOG
// ============================================================================

/** Append a communication log entry (append-only) */
export async function addCommunicationLog(
  propertyId: string,
  planId: string,
  loanId: string,
  input: AddCommunicationLogInput,
  createdBy: string,
  resolveLoans: (plan: PaymentPlan) => LoanTracking[]
): Promise<ServiceResult> {
  try {
    const plan = await PaymentPlanService.getPaymentPlan(propertyId, planId);
    if (!plan) return { success: false, error: 'Payment plan not found' };

    const loans = resolveLoans(plan);
    const loanIndex = loans.findIndex(l => l.loanId === loanId);
    if (loanIndex === -1) return { success: false, error: `Loan ${loanId} not found` };

    if (!input.summary?.trim()) {
      return { success: false, error: 'Απαιτείται περιγραφή' };
    }

    const now = nowISO();

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
    await db.collection(planCollectionPath(propertyId)).doc(planId).update({
      loans: updatedLoans,
      updatedAt: now,
      updatedBy: createdBy,
    });

    logger.info(`[LoanTrackingOps] Added comm log entry for loan ${loanId}`);
    return { success: true };
  } catch (error) {
    logger.error('[LoanTrackingOps] Failed to add comm log:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
