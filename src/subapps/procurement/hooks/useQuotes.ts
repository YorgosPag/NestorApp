'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { where, type QueryConstraint } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { Quote, QuoteFilters } from '@/subapps/procurement/types/quote';

interface UseQuotesResult {
  quotes: Quote[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  silentRefetch: () => Promise<void>;
  patch: (updater: (prev: Quote[]) => Quote[]) => void;
}

export function useQuotes(filters: Partial<QuoteFilters> = {}): UseQuotesResult {
  const { projectId, rfqId, trade, status, vendorContactId } = filters;

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const constraints = useMemo<QueryConstraint[]>(() => {
    const c: QueryConstraint[] = [];
    if (projectId) c.push(where('projectId', '==', projectId));
    if (rfqId) c.push(where('rfqId', '==', rfqId));
    if (trade) c.push(where('trade', '==', trade));
    if (status) c.push(where('status', '==', status));
    if (vendorContactId) c.push(where('vendorContactId', '==', vendorContactId));
    return c;
  }, [projectId, rfqId, trade, status, vendorContactId]);

  const onDataRef = useRef<((qs: Quote[]) => void) | null>(null);
  onDataRef.current = (qs) => setQuotes(qs);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = firestoreQueryService.subscribe<Quote>(
      'QUOTES',
      (result) => {
        onDataRef.current?.(result.documents as Quote[]);
        setLoading(false);
      },
      (err) => {
        setError(err.message ?? 'Failed to subscribe to quotes');
        setLoading(false);
      },
      { constraints },
    );

    return () => unsubscribe();
  }, [constraints]);

  const refetch = useCallback(async () => {
    /* onSnapshot is live — no manual refetch needed (kept for API compat) */
  }, []);

  const patch = useCallback((updater: (prev: Quote[]) => Quote[]) => {
    setQuotes(updater);
  }, []);

  return { quotes, loading, error, refetch, silentRefetch: refetch, patch };
}
