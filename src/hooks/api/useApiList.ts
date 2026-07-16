'use client';

/**
 * =============================================================================
 * useApiList — SSoT for "GET a list off one of our /api routes into state"
 * =============================================================================
 *
 * Owns the four pieces that always travel together: the rows, the in-flight
 * flag, the error, and a refetch the caller can hand to `runGatewayAction`.
 *
 * Deliberately narrow. It covers the shape where one URL yields one
 * `{ success, data: T[] }` envelope — which is exactly `useChequeRegistry` and
 * `useLoanTracking`, and is why those two were byte-identical here (ADR-584).
 * `usePaymentPlan` (two routes in one Promise.all) and `useLegalContracts` (a
 * REST list plus a Firestore subscription) keep their own fetchers rather than
 * bending this one into a god-hook with flags for each of them.
 *
 * @module hooks/api/useApiList
 * @see ADR-584 — token-based clone ratchet (jscpd)
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchJson } from '@/lib/api/fetch-json';
import { getErrorMessage } from '@/lib/error-utils';

export interface UseApiListReturn<T> {
  items: T[];
  isLoading: boolean;
  error: string | null;
  /** Refetch — safe to await, and a no-op while `url` is null. */
  refetch: () => Promise<void>;
}

/**
 * @param url Route to read, or null while the caller is out of scope (no unit
 *            selected yet) — in which case nothing is fetched and `items` stays
 *            empty.
 */
export function useApiList<T>(url: string | null): UseApiListReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!url) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetchJson<{ success: boolean; data: T[] }>(url);
      setItems(res.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { items, isLoading, error, refetch };
}
