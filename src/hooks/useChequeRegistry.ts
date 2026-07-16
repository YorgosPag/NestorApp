'use client';

/**
 * =============================================================================
 * useChequeRegistry — Data hook for cheque lifecycle management
 * =============================================================================
 *
 * Fetches cheques for a unit. Exposes actions for creating, updating,
 * transitioning, endorsing, and bouncing cheques.
 *
 * Mutations run through `runGatewayAction` (ADR-584) — the guard/refetch/result
 * mapping is not re-implemented here.
 *
 * @module hooks/useChequeRegistry
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

import { useCallback } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { useApiList } from '@/hooks/api/useApiList';
import { runGatewayAction, type ActionResult } from '@/lib/mutations/gateway-action';
import {
  bouncePropertyChequeWithPolicy,
  createPropertyChequeWithPolicy,
  endorsePropertyChequeWithPolicy,
  transitionPropertyChequeWithPolicy,
  updatePropertyChequeWithPolicy,
} from '@/services/property-finance/property-finance-mutation-gateway';
import type {
  ChequeRecord,
  CreateChequeInput,
  UpdateChequeInput,
  ChequeTransitionInput,
  EndorseInput,
  BounceInput,
} from '@/types/cheque-registry';

// ============================================================================
// TYPES
// ============================================================================

interface UseChequeRegistryReturn {
  cheques: ChequeRecord[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  createCheque: (input: CreateChequeInput) => Promise<ActionResult>;
  updateCheque: (chequeId: string, input: UpdateChequeInput) => Promise<ActionResult>;
  transitionStatus: (chequeId: string, input: ChequeTransitionInput) => Promise<ActionResult>;
  endorseCheque: (chequeId: string, input: EndorseInput) => Promise<ActionResult>;
  bounceCheque: (chequeId: string, input: BounceInput) => Promise<ActionResult>;
}

const NO_PROPERTY = 'No property selected';

// ============================================================================
// HOOK
// ============================================================================

export function useChequeRegistry(propertyId: string | null): UseChequeRegistryReturn {
  const basePath = propertyId ? API_ROUTES.PROPERTIES.CHEQUES(propertyId) : null;
  const blocked = basePath ? null : NO_PROPERTY;

  const { items: cheques, isLoading, error, refetch: fetchData } = useApiList<ChequeRecord>(basePath);

  // Create cheque — refetch fired off so a slow reload cannot hold up the dialog
  const createCheque = useCallback(
    (input: CreateChequeInput) =>
      runGatewayAction(() => createPropertyChequeWithPolicy(propertyId!, input), {
        run: fetchData, blocked, background: 'ChequeRegistry.refetch',
      }),
    [propertyId, fetchData, blocked]
  );

  const updateCheque = useCallback(
    (chequeId: string, input: UpdateChequeInput) =>
      runGatewayAction(() => updatePropertyChequeWithPolicy(propertyId!, chequeId, input), {
        run: fetchData, blocked,
      }),
    [propertyId, fetchData, blocked]
  );

  const transitionStatus = useCallback(
    (chequeId: string, input: ChequeTransitionInput) =>
      runGatewayAction(() => transitionPropertyChequeWithPolicy(propertyId!, chequeId, input), {
        run: fetchData, blocked,
      }),
    [propertyId, fetchData, blocked]
  );

  const endorseCheque = useCallback(
    (chequeId: string, input: EndorseInput) =>
      runGatewayAction(() => endorsePropertyChequeWithPolicy(propertyId!, chequeId, input), {
        run: fetchData, blocked,
      }),
    [propertyId, fetchData, blocked]
  );

  const bounceCheque = useCallback(
    (chequeId: string, input: BounceInput) =>
      runGatewayAction(() => bouncePropertyChequeWithPolicy(propertyId!, chequeId, input), {
        run: fetchData, blocked,
      }),
    [propertyId, fetchData, blocked]
  );

  return {
    cheques,
    isLoading,
    error,
    refetch: () => { fetchData(); },
    createCheque,
    updateCheque,
    transitionStatus,
    endorseCheque,
    bounceCheque,
  };
}
