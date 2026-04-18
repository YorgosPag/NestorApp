/**
 * =============================================================================
 * PaymentPlanService — Facade for Payment Plan Management
 * =============================================================================
 *
 * Thin class that delegates to focused modules (SRP — Google standard):
 * - payment-plan-core.ts — DB helpers, pure computation, simple reads
 * - payment-plan-installments.service.ts — Installment CRUD + plan status
 * - payment-plan-recording.service.ts — Payment recording, loans, summary sync
 *
 * External code calls PaymentPlanService.xxx() — internal split is transparent.
 *
 * @module services/payment-plan.service
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { generatePaymentPlanId, generatePlanGroupId } from '@/services/enterprise-id.service';
import type {
  PaymentPlan,
  PaymentRecord,
  Installment,
  CreatePaymentPlanInput,
  UpdatePaymentPlanInput,
  CreateInstallmentInput,
} from '@/types/payment-plan';
import {
  DEFAULT_PAYMENT_PLAN_CONFIG,
  DEFAULT_LOAN_INFO,
} from '@/types/payment-plan';
import {
  getDb,
  planCollectionPath,
  getActivePaymentPlan,
  getPaymentPlans,
  getPaymentPlan,
} from './payment-plan-core';

// Re-export for backward-compat barrel imports
export type { PaymentPlan, PaymentRecord };

// Delegated modules
import {
  resyncTotalAmount,
  deletePlan,
  activatePlan,
  cancelPlan,
  addInstallment,
  updateInstallment,
  removeInstallment,
} from './payment-plan-installments.service';
import {
  recordPayment,
  getPayments,
  updateLoanInfo,
  syncPaymentSummary,
  syncAggregatedPaymentSummary,
} from './payment-plan-recording.service';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('PaymentPlanService');

// ============================================================================
// PAYMENT PLAN SERVICE — FACADE CLASS
// ============================================================================

export class PaymentPlanService {
  // ==========================================================================
  // CRUD — Plan Creation & Update (kept in this file)
  // ==========================================================================

  static async createPaymentPlan(
    input: CreatePaymentPlanInput,
    createdBy: string,
    options?: { skipSummarySync?: boolean }
  ): Promise<{ success: boolean; plan?: PaymentPlan; error?: string }> {
    try {
      const installments: Installment[] = input.installments.map((inst, i) => ({
        index: i,
        label: inst.label,
        type: inst.type,
        amount: inst.amount,
        percentage: inst.percentage,
        dueDate: inst.dueDate,
        status: 'pending',
        paidAmount: 0,
        paidDate: null,
        paymentIds: [],
        notes: inst.notes ?? null,
      }));

      const id = generatePaymentPlanId();
      const now = nowISO();

      const plan: PaymentPlan = {
        id,
        propertyId: input.propertyId,
        buildingId: input.buildingId,
        projectId: input.projectId,
        status: 'negotiation',
        // ADR-244 Phase 3: Owner fields (SSoT)
        planGroupId: input.planGroupId ?? null,
        planType: input.planType ?? 'joint',
        ownerContactId: input.ownerContactId,
        ownerName: input.ownerName,
        ownershipPct: input.ownershipPct ?? null,
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
      await db.collection(planCollectionPath(input.propertyId)).doc(id).set(plan);

      if (!options?.skipSummarySync) {
        await syncPaymentSummary(input.propertyId, id);
      }

      logger.info(`[PaymentPlanService] Created plan ${id} for property ${input.propertyId}`);
      return { success: true, plan };
    } catch (error) {
      logger.error('[PaymentPlanService] Failed to create plan:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /** @deprecated Use getPaymentPlans() for multi-plan support (ADR-244) */
  static getActivePaymentPlan = getActivePaymentPlan;
  static getPaymentPlans = getPaymentPlans;
  static getPaymentPlan = getPaymentPlan;

  static async createSplitPaymentPlans(
    propertyId: string,
    owners: Array<{ contactId: string; name: string; ownershipPct: number }>,
    baseInput: {
      buildingId: string;
      projectId: string;
      taxRegime: import('@/types/payment-plan').SaleTaxRegime;
      taxRate: number;
      config?: Partial<import('@/types/payment-plan').PaymentPlanConfig>;
      loan?: Partial<import('@/types/payment-plan').LoanInfo>;
      notes?: string;
    },
    totalPrice: number,
    baseInstallments: CreateInstallmentInput[],
    createdBy: string,
  ): Promise<{ success: boolean; plans?: PaymentPlan[]; error?: string }> {
    try {
      const groupId = generatePlanGroupId();
      const createdPlans: PaymentPlan[] = [];

      for (const owner of owners) {
        const ownerAmount = Math.round((totalPrice * owner.ownershipPct / 100) * 100) / 100;
        const scaledInstallments: CreateInstallmentInput[] = baseInstallments.map(inst => ({
          ...inst,
          amount: Math.round((inst.amount * owner.ownershipPct / 100) * 100) / 100,
        }));

        const scaledSum = scaledInstallments.reduce((s, i) => s + i.amount, 0);
        if (scaledInstallments.length > 0 && Math.abs(scaledSum - ownerAmount) > 0.01) {
          scaledInstallments[scaledInstallments.length - 1].amount += ownerAmount - scaledSum;
        }

        const result = await this.createPaymentPlan(
          {
            ...baseInput,
            propertyId,
            ownerContactId: owner.contactId,
            ownerName: owner.name,
            totalAmount: ownerAmount,
            installments: scaledInstallments,
            planGroupId: groupId,
            planType: 'individual',
            ownershipPct: owner.ownershipPct,
          },
          createdBy,
          { skipSummarySync: true },
        );

        if (!result.success) return { success: false, error: result.error };
        if (result.plan) createdPlans.push(result.plan);
      }

      await syncAggregatedPaymentSummary(propertyId);

      logger.info(`[PaymentPlanService] Created ${createdPlans.length} split plans for property ${propertyId}`);
      return { success: true, plans: createdPlans };
    } catch (error) {
      logger.error('[PaymentPlanService] Failed to create split plans:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async updatePaymentPlan(
    propertyId: string, planId: string, input: UpdatePaymentPlanInput, updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const plan = await getPaymentPlan(propertyId, planId);
      if (!plan) return { success: false, error: 'Payment plan not found' };

      if (plan.status !== 'negotiation' && plan.status !== 'draft') {
        return { success: false, error: 'Μπορείτε να τροποποιήσετε μόνο plans σε negotiation/draft' };
      }

      const updates: Record<string, unknown> = {
        updatedAt: nowISO(),
        updatedBy,
      };
      if (input.notes !== undefined) updates.notes = input.notes;
      if (input.taxRegime !== undefined) updates.taxRegime = input.taxRegime;
      if (input.taxRate !== undefined) updates.taxRate = input.taxRate;
      if (input.config !== undefined) updates.config = { ...plan.config, ...input.config };

      const db = getDb();
      await db.collection(planCollectionPath(propertyId)).doc(planId).update(updates);

      logger.info(`[PaymentPlanService] Updated plan ${planId}`);
      return { success: true };
    } catch (error) {
      logger.error('[PaymentPlanService] Failed to update plan:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  // ==========================================================================
  // DELEGATED METHODS (from extracted modules)
  // ==========================================================================

  static resyncTotalAmount = resyncTotalAmount;
  static deletePlan = deletePlan;
  static activatePlan = activatePlan;
  static cancelPlan = cancelPlan;
  static addInstallment = addInstallment;
  static updateInstallment = updateInstallment;
  static removeInstallment = removeInstallment;
  static recordPayment = recordPayment;
  static getPayments = getPayments;
  static updateLoanInfo = updateLoanInfo;
  static syncPaymentSummary = syncPaymentSummary;
  static syncAggregatedPaymentSummary = syncAggregatedPaymentSummary;
}

export default PaymentPlanService;
