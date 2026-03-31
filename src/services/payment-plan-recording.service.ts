/**
 * Payment Plan Recording — Payment recording, loans, summary sync.
 *
 * Extracted from PaymentPlanService for SRP (Google standard: max 500 lines).
 *
 * @module services/payment-plan-recording
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { getErrorMessage } from '@/lib/error-utils';
import { generatePaymentRecordId } from '@/services/enterprise-id.service';
import type {
  PaymentPlan,
  PaymentRecord,
  PaymentSummary,
  LoanInfo,
  CreatePaymentInput,
  SplitAllocation,
} from '@/types/payment-plan';
import {
  getDb,
  planCollectionPath,
  paymentCollectionPath,
  ppLogger as logger,
  computeInstallmentStatus,
  computeSummaryFromPlan,
  getPaymentPlan,
  getPaymentPlans,
} from './payment-plan-core';

// ============================================================================
// PAYMENT RECORDING
// ============================================================================

export async function recordPayment(
  unitId: string,
  input: CreatePaymentInput,
  createdBy: string
): Promise<{ success: boolean; payment?: PaymentRecord; error?: string }> {
  try {
    if (input.amount <= 0) {
      return { success: false, error: 'Το ποσό πρέπει να είναι θετικό' };
    }

    const db = getDb();
    const planRef = db.collection(planCollectionPath(unitId)).doc(input.paymentPlanId);
    const unitRef = db.collection(COLLECTIONS.PROPERTIES).doc(unitId);
    const paymentId = generatePaymentRecordId();
    const paymentRef = db.collection(paymentCollectionPath(unitId)).doc(paymentId);

    const paymentRecord = await db.runTransaction(async (tx) => {
      const planSnap = await tx.get(planRef);
      if (!planSnap.exists) throw new Error('Payment plan not found');
      const plan = { id: planSnap.id, ...planSnap.data() } as PaymentPlan;

      if (plan.status === 'completed' || plan.status === 'cancelled') {
        throw new Error('Δεν μπορείτε να καταγράψετε πληρωμή σε ολοκληρωμένο/ακυρωμένο plan');
      }

      const targetIdx = input.installmentIndex;
      if (targetIdx < 0 || targetIdx >= plan.installments.length) {
        throw new Error(`Δόση #${targetIdx} δεν βρέθηκε`);
      }

      if (plan.config.sequentialPaymentRequired) {
        for (let i = 0; i < targetIdx; i++) {
          const prev = plan.installments[i];
          if (prev.status !== 'paid' && prev.status !== 'waived') {
            throw new Error(`Η δόση #${i} (${prev.label}) πρέπει να εξοφληθεί πρώτα`);
          }
        }
      }

      const targetInst = plan.installments[targetIdx];
      const targetRemaining = targetInst.amount - targetInst.paidAmount;

      if (targetRemaining <= 0) {
        throw new Error(`Η δόση #${targetIdx} (${targetInst.label}) είναι ήδη εξοφλημένη`);
      }

      const allocations: SplitAllocation[] = [];
      let remainingPayment = input.amount;
      const updatedInstallments = [...plan.installments.map((inst) => ({ ...inst }))];

      const applyToTarget = Math.min(remainingPayment, targetRemaining);
      updatedInstallments[targetIdx].paidAmount += applyToTarget;
      updatedInstallments[targetIdx].status = computeInstallmentStatus(updatedInstallments[targetIdx]);
      if (updatedInstallments[targetIdx].status === 'paid') {
        updatedInstallments[targetIdx].paidDate = input.paymentDate;
      }
      allocations.push({ installmentIndex: targetIdx, amount: applyToTarget });
      remainingPayment -= applyToTarget;

      let overpaymentAmount = 0;
      if (remainingPayment > 0 && plan.config.autoApplyOverpayment) {
        for (let i = targetIdx + 1; i < updatedInstallments.length && remainingPayment > 0; i++) {
          const inst = updatedInstallments[i];
          const instRemaining = inst.amount - inst.paidAmount;
          if (instRemaining <= 0) continue;

          const applyAmount = Math.min(remainingPayment, instRemaining);
          inst.paidAmount += applyAmount;
          inst.status = computeInstallmentStatus(inst);
          if (inst.status === 'paid') inst.paidDate = input.paymentDate;
          allocations.push({ installmentIndex: i, amount: applyAmount });
          remainingPayment -= applyAmount;
        }
      }

      if (remainingPayment > 0) overpaymentAmount = remainingPayment;

      const now = new Date().toISOString();
      const record: PaymentRecord = {
        id: paymentId, paymentPlanId: input.paymentPlanId,
        installmentIndex: targetIdx, amount: input.amount,
        method: input.method, paymentDate: input.paymentDate,
        methodDetails: input.methodDetails,
        splitAllocations: allocations, overpaymentAmount,
        invoiceId: null, transactionChainId: null,
        notes: input.notes ?? null,
        createdAt: now, createdBy, updatedAt: now,
      };

      for (const alloc of allocations) {
        const inst = updatedInstallments[alloc.installmentIndex];
        if (!inst.paymentIds.includes(paymentId)) {
          inst.paymentIds = [...inst.paymentIds, paymentId];
        }
      }

      const newPaidAmount = updatedInstallments.reduce((s, i) => s + i.paidAmount, 0);
      const newRemainingAmount = plan.totalAmount - newPaidAmount;
      const allPaid = updatedInstallments.every((i) => i.status === 'paid' || i.status === 'waived');
      const newStatus = allPaid ? 'completed' : plan.status;

      const updatedPlan: PaymentPlan = {
        ...plan, installments: updatedInstallments,
        paidAmount: newPaidAmount, remainingAmount: newRemainingAmount, status: newStatus,
      };
      const summary = computeSummaryFromPlan(updatedPlan, plan.id);

      tx.set(paymentRef, record);
      tx.update(planRef, {
        installments: updatedInstallments,
        paidAmount: newPaidAmount, remainingAmount: newRemainingAmount,
        status: newStatus, updatedAt: now, updatedBy: createdBy,
      });
      tx.update(unitRef, { 'commercial.paymentSummary': summary });

      return record;
    });

    logger.info(
      `[PaymentPlanService] Recorded payment ${paymentId}: €${input.amount} for installment #${input.installmentIndex}` +
      (paymentRecord.splitAllocations.length > 1 ? ` (split across ${paymentRecord.splitAllocations.length} installments)` : '') +
      (paymentRecord.overpaymentAmount > 0 ? ` (overpayment: €${paymentRecord.overpaymentAmount})` : '')
    );

    return { success: true, payment: paymentRecord };
  } catch (error) {
    logger.error('[PaymentPlanService] Failed to record payment:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function getPayments(unitId: string): Promise<PaymentRecord[]> {
  try {
    const db = getDb();
    const snapshot = await db
      .collection(paymentCollectionPath(unitId))
      .orderBy(FIELDS.CREATED_AT, 'desc')
      .get();
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as PaymentRecord);
  } catch (error) {
    logger.error('[PaymentPlanService] Failed to get payments:', error);
    return [];
  }
}

// ============================================================================
// LOAN INFO
// ============================================================================

export async function updateLoanInfo(
  unitId: string, planId: string, loan: Partial<LoanInfo>, updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const plan = await getPaymentPlan(unitId, planId);
    if (!plan) return { success: false, error: 'Payment plan not found' };

    const updatedLoan: LoanInfo = { ...plan.loan, ...loan };
    if (updatedLoan.loanAmount !== null && updatedLoan.loanAmount > plan.totalAmount) {
      return { success: false, error: 'Το ποσό δανείου δεν μπορεί να υπερβαίνει το συνολικό ποσό' };
    }

    const db = getDb();
    await db.collection(planCollectionPath(unitId)).doc(planId).update({
      loan: updatedLoan,
      updatedAt: new Date().toISOString(),
      updatedBy,
    });

    await syncPaymentSummary(unitId, planId);

    logger.info(`[PaymentPlanService] Updated loan info for plan ${planId}`);
    return { success: true };
  } catch (error) {
    logger.error('[PaymentPlanService] Failed to update loan info:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ============================================================================
// SUMMARY SYNC
// ============================================================================

export async function syncPaymentSummary(unitId: string, planId: string): Promise<void> {
  try {
    const db = getDb();
    await db.runTransaction(async (tx) => {
      const planRef = db.collection(planCollectionPath(unitId)).doc(planId);
      const planSnap = await tx.get(planRef);
      if (!planSnap.exists) return;

      const plan = { id: planSnap.id, ...planSnap.data() } as PaymentPlan;
      const summary = computeSummaryFromPlan(plan, planId);

      const unitRef = db.collection(COLLECTIONS.PROPERTIES).doc(unitId);
      tx.update(unitRef, { 'commercial.paymentSummary': summary });
    });

    logger.info(`[PaymentPlanService] Synced summary for unit ${unitId}`);
  } catch (error) {
    logger.error('[PaymentPlanService] Failed to sync summary:', error);
  }
}

export async function syncAggregatedPaymentSummary(unitId: string): Promise<void> {
  try {
    const plans = await getPaymentPlans(unitId);
    if (plans.length === 0) return;

    if (plans.length === 1) {
      await syncPaymentSummary(unitId, plans[0].id);
      return;
    }

    const totalAmount = plans.reduce((s, p) => s + p.totalAmount, 0);
    const paidAmount = plans.reduce((s, p) => s + p.paidAmount, 0);
    const remainingAmount = plans.reduce((s, p) => s + p.remainingAmount, 0);

    const allInstallments = plans.flatMap(p =>
      p.installments.map(inst => ({ ...inst, planId: p.id }))
    );
    const pendingInstallments = allInstallments
      .filter(i => i.status === 'pending' || i.status === 'due')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const next = pendingInstallments[0] ?? null;
    const overdueCount = allInstallments.filter(
      i => (i.status === 'pending' || i.status === 'due') && new Date(i.dueDate) < new Date()
    ).length;

    const summary: PaymentSummary = {
      paymentPlanId: plans[0].id,
      planStatus: plans.every(p => p.status === 'completed') ? 'completed' : plans[0].status,
      totalAmount, paidAmount, remainingAmount,
      paidPercentage: totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0,
      totalInstallments: allInstallments.length,
      paidInstallments: allInstallments.filter(i => i.status === 'paid').length,
      overdueInstallments: overdueCount,
      nextInstallmentDate: next?.dueDate ?? null,
      nextInstallmentAmount: next?.amount ?? null,
      loanStatus: 'not_applicable',
    };

    const db = getDb();
    await db.collection(COLLECTIONS.PROPERTIES).doc(unitId).update({
      'commercial.paymentSummary': summary,
    });

    logger.info(`[PaymentPlanService] Synced aggregated summary for unit ${unitId} (${plans.length} plans)`);
  } catch (error) {
    logger.error('[PaymentPlanService] Failed to sync aggregated summary:', error);
  }
}
