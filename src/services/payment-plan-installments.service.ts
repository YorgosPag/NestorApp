/**
 * Payment Plan Installments — Add, Update, Remove installments + plan status.
 *
 * Extracted from PaymentPlanService for SRP (Google standard: max 500 lines).
 *
 * @module services/payment-plan-installments
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  PaymentPlan,
  PaymentPlanStatus,
  Installment,
  CreateInstallmentInput,
  UpdateInstallmentInput,
} from '@/types/payment-plan';
import { isValidPlanTransition } from '@/types/payment-plan';
import {
  getDb,
  planCollectionPath,
  ppLogger as logger,
  computeSummaryFromPlan,
  getActivePaymentPlan,
  getPaymentPlan,
} from './payment-plan-core';
import { syncPaymentSummary } from './payment-plan-recording.service';

// ============================================================================
// RESYNC TOTAL AMOUNT
// ============================================================================

export async function resyncTotalAmount(
  unitId: string,
  newSalePrice: number,
  updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const activePlan = await getActivePaymentPlan(unitId);
    if (!activePlan) return { success: true };
    if (newSalePrice === activePlan.totalAmount) return { success: true };
    if (activePlan.status !== 'negotiation' && activePlan.status !== 'draft') {
      logger.info(`[PaymentPlanService] Skipping resync: plan ${activePlan.id} is ${activePlan.status}`);
      return { success: true };
    }

    const planRef = db.collection(planCollectionPath(unitId)).doc(activePlan.id);
    const unitRef = db.collection(COLLECTIONS.UNITS).doc(unitId);

    await db.runTransaction(async (tx) => {
      const planSnap = await tx.get(planRef);
      if (!planSnap.exists) return;
      const plan = { id: planSnap.id, ...planSnap.data() } as PaymentPlan;

      if (newSalePrice === plan.totalAmount) return;
      if (plan.status !== 'negotiation' && plan.status !== 'draft') return;

      const oldTotal = plan.totalAmount;
      const delta = newSalePrice - oldTotal;
      const updatedInstallments = [...plan.installments];
      const totalUnpaid = updatedInstallments
        .filter((inst) => inst.paidAmount < inst.amount)
        .reduce((s, inst) => s + (inst.amount - inst.paidAmount), 0);

      if (delta < 0 && Math.abs(delta) > totalUnpaid) {
        throw new Error(
          `Η νέα τιμή (${newSalePrice}) θα μειώσει το πλάνο κατά ${Math.abs(delta)} αλλά το αδιάθετο υπόλοιπο είναι μόνο ${totalUnpaid}.`
        );
      }

      if (totalUnpaid > 0) {
        for (const inst of updatedInstallments) {
          const unpaid = inst.amount - inst.paidAmount;
          if (unpaid <= 0) continue;
          const share = Math.round((unpaid / totalUnpaid) * delta * 100) / 100;
          inst.amount = Math.round((inst.amount + share) * 100) / 100;
          inst.percentage = newSalePrice > 0
            ? Math.round((inst.amount / newSalePrice) * 10000) / 100
            : 0;
        }
      } else if (delta > 0 && updatedInstallments.length > 0) {
        const pendingCount = updatedInstallments.filter((i) => i.status === 'pending').length;
        if (pendingCount > 0) {
          const share = Math.round((delta / pendingCount) * 100) / 100;
          for (const inst of updatedInstallments) {
            if (inst.status !== 'pending') continue;
            inst.amount = Math.round((inst.amount + share) * 100) / 100;
          }
        }
      }

      const reindexed = updatedInstallments.map((inst, i) => ({ ...inst, index: i }));
      const newTotal = reindexed.reduce((s, i) => s + i.amount, 0);

      const updatedPlan: PaymentPlan = {
        ...plan,
        installments: reindexed,
        totalAmount: newTotal,
        remainingAmount: newTotal - plan.paidAmount,
      };
      const summary = computeSummaryFromPlan(updatedPlan, plan.id);

      tx.update(planRef, {
        installments: reindexed,
        totalAmount: newTotal,
        remainingAmount: newTotal - plan.paidAmount,
        updatedAt: new Date().toISOString(),
        updatedBy,
      });
      tx.update(unitRef, { 'commercial.paymentSummary': summary });

      logger.info(`[PaymentPlanService] Resynced plan ${plan.id}: ${oldTotal} → ${newTotal} (delta: ${delta})`);
    });

    return { success: true };
  } catch (error) {
    logger.error('[PaymentPlanService] Failed to resync total amount:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ============================================================================
// DELETE / ACTIVATE / CANCEL
// ============================================================================

export async function deletePlan(
  unitId: string,
  planId: string,
  deletedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const plan = await getPaymentPlan(unitId, planId);
    if (!plan) return { success: false, error: 'Payment plan not found' };

    if (plan.status !== 'negotiation' && plan.status !== 'draft') {
      return { success: false, error: 'Μπορείτε να διαγράψετε μόνο plans σε negotiation/draft' };
    }
    if (plan.paidAmount > 0) {
      return { success: false, error: 'Δεν μπορείτε να διαγράψετε plan με καταγεγραμμένες πληρωμές' };
    }

    const db = getDb();
    await db.collection(planCollectionPath(unitId)).doc(planId).delete();
    await db.collection(COLLECTIONS.UNITS).doc(unitId).update({
      'commercial.paymentSummary': null,
      updatedAt: new Date().toISOString(),
    });

    logger.info(`[PaymentPlanService] Deleted plan ${planId} by ${deletedBy}`);
    return { success: true };
  } catch (error) {
    logger.error('[PaymentPlanService] Failed to delete plan:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function activatePlan(
  unitId: string, planId: string, updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  return transitionPlanStatus(unitId, planId, 'active', updatedBy);
}

export async function cancelPlan(
  unitId: string, planId: string, updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  return transitionPlanStatus(unitId, planId, 'cancelled', updatedBy);
}

async function transitionPlanStatus(
  unitId: string, planId: string, targetStatus: PaymentPlanStatus, updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const plan = await getPaymentPlan(unitId, planId);
    if (!plan) return { success: false, error: 'Payment plan not found' };

    if (!isValidPlanTransition(plan.status, targetStatus)) {
      return { success: false, error: `Μη έγκυρη μετάβαση: ${plan.status} → ${targetStatus}` };
    }

    const db = getDb();
    await db.collection(planCollectionPath(unitId)).doc(planId).update({
      status: targetStatus,
      updatedAt: new Date().toISOString(),
      updatedBy,
    });

    await syncPaymentSummary(unitId, planId);

    logger.info(`[PaymentPlanService] Plan ${planId}: ${plan.status} → ${targetStatus}`);
    return { success: true };
  } catch (error) {
    logger.error('[PaymentPlanService] Failed to transition plan:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ============================================================================
// INSTALLMENT CRUD
// ============================================================================

export async function addInstallment(
  unitId: string, planId: string, input: CreateInstallmentInput,
  updatedBy: string, insertAtIndex?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const planRef = db.collection(planCollectionPath(unitId)).doc(planId);
    const unitRef = db.collection(COLLECTIONS.UNITS).doc(unitId);

    await db.runTransaction(async (tx) => {
      const planSnap = await tx.get(planRef);
      if (!planSnap.exists) throw new Error('Payment plan not found');
      const plan = { id: planSnap.id, ...planSnap.data() } as PaymentPlan;

      if (plan.status !== 'negotiation' && plan.status !== 'draft') {
        throw new Error('Μπορείτε να προσθέσετε δόσεις μόνο σε negotiation/draft');
      }

      const newInstallment: Installment = {
        index: 0, label: input.label, type: input.type,
        amount: input.amount, percentage: input.percentage,
        dueDate: input.dueDate, status: 'pending',
        paidAmount: 0, paidDate: null, paymentIds: [],
        notes: input.notes ?? null,
      };

      const existingInstallments = plan.installments;
      const totalUnpaid = existingInstallments
        .filter((inst) => inst.paidAmount < inst.amount)
        .reduce((s, inst) => s + (inst.amount - inst.paidAmount), 0);
      const addedAmount = newInstallment.amount;

      const maxAllowed = Math.round(totalUnpaid * 0.95 * 100) / 100;
      if (existingInstallments.length > 0 && addedAmount > maxAllowed) {
        const fmt = (v: number) => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
        throw new Error(
          `Το ποσό ${fmt(addedAmount)} υπερβαίνει το μέγιστο επιτρεπτό ${fmt(maxAllowed)} (95% του αδιάθετου υπολοίπου ${fmt(totalUnpaid)}).`
        );
      }

      if (totalUnpaid > 0 && addedAmount > 0 && addedAmount <= totalUnpaid) {
        const reductionRatio = addedAmount / totalUnpaid;
        for (const inst of existingInstallments) {
          const unpaidPortion = inst.amount - inst.paidAmount;
          if (unpaidPortion <= 0) continue;
          const reduction = Math.round(unpaidPortion * reductionRatio * 100) / 100;
          inst.amount = Math.round((inst.amount - reduction) * 100) / 100;
          if (plan.totalAmount > 0) {
            inst.percentage = Math.round((inst.amount / plan.totalAmount) * 10000) / 100;
          }
        }
        if (plan.totalAmount > 0) {
          newInstallment.percentage = Math.round((newInstallment.amount / plan.totalAmount) * 10000) / 100;
        }
      }

      let updatedInstallments: Installment[];
      if (insertAtIndex !== undefined && insertAtIndex >= 0 && insertAtIndex < existingInstallments.length) {
        updatedInstallments = [...existingInstallments];
        updatedInstallments.splice(insertAtIndex, 0, newInstallment);
      } else {
        updatedInstallments = [...existingInstallments, newInstallment];
      }
      updatedInstallments = updatedInstallments.map((inst, i) => ({ ...inst, index: i }));
      const newTotal = updatedInstallments.reduce((s, i) => s + i.amount, 0);

      const updatedPlan: PaymentPlan = { ...plan, installments: updatedInstallments, totalAmount: newTotal, remainingAmount: newTotal - plan.paidAmount };
      const summary = computeSummaryFromPlan(updatedPlan, planId);

      tx.update(planRef, { installments: updatedInstallments, totalAmount: newTotal, remainingAmount: newTotal - plan.paidAmount, updatedAt: new Date().toISOString(), updatedBy });
      tx.update(unitRef, { 'commercial.paymentSummary': summary });
    });

    logger.info(`[PaymentPlanService] Added installment to plan ${planId}`);
    return { success: true };
  } catch (error) {
    logger.error('[PaymentPlanService] Failed to add installment:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateInstallment(
  unitId: string, planId: string, index: number,
  input: UpdateInstallmentInput, updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const planRef = db.collection(planCollectionPath(unitId)).doc(planId);
    const unitRef = db.collection(COLLECTIONS.UNITS).doc(unitId);

    await db.runTransaction(async (tx) => {
      const planSnap = await tx.get(planRef);
      if (!planSnap.exists) throw new Error('Payment plan not found');
      const plan = { id: planSnap.id, ...planSnap.data() } as PaymentPlan;

      if (index < 0 || index >= plan.installments.length) {
        throw new Error(`Δόση #${index} δεν βρέθηκε`);
      }

      if (plan.status === 'active') {
        if (input.label || input.amount !== undefined || input.percentage !== undefined || input.dueDate) {
          throw new Error('Σε ενεργό plan μπορείτε να αλλάξετε μόνο σημειώσεις');
        }
      } else if (plan.status !== 'negotiation' && plan.status !== 'draft') {
        throw new Error('Δεν μπορείτε να τροποποιήσετε δόσεις σε αυτό το status');
      }

      const updated = [...plan.installments];
      const inst = { ...updated[index] };
      const oldAmount = inst.amount;

      if (input.label !== undefined) inst.label = input.label;
      if (input.amount !== undefined) inst.amount = input.amount;
      if (input.percentage !== undefined) inst.percentage = input.percentage;
      if (input.dueDate !== undefined) inst.dueDate = input.dueDate;
      if (input.notes !== undefined) inst.notes = input.notes ?? null;

      updated[index] = inst;

      const amountDelta = inst.amount - oldAmount;
      if (amountDelta > 0 && input.amount !== undefined) {
        const othersUnpaid = updated
          .filter((item, i) => i !== index && item.paidAmount < item.amount)
          .reduce((s, item) => s + (item.amount - item.paidAmount), 0);
        const maxIncrease = Math.round(othersUnpaid * 0.95 * 100) / 100;
        if (amountDelta > maxIncrease) {
          const fmt = (v: number) => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
          throw new Error(
            `Η αύξηση κατά ${fmt(amountDelta)} υπερβαίνει το μέγιστο ${fmt(maxIncrease)} (95% του αδιάθετου υπολοίπου ${fmt(othersUnpaid)}).`
          );
        }
      }
      if (amountDelta !== 0 && input.amount !== undefined) {
        const othersUnpaid = updated
          .filter((item, i) => i !== index && item.paidAmount < item.amount)
          .reduce((s, item) => s + (item.amount - item.paidAmount), 0);

        if (othersUnpaid > 0 && Math.abs(amountDelta) <= othersUnpaid) {
          for (let i = 0; i < updated.length; i++) {
            if (i === index) continue;
            const unpaid = updated[i].amount - updated[i].paidAmount;
            if (unpaid <= 0) continue;
            const adjustment = Math.round((unpaid / othersUnpaid) * amountDelta * 100) / 100;
            updated[i] = { ...updated[i], amount: Math.round((updated[i].amount - adjustment) * 100) / 100 };
            if (plan.totalAmount > 0) {
              updated[i] = { ...updated[i], percentage: Math.round((updated[i].amount / plan.totalAmount) * 10000) / 100 };
            }
          }
        }
        if (plan.totalAmount > 0) {
          updated[index] = { ...updated[index], percentage: Math.round((updated[index].amount / plan.totalAmount) * 10000) / 100 };
        }
      }

      const newTotal = updated.reduce((s, i) => s + i.amount, 0);
      const updatedPlan: PaymentPlan = { ...plan, installments: updated, totalAmount: newTotal, remainingAmount: newTotal - plan.paidAmount };
      const summary = computeSummaryFromPlan(updatedPlan, planId);

      tx.update(planRef, { installments: updated, totalAmount: newTotal, remainingAmount: newTotal - plan.paidAmount, updatedAt: new Date().toISOString(), updatedBy });
      tx.update(unitRef, { 'commercial.paymentSummary': summary });
    });

    logger.info(`[PaymentPlanService] Updated installment #${index} in plan ${planId}`);
    return { success: true };
  } catch (error) {
    logger.error('[PaymentPlanService] Failed to update installment:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function removeInstallment(
  unitId: string, planId: string, index: number, updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const planRef = db.collection(planCollectionPath(unitId)).doc(planId);
    const unitRef = db.collection(COLLECTIONS.UNITS).doc(unitId);

    await db.runTransaction(async (tx) => {
      const planSnap = await tx.get(planRef);
      if (!planSnap.exists) throw new Error('Payment plan not found');
      const plan = { id: planSnap.id, ...planSnap.data() } as PaymentPlan;

      if (plan.status !== 'negotiation' && plan.status !== 'draft') {
        throw new Error('Μπορείτε να αφαιρέσετε δόσεις μόνο σε negotiation/draft');
      }
      if (index < 0 || index >= plan.installments.length) {
        throw new Error(`Δόση #${index} δεν βρέθηκε`);
      }
      if (plan.installments[index].paidAmount > 0) {
        throw new Error('Δεν μπορείτε να αφαιρέσετε πληρωμένη δόση');
      }

      const removedAmount = plan.installments[index].amount;
      const remaining = plan.installments.filter((_, i) => i !== index);

      if (removedAmount > 0 && remaining.length > 0) {
        const unpaidInstallments = remaining.filter((inst) => inst.paidAmount < inst.amount);
        const totalUnpaidRemaining = unpaidInstallments
          .reduce((s, inst) => s + (inst.amount - inst.paidAmount), 0);

        if (totalUnpaidRemaining > 0) {
          for (const inst of remaining) {
            const unpaidPortion = inst.amount - inst.paidAmount;
            if (unpaidPortion <= 0) continue;
            const addBack = Math.round((unpaidPortion / totalUnpaidRemaining) * removedAmount * 100) / 100;
            inst.amount = Math.round((inst.amount + addBack) * 100) / 100;
            if (plan.totalAmount > 0) {
              inst.percentage = Math.round((inst.amount / plan.totalAmount) * 10000) / 100;
            }
          }
        } else {
          const pendingInsts = remaining.filter((inst) => inst.status === 'pending');
          const count = pendingInsts.length || remaining.length;
          const shareEach = Math.round((removedAmount / count) * 100) / 100;
          const targets = pendingInsts.length > 0 ? pendingInsts : remaining;
          for (const inst of targets) {
            inst.amount = Math.round((inst.amount + shareEach) * 100) / 100;
            if (plan.totalAmount > 0) {
              inst.percentage = Math.round((inst.amount / plan.totalAmount) * 10000) / 100;
            }
          }
        }
      }

      const updated = remaining.map((inst, i) => ({ ...inst, index: i }));
      const newTotal = updated.reduce((s, i) => s + i.amount, 0);

      const updatedPlan: PaymentPlan = { ...plan, installments: updated, totalAmount: newTotal, remainingAmount: newTotal - plan.paidAmount };
      const summary = computeSummaryFromPlan(updatedPlan, planId);

      tx.update(planRef, { installments: updated, totalAmount: newTotal, remainingAmount: newTotal - plan.paidAmount, updatedAt: new Date().toISOString(), updatedBy });
      tx.update(unitRef, { 'commercial.paymentSummary': summary });
    });

    logger.info(`[PaymentPlanService] Removed installment #${index} from plan ${planId}`);
    return { success: true };
  } catch (error) {
    logger.error('[PaymentPlanService] Failed to remove installment:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
