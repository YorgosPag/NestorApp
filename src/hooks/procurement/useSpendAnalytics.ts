'use client';

/**
 * useSpendAnalytics — client hook for the cross-project Spend Analytics page.
 *
 * Filter state SSoT = URL `searchParams` (no separate React state). Writes via
 * `router.push(..., { scroll: false })`. Server fetch is debounced (250 ms),
 * cancellable (`AbortController`), and cached via ADR-300 stale-while-revalidate.
 * Re-fetches silently on remount and on `spend-analytics:invalidate` events
 * emitted by PO mutations.
 *
 * @module hooks/procurement/useSpendAnalytics
 * @see ADR-331 §4 D2, D7, D11, D12, D14, D28
 * @see ADR-300 — Stale-while-revalidate cache
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReadonlyURLSearchParams } from 'next/navigation';

import { createStaleCache } from '@/lib/stale-cache';
import { getCurrentQuarterRange } from '@/lib/date/quarter-helpers';
import {
  parseDateOrDefault,
  parseFilterArray,
  serializeFilterArray,
} from '@/lib/url-filters/multi-value';
import { onSpendAnalyticsInvalidate } from '@/lib/cache/spend-analytics-bus';
import type {
  SpendAnalyticsFilters,
  SpendAnalyticsResult,
} from '@/services/procurement/aggregators/spendAnalyticsAggregator';

// ============================================================================
// MODULE-LEVEL CACHE & CONSTANTS
// ============================================================================

const ANALYTICS_PATH = '/procurement/analytics';
const API_PATH = '/api/procurement/spend-analytics';
const FILTER_DEBOUNCE_MS = 250;

const analyticsCache = createStaleCache<SpendAnalyticsResult>('spend-analytics');

// ============================================================================
// PURE HELPERS
// ============================================================================

function buildFilters(searchParams: ReadonlyURLSearchParams): SpendAnalyticsFilters {
  const defaults = getCurrentQuarterRange(new Date());
  return {
    from: parseDateOrDefault(searchParams.get('from'), defaults.from),
    to: parseDateOrDefault(searchParams.get('to'), defaults.to),
    projectId: parseFilterArray(searchParams.get('projectId')),
    supplierId: parseFilterArray(searchParams.get('supplierId')),
    categoryCode: parseFilterArray(searchParams.get('categoryCode')),
    status: parseFilterArray(searchParams.get('status')),
  };
}

function buildQuery(filters: SpendAnalyticsFilters): string {
  const params = new URLSearchParams();
  params.set('from', filters.from);
  params.set('to', filters.to);
  const arrays: Array<[keyof SpendAnalyticsFilters, readonly string[]]> = [
    ['projectId', filters.projectId],
    ['supplierId', filters.supplierId],
    ['categoryCode', filters.categoryCode],
    ['status', filters.status],
  ];
  for (const [key, values] of arrays) {
    const serialized = serializeFilterArray(values);
    if (serialized) params.set(String(key), serialized);
  }
  return params.toString();
}

// ============================================================================
// PUBLIC API
// ============================================================================

export interface UseSpendAnalyticsReturn {
  data: SpendAnalyticsResult | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  filters: SpendAnalyticsFilters;
  setFilters: (partial: Partial<SpendAnalyticsFilters>) => void;
  refresh: () => void;
}

export function useSpendAnalytics(): UseSpendAnalyticsReturn {
  const searchParams = useSearchParams();
  const router = useRouter();

  const filters = useMemo(() => buildFilters(searchParams), [searchParams]);
  const cacheKey = useMemo(() => buildQuery(filters), [filters]);

  const [data, setData] = useState<SpendAnalyticsResult | null>(
    () => analyticsCache.get(cacheKey),
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    () => !analyticsCache.hasLoaded(cacheKey),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const runFetch = useCallback(async (key: string, silent: boolean): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_PATH}?${key}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error ?? 'Unknown error');
      const payload = json.data as SpendAnalyticsResult;
      analyticsCache.set(payload, key);
      setData(payload);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message);
    } finally {
      if (silent) setIsRefreshing(false);
      else setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = analyticsCache.get(cacheKey);
    if (cached) setData(cached);
    const silent = analyticsCache.hasLoaded(cacheKey);
    setIsLoading(!silent);
    const handle = setTimeout(() => {
      void runFetch(cacheKey, silent);
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [cacheKey, refreshTick, runFetch]);

  useEffect(() => {
    return onSpendAnalyticsInvalidate(() => {
      analyticsCache.clear();
      setRefreshTick(t => t + 1);
    });
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const setFilters = useCallback((partial: Partial<SpendAnalyticsFilters>): void => {
    const next: SpendAnalyticsFilters = { ...filters, ...partial };
    const qs = buildQuery(next);
    router.push(`${ANALYTICS_PATH}?${qs}`, { scroll: false });
  }, [filters, router]);

  const refresh = useCallback((): void => {
    analyticsCache.invalidate(cacheKey);
    setRefreshTick(t => t + 1);
  }, [cacheKey]);

  return { data, isLoading, isRefreshing, error, filters, setFilters, refresh };
}
