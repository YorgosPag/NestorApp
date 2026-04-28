'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Quote } from '@/subapps/procurement/types/quote';

interface UseQuoteOptions {
  /**
   * If > 0, the hook polls `/api/quotes/{id}` every N ms while
   * `stopWhen` returns false. Default: 0 (no polling).
   */
  pollIntervalMs?: number;
  /**
   * Predicate evaluated after every fetch — when it returns `true`
   * polling stops automatically. Default: stops when `extractedData` is set.
   */
  stopWhen?: (quote: Quote | null) => boolean;
}

interface UseQuoteResult {
  quote: Quote | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
  refetch: () => Promise<void>;
}

const defaultStopWhen = (q: Quote | null): boolean => q !== null && q.extractedData !== null;

interface FetchResult {
  quote: Quote | null;
  notFound: boolean;
}

async function fetchQuoteById(id: string): Promise<FetchResult> {
  const res = await fetch(`/api/quotes/${id}`);
  if (res.status === 404) return { quote: null, notFound: true };
  if (!res.ok) throw new Error(`Failed to load quote ${id}: ${res.status}`);
  const json = await res.json();
  if (!json?.data) throw new Error('Empty response payload');
  return { quote: json.data as Quote, notFound: false };
}

export function useQuote(quoteId: string | null, options: UseQuoteOptions = {}): UseQuoteResult {
  const { pollIntervalMs = 0, stopWhen = defaultStopWhen } = options;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(quoteId));
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);
  const stopWhenRef = useRef(stopWhen);
  stopWhenRef.current = stopWhen;

  const refetch = useCallback(async () => {
    if (!quoteId) return;
    try {
      const result = await fetchQuoteById(quoteId);
      if (result.notFound) {
        setQuote(null);
        setNotFound(true);
        setError(null);
      } else {
        setQuote(result.quote);
        setNotFound(false);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quote');
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    if (!quoteId) {
      setQuote(null);
      setNotFound(false);
      setLoading(false);
      return;
    }
    setNotFound(false);
    setLoading(true);
    void refetch();
  }, [quoteId, refetch]);

  useEffect(() => {
    if (!quoteId || pollIntervalMs <= 0) return;
    if (notFound) return;
    if (stopWhenRef.current(quote)) return;

    const interval = setInterval(() => {
      void refetch();
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [quoteId, pollIntervalMs, quote, notFound, refetch]);

  return { quote, loading, error, notFound, refetch };
}
