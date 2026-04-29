'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { where } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type {
  QuoteComparisonResult,
  CherryPickResult,
} from '@/subapps/procurement/types/comparison';

interface UseComparisonOptions {
  templateId?: string;
  cherryPick?: boolean;
}

interface UseComparisonResult {
  comparison: QuoteComparisonResult | null;
  cherryPick: CherryPickResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface ApiPayload {
  comparison: QuoteComparisonResult;
  cherryPick: CherryPickResult | null;
}

async function fetchComparison(rfqId: string, options: UseComparisonOptions): Promise<ApiPayload> {
  const params = new URLSearchParams();
  if (options.templateId) params.set('templateId', options.templateId);
  if (options.cherryPick) params.set('cherryPick', 'true');
  const url = `/api/rfqs/${rfqId}/comparison${params.size > 0 ? `?${params.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load comparison: ${res.status}`);
  const json = await res.json();
  if (!json?.data) throw new Error('Empty comparison payload');
  return json.data as ApiPayload;
}

const COMPARISON_REFETCH_DEBOUNCE_MS = 400;

export function useComparison(
  rfqId: string | null,
  options: UseComparisonOptions = {},
): UseComparisonResult {
  const { templateId, cherryPick: cherryPickOpt = false } = options;
  const [comparison, setComparison] = useState<QuoteComparisonResult | null>(null);
  const [cherryPick, setCherryPick] = useState<CherryPickResult | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(rfqId));
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    if (!rfqId) return;
    try {
      setLoading(true);
      const data = await fetchComparison(rfqId, { templateId, cherryPick: cherryPickOpt });
      setComparison(data.comparison);
      setCherryPick(data.cherryPick);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load comparison');
    } finally {
      setLoading(false);
    }
  }, [rfqId, templateId, cherryPickOpt]);

  // Subscribe to underlying quote changes and re-compute comparison via API.
  // Debounced to coalesce bursts (e.g. award flow updates multiple quotes at once).
  useEffect(() => {
    if (!rfqId) {
      setComparison(null);
      setCherryPick(null);
      setLoading(false);
      return;
    }

    let initialDelivered = false;

    const triggerRefetch = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        void refetch();
      }, COMPARISON_REFETCH_DEBOUNCE_MS);
    };

    // Initial fetch — don't wait for snapshot (which may also trigger one)
    void refetch();

    const unsubscribe = firestoreQueryService.subscribe(
      'QUOTES',
      () => {
        if (!initialDelivered) {
          initialDelivered = true;
          return;
        }
        triggerRefetch();
      },
      (err) => {
        setError(err.message ?? 'Failed to subscribe to quote changes');
      },
      { constraints: [where('rfqId', '==', rfqId)] },
    );

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      unsubscribe();
    };
  }, [rfqId, refetch]);

  return { comparison, cherryPick, loading, error, refetch };
}
