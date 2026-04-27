'use client';

import { useAsyncData } from '@/hooks/useAsyncData';
import type { SupplierMetrics } from '@/types/procurement';

interface SupplierMetricsResponse {
  metrics: SupplierMetrics;
  priceTrend: unknown;
}

async function fetchSupplierMetrics(supplierId: string): Promise<SupplierMetricsResponse> {
  const res = await fetch(
    `/api/procurement/supplier-metrics?supplierId=${encodeURIComponent(supplierId)}`
  );
  if (!res.ok) throw new Error(`Failed to fetch supplier metrics: ${res.status}`);
  const json = await res.json();
  return json.data as SupplierMetricsResponse;
}

export function useSupplierMetricsForContact(supplierId: string | null) {
  const { data, loading, error, refetch, silentRefetch } = useAsyncData<SupplierMetricsResponse | null>({
    fetcher: () => (supplierId ? fetchSupplierMetrics(supplierId) : Promise.resolve(null)),
    deps: [supplierId],
    enabled: Boolean(supplierId),
    initialData: null,
  });

  return {
    metrics: data?.metrics ?? null,
    priceTrend: data?.priceTrend ?? null,
    loading,
    error,
    refetch,
    silentRefetch,
  };
}
