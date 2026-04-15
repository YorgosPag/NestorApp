/**
 * useBOQItems — Custom Hook for BOQ Data Management
 *
 * Fetches, filters, and manages BOQ items for a building.
 * Uses centralized useAsyncData for data fetching (ADR-223).
 * CRUD operations trigger refetch for server-consistent state.
 *
 * @module hooks/useBOQItems
 * @see ADR-175 (Quantity Surveying / BOQ)
 */

'use client';

import { useCallback, useMemo, useState } from 'react';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  BOQItem,
  BOQItemStatus,
  BOQSummary,
  CreateBOQItemInput,
  UpdateBOQItemInput,
} from '@/types/boq';
import type { MasterBOQCategory } from '@/config/boq-categories';
import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';
import { boqService, computeBuildingSummary } from '@/services/measurements';
import {
  createBOQItemWithPolicy,
  deleteBOQItemWithPolicy,
  transitionBOQItemWithPolicy,
  updateBOQItemWithPolicy,
} from '@/services/measurements/boq-mutation-gateway';
import { createModuleLogger } from '@/lib/telemetry';
import { useAsyncData } from '@/hooks/useAsyncData';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

const logger = createModuleLogger('useBOQItems');

// ADR-300: Module-level cache survives React unmount/remount (navigation)
// Keyed by buildingId
const boqItemsCache = createStaleCache<BOQItem[]>('boq-items');

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface BOQUIFilters {
  scope: 'all' | 'building' | 'property';
  status: BOQItemStatus | 'all';
  categoryCode: string; // '' = all
  searchQuery: string;
}

const DEFAULT_FILTERS: BOQUIFilters = {
  scope: 'all',
  status: 'all',
  categoryCode: '',
  searchQuery: '',
};

// ============================================================================
// RETURN TYPE
// ============================================================================

export interface UseBOQItemsReturn {
  /** All items (unfiltered) */
  items: BOQItem[];
  /** Filtered items */
  filteredItems: BOQItem[];
  /** ATOE categories */
  categories: readonly MasterBOQCategory[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Cost summary */
  summary: BOQSummary | null;
  /** Current filters */
  filters: BOQUIFilters;
  /** Update filters */
  setFilters: (filters: Partial<BOQUIFilters>) => void;
  /** Reset filters */
  resetFilters: () => void;
  /** CRUD: Create new item */
  createItem: (data: CreateBOQItemInput) => Promise<BOQItem | null>;
  /** CRUD: Update item */
  updateItem: (id: string, data: UpdateBOQItemInput) => Promise<boolean>;
  /** CRUD: Delete item */
  deleteItem: (id: string) => Promise<boolean>;
  /** Governance: Transition status */
  updateStatus: (id: string, status: BOQItemStatus) => Promise<boolean>;
  /** Refresh data */
  refreshItems: () => Promise<void>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useBOQItems(
  buildingId: string,
  projectId: string,
  companyId: string,
  userId: string
): UseBOQItemsReturn {
  const [filters, setFiltersState] = useState<BOQUIFilters>(DEFAULT_FILTERS);
  const [crudError, setCrudError] = useState<string | null>(null);

  // Categories — static fallback (ATOE master)
  const categories = ATOE_MASTER_CATEGORIES;

  // --- FETCH via useAsyncData ---

  const { data, loading, error: fetchError, refetch: refreshItems } = useAsyncData({
    fetcher: async () => {
      const result = await boqService.getByBuilding(companyId, buildingId);
      // ADR-300: Write to module-level cache so next remount skips spinner
      boqItemsCache.set(result, buildingId);
      return result;
    },
    deps: [companyId, buildingId],
    enabled: !!buildingId && !!companyId,
    initialData: boqItemsCache.get(buildingId),
    silentInitialFetch: boqItemsCache.hasLoaded(buildingId),
  });

  const items = data ?? [];
  const error = crudError ?? fetchError;

  // --- CLIENT-SIDE FILTERING ---

  const filteredItems = useMemo(() => {
    let result = items;

    if (filters.scope !== 'all') {
      result = result.filter((item) => item.scope === filters.scope);
    }

    if (filters.status !== 'all') {
      result = result.filter((item) => item.status === filters.status);
    }

    if (filters.categoryCode) {
      result = result.filter((item) => item.categoryCode === filters.categoryCode);
    }

    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.description?.toLowerCase().includes(q) ?? false)
      );
    }

    return result;
  }, [items, filters]);

  // --- SUMMARY (computed from all items, not filtered) ---

  const summary = useMemo<BOQSummary | null>(() => {
    if (items.length === 0) return null;

    const categoryNames = new Map<string, string>();
    for (const cat of categories) {
      categoryNames.set(cat.code, cat.nameEL);
    }

    return computeBuildingSummary(buildingId, items, categoryNames);
  }, [items, buildingId, categories]);

  // --- FILTER SETTERS ---

  const setFilters = useCallback((partial: Partial<BOQUIFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  // --- CRUD (trigger refetch after success) ---

  const createItem = useCallback(
    async (input: CreateBOQItemInput): Promise<BOQItem | null> => {
      try {
        setCrudError(null);
        const created = await createBOQItemWithPolicy({
          data: input,
          userId,
          companyId,
        });
        await refreshItems();
        return created;
      } catch (err) {
        const message = getErrorMessage(err);
        logger.error('Failed to create BOQ item', { error: err });
        setCrudError(message);
        return null;
      }
    },
    [userId, companyId, refreshItems]
  );

  const updateItem = useCallback(
    async (id: string, input: UpdateBOQItemInput): Promise<boolean> => {
      try {
        setCrudError(null);
        const updated = await updateBOQItemWithPolicy({
          id,
          data: input,
        });
        if (updated) {
          await refreshItems();
          return true;
        }
        return false;
      } catch (err) {
        const message = getErrorMessage(err);
        logger.error('Failed to update BOQ item', { id, error: err });
        setCrudError(message);
        return false;
      }
    },
    [refreshItems]
  );

  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    try {
      setCrudError(null);
      const success = await deleteBOQItemWithPolicy({ id });
      if (success) {
        await refreshItems();
      }
      return success;
    } catch (err) {
      const message = getErrorMessage(err);
      logger.error('Failed to delete BOQ item', { id, error: err });
      setCrudError(message);
      return false;
    }
  }, [refreshItems]);

  const updateStatus = useCallback(
    async (id: string, status: BOQItemStatus): Promise<boolean> => {
      try {
        setCrudError(null);
        const success = await transitionBOQItemWithPolicy({
          id,
          status,
          userId,
        });
        if (success) {
          await refreshItems();
        }
        return success;
      } catch (err) {
        const message = getErrorMessage(err);
        logger.error('Failed to transition BOQ item', { id, status, error: err });
        setCrudError(message);
        return false;
      }
    },
    [userId, refreshItems]
  );

  return {
    items,
    filteredItems,
    categories,
    loading,
    error,
    summary,
    filters,
    setFilters,
    resetFilters,
    createItem,
    updateItem,
    deleteItem,
    updateStatus,
    refreshItems,
  };
}
