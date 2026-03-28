'use client';

/**
 * usePurchaseOrders — Fetch and filter purchase orders
 *
 * Wraps /api/procurement with useAsyncData for auto-refetch on filter change.
 * Provides search, status filter, project filter, supplier filter.
 *
 * @module hooks/procurement/usePurchaseOrders
 * @see ADR-267 §Phase A
 */

import { useState, useMemo, useCallback } from 'react';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/procurement';

// ============================================================================
// FILTER STATE
// ============================================================================

export interface POFilters {
  search: string;
  status: PurchaseOrderStatus | null;
  projectId: string | null;
  supplierId: string | null;
}

const DEFAULT_FILTERS: POFilters = {
  search: '',
  status: null,
  projectId: null,
  supplierId: null,
};

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

export function usePurchaseOrders() {
  const [filters, setFilters] = useState<POFilters>(DEFAULT_FILTERS);

  const { data: allPOs, loading, error, refetch } = useAsyncData<PurchaseOrder[]>({
    fetcher: () => fetchPurchaseOrders(filters),
    deps: [filters.status, filters.projectId, filters.supplierId],
    initialData: [],
  });

  // Client-side text search (instant, no API call)
  const filteredPOs = useMemo(() => {
    if (!allPOs) return [];
    if (!filters.search) return allPOs;

    const term = filters.search.toLowerCase();
    return allPOs.filter((po) =>
      po.poNumber.toLowerCase().includes(term) ||
      po.items.some((i) => i.description.toLowerCase().includes(term))
    );
  }, [allPOs, filters.search]);

  // "Requires Action" section — pinned POs
  const actionRequired = useMemo(() => {
    if (!filteredPOs) return [];
    const now = new Date().toISOString();

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
  const setSearch = useCallback((v: string) =>
    setFilters((f) => ({ ...f, search: v })), []);
  const setStatus = useCallback((v: PurchaseOrderStatus | null) =>
    setFilters((f) => ({ ...f, status: v })), []);
  const setProjectId = useCallback((v: string | null) =>
    setFilters((f) => ({ ...f, projectId: v })), []);
  const setSupplierId = useCallback((v: string | null) =>
    setFilters((f) => ({ ...f, supplierId: v })), []);
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
