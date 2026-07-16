'use client';

/**
 * =============================================================================
 * usePaymentPlan — Data hook for Payment Plan & Installments
 * =============================================================================
 *
 * Fetches payment plan + payments for a unit. Exposes actions for creating
 * plans, recording payments, and managing installments.
 *
 * Mutations run through `runGatewayAction` (ADR-584) — the guard/refetch/result
 * mapping is not re-implemented here.
 *
 * @module hooks/usePaymentPlan
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import { useState, useEffect, useCallback } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { fetchJson } from '@/lib/api/fetch-json';
import { getErrorMessage } from '@/lib/error-utils';
import { runGatewayAction, type ActionResult } from '@/lib/mutations/gateway-action';
import {
  addPaymentInstallmentWithPolicy,
  createPaymentPlanWithPolicy,
  createSplitPaymentPlansWithPolicy,
  deletePaymentPlanWithPolicy,
  recordPropertyPaymentWithPolicy,
  removePaymentInstallmentWithPolicy,
  updatePaymentInstallmentWithPolicy,
  updatePaymentPlanLoanInfoWithPolicy,
  updatePaymentPlanWithPolicy,
} from '@/services/property-finance/property-finance-mutation-gateway';
import type {
  PaymentPlan,
  PaymentRecord,
  CreatePaymentPlanInput,
  CreatePaymentInput,
  CreateSplitPlansInput,
  UpdatePaymentPlanInput,
  CreateInstallmentInput,
  UpdateInstallmentInput,
  LoanInfo,
} from '@/types/payment-plan';

// ============================================================================
// TYPES
// ============================================================================

interface UsePaymentPlanReturn {
  /** @deprecated Use plans[] for multi-owner support (ADR-244) */
  plan: PaymentPlan | null;
  /** ADR-244: All active payment plans (0, 1, or N for split plans) */
  plans: PaymentPlan[];
  /** ADR-244: Plan group type — 'none' (no plans), 'joint' (1 plan), 'individual' (N plans) */
  planGroup: 'none' | 'joint' | 'individual';
  payments: PaymentRecord[];
  isLoading: boolean;
  error: string | null;
  /** ADR-244: Create split plans (1 per owner) */
  createSplitPlans: (input: CreateSplitPlansInput) => Promise<ActionResult>;
  refetch: () => void;
  createPlan: (input: Omit<CreatePaymentPlanInput, 'propertyId'>) => Promise<ActionResult>;
  updatePlan: (planId: string, updates: UpdatePaymentPlanInput) => Promise<ActionResult>;
  recordPayment: (input: CreatePaymentInput) => Promise<ActionResult>;
  addInstallment: (planId: string, input: CreateInstallmentInput, insertAtIndex?: number) => Promise<ActionResult>;
  updateInstallment: (planId: string, index: number, updates: UpdateInstallmentInput) => Promise<ActionResult>;
  removeInstallment: (planId: string, index: number) => Promise<ActionResult>;
  deletePlan: (planId: string) => Promise<ActionResult>;
  /** @deprecated Use useLoanTracking hook instead */
  updateLoan: (planId: string, loan: Partial<LoanInfo>) => Promise<ActionResult>;
}

const NO_PROPERTY = 'No property selected';

// ============================================================================
// HOOK
// ============================================================================

export function usePaymentPlan(propertyId: string | null): UsePaymentPlanReturn {
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = propertyId ? null : NO_PROPERTY;

  // Backward compat: plan = first plan, planGroup = derived
  const plan = plans[0] ?? null;
  const planGroup: 'none' | 'joint' | 'individual' =
    plans.length === 0 ? 'none' :
    plans.length === 1 ? (plans[0].planType ?? 'joint') :
    'individual';

  // Fetch plan + payments
  const fetchData = useCallback(async () => {
    if (!propertyId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [planRes, paymentsRes] = await Promise.all([
        fetchJson<{ success: boolean; data: PaymentPlan | PaymentPlan[] | null }>(
          API_ROUTES.PROPERTIES.PAYMENT_PLAN(propertyId)
        ),
        fetchJson<{ success: boolean; data: PaymentRecord[] }>(
          API_ROUTES.PROPERTIES.PAYMENTS(propertyId)
        ),
      ]);

      // ADR-244: Handle both single plan (legacy) and array (multi-owner) responses
      const planData = planRes.data;
      if (Array.isArray(planData)) {
        setPlans(planData);
      } else {
        setPlans(planData ? [planData] : []);
      }
      setPayments(paymentsRes.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create payment plan — refetch fired off so a slow reload cannot hold up the wizard
  const createPlan = useCallback(
    (input: Omit<CreatePaymentPlanInput, 'propertyId'>) =>
      runGatewayAction(() => createPaymentPlanWithPolicy(propertyId!, input), {
        run: fetchData, blocked, background: 'PaymentPlan.refetch',
      }),
    [propertyId, fetchData, blocked]
  );

  // ADR-244: Create split plans (1 per owner)
  const createSplitPlans = useCallback(
    (input: CreateSplitPlansInput) =>
      runGatewayAction(() => createSplitPaymentPlansWithPolicy(propertyId!, input), {
        run: fetchData, blocked, background: 'PaymentPlan.refetchAfterSplit',
      }),
    [propertyId, fetchData, blocked]
  );

  const updatePlan = useCallback(
    (planId: string, updates: UpdatePaymentPlanInput) =>
      runGatewayAction(() => updatePaymentPlanWithPolicy(propertyId!, planId, updates), {
        run: fetchData, blocked,
      }),
    [propertyId, fetchData, blocked]
  );

  const recordPayment = useCallback(
    (input: CreatePaymentInput) =>
      runGatewayAction(() => recordPropertyPaymentWithPolicy(propertyId!, input), {
        run: fetchData, blocked,
      }),
    [propertyId, fetchData, blocked]
  );

  const addInstallment = useCallback(
    (planId: string, input: CreateInstallmentInput, insertAtIndex?: number) =>
      runGatewayAction(
        () => addPaymentInstallmentWithPolicy(propertyId!, planId, input, insertAtIndex),
        { run: fetchData, blocked }
      ),
    [propertyId, fetchData, blocked]
  );

  const updateInstallment = useCallback(
    (planId: string, index: number, updates: UpdateInstallmentInput) =>
      runGatewayAction(
        () => updatePaymentInstallmentWithPolicy(propertyId!, planId, index, updates),
        { run: fetchData, blocked }
      ),
    [propertyId, fetchData, blocked]
  );

  const removeInstallment = useCallback(
    (planId: string, index: number) =>
      runGatewayAction(() => removePaymentInstallmentWithPolicy(propertyId!, planId, index), {
        run: fetchData, blocked,
      }),
    [propertyId, fetchData, blocked]
  );

  const updateLoan = useCallback(
    (planId: string, loan: Partial<LoanInfo>) =>
      runGatewayAction(() => updatePaymentPlanLoanInfoWithPolicy(propertyId!, planId, loan), {
        run: fetchData, blocked,
      }),
    [propertyId, fetchData, blocked]
  );

  const deletePlan = useCallback(
    (planId: string) =>
      runGatewayAction(() => deletePaymentPlanWithPolicy(propertyId!, planId), {
        run: fetchData, blocked,
      }),
    [propertyId, fetchData, blocked]
  );

  return {
    plan,
    plans,
    planGroup,
    createSplitPlans,
    payments,
    isLoading,
    error,
    refetch: () => { fetchData(); },
    createPlan,
    updatePlan,
    deletePlan,
    recordPayment,
    addInstallment,
    updateInstallment,
    removeInstallment,
    updateLoan,
  };
}
