'use client';

/**
 * =============================================================================
 * useChequeRegistry — Data hook for cheque lifecycle management
 * =============================================================================
 *
 * Fetches cheques for a unit. Exposes actions for creating, updating,
 * transitioning, endorsing, and bouncing cheques.
 *
 * @module hooks/useChequeRegistry
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

import { useState, useEffect, useCallback } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { getErrorMessage } from '@/lib/error-utils';
import { clientSafeFireAndForget } from '@/lib/safe-fire-and-forget';
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

interface ActionResult {
  success: boolean;
  error?: string;
}

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

export function useChequeRegistry(propertyId: string | null): UseChequeRegistryReturn {
  const [cheques, setCheques] = useState<ChequeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const basePath = propertyId ? API_ROUTES.PROPERTIES.CHEQUES(propertyId) : null;

  // Fetch cheques
  const fetchData = useCallback(async () => {
    if (!basePath) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetchJson<{ success: boolean; data: ChequeRecord[] }>(basePath);
      setCheques(res.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create cheque
  const createCheque = useCallback(
    async (input: CreateChequeInput): Promise<ActionResult> => {
      if (!basePath) return { success: false, error: 'No property selected' };
      try {
        const res = await fetchJson<{ success: boolean; error?: string }>(basePath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        if (res.success) clientSafeFireAndForget(fetchData(), 'ChequeRegistry.refetch');
        return { success: res.success, error: res.error };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    },
    [basePath, fetchData]
  );

  // Update cheque
  const updateCheque = useCallback(
    async (chequeId: string, input: UpdateChequeInput): Promise<ActionResult> => {
      if (!basePath) return { success: false, error: 'No property selected' };
      try {
        const res = await fetchJson<{ success: boolean; error?: string }>(
          `${basePath}/${chequeId}`,
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
    async (chequeId: string, input: ChequeTransitionInput): Promise<ActionResult> => {
      if (!basePath) return { success: false, error: 'No property selected' };
      try {
        const res = await fetchJson<{ success: boolean; error?: string }>(
          `${basePath}/${chequeId}/transition`,
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

  // Endorse cheque
  const endorseCheque = useCallback(
    async (chequeId: string, input: EndorseInput): Promise<ActionResult> => {
      if (!basePath) return { success: false, error: 'No property selected' };
      try {
        const res = await fetchJson<{ success: boolean; error?: string }>(
          `${basePath}/${chequeId}/endorse`,
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

  // Bounce cheque
  const bounceCheque = useCallback(
    async (chequeId: string, input: BounceInput): Promise<ActionResult> => {
      if (!basePath) return { success: false, error: 'No property selected' };
      try {
        const res = await fetchJson<{ success: boolean; error?: string }>(
          `${basePath}/${chequeId}/bounce`,
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
