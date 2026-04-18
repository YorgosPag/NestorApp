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
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
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
import { nowISO } from '@/lib/date-local';

// ============================================================================
// RESYNC TOTAL AMOUNT
// ============================================================================

export async function resyncTotalAmount(
  propertyId: string,
  newSalePrice: number,
  updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const activePlan = await getActivePaymentPlan(propertyId);
    if (!activePlan) return { success: true };
    if (newSalePrice === activePlan.totalAmount) return { success: true };
    if (activePlan.status !== 'negotiation' && activePlan.status !== 'draft') {
      logger.info(`[PaymentPlanService] Skipping resync: plan ${activePlan.id} is ${activePlan.status}`);
      return { success: true };
    }

    const planRef = db.collection(planCollectionPath(propertyId)).doc(activePlan.id);
    const propertyRef = db.collection(COLLECTIONS.PROPERTIES).doc(propertyId);

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
          `New price (${newSalePrice}) would reduce plan by ${Math.abs(delta)} but unallocated balance is only ${totalUnpaid}.`
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
        updatedAt: nowISO(),
        updatedBy,
      });
      tx.update(propertyRef, { 'commercial.paymentSummary': summary });

      logger.info(`[PaymentPlanService] Resynced plan ${plan.id}: ${oldTotal} → ${newTotal} (delta: ${delta})`);
    });

    // ADR-195 — Entity audit trail (user-initiated sale price resync)
    const propSnap = await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
    const propCompanyId = (propSnap.data()?.companyId as string | undefined) ?? null;
    if (propCompanyId) {
      await EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.PROPERTY,
        entityId: propertyId,
        entityName: null,
        action: 'updated',
        changes: [
          {
            field: 'commercial.paymentSummary',
            oldValue: activePlan.totalAmount,
            newValue: newSalePrice,
            label: 'Αναπροσαρμογή Τιμής Πώλησης',
          },
        ],
        performedBy: updatedBy,
        performedByName: null,
        companyId: propCompanyId,
      });
    }

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
  propertyId: string,
  planId: string,
  deletedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const plan = await getPaymentPlan(propertyId, planId);
    if (!plan) return { success: false, error: 'Payment plan not found' };

    if (plan.status !== 'negotiation' && plan.status !== 'draft') {
      return { success: false, error: 'Can only delete plans in negotiation/draft status' };
    }
    if (plan.paidAmount > 0) {
      return { success: false, error: 'Cannot delete plan with recorded payments' };
    }

    const db = getDb();
    await db.collection(planCollectionPath(propertyId)).doc(planId).delete();
    await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).update({
      'commercial.paymentSummary': null,
      updatedAt: nowISO(),
    });

    logger.info(`[PaymentPlanService] Deleted plan ${planId} by ${deletedBy}`);
    return { success: true };
  } catch (error) {
    logger.error('[PaymentPlanService] Failed to delete plan:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function activatePlan(
  propertyId: string, planId: string, updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  return transitionPlanStatus(propertyId, planId, 'active', updatedBy);
}

export async function cancelPlan(
  propertyId: string, planId: string, updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  return transitionPlanStatus(propertyId, planId, 'cancelled', updatedBy);
}

async function transitionPlanStatus(
  propertyId: string, planId: string, targetStatus: PaymentPlanStatus, updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const plan = await getPaymentPlan(propertyId, planId);
    if (!plan) return { success: false, error: 'Payment plan not found' };

    if (!isValidPlanTransition(plan.status, targetStatus)) {
      return { success: false, error: `Invalid transition: ${plan.status} → ${targetStatus}` };
    }

    const db = getDb();
    await db.collection(planCollectionPath(propertyId)).doc(planId).update({
      status: targetStatus,
      updatedAt: nowISO(),
      updatedBy,
    });

    await syncPaymentSummary(propertyId, planId);

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
  propertyId: string, planId: string, input: CreateInstallmentInput,
  updatedBy: string, insertAtIndex?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const planRef = db.collection(planCollectionPath(propertyId)).doc(planId);
    const propertyRef = db.collection(COLLECTIONS.PROPERTIES).doc(propertyId);

    await db.runTransaction(async (tx) => {
      const planSnap = await tx.get(planRef);
      if (!planSnap.exists) throw new Error('Payment plan not found');
      const plan = { id: planSnap.id, ...planSnap.data() } as PaymentPlan;

      if (plan.status !== 'negotiation' && plan.status !== 'draft') {
        throw new Error('Can only add installments in negotiation/draft status');
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
          `Amount ${fmt(addedAmount)} exceeds maximum allowed ${fmt(maxAllowed)} (95% of unallocated balance ${fmt(totalUnpaid)}).`
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

      tx.update(planRef, { installments: updatedInstallments, totalAmount: newTotal, remainingAmount: newTotal - plan.paidAmount, updatedAt: nowISO(), updatedBy });
      tx.update(propertyRef, { 'commercial.paymentSummary': summary });
    });

    logger.info(`[PaymentPlanService] Added installment to plan ${planId}`);
    return { success: true };
  } catch (error) {
    logger.error('[PaymentPlanService] Failed to add installment:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateInstallment(
  propertyId: string, planId: string, index: number,
  input: UpdateInstallmentInput, updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const planRef = db.collection(planCollectionPath(propertyId)).doc(planId);
    const propertyRef = db.collection(COLLECTIONS.PROPERTIES).doc(propertyId);

    await db.runTransaction(async (tx) => {
      const planSnap = await tx.get(planRef);
      if (!planSnap.exists) throw new Error('Payment plan not found');
      const plan = { id: planSnap.id, ...planSnap.data() } as PaymentPlan;

      if (index < 0 || index >= plan.installments.length) {
        throw new Error(`Installment #${index} not found`);
      }

      if (plan.status === 'active') {
        if (input.label || input.amount !== undefined || input.percentage !== undefined || input.dueDate) {
          throw new Error('Active plan — only notes can be modified');
        }
      } else if (plan.status !== 'negotiation' && plan.status !== 'draft') {
        throw new Error('Cannot modify installments in this status');
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
            `Increase of ${fmt(amountDelta)} exceeds maximum ${fmt(maxIncrease)} (95% of unallocated balance ${fmt(othersUnpaid)}).`
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

      tx.update(planRef, { installments: updated, totalAmount: newTotal, remainingAmount: newTotal - plan.paidAmount, updatedAt: nowISO(), updatedBy });
      tx.update(propertyRef, { 'commercial.paymentSummary': summary });
    });

    logger.info(`[PaymentPlanService] Updated installment #${index} in plan ${planId}`);
    return { success: true };
  } catch (error) {
    logger.error('[PaymentPlanService] Failed to update installment:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function removeInstallment(
  propertyId: string, planId: string, index: number, updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const planRef = db.collection(planCollectionPath(propertyId)).doc(planId);
    const propertyRef = db.collection(COLLECTIONS.PROPERTIES).doc(propertyId);

    await db.runTransaction(async (tx) => {
      const planSnap = await tx.get(planRef);
      if (!planSnap.exists) throw new Error('Payment plan not found');
      const plan = { id: planSnap.id, ...planSnap.data() } as PaymentPlan;

      if (plan.status !== 'negotiation' && plan.status !== 'draft') {
        throw new Error('Can only remove installments in negotiation/draft status');
      }
      if (index < 0 || index >= plan.installments.length) {
        throw new Error(`Installment #${index} not found`);
      }
      if (plan.installments[index].paidAmount > 0) {
        throw new Error('Cannot remove a paid installment');
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

      tx.update(planRef, { installments: updated, totalAmount: newTotal, remainingAmount: newTotal - plan.paidAmount, updatedAt: nowISO(), updatedBy });
      tx.update(propertyRef, { 'commercial.paymentSummary': summary });
    });

    logger.info(`[PaymentPlanService] Removed installment #${index} from plan ${planId}`);
    return { success: true };
  } catch (error) {
    logger.error('[PaymentPlanService] Failed to remove installment:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
