'use client';

/**
 * useAsyncData — Centralized async data fetching hook
 *
 * Eliminates repeated loading/error/data boilerplate across 112+ files.
 * Provides stale-closure prevention, unmount safety, and auto-refetch on dependency change.
 *
 * @module hooks/useAsyncData
 * @enterprise ADR-223 — useAsyncData Centralization
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getErrorMessage } from '@/lib/error-utils';

// =============================================================================
// TYPES
// =============================================================================

export interface UseAsyncDataOptions<T> {
  /** Async function that returns data */
  fetcher: () => Promise<T>;
  /** Dependency array — refetch when values change (serialized via JSON.stringify) */
  deps?: ReadonlyArray<unknown>;
  /** Skip fetch until ready (e.g. auth gating). Default: true */
  enabled?: boolean;
  /** Fallback value before first resolve */
  initialData?: T;
  /** Optional error callback (e.g. toast notification) */
  onError?: (message: string) => void;
  /**
   * When true + initialData provided: show stale data immediately and fetch
   * silently in background without triggering a loading state.
   * Implements stale-while-revalidate for instant navigation (no flash).
   */
  silentInitialFetch?: boolean;
}

export interface UseAsyncDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-execute the fetcher manually (shows loading state) */
  refetch: () => Promise<void>;
  /**
   * Re-execute the fetcher without flipping loading to true.
   * Use for background sync after optimistic updates — the UI stays
   * stable and silently reconciles with server state on completion.
   */
  silentRefetch: () => Promise<void>;
  /**
   * Optimistically mutate local state without a network round-trip.
   * Use before silentRefetch to give instant UI feedback.
   *
   * @example
   * patch(prev => ({ ...prev, items: [...(prev?.items ?? []), newItem] }));
   * silentRefetch(); // reconcile with server in background
   */
  patch: (updater: (prev: T | null) => T) => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useAsyncData<T>(options: UseAsyncDataOptions<T>): UseAsyncDataReturn<T> {
  const { deps = [], enabled = true, initialData, silentInitialFetch = false } = options;

  const hasInitialData = initialData !== null && initialData !== undefined;
  const useStale = silentInitialFetch && hasInitialData;

  const [data, setData] = useState<T | null>(initialData ?? null);
  // Stale-while-revalidate: if we have cached initialData + silentInitialFetch,
  // start with loading=false and fetch silently in background.
  const [loading, setLoading] = useState(useStale ? false : (enabled !== false));
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const callIdRef = useRef(0);

  // Refs keep latest closures without triggering re-renders
  const fetcherRef = useRef(options.fetcher);
  const onErrorRef = useRef(options.onError);
  fetcherRef.current = options.fetcher;
  onErrorRef.current = options.onError;

  const execute = useCallback(async () => {
    const id = ++callIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current();
      if (mountedRef.current && callIdRef.current === id) {
        setData(result);
      }
    } catch (err) {
      if (mountedRef.current && callIdRef.current === id) {
        const message = getErrorMessage(err);
        setError(message);
        onErrorRef.current?.(message);
      }
    } finally {
      if (mountedRef.current && callIdRef.current === id) {
        setLoading(false);
      }
    }
  }, []);

  /** Fetch without flipping loading — for post-optimistic background sync */
  const silentExecute = useCallback(async () => {
    const id = ++callIdRef.current;
    try {
      const result = await fetcherRef.current();
      if (mountedRef.current && callIdRef.current === id) {
        setData(result);
      }
    } catch {
      // Silent: optimistic state already shown, server error not surfaced
    }
  }, []);

  /** Mutate local state immediately without a network round-trip */
  const patch = useCallback((updater: (prev: T | null) => T) => {
    setData(prev => updater(prev));
  }, []);

  // Serialize deps for stable comparison
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    if (enabled) {
      if (useStale) {
        silentExecute(); // stale-while-revalidate: no loading flash
      } else {
        execute();
      }
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, enabled]);

  // Unmount cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { data, loading, error, refetch: execute, silentRefetch: silentExecute, patch };
}
