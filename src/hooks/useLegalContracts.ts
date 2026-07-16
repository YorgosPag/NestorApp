'use client';

/**
 * =============================================================================
 * useLegalContracts — Data hook for Legal Contracts
 * =============================================================================
 *
 * Fetches contracts + brokerage data for a unit. Exposes actions
 * for creating contracts, FSM transitions, and professional overrides.
 *
 * @module hooks/useLegalContracts
 * @enterprise ADR-230 - Contract Workflow & Legal Process
 */

import { useState, useEffect, useCallback } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import type {
  LegalContract,
  ContractStatus,
  LegalPhase,
  CreateContractInput,
  LegalProfessionalRole,
} from '@/types/legal-contracts';
import { computeLegalPhase, CONTRACT_PHASE_ORDER } from '@/types/legal-contracts';
import type { BrokerageAgreement } from '@/types/brokerage';
import { getErrorMessage } from '@/lib/error-utils';
import { fetchJson } from '@/lib/api/fetch-json';
import { runGatewayAction, type ActionResult } from '@/lib/mutations/gateway-action';
import {
  createLegalContractWithPolicy,
  overrideLegalProfessionalWithPolicy,
  transitionLegalContractStatusWithPolicy,
  updateLegalContractWithPolicy,
} from '@/services/legal-contracts/legal-contract-mutation-gateway';
import { where, type DocumentData } from 'firebase/firestore';
import { firestoreQueryService, type QueryResult } from '@/services/firestore';
import { useCompanyId } from '@/hooks/useCompanyId';

// ============================================================================
// TYPES
// ============================================================================

interface UseLegalContractsReturn {
  contracts: LegalContract[];
  agreements: BrokerageAgreement[];
  currentPhase: LegalPhase;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  createContract: (input: CreateContractInput) => Promise<ActionResult>;
  transitionStatus: (contractId: string, targetStatus: ContractStatus) => Promise<ActionResult>;
  updateContract: (contractId: string, updates: Record<string, unknown>) => Promise<ActionResult>;
  overrideProfessional: (contractId: string, role: LegalProfessionalRole, contactId: string | null) => Promise<ActionResult>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useLegalContracts(propertyId: string | null, projectId?: string): UseLegalContractsReturn {
  const companyId = useCompanyId()?.companyId;
  const [contracts, setContracts] = useState<LegalContract[]>([]);
  const [agreements, setAgreements] = useState<BrokerageAgreement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute current legal phase from contracts
  const currentPhase: LegalPhase = (() => {
    if (contracts.length === 0) return 'none';

    let highest: LegalPhase = 'none';
    let highestIdx = -1;

    for (const c of contracts) {
      const idx = CONTRACT_PHASE_ORDER.indexOf(c.phase);
      if (idx > highestIdx) {
        highestIdx = idx;
        highest = computeLegalPhase(c.phase, c.status);
      }
    }
    return highest;
  })();

  // Fetch contracts
  const fetchContracts = useCallback(async () => {
    if (!propertyId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchJson<{ success: boolean; data: LegalContract[] }>(
        `${API_ROUTES.CONTRACTS.LIST}?propertyId=${propertyId}`
      );
      setContracts(data.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  // Initial fetch for contracts
  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // 🔴 REAL-TIME: firestoreQueryService subscription for brokerage agreements
  // (ADR-214 canonical path — auto-injects companyId tenant filter)
  useEffect(() => {
    if (!projectId || !companyId) return;

    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'BROKERAGE_AGREEMENTS',
      (result: QueryResult<DocumentData>) => {
        const data = result.documents.map(
          (d) => ({ ...d } as unknown as BrokerageAgreement),
        );
        setAgreements(data);
      },
      (err: Error) => {
        // Non-blocking — agreements are supplementary data
        if (process.env.NODE_ENV === 'development') {
          console.warn('[useLegalContracts] Subscription error (non-blocking):', err.message);
        }
        setAgreements([]);
      },
      {
        constraints: [where('projectId', '==', projectId)],
      },
    );

    return unsubscribe;
  }, [projectId, companyId]);

  // Actions — scoped by contractId, so no propertyId guard (unlike the finance hooks)
  const createContract = useCallback(
    (input: CreateContractInput) =>
      runGatewayAction(() => createLegalContractWithPolicy(input), {
        run: fetchContracts, background: 'LegalContracts.refetch',
      }),
    [fetchContracts]
  );

  const transitionStatus = useCallback(
    (contractId: string, targetStatus: ContractStatus) =>
      runGatewayAction(() => transitionLegalContractStatusWithPolicy(contractId, targetStatus), {
        run: fetchContracts,
      }),
    [fetchContracts]
  );

  const updateContract = useCallback(
    (contractId: string, updates: Record<string, unknown>) =>
      runGatewayAction(() => updateLegalContractWithPolicy(contractId, updates), {
        run: fetchContracts,
      }),
    [fetchContracts]
  );

  const overrideProfessional = useCallback(
    (contractId: string, role: LegalProfessionalRole, contactId: string | null) =>
      runGatewayAction(() => overrideLegalProfessionalWithPolicy(contractId, role, contactId), {
        run: fetchContracts,
      }),
    [fetchContracts]
  );

  return {
    contracts,
    agreements,
    currentPhase,
    isLoading,
    error,
    refetch: () => { fetchContracts(); },
    createContract,
    transitionStatus,
    updateContract,
    overrideProfessional,
  };
}
