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
  ContractPhase,
  ContractStatus,
  LegalPhase,
  CreateContractInput,
  LegalProfessionalRole,
} from '@/types/legal-contracts';
import { computeLegalPhase, CONTRACT_PHASE_ORDER } from '@/types/legal-contracts';
import type { BrokerageAgreement } from '@/types/brokerage';
import { BrokerageService } from '@/services/brokerage.service';
import { getErrorMessage } from '@/lib/error-utils';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

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
  createContract: (input: CreateContractInput) => Promise<{ success: boolean; error?: string }>;
  transitionStatus: (contractId: string, targetStatus: ContractStatus) => Promise<{ success: boolean; error?: string }>;
  updateContract: (contractId: string, updates: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  overrideProfessional: (contractId: string, role: LegalProfessionalRole, contactId: string | null) => Promise<{ success: boolean; error?: string }>;
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

export function useLegalContracts(unitId: string | null, projectId?: string): UseLegalContractsReturn {
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
    if (!unitId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchJson<{ success: boolean; data: LegalContract[] }>(
        `${API_ROUTES.CONTRACTS.LIST}?unitId=${unitId}`
      );
      setContracts(data.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [unitId]);

  // Initial fetch for contracts
  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // 🔴 REAL-TIME: onSnapshot subscription for brokerage agreements
  useEffect(() => {
    if (!projectId) return;

    const q = query(
      collection(db, COLLECTIONS.BROKERAGE_AGREEMENTS),
      where('projectId', '==', projectId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as BrokerageAgreement);
        setAgreements(data);
      },
      (err) => {
        // Non-blocking — agreements are supplementary data
        // Log once to help diagnose permission issues without flooding console
        if (process.env.NODE_ENV === 'development') {
          console.warn('[useLegalContracts] Subscription error (non-blocking):', err.message);
        }
        setAgreements([]);
      }
    );

    return unsubscribe;
  }, [projectId]);

  // Actions
  const createContract = useCallback(async (input: CreateContractInput) => {
    try {
      const data = await fetchJson<{ success: boolean; error?: string }>(
        API_ROUTES.CONTRACTS.LIST,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }
      );
      if (data.success) {
        // Refetch contracts — don't let refetch failure mask successful creation
        fetchContracts().catch(() => {});
      }
      return { success: data.success, error: data.error };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  }, [fetchContracts]);

  const transitionStatus = useCallback(async (contractId: string, targetStatus: ContractStatus) => {
    try {
      const data = await fetchJson<{ success: boolean; error?: string }>(
        API_ROUTES.CONTRACTS.TRANSITION(contractId),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetStatus }),
        }
      );
      if (data.success) {
        await fetchContracts();
      }
      return { success: data.success, error: data.error };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  }, [fetchContracts]);

  const updateContract = useCallback(async (contractId: string, updates: Record<string, unknown>) => {
    try {
      const data = await fetchJson<{ success: boolean; error?: string }>(
        API_ROUTES.CONTRACTS.BY_ID(contractId),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );
      if (data.success) {
        await fetchContracts();
      }
      return { success: data.success, error: data.error };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  }, [fetchContracts]);

  const overrideProfessional = useCallback(async (
    contractId: string,
    role: LegalProfessionalRole,
    contactId: string | null
  ) => {
    try {
      const data = await fetchJson<{ success: boolean; error?: string }>(
        API_ROUTES.CONTRACTS.PROFESSIONALS(contractId),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, contactId }),
        }
      );
      if (data.success) {
        await fetchContracts();
      }
      return { success: data.success, error: data.error };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  }, [fetchContracts]);

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
