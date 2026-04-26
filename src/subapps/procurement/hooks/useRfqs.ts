'use client';

import { useAsyncData } from '@/hooks/useAsyncData';
import type { RFQ, RfqFilters } from '@/subapps/procurement/types/rfq';

async function fetchRfqs(filters: Partial<RfqFilters>): Promise<RFQ[]> {
  const params = new URLSearchParams();
  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  const qs = params.toString();
  const res = await fetch(`/api/rfqs${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(`Failed to fetch RFQs: ${res.status}`);
  const json = await res.json();
  return (json.data ?? []) as RFQ[];
}

export function useRfqs(filters: Partial<RfqFilters> = {}) {
  const { data, loading, error, refetch, silentRefetch, patch } = useAsyncData<RFQ[]>({
    fetcher: () => fetchRfqs(filters),
    deps: [filters.projectId, filters.status, filters.search],
    initialData: [],
  });

  return { rfqs: data ?? [], loading, error, refetch, silentRefetch, patch };
}
