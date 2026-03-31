/**
 * Payment Plan Core — Shared helpers, DB access, pure computation.
 *
 * Extracted from PaymentPlanService for SRP (Google standard: max 500 lines).
 * Used by: payment-plan.service, payment-plan-installments, payment-plan-recording.
 *
 * @module services/payment-plan-core
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  PaymentPlan,
  PaymentSummary,
  Installment,
  InstallmentStatus,
} from '@/types/payment-plan';
import type { LoanTracking } from '@/types/loan-tracking';
import { migrateLoanInfoToTracking } from '@/types/loan-tracking';

export const ppLogger = createModuleLogger('PaymentPlanService');

// ============================================================================
// DB HELPERS
// ============================================================================

export function getDb() {
  const db = getAdminFirestore();
  if (!db) throw new Error('Admin Firestore unavailable');
  return db;
}

export function planCollectionPath(unitId: string): string {
  return `${COLLECTIONS.PROPERTIES}/${unitId}/${SUBCOLLECTIONS.PROPERTY_PAYMENT_PLANS}`;
}

export function paymentCollectionPath(unitId: string): string {
  return `${COLLECTIONS.PROPERTIES}/${unitId}/${SUBCOLLECTIONS.PROPERTY_PAYMENTS}`;
}

// ============================================================================
// PURE COMPUTATION
// ============================================================================

/** Compute installment status from paid amount vs total. */
export function computeInstallmentStatus(installment: Installment): InstallmentStatus {
  if (installment.paidAmount >= installment.amount) return 'paid';
  if (installment.paidAmount > 0) return 'partial';
  return installment.status === 'waived' ? 'waived' : 'pending';
}

/** Pure function: compute PaymentSummary from a plan snapshot (no I/O). */
export function computeSummaryFromPlan(plan: PaymentPlan, planId: string): PaymentSummary {
  const now = new Date().toISOString();
  const paidInstallments = plan.installments.filter(
    (i) => i.status === 'paid' || i.status === 'waived'
  ).length;

  const overdueInstallments = plan.installments.filter((i) => {
    if (i.status === 'paid' || i.status === 'waived') return false;
    return i.dueDate < now && i.paidAmount < i.amount;
  }).length;

  const nextInstallment = plan.installments.find(
    (i) => i.status === 'pending' || i.status === 'due' || i.status === 'partial'
  );

  // Resolve loans (Phase 2 — SPEC-234C)
  const loans: LoanTracking[] = plan.loans && plan.loans.length > 0
    ? plan.loans
    : (plan.loan && plan.loan.status !== 'not_applicable'
      ? [migrateLoanInfoToTracking(plan.loan, 'migrated_loan')]
      : []);

  const primaryLoan = loans.find(l => l.isPrimary) ?? loans[0] ?? null;

  const totalApprovedLoanAmount = loans.reduce<number | null>((sum, l) => {
    if (l.approvedAmount === null) return sum;
    return (sum ?? 0) + l.approvedAmount;
  }, null);

  const totalDisbursedAmount = loans.reduce((sum, l) => sum + l.disbursedAmount, 0);

  return {
    planStatus: plan.status,
    totalAmount: plan.totalAmount,
    paidAmount: plan.paidAmount,
    remainingAmount: plan.remainingAmount,
    paidPercentage: plan.totalAmount > 0
      ? Math.round((plan.paidAmount / plan.totalAmount) * 10000) / 100
      : 0,
    totalInstallments: plan.installments.length,
    paidInstallments,
    overdueInstallments,
    nextInstallmentAmount: nextInstallment?.amount ?? null,
    nextInstallmentDate: nextInstallment?.dueDate ?? null,
    loanStatus: plan.loan.status,
    primaryLoanStatus: primaryLoan?.status ?? 'not_applicable',
    primaryLoanBank: primaryLoan?.bankName ?? null,
    totalApprovedLoanAmount,
    totalDisbursedAmount,
    paymentPlanId: planId,
  };
}

// ============================================================================
// SIMPLE DB READS
// ============================================================================

/** Ανάκτηση ενεργού payment plan (non-cancelled). */
export async function getActivePaymentPlan(unitId: string): Promise<PaymentPlan | null> {
  try {
    const db = getDb();
    const snapshot = await db
      .collection(planCollectionPath(unitId))
      .where(FIELDS.STATUS, 'in', ['negotiation', 'draft', 'active', 'completed'])
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as PaymentPlan;
  } catch (error) {
    ppLogger.error('[PaymentPlanService] Failed to get active plan:', error);
    return null;
  }
}

/** ADR-244: Ανάκτηση ΟΛΩΝ των non-cancelled payment plans. */
export async function getPaymentPlans(unitId: string): Promise<PaymentPlan[]> {
  try {
    const db = getDb();
    const snapshot = await db
      .collection(planCollectionPath(unitId))
      .where(FIELDS.STATUS, 'in', ['negotiation', 'draft', 'active', 'completed'])
      .get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentPlan));
  } catch (error) {
    ppLogger.error('[PaymentPlanService] Failed to get payment plans:', error);
    return [];
  }
}

/** Ανάκτηση μεμονωμένου plan by ID. */
export async function getPaymentPlan(unitId: string, planId: string): Promise<PaymentPlan | null> {
  try {
    const db = getDb();
    const doc = await db.collection(planCollectionPath(unitId)).doc(planId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as PaymentPlan;
  } catch (error) {
    ppLogger.error('[PaymentPlanService] Failed to get plan:', error);
    return null;
  }
}
