'use client';

/**
 * =============================================================================
 * usePaymentPlan — Data hook for Payment Plan & Installments
 * =============================================================================
 *
 * Fetches payment plan + payments for a unit. Exposes actions for creating
 * plans, recording payments, and managing installments.
 *
 * @module hooks/usePaymentPlan
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import { useState, useEffect, useCallback } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { getErrorMessage } from '@/lib/error-utils';
import { clientSafeFireAndForget } from '@/lib/safe-fire-and-forget';
import type {
  PaymentPlan,
  PaymentRecord,
  CreatePaymentPlanInput,
  CreatePaymentInput,
  UpdatePaymentPlanInput,
  CreateInstallmentInput,
  UpdateInstallmentInput,
  LoanInfo,
} from '@/types/payment-plan';

// ============================================================================
// TYPES
// ============================================================================

/** ADR-244: Input for creating split plans — owners array triggers server-side split */
interface CreateSplitPlansInput {
  owners: Array<{ contactId: string; name: string; ownershipPct: number }>;
  ownerContactId: string;
  ownerName: string;
  buildingId: string;
  projectId: string;
  totalAmount: number;
  installments: CreateInstallmentInput[];
  taxRegime?: string;
  taxRate?: number;
  planType: 'individual';
}

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
  createSplitPlans: (input: CreateSplitPlansInput) => Promise<{ success: boolean; error?: string }>;
  refetch: () => void;
  createPlan: (input: Omit<CreatePaymentPlanInput, 'unitId'>) => Promise<{ success: boolean; error?: string }>;
  updatePlan: (planId: string, updates: UpdatePaymentPlanInput) => Promise<{ success: boolean; error?: string }>;
  recordPayment: (input: CreatePaymentInput) => Promise<{ success: boolean; error?: string }>;
  addInstallment: (planId: string, input: CreateInstallmentInput, insertAtIndex?: number) => Promise<{ success: boolean; error?: string }>;
  updateInstallment: (planId: string, index: number, updates: UpdateInstallmentInput) => Promise<{ success: boolean; error?: string }>;
  removeInstallment: (planId: string, index: number) => Promise<{ success: boolean; error?: string }>;
  deletePlan: (planId: string) => Promise<{ success: boolean; error?: string }>;
  /** @deprecated Use useLoanTracking hook instead */
  updateLoan: (planId: string, loan: Partial<LoanInfo>) => Promise<{ success: boolean; error?: string }>;
}

// ============================================================================
// API HELPERS
// ============================================================================

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ============================================================================
// HOOK
// ============================================================================

export function usePaymentPlan(unitId: string | null): UsePaymentPlanReturn {
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Backward compat: plan = first plan, planGroup = derived
  const plan = plans[0] ?? null;
  const planGroup: 'none' | 'joint' | 'individual' =
    plans.length === 0 ? 'none' :
    plans.length === 1 ? (plans[0].planType ?? 'joint') :
    'individual';

  // Fetch plan + payments
  const fetchData = useCallback(async () => {
    if (!unitId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [planRes, paymentsRes] = await Promise.all([
        fetchJson<{ success: boolean; data: PaymentPlan | PaymentPlan[] | null }>(
          API_ROUTES.UNITS.PAYMENT_PLAN(unitId)
        ),
        fetchJson<{ success: boolean; data: PaymentRecord[] }>(
          API_ROUTES.UNITS.PAYMENTS(unitId)
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
  }, [unitId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create payment plan
  const createPlan = useCallback(
    async (input: Omit<CreatePaymentPlanInput, 'unitId'>) => {
      if (!unitId) return { success: false, error: 'No unit selected' };
      try {
        const data = await fetchJson<{ success: boolean; error?: string }>(
          API_ROUTES.UNITS.PAYMENT_PLAN(unitId),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        );
        if (data.success) clientSafeFireAndForget(fetchData(), 'PaymentPlan.refetch');
        return { success: data.success, error: data.error };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    },
    [unitId, fetchData]
  );

  // ADR-244: Create split plans (1 per owner)
  const createSplitPlans = useCallback(
    async (input: CreateSplitPlansInput) => {
      if (!unitId) return { success: false, error: 'No unit selected' };
      try {
        const data = await fetchJson<{ success: boolean; error?: string }>(
          API_ROUTES.UNITS.PAYMENT_PLAN(unitId),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        );
        if (data.success) clientSafeFireAndForget(fetchData(), 'PaymentPlan.refetchAfterSplit');
        return { success: data.success, error: data.error };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    },
    [unitId, fetchData]
  );

  // Update payment plan
  const updatePlan = useCallback(
    async (planId: string, updates: UpdatePaymentPlanInput) => {
      if (!unitId) return { success: false, error: 'No unit selected' };
      try {
        const data = await fetchJson<{ success: boolean; error?: string }>(
          API_ROUTES.UNITS.PAYMENT_PLAN(unitId),
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId, ...updates }),
          }
        );
        if (data.success) await fetchData();
        return { success: data.success, error: data.error };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    },
    [unitId, fetchData]
  );

  // Record payment
  const recordPayment = useCallback(
    async (input: CreatePaymentInput) => {
      if (!unitId) return { success: false, error: 'No unit selected' };
      try {
        const data = await fetchJson<{ success: boolean; error?: string }>(
          API_ROUTES.UNITS.PAYMENTS(unitId),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        );
        if (data.success) await fetchData();
        return { success: data.success, error: data.error };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    },
    [unitId, fetchData]
  );

  // Add installment
  const addInstallment = useCallback(
    async (planId: string, input: CreateInstallmentInput, insertAtIndex?: number) => {
      if (!unitId) return { success: false, error: 'No unit selected' };
      try {
        const data = await fetchJson<{ success: boolean; error?: string }>(
          API_ROUTES.UNITS.INSTALLMENTS(unitId),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId, installment: input, insertAtIndex }),
          }
        );
        if (data.success) await fetchData();
        return { success: data.success, error: data.error };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    },
    [unitId, fetchData]
  );

  // Update installment
  const updateInstallment = useCallback(
    async (planId: string, index: number, updates: UpdateInstallmentInput) => {
      if (!unitId) return { success: false, error: 'No unit selected' };
      try {
        const data = await fetchJson<{ success: boolean; error?: string }>(
          API_ROUTES.UNITS.INSTALLMENTS(unitId),
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId, index, updates }),
          }
        );
        if (data.success) await fetchData();
        return { success: data.success, error: data.error };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    },
    [unitId, fetchData]
  );

  // Remove installment
  const removeInstallment = useCallback(
    async (planId: string, index: number) => {
      if (!unitId) return { success: false, error: 'No unit selected' };
      try {
        const data = await fetchJson<{ success: boolean; error?: string }>(
          API_ROUTES.UNITS.INSTALLMENTS(unitId),
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId, index }),
          }
        );
        if (data.success) await fetchData();
        return { success: data.success, error: data.error };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    },
    [unitId, fetchData]
  );

  // Update loan info
  const updateLoan = useCallback(
    async (planId: string, loan: Partial<LoanInfo>) => {
      if (!unitId) return { success: false, error: 'No unit selected' };
      try {
        const data = await fetchJson<{ success: boolean; error?: string }>(
          API_ROUTES.UNITS.LOAN(unitId),
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId, ...loan }),
          }
        );
        if (data.success) await fetchData();
        return { success: data.success, error: data.error };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    },
    [unitId, fetchData]
  );

  const deletePlan = useCallback(
    async (planId: string) => {
      try {
        const data = await fetchJson<{ success: boolean; error?: string }>(
          `${API_ROUTES.UNITS.PAYMENT_PLAN(unitId!)}?planId=${encodeURIComponent(planId)}`,
          { method: 'DELETE' }
        );
        if (data.success) await fetchData();
        return { success: data.success, error: data.error };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    },
    [unitId, fetchData]
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
