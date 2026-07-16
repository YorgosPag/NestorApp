'use client';

/**
 * =============================================================================
 * useLoanTracking — Data hook for multi-bank loan tracking
 * =============================================================================
 *
 * Fetches loans for a unit's active payment plan. Exposes actions for creating,
 * updating, transitioning, disbursing, and logging communications.
 *
 * Mutations run through `runGatewayAction` (ADR-584) — the guard/refetch/result
 * mapping is not re-implemented here.
 *
 * @module hooks/useLoanTracking
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import { useCallback } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { useApiList } from '@/hooks/api/useApiList';
import { runGatewayAction, type ActionResult } from '@/lib/mutations/gateway-action';
import {
  addLoanCommunicationLogWithPolicy,
  createPropertyLoanWithPolicy,
  recordLoanDisbursementWithPolicy,
  transitionPropertyLoanWithPolicy,
  updatePropertyLoanWithPolicy,
} from '@/services/property-finance/property-finance-mutation-gateway';
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

const NO_UNIT = 'No unit selected';

// ============================================================================
// HOOK
// ============================================================================

export function useLoanTracking(propertyId: string | null): UseLoanTrackingReturn {
  const basePath = propertyId ? API_ROUTES.PROPERTIES.LOANS(propertyId) : null;
  const blocked = basePath ? null : NO_UNIT;

  const { items: loans, isLoading, error, refetch: fetchData } = useApiList<LoanTracking>(basePath);

  // Add loan — refetch fired off so a slow reload cannot hold up the dialog
  const addLoan = useCallback(
    (input: CreateLoanInput) =>
      runGatewayAction(() => createPropertyLoanWithPolicy(propertyId!, input), {
        run: fetchData, blocked, background: 'LoanTracking.refetch',
      }),
    [propertyId, fetchData, blocked]
  );

  const updateLoan = useCallback(
    (loanId: string, input: UpdateLoanInput) =>
      runGatewayAction(() => updatePropertyLoanWithPolicy(propertyId!, loanId, input), {
        run: fetchData, blocked,
      }),
    [propertyId, fetchData, blocked]
  );

  const transitionStatus = useCallback(
    (loanId: string, input: LoanTransitionInput) =>
      runGatewayAction(() => transitionPropertyLoanWithPolicy(propertyId!, loanId, input), {
        run: fetchData, blocked,
      }),
    [propertyId, fetchData, blocked]
  );

  const recordDisbursement = useCallback(
    (loanId: string, input: RecordDisbursementInput) =>
      runGatewayAction(() => recordLoanDisbursementWithPolicy(propertyId!, loanId, input), {
        run: fetchData, blocked,
      }),
    [propertyId, fetchData, blocked]
  );

  const addCommLog = useCallback(
    (loanId: string, input: AddCommunicationLogInput) =>
      runGatewayAction(() => addLoanCommunicationLogWithPolicy(propertyId!, loanId, input), {
        run: fetchData, blocked,
      }),
    [propertyId, fetchData, blocked]
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
