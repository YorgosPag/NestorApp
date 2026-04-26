'use client';

import { useAsyncData } from '@/hooks/useAsyncData';
import type { Quote, QuoteFilters } from '@/subapps/procurement/types/quote';

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
  const { data, loading, error, refetch, silentRefetch, patch } = useAsyncData<Quote[]>({
    fetcher: () => fetchQuotes(filters),
    deps: [filters.projectId, filters.rfqId, filters.trade, filters.status],
    initialData: [],
  });

  return { quotes: data ?? [], loading, error, refetch, silentRefetch, patch };
}
