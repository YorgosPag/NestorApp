'use client';

/**
 * =============================================================================
 * ENTERPRISE: useReferenceData — SWR-style React hook
 * =============================================================================
 *
 * Thin React binding around the module-level reference cache. Gives
 * components a standard `{ data, loading, error, refetch }` shape with
 * automatic revalidation on mount / when the key changes.
 *
 * Behaviour (stale-while-revalidate):
 *   • No cached data → `loading: true`, fetches from network.
 *   • Cached data within staleTime → returns it instantly, no fetch.
 *   • Cached data beyond staleTime → returns it instantly (no spinner) AND
 *     fetches fresh data in the background; hook re-renders when it lands.
 *
 * Cross-component sync: all hooks sharing the same `key` see the same data
 * and the same update stream, because they read from a single module store.
 *
 * @module hooks/useReferenceData
 * @see lib/cache/reference-cache
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  getCached,
  subscribe,
  revalidate,
} from '@/lib/cache/reference-cache';

export interface UseReferenceDataOptions {
  /** Max age (ms) before a cached entry is considered stale. Default: 60s. */
  readonly staleTime?: number;
  /** Skip fetching while `enabled` is false (hook stays idle). */
  readonly enabled?: boolean;
}

export interface UseReferenceDataResult<T> {
  readonly data: T | undefined;
  readonly loading: boolean;
  readonly error: Error | undefined;
  readonly refetch: () => Promise<T | undefined>;
}

const DEFAULT_STALE_TIME_MS = 60_000;

export function useReferenceData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: UseReferenceDataOptions,
): UseReferenceDataResult<T> {
  const staleTime = options?.staleTime ?? DEFAULT_STALE_TIME_MS;
  const enabled = options?.enabled ?? true;

  const entry = useSyncExternalStore(
    useCallback((cb) => subscribe(key, cb), [key]),
    () => getCached<T>(key),
    () => undefined, // SSR: no cache, always undefined
  );

  // Trigger a revalidation when the cached entry is missing or stale.
  useEffect(() => {
    if (!enabled) return;
    const cached = getCached<T>(key);
    const hasData = cached?.data !== undefined;
    const isStale = !cached || Date.now() - cached.timestamp > staleTime;
    if (!hasData || isStale) {
      revalidate(key, fetcher).catch(() => {
        // Error is already surfaced via the cache entry — hook will re-render.
      });
    }
  }, [enabled, key, fetcher, staleTime]);

  const refetch = useCallback(
    () => revalidate(key, fetcher).catch(() => undefined),
    [key, fetcher],
  );

  return {
    data: entry?.data,
    // "loading" means there's NO data to show yet AND a fetch is in flight.
    loading: entry?.data === undefined && entry?.promise !== undefined,
    error: entry?.error,
    refetch,
  };
}
