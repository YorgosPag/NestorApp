'use client';

/**
 * =============================================================================
 * useLoanTracking — Data hook for multi-bank loan tracking
 * =============================================================================
 *
 * Fetches loans for a unit's active payment plan. Exposes actions for creating,
 * updating, transitioning, disbursing, and logging communications.
 *
 * @module hooks/useLoanTracking
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import { useState, useEffect, useCallback } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  LoanTracking,
  CreateLoanInput,
  UpdateLoanInput,
  LoanTransitionInput,
  RecordDisbursementInput,
  AddCommunicationLogInput,
} from '@/types/loan-tracking';

// ============================================================================
// TYPES
// ============================================================================

interface ActionResult {
  success: boolean;
  error?: string;
}

interface UseLoanTrackingReturn {
  loans: LoanTracking[];
  primaryLoan: LoanTracking | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  addLoan: (input: CreateLoanInput) => Promise<ActionResult>;
  updateLoan: (loanId: string, input: UpdateLoanInput) => Promise<ActionResult>;
  transitionStatus: (loanId: string, input: LoanTransitionInput) => Promise<ActionResult>;
  recordDisbursement: (loanId: string, input: RecordDisbursementInput) => Promise<ActionResult>;
  addCommLog: (loanId: string, input: AddCommunicationLogInput) => Promise<ActionResult>;
}

// ============================================================================
// API HELPER
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

export function useLoanTracking(unitId: string | null): UseLoanTrackingReturn {
  const [loans, setLoans] = useState<LoanTracking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const basePath = unitId ? API_ROUTES.UNITS.LOANS(unitId) : null;

  // Fetch loans
  const fetchData = useCallback(async () => {
    if (!basePath) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetchJson<{ success: boolean; data: LoanTracking[] }>(basePath);
      setLoans(res.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Add loan
  const addLoan = useCallback(
    async (input: CreateLoanInput): Promise<ActionResult> => {
      if (!basePath) return { success: false, error: 'No unit selected' };
      try {
        const res = await fetchJson<{ success: boolean; error?: string }>(basePath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        if (res.success) fetchData().catch(() => {});
        return { success: res.success, error: res.error };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    },
    [basePath, fetchData]
  );

  // Update loan
  const updateLoan = useCallback(
    async (loanId: string, input: UpdateLoanInput): Promise<ActionResult> => {
      if (!basePath) return { success: false, error: 'No unit selected' };
      try {
        const res = await fetchJson<{ success: boolean; error?: string }>(
          `${basePath}/${loanId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        );
        if (res.success) await fetchData();
        return { success: res.success, error: res.error };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    },
    [basePath, fetchData]
  );

  // Transition status
  const transitionStatus = useCallback(
    async (loanId: string, input: LoanTransitionInput): Promise<ActionResult> => {
      if (!basePath) return { success: false, error: 'No unit selected' };
      try {
        const res = await fetchJson<{ success: boolean; error?: string }>(
          `${basePath}/${loanId}/transition`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        );
        if (res.success) await fetchData();
        return { success: res.success, error: res.error };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    },
    [basePath, fetchData]
  );

  // Record disbursement
  const recordDisbursement = useCallback(
    async (loanId: string, input: RecordDisbursementInput): Promise<ActionResult> => {
      if (!basePath) return { success: false, error: 'No unit selected' };
      try {
        const res = await fetchJson<{ success: boolean; error?: string }>(
          `${basePath}/${loanId}/disburse`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        );
        if (res.success) await fetchData();
        return { success: res.success, error: res.error };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    },
    [basePath, fetchData]
  );

  // Add communication log
  const addCommLog = useCallback(
    async (loanId: string, input: AddCommunicationLogInput): Promise<ActionResult> => {
      if (!basePath) return { success: false, error: 'No unit selected' };
      try {
        const res = await fetchJson<{ success: boolean; error?: string }>(
          `${basePath}/${loanId}/comm-log`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        );
        if (res.success) await fetchData();
        return { success: res.success, error: res.error };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    },
    [basePath, fetchData]
  );

  const primaryLoan = loans.find(l => l.isPrimary) ?? loans[0] ?? null;

  return {
    loans,
    primaryLoan,
    isLoading,
    error,
    refetch: () => { fetchData(); },
    addLoan,
    updateLoan,
    transitionStatus,
    recordDisbursement,
    addCommLog,
  };
}
