'use client';

/**
 * useSupplierMetrics — Fetch supplier performance metrics
 *
 * @module hooks/procurement/useSupplierMetrics
 * @see ADR-267 Phase C (Supplier Metrics)
 */

import { useAsyncData } from '@/hooks/useAsyncData';
import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type {
  SupplierMetrics,
  SupplierPriceTrend,
  SupplierComparison,
} from '@/types/procurement';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

// ADR-300: Module-level caches survive React unmount/remount (navigation)
const supplierMetricsCache = createStaleCache<MetricsResponse>('supplier-metrics');
const supplierComparisonCache = createStaleCache<SupplierComparison>('supplier-comparison');

// ============================================================================
// SINGLE SUPPLIER METRICS
// ============================================================================

interface MetricsResponse {
  metrics: SupplierMetrics;
  priceTrend: SupplierPriceTrend[] | null;
}

function fetchMetrics(
  supplierId: string,
  categoryCode: string | null
): Promise<MetricsResponse> {
  return apiClient.get<MetricsResponse>(API_ROUTES.PROCUREMENT.SUPPLIER_METRICS, {
    params: { supplierId, ...(categoryCode ? { categoryCode } : {}) },
  });
}

/** Fetch metrics for a single supplier */
export function useSupplierMetrics(
  supplierId: string | null,
  categoryCode: string | null = null
) {
  const cacheKey = supplierId ? `${supplierId}_${categoryCode ?? 'null'}` : null;

  const { data, loading, error, refetch } = useAsyncData<MetricsResponse>({
    fetcher: async () => {
      const result = await fetchMetrics(supplierId!, categoryCode);
      // ADR-300: Write to module-level cache so next remount skips spinner
      if (cacheKey) supplierMetricsCache.set(result, cacheKey);
      return result;
    },
    deps: [supplierId, categoryCode],
    enabled: !!supplierId,
    initialData: (cacheKey ? supplierMetricsCache.get(cacheKey) : undefined) ?? undefined,
    silentInitialFetch: !!cacheKey && supplierMetricsCache.hasLoaded(cacheKey),
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

function fetchComparison(): Promise<SupplierComparison> {
  return apiClient.get<SupplierComparison>(API_ROUTES.PROCUREMENT.SUPPLIER_COMPARISON);
}

/** Fetch comparison of all suppliers */
export function useSupplierComparison() {
  const { data, loading, error, refetch } = useAsyncData<SupplierComparison>({
    fetcher: async () => {
      const result = await fetchComparison();
      // ADR-300: Write to module-level cache so next remount skips spinner
      supplierComparisonCache.set(result);
      return result;
    },
    deps: [],
    initialData: supplierComparisonCache.get() ?? undefined,
    silentInitialFetch: supplierComparisonCache.hasLoaded(),
  });

  return {
    comparison: data ?? null,
    isLoading: loading,
    error,
    refetch,
  };
}
