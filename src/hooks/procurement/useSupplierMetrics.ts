'use client';

/**
 * useSupplierMetrics — Fetch supplier performance metrics
 *
 * @module hooks/procurement/useSupplierMetrics
 * @see ADR-267 Phase C (Supplier Metrics)
 */

import { useAsyncData } from '@/hooks/useAsyncData';
import type {
  SupplierMetrics,
  SupplierPriceTrend,
  SupplierComparison,
} from '@/types/procurement';

// ============================================================================
// SINGLE SUPPLIER METRICS
// ============================================================================

interface MetricsResponse {
  metrics: SupplierMetrics;
  priceTrend: SupplierPriceTrend[] | null;
}

async function fetchMetrics(
  supplierId: string,
  categoryCode: string | null
): Promise<MetricsResponse> {
  const params = new URLSearchParams({ supplierId });
  if (categoryCode) params.set('categoryCode', categoryCode);

  const res = await fetch(`/api/procurement/supplier-metrics?${params}`);
  const json = await res.json() as { success: boolean; data: MetricsResponse; error?: string };
  if (!json.success) throw new Error(json.error ?? 'Failed to fetch supplier metrics');
  return json.data;
}

/** Fetch metrics for a single supplier */
export function useSupplierMetrics(
  supplierId: string | null,
  categoryCode: string | null = null
) {
  const { data, loading, error, refetch } = useAsyncData<MetricsResponse>({
    fetcher: () => fetchMetrics(supplierId!, categoryCode),
    deps: [supplierId, categoryCode],
    enabled: !!supplierId,
  });

  return {
    metrics: data?.metrics ?? null,
    priceTrend: data?.priceTrend ?? null,
    isLoading: loading,
    error,
    refetch,
  };
}

// ============================================================================
// SUPPLIER COMPARISON
// ============================================================================

async function fetchComparison(): Promise<SupplierComparison> {
  const res = await fetch('/api/procurement/supplier-metrics/comparison');
  const json = await res.json() as { success: boolean; data: SupplierComparison; error?: string };
  if (!json.success) throw new Error(json.error ?? 'Failed to fetch supplier comparison');
  return json.data;
}

/** Fetch comparison of all suppliers */
export function useSupplierComparison() {
  const { data, loading, error, refetch } = useAsyncData<SupplierComparison>({
    fetcher: fetchComparison,
    deps: [],
  });

  return {
    comparison: data ?? null,
    isLoading: loading,
    error,
    refetch,
  };
}
