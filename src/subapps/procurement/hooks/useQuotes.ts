'use client';

import { useAsyncData } from '@/hooks/useAsyncData';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';
import type { Quote, QuoteFilters } from '@/subapps/procurement/types/quote';

// ADR-300: Cache only the default (no-filter) list — state on re-navigation
const quotesCache = createStaleCache<Quote[]>('quotes');

async function fetchQuotes(filters: Partial<QuoteFilters>): Promise<Quote[]> {
  const params = new URLSearchParams();
  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.rfqId) params.set('rfqId', filters.rfqId);
  if (filters.trade) params.set('trade', filters.trade);
  if (filters.status) params.set('status', filters.status);
  if (filters.vendorContactId) params.set('vendorContactId', filters.vendorContactId);
  const qs = params.toString();
  const res = await fetch(`/api/quotes${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(`Failed to fetch quotes: ${res.status}`);
  const json = await res.json();
  return (json.data ?? []) as Quote[];
}

export function useQuotes(filters: Partial<QuoteFilters> = {}) {
  const isDefaultFilters =
    !filters.projectId &&
    !filters.rfqId &&
    !filters.trade &&
    !filters.status &&
    !filters.vendorContactId;

  const { data, loading, error, refetch, silentRefetch, patch } = useAsyncData<Quote[]>({
    fetcher: async () => {
      const result = await fetchQuotes(filters);
      // ADR-300: Cache only the default state — what user sees on re-navigation
      if (isDefaultFilters) quotesCache.set(result);
      return result;
    },
    deps: [filters.projectId, filters.rfqId, filters.trade, filters.status, filters.vendorContactId],
    initialData: isDefaultFilters ? (quotesCache.get() ?? []) : [],
    silentInitialFetch: isDefaultFilters && quotesCache.hasLoaded(),
  });

  return { quotes: data ?? [], loading, error, refetch, silentRefetch, patch };
}
