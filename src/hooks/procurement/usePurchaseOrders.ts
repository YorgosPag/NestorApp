'use client';

/**
 * usePurchaseOrders — Fetch and filter purchase orders
 *
 * Wraps /api/procurement with useAsyncData for auto-refetch on filter change.
 * Provides search, status filter, project filter, supplier filter.
 * Optional `drill` param applies analytics drill-down filters client-side (ADR-331 Phase F).
 *
 * @module hooks/procurement/usePurchaseOrders
 * @see ADR-267 §Phase A
 * @see ADR-331 §2.7 D5
 */

import { useState, useMemo, useCallback } from 'react';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { PurchaseOrder, PurchaseOrderStatus, POFilters, AnalyticsDrillFilters } from '@/types/procurement';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';
import { nowISO } from '@/lib/date-local';

// ADR-300: Cache only the default (no-filter) list — state on re-navigation
const purchaseOrdersCache = createStaleCache<PurchaseOrder[]>('procurement');

// ============================================================================
// FILTER STATE
// ============================================================================

export type { POFilters };

const DEFAULT_FILTERS: POFilters = {
  search: '',
  status: null,
  projectId: null,
  supplierId: null,
};

// ============================================================================
// ANALYTICS DRILL HELPERS (ADR-331 Phase F)
// ============================================================================

function isActiveDrill(f: AnalyticsDrillFilters): boolean {
  return (
    f.from !== null ||
    f.to !== null ||
    f.projectIds.length > 0 ||
    f.supplierIds.length > 0 ||
    f.categoryCodes.length > 0 ||
    f.statuses.length > 0
  );
}

function applyAnalyticsDrill(pos: PurchaseOrder[], f: AnalyticsDrillFilters): PurchaseOrder[] {
  return pos.filter((po) => {
    const dateKey = po.dateCreated.substring(0, 10);
    if (f.from && dateKey < f.from) return false;
    if (f.to && dateKey > f.to) return false;
    if (f.projectIds.length > 0 && !f.projectIds.includes(po.projectId)) return false;
    if (f.supplierIds.length > 0 && !f.supplierIds.includes(po.supplierId)) return false;
    if (f.statuses.length > 0 && !(f.statuses as string[]).includes(po.status)) return false;
    if (
      f.categoryCodes.length > 0 &&
      !po.items.some((item) => (f.categoryCodes as string[]).includes(item.categoryCode))
    ) return false;
    return true;
  });
}

// ============================================================================
// FETCH
// ============================================================================

async function fetchPurchaseOrders(filters: POFilters): Promise<PurchaseOrder[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.supplierId) params.set('supplierId', filters.supplierId);

  const qs = params.toString();
  const url = `/api/procurement${qs ? `?${qs}` : ''}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch POs: ${res.status}`);

  const json = await res.json();
  return json.data as PurchaseOrder[];
}

// ============================================================================
// HOOK
// ============================================================================

export function usePurchaseOrders(drill?: AnalyticsDrillFilters) {
  const [filters, setFilters] = useState<POFilters>(DEFAULT_FILTERS);

  const hasDrill = drill !== undefined && isActiveDrill(drill);
  const isDefaultFilters = !filters.status && !filters.projectId && !filters.supplierId && !hasDrill;

  const { data: allPOs, loading, error, refetch } = useAsyncData<PurchaseOrder[]>({
    fetcher: async () => {
      const result = await fetchPurchaseOrders(filters);
      // ADR-300: Cache only the default state — what user sees on re-navigation
      if (isDefaultFilters) purchaseOrdersCache.set(result);
      return result;
    },
    deps: [filters.status, filters.projectId, filters.supplierId],
    initialData: isDefaultFilters ? (purchaseOrdersCache.get() ?? []) : [],
    silentInitialFetch: isDefaultFilters && purchaseOrdersCache.hasLoaded(),
  });

  // Analytics drill overlay — applied before text search (ADR-331 Phase F)
  const drillFiltered = useMemo(
    () => (allPOs && hasDrill && drill ? applyAnalyticsDrill(allPOs, drill) : (allPOs ?? [])),
    [allPOs, hasDrill, drill],
  );

  // Client-side text search (instant, no API call)
  const filteredPOs = useMemo(() => {
    if (!filters.search) return drillFiltered;
    const term = filters.search.toLowerCase();
    return drillFiltered.filter(
      (po) =>
        po.poNumber.toLowerCase().includes(term) ||
        po.items.some((i) => i.description.toLowerCase().includes(term)),
    );
  }, [drillFiltered, filters.search]);

  // "Requires Action" section — pinned POs
  const actionRequired = useMemo(() => {
    const now = nowISO();
    return filteredPOs.filter((po) => {
      if (po.status === 'draft') return true;
      if (po.status === 'partially_delivered') return true;
      if (
        po.dateNeeded &&
        po.dateNeeded < now &&
        ['ordered', 'partially_delivered'].includes(po.status)
      ) return true;
      return false;
    });
  }, [filteredPOs]);

  // Filter setters
  const setSearch = useCallback((v: string) => setFilters((f) => ({ ...f, search: v })), []);
  const setStatus = useCallback(
    (v: PurchaseOrderStatus | null) => setFilters((f) => ({ ...f, status: v })),
    [],
  );
  const setProjectId = useCallback(
    (v: string | null) => setFilters((f) => ({ ...f, projectId: v })),
    [],
  );
  const setSupplierId = useCallback(
    (v: string | null) => setFilters((f) => ({ ...f, supplierId: v })),
    [],
  );
  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  return {
    // Data
    purchaseOrders: filteredPOs,
    actionRequired,
    allCount: allPOs?.length ?? 0,

    // State
    loading,
    error,
    filters,

    // Actions
    setSearch,
    setStatus,
    setProjectId,
    setSupplierId,
    resetFilters,
    refetch,
  };
}
