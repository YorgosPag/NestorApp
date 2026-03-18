/**
 * =============================================================================
 * PaymentPlanService — Payment Plan CRUD & Payment Recording
 * =============================================================================
 *
 * Core service for payment plan management: CRUD, payment recording with
 * partial/split/overpayment support, installment management, and
 * denormalized summary sync to unit.commercial.
 *
 * Uses Admin SDK — called exclusively from API routes.
 *
 * @module services/payment-plan.service
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { generatePaymentPlanId, generatePaymentRecordId } from '@/services/enterprise-id.service';
import type {
  PaymentPlan,
  PaymentPlanStatus,
  PaymentRecord,
  PaymentSummary,
  Installment,
  InstallmentStatus,
  LoanInfo,
  CreatePaymentPlanInput,
  CreatePaymentInput,
  UpdatePaymentPlanInput,
  CreateInstallmentInput,
  UpdateInstallmentInput,
  SplitAllocation,
} from '@/types/payment-plan';
import {
  DEFAULT_PAYMENT_PLAN_CONFIG,
  DEFAULT_LOAN_INFO,
  isValidPlanTransition,
} from '@/types/payment-plan';
import type { LoanTracking } from '@/types/loan-tracking';
import { migrateLoanInfoToTracking } from '@/types/loan-tracking';

const logger = createModuleLogger('PaymentPlanService');

// ============================================================================
// ADMIN DB HELPER
// ============================================================================

function getDb() {
  const db = getAdminFirestore();
  if (!db) throw new Error('Admin Firestore unavailable');
  return db;
}

/** Path helpers */
function planCollectionPath(unitId: string): string {
  return `${COLLECTIONS.UNITS}/${unitId}/${SUBCOLLECTIONS.UNIT_PAYMENT_PLANS}`;
}

function paymentCollectionPath(unitId: string): string {
  return `${COLLECTIONS.UNITS}/${unitId}/${SUBCOLLECTIONS.UNIT_PAYMENTS}`;
}

// ============================================================================
// PAYMENT PLAN SERVICE
// ============================================================================

export class PaymentPlanService {
  // ==========================================================================
  // CRUD — Payment Plans
  // ==========================================================================

  /**
   * Δημιουργία νέου payment plan.
   * Validates: single active plan, sum = totalAmount, no negative amounts.
   */
  static async createPaymentPlan(
    input: CreatePaymentPlanInput,
    createdBy: string
  ): Promise<{ success: boolean; plan?: PaymentPlan; error?: string }> {
    try {
      // Validate single active plan
      const existing = await this.getActivePaymentPlan(input.unitId);
      if (existing && existing.status !== 'cancelled') {
        return {
          success: false,
          error: 'Υπάρχει ήδη ενεργό πρόγραμμα αποπληρωμής για αυτή τη μονάδα',
        };
      }

      // Validate amounts
      if (input.totalAmount <= 0) {
        return { success: false, error: 'Το συνολικό ποσό πρέπει να είναι θετικό' };
      }

      // Validate installments sum
      const installmentSum = input.installments.reduce((s, inst) => s + inst.amount, 0);
      const tolerance = 0.01;
      if (Math.abs(installmentSum - input.totalAmount) > tolerance) {
        return {
          success: false,
          error: `Το άθροισμα δόσεων (€${installmentSum.toFixed(2)}) δεν ταιριάζει με το συνολικό ποσό (€${input.totalAmount.toFixed(2)})`,
        };
      }

      // Build installments array
      const installments: Installment[] = input.installments.map((inst, idx) => ({
        index: idx,
        label: inst.label,
        type: inst.type,
        amount: inst.amount,
        percentage: inst.percentage,
        dueDate: inst.dueDate,
        status: 'pending' as const,
        paidAmount: 0,
        paidDate: null,
        paymentIds: [],
        notes: inst.notes ?? null,
      }));

      const id = generatePaymentPlanId();
      const now = new Date().toISOString();

      const plan: PaymentPlan = {
        id,
        unitId: input.unitId,
        buildingId: input.buildingId,
        projectId: input.projectId,
        buyerContactId: input.buyerContactId,
        buyerName: input.buyerName,
        status: 'negotiation',
        totalAmount: input.totalAmount,
        paidAmount: 0,
        remainingAmount: input.totalAmount,
        currency: 'EUR',
        installments,
        loan: input.loan ? { ...DEFAULT_LOAN_INFO, ...input.loan } : { ...DEFAULT_LOAN_INFO },
        config: { ...DEFAULT_PAYMENT_PLAN_CONFIG, ...input.config },
        taxRegime: input.taxRegime,
        taxRate: input.taxRate,
        notes: input.notes ?? null,
        createdAt: now,
        createdBy,
        updatedAt: now,
        updatedBy: createdBy,
      };

      const db = getDb();
      await db.collection(planCollectionPath(input.unitId)).doc(id).set(plan);

      // Sync summary to unit
      await this.syncPaymentSummary(input.unitId, id);

      logger.info(`[PaymentPlanService] Created plan ${id} for unit ${input.unitId}`);
      return { success: true, plan };
    } catch (error) {
      logger.error('[PaymentPlanService] Failed to create plan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Ανάκτηση ενεργού payment plan (non-cancelled).
   */
  static async getActivePaymentPlan(unitId: string): Promise<PaymentPlan | null> {
    try {
      const db = getDb();
      const snapshot = await db
        .collection(planCollectionPath(unitId))
        .where('status', 'in', ['negotiation', 'draft', 'active', 'completed'])
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as PaymentPlan;
    } catch (error) {
      logger.error('[PaymentPlanService] Failed to get active plan:', error);
      return null;
    }
  }

  /**
   * Ανάκτηση plan by ID.
   */
  static async getPaymentPlan(unitId: string, planId: string): Promise<PaymentPlan | null> {
    try {
      const db = getDb();
      const snap = await db.collection(planCollectionPath(unitId)).doc(planId).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() } as PaymentPlan;
    } catch (error) {
      logger.error('[PaymentPlanService] Failed to get plan:', error);
      return null;
    }
  }

  /**
   * Ενημέρωση plan (μόνο negotiation/draft).
   */
  static async updatePaymentPlan(
    unitId: string,
    planId: string,
    input: UpdatePaymentPlanInput,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const plan = await this.getPaymentPlan(unitId, planId);
      if (!plan) return { success: false, error: 'Payment plan not found' };

      if (plan.status !== 'negotiation' && plan.status !== 'draft') {
        return { success: false, error: 'Μπορείτε να τροποποιήσετε μόνο plans σε negotiation/draft' };
      }

      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
        updatedBy,
      };

      if (input.notes !== undefined) updates.notes = input.notes;
      if (input.taxRegime !== undefined) updates.taxRegime = input.taxRegime;
      if (input.taxRate !== undefined) updates.taxRate = input.taxRate;
      if (input.config !== undefined) {
        updates.config = { ...plan.config, ...input.config };
      }

      const db = getDb();
      await db.collection(planCollectionPath(unitId)).doc(planId).update(updates);

      logger.info(`[PaymentPlanService] Updated plan ${planId}`);
      return { success: true };
    } catch (error) {
      logger.error('[PaymentPlanService] Failed to update plan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete payment plan (negotiation/draft only, no payments recorded).
   */
  static async deletePlan(
    unitId: string,
    planId: string,
    deletedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const plan = await this.getPaymentPlan(unitId, planId);
      if (!plan) return { success: false, error: 'Payment plan not found' };

      if (plan.status !== 'negotiation' && plan.status !== 'draft') {
        return { success: false, error: 'Μπορείτε να διαγράψετε μόνο plans σε negotiation/draft' };
      }
      if (plan.paidAmount > 0) {
        return { success: false, error: 'Δεν μπορείτε να διαγράψετε plan με καταγεγραμμένες πληρωμές' };
      }

      const db = getDb();
      await db.collection(planCollectionPath(unitId)).doc(planId).delete();

      // Clear payment summary from unit
      await db.collection(COLLECTIONS.UNITS).doc(unitId).update({
        'commercial.paymentSummary': null,
        updatedAt: new Date().toISOString(),
      });

      logger.info(`[PaymentPlanService] Deleted plan ${planId} by ${deletedBy}`);
      return { success: true };
    } catch (error) {
      logger.error('[PaymentPlanService] Failed to delete plan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // STATUS TRANSITIONS
  // ==========================================================================

  /**
   * Activate plan (negotiation/draft → active).
   */
  static async activatePlan(
    unitId: string,
    planId: string,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.transitionPlanStatus(unitId, planId, 'active', updatedBy);
  }

  /**
   * Cancel plan.
   */
  static async cancelPlan(
    unitId: string,
    planId: string,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.transitionPlanStatus(unitId, planId, 'cancelled', updatedBy);
  }

  /**
   * Generic status transition with FSM validation.
   */
  private static async transitionPlanStatus(
    unitId: string,
    planId: string,
    targetStatus: PaymentPlanStatus,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const plan = await this.getPaymentPlan(unitId, planId);
      if (!plan) return { success: false, error: 'Payment plan not found' };

      if (!isValidPlanTransition(plan.status, targetStatus)) {
        return {
          success: false,
          error: `Μη έγκυρη μετάβαση: ${plan.status} → ${targetStatus}`,
        };
      }

      const db = getDb();
      await db.collection(planCollectionPath(unitId)).doc(planId).update({
        status: targetStatus,
        updatedAt: new Date().toISOString(),
        updatedBy,
      });

      await this.syncPaymentSummary(unitId, planId);

      logger.info(`[PaymentPlanService] Plan ${planId}: ${plan.status} → ${targetStatus}`);
      return { success: true };
    } catch (error) {
      logger.error('[PaymentPlanService] Failed to transition plan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // INSTALLMENT MANAGEMENT
  // ==========================================================================

  /**
   * Add installment to plan (negotiation/draft only).
   */
  static async addInstallment(
    unitId: string,
    planId: string,
    input: CreateInstallmentInput,
    updatedBy: string,
    insertAtIndex?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const plan = await this.getPaymentPlan(unitId, planId);
      if (!plan) return { success: false, error: 'Payment plan not found' };
      if (plan.status !== 'negotiation' && plan.status !== 'draft') {
        return { success: false, error: 'Μπορείτε να προσθέσετε δόσεις μόνο σε negotiation/draft' };
      }

      const newInstallment: Installment = {
        index: 0, // Will be re-indexed below
        label: input.label,
        type: input.type,
        amount: input.amount,
        percentage: input.percentage,
        dueDate: input.dueDate,
        status: 'pending',
        paidAmount: 0,
        paidDate: null,
        paymentIds: [],
        notes: input.notes ?? null,
      };

      // ── Validate & redistribute amounts: keep totalAmount constant ──
      const existingInstallments = plan.installments;
      const totalUnpaid = existingInstallments
        .filter((inst) => inst.paidAmount < inst.amount)
        .reduce((s, inst) => s + (inst.amount - inst.paidAmount), 0);
      const addedAmount = newInstallment.amount;

      // Guard: new installment cannot exceed 95% of unpaid (leave min balance)
      const maxAllowed = Math.round(totalUnpaid * 0.95 * 100) / 100;
      if (existingInstallments.length > 0 && addedAmount > maxAllowed) {
        const fmt = (v: number) => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
        return {
          success: false,
          error: `Το ποσό ${fmt(addedAmount)} υπερβαίνει το μέγιστο επιτρεπτό ${fmt(maxAllowed)} (95% του αδιάθετου υπολοίπου ${fmt(totalUnpaid)}). Οι υπόλοιπες δόσεις πρέπει να διατηρήσουν ελάχιστο υπόλοιπο.`,
        };
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
      // Re-index all installments
      updatedInstallments = updatedInstallments.map((inst, i) => ({ ...inst, index: i }));
      const newTotal = updatedInstallments.reduce((s, i) => s + i.amount, 0);

      const db = getDb();
      await db.collection(planCollectionPath(unitId)).doc(planId).update({
        installments: updatedInstallments,
        totalAmount: newTotal,
        remainingAmount: newTotal - plan.paidAmount,
        updatedAt: new Date().toISOString(),
        updatedBy,
      });

      await this.syncPaymentSummary(unitId, planId);

      logger.info(`[PaymentPlanService] Added installment #${newInstallment.index} to plan ${planId}`);
      return { success: true };
    } catch (error) {
      logger.error('[PaymentPlanService] Failed to add installment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update installment (negotiation/draft only, or notes for active).
   */
  static async updateInstallment(
    unitId: string,
    planId: string,
    index: number,
    input: UpdateInstallmentInput,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const plan = await this.getPaymentPlan(unitId, planId);
      if (!plan) return { success: false, error: 'Payment plan not found' };

      if (index < 0 || index >= plan.installments.length) {
        return { success: false, error: `Δόση #${index} δεν βρέθηκε` };
      }

      // Active plans: only notes can be updated
      if (plan.status === 'active') {
        if (input.label || input.amount !== undefined || input.percentage !== undefined || input.dueDate) {
          return { success: false, error: 'Σε ενεργό plan μπορείτε να αλλάξετε μόνο σημειώσεις' };
        }
      } else if (plan.status !== 'negotiation' && plan.status !== 'draft') {
        return { success: false, error: 'Δεν μπορείτε να τροποποιήσετε δόσεις σε αυτό το status' };
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

      // ── Redistribute delta to keep totalAmount constant ──
      const amountDelta = inst.amount - oldAmount;
      if (amountDelta > 0 && input.amount !== undefined) {
        const othersUnpaid = updated
          .filter((item, i) => i !== index && item.paidAmount < item.amount)
          .reduce((s, item) => s + (item.amount - item.paidAmount), 0);

        const maxIncrease = Math.round(othersUnpaid * 0.95 * 100) / 100;
        if (amountDelta > maxIncrease) {
          const fmt = (v: number) => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
          return {
            success: false,
            error: `Η αύξηση κατά ${fmt(amountDelta)} υπερβαίνει το μέγιστο ${fmt(maxIncrease)} (95% του αδιάθετου υπολοίπου ${fmt(othersUnpaid)}).`,
          };
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
            updated[i] = {
              ...updated[i],
              amount: Math.round((updated[i].amount - adjustment) * 100) / 100,
            };
            if (plan.totalAmount > 0) {
              updated[i] = {
                ...updated[i],
                percentage: Math.round((updated[i].amount / plan.totalAmount) * 10000) / 100,
              };
            }
          }
        }
        // Update edited installment percentage too
        if (plan.totalAmount > 0) {
          updated[index] = {
            ...updated[index],
            percentage: Math.round((updated[index].amount / plan.totalAmount) * 10000) / 100,
          };
        }
      }

      const newTotal = updated.reduce((s, i) => s + i.amount, 0);

      const db = getDb();
      await db.collection(planCollectionPath(unitId)).doc(planId).update({
        installments: updated,
        totalAmount: newTotal,
        remainingAmount: newTotal - plan.paidAmount,
        updatedAt: new Date().toISOString(),
        updatedBy,
      });

      await this.syncPaymentSummary(unitId, planId);

      logger.info(`[PaymentPlanService] Updated installment #${index} in plan ${planId}`);
      return { success: true };
    } catch (error) {
      logger.error('[PaymentPlanService] Failed to update installment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Remove installment (negotiation/draft only, no paid installments).
   */
  static async removeInstallment(
    unitId: string,
    planId: string,
    index: number,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const plan = await this.getPaymentPlan(unitId, planId);
      if (!plan) return { success: false, error: 'Payment plan not found' };
      if (plan.status !== 'negotiation' && plan.status !== 'draft') {
        return { success: false, error: 'Μπορείτε να αφαιρέσετε δόσεις μόνο σε negotiation/draft' };
      }
      if (index < 0 || index >= plan.installments.length) {
        return { success: false, error: `Δόση #${index} δεν βρέθηκε` };
      }
      if (plan.installments[index].paidAmount > 0) {
        return { success: false, error: 'Δεν μπορείτε να αφαιρέσετε πληρωμένη δόση' };
      }

      // ── Redistribute: give removed amount back to remaining installments ──
      const removedAmount = plan.installments[index].amount;
      const remaining = plan.installments.filter((_, i) => i !== index);

      if (removedAmount > 0 && remaining.length > 0) {
        // Find installments that can receive the redistributed amount
        const unpaidInstallments = remaining.filter((inst) => inst.paidAmount < inst.amount);
        const totalUnpaidRemaining = unpaidInstallments
          .reduce((s, inst) => s + (inst.amount - inst.paidAmount), 0);

        if (totalUnpaidRemaining > 0) {
          // Proportional redistribution based on unpaid portions
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
          // Edge case: all remaining have 0 unpaid → distribute equally among pending
          const pendingInstallments = remaining.filter((inst) => inst.status === 'pending');
          const count = pendingInstallments.length || remaining.length;
          const shareEach = Math.round((removedAmount / count) * 100) / 100;
          const targets = pendingInstallments.length > 0 ? pendingInstallments : remaining;
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

      const db = getDb();
      await db.collection(planCollectionPath(unitId)).doc(planId).update({
        installments: updated,
        totalAmount: newTotal,
        remainingAmount: newTotal - plan.paidAmount,
        updatedAt: new Date().toISOString(),
        updatedBy,
      });

      await this.syncPaymentSummary(unitId, planId);

      logger.info(`[PaymentPlanService] Removed installment #${index} from plan ${planId}`);
      return { success: true };
    } catch (error) {
      logger.error('[PaymentPlanService] Failed to remove installment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // PAYMENT RECORDING — CRITICAL BUSINESS LOGIC
  // ==========================================================================

  /**
   * Record a payment.
   *
   * Handles: normal (1:1), partial, overpayment with auto-apply.
   * Updates installment status, recalculates amounts, syncs summary.
   */
  static async recordPayment(
    unitId: string,
    input: CreatePaymentInput,
    createdBy: string
  ): Promise<{ success: boolean; payment?: PaymentRecord; error?: string }> {
    try {
      const plan = await this.getPaymentPlan(unitId, input.paymentPlanId);
      if (!plan) return { success: false, error: 'Payment plan not found' };

      if (plan.status === 'completed' || plan.status === 'cancelled') {
        return { success: false, error: 'Δεν μπορείτε να καταγράψετε πληρωμή σε ολοκληρωμένο/ακυρωμένο plan' };
      }

      if (input.amount <= 0) {
        return { success: false, error: 'Το ποσό πρέπει να είναι θετικό' };
      }

      const targetIdx = input.installmentIndex;
      if (targetIdx < 0 || targetIdx >= plan.installments.length) {
        return { success: false, error: `Δόση #${targetIdx} δεν βρέθηκε` };
      }

      // Sequential payment check
      if (plan.config.sequentialPaymentRequired) {
        for (let i = 0; i < targetIdx; i++) {
          const prev = plan.installments[i];
          if (prev.status !== 'paid' && prev.status !== 'waived') {
            return {
              success: false,
              error: `Η δόση #${i} (${prev.label}) πρέπει να εξοφληθεί πρώτα`,
            };
          }
        }
      }

      const targetInst = plan.installments[targetIdx];
      const targetRemaining = targetInst.amount - targetInst.paidAmount;

      if (targetRemaining <= 0) {
        return { success: false, error: `Η δόση #${targetIdx} (${targetInst.label}) είναι ήδη εξοφλημένη` };
      }

      // Calculate allocations
      const allocations: SplitAllocation[] = [];
      let remainingPayment = input.amount;
      const updatedInstallments = [...plan.installments.map((inst) => ({ ...inst }))];

      // Apply to target installment
      const applyToTarget = Math.min(remainingPayment, targetRemaining);
      updatedInstallments[targetIdx].paidAmount += applyToTarget;
      updatedInstallments[targetIdx].status = this.computeInstallmentStatus(
        updatedInstallments[targetIdx]
      );
      if (updatedInstallments[targetIdx].status === 'paid') {
        updatedInstallments[targetIdx].paidDate = input.paymentDate;
      }
      allocations.push({ installmentIndex: targetIdx, amount: applyToTarget });
      remainingPayment -= applyToTarget;

      // Overpayment auto-apply
      let overpaymentAmount = 0;
      if (remainingPayment > 0 && plan.config.autoApplyOverpayment) {
        for (let i = targetIdx + 1; i < updatedInstallments.length && remainingPayment > 0; i++) {
          const inst = updatedInstallments[i];
          const instRemaining = inst.amount - inst.paidAmount;
          if (instRemaining <= 0) continue;

          const applyAmount = Math.min(remainingPayment, instRemaining);
          inst.paidAmount += applyAmount;
          inst.status = this.computeInstallmentStatus(inst);
          if (inst.status === 'paid') {
            inst.paidDate = input.paymentDate;
          }
          allocations.push({ installmentIndex: i, amount: applyAmount });
          remainingPayment -= applyAmount;
        }
      }

      if (remainingPayment > 0) {
        overpaymentAmount = remainingPayment;
      }

      // Create payment record
      const paymentId = generatePaymentRecordId();
      const now = new Date().toISOString();

      const paymentRecord: PaymentRecord = {
        id: paymentId,
        paymentPlanId: input.paymentPlanId,
        installmentIndex: targetIdx,
        amount: input.amount,
        method: input.method,
        paymentDate: input.paymentDate,
        methodDetails: input.methodDetails,
        splitAllocations: allocations,
        overpaymentAmount,
        invoiceId: null,
        transactionChainId: null,
        notes: input.notes ?? null,
        createdAt: now,
        createdBy,
        updatedAt: now,
      };

      // Update installment paymentIds
      for (const alloc of allocations) {
        const inst = updatedInstallments[alloc.installmentIndex];
        if (!inst.paymentIds.includes(paymentId)) {
          inst.paymentIds = [...inst.paymentIds, paymentId];
        }
      }

      // Recalculate plan amounts
      const newPaidAmount = updatedInstallments.reduce((s, i) => s + i.paidAmount, 0);
      const newRemainingAmount = plan.totalAmount - newPaidAmount;

      // Check if all paid → completed
      const allPaid = updatedInstallments.every(
        (i) => i.status === 'paid' || i.status === 'waived'
      );
      const newStatus = allPaid ? 'completed' : plan.status;

      // Batch write: payment record + plan update
      const db = getDb();
      const batch = db.batch();

      batch.set(
        db.collection(paymentCollectionPath(unitId)).doc(paymentId),
        paymentRecord
      );

      batch.update(
        db.collection(planCollectionPath(unitId)).doc(input.paymentPlanId),
        {
          installments: updatedInstallments,
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
          updatedAt: now,
          updatedBy: createdBy,
        }
      );

      await batch.commit();

      // Sync summary
      await this.syncPaymentSummary(unitId, input.paymentPlanId);

      logger.info(
        `[PaymentPlanService] Recorded payment ${paymentId}: €${input.amount} for installment #${targetIdx}` +
        (allocations.length > 1 ? ` (split across ${allocations.length} installments)` : '') +
        (overpaymentAmount > 0 ? ` (overpayment: €${overpaymentAmount})` : '')
      );

      return { success: true, payment: paymentRecord };
    } catch (error) {
      logger.error('[PaymentPlanService] Failed to record payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all payments for a unit.
   */
  static async getPayments(unitId: string): Promise<PaymentRecord[]> {
    try {
      const db = getDb();
      const snapshot = await db
        .collection(paymentCollectionPath(unitId))
        .orderBy('createdAt', 'desc')
        .get();
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as PaymentRecord);
    } catch (error) {
      logger.error('[PaymentPlanService] Failed to get payments:', error);
      return [];
    }
  }

  // ==========================================================================
  // LOAN INFO
  // ==========================================================================

  /**
   * Update loan info on a payment plan.
   * @deprecated Use LoanTrackingService for Phase 2 multi-bank support.
   */
  static async updateLoanInfo(
    unitId: string,
    planId: string,
    loan: Partial<LoanInfo>,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const plan = await this.getPaymentPlan(unitId, planId);
      if (!plan) return { success: false, error: 'Payment plan not found' };

      const updatedLoan: LoanInfo = { ...plan.loan, ...loan };

      // Validate loan amount
      if (updatedLoan.loanAmount !== null && updatedLoan.loanAmount > plan.totalAmount) {
        return { success: false, error: 'Το ποσό δανείου δεν μπορεί να υπερβαίνει το συνολικό ποσό' };
      }

      const db = getDb();
      await db.collection(planCollectionPath(unitId)).doc(planId).update({
        loan: updatedLoan,
        updatedAt: new Date().toISOString(),
        updatedBy,
      });

      await this.syncPaymentSummary(unitId, planId);

      logger.info(`[PaymentPlanService] Updated loan info for plan ${planId}`);
      return { success: true };
    } catch (error) {
      logger.error('[PaymentPlanService] Failed to update loan info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // DENORMALIZATION — Sync PaymentSummary to unit.commercial
  // ==========================================================================

  /**
   * Sync denormalized PaymentSummary to unit.commercial.paymentSummary.
   */
  static async syncPaymentSummary(unitId: string, planId: string): Promise<void> {
    try {
      const plan = await this.getPaymentPlan(unitId, planId);
      if (!plan) return;

      const now = new Date().toISOString();
      const paidInstallments = plan.installments.filter(
        (i) => i.status === 'paid' || i.status === 'waived'
      ).length;

      const overdueInstallments = plan.installments.filter((i) => {
        if (i.status === 'paid' || i.status === 'waived') return false;
        return i.dueDate < now && i.paidAmount < i.amount;
      }).length;

      // Find next unpaid installment
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

      const summary: PaymentSummary = {
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

      const db = getDb();
      await db.collection(COLLECTIONS.UNITS).doc(unitId).update({
        'commercial.paymentSummary': summary,
      });

      logger.info(
        `[PaymentPlanService] Synced summary for unit ${unitId}: ` +
        `${summary.paidPercentage}% paid, ${paidInstallments}/${summary.totalInstallments} installments`
      );
    } catch (error) {
      logger.error('[PaymentPlanService] Failed to sync summary:', error);
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Compute installment status from paid amount vs total.
   */
  private static computeInstallmentStatus(installment: Installment): InstallmentStatus {
    if (installment.paidAmount >= installment.amount) return 'paid';
    if (installment.paidAmount > 0) return 'partial';
    return installment.status === 'waived' ? 'waived' : 'pending';
  }
}

export default PaymentPlanService;
