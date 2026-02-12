/**
 * useBOQItems — Custom Hook for BOQ Data Management
 *
 * Fetches, filters, and manages BOQ items for a building.
 * Provides CRUD operations, client-side filtering, and real-time cost summaries.
 *
 * @module hooks/useBOQItems
 * @see ADR-175 (Quantity Surveying / BOQ)
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BOQItem,
  BOQItemStatus,
  BOQSummary,
  CreateBOQItemInput,
  UpdateBOQItemInput,
} from '@/types/boq';
import type { MasterBOQCategory } from '@/config/boq-categories';
import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';
import { boqService, computeBuildingSummary, computeItemCost } from '@/services/measurements';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useBOQItems');

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface BOQUIFilters {
  scope: 'all' | 'building' | 'unit';
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
  const [items, setItems] = useState<BOQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<BOQUIFilters>(DEFAULT_FILTERS);

  // Categories — static fallback (ATOE master)
  const categories = ATOE_MASTER_CATEGORIES;

  // --- FETCH ---

  const fetchItems = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    setError(null);
    try {
      const fetched = await boqService.getByBuilding(buildingId);
      setItems(fetched);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Σφάλμα φόρτωσης';
      logger.error('Failed to fetch BOQ items', { buildingId, error: err });
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

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

  // --- CRUD ---

  const createItem = useCallback(
    async (data: CreateBOQItemInput): Promise<BOQItem | null> => {
      try {
        const created = await boqService.create(data, userId, companyId);
        setItems((prev) => [...prev, created]);
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Σφάλμα δημιουργίας';
        logger.error('Failed to create BOQ item', { error: err });
        setError(message);
        return null;
      }
    },
    [userId, companyId]
  );

  const updateItem = useCallback(
    async (id: string, data: UpdateBOQItemInput): Promise<boolean> => {
      try {
        const updated = await boqService.update(id, data);
        if (updated) {
          setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
          return true;
        }
        return false;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Σφάλμα ενημέρωσης';
        logger.error('Failed to update BOQ item', { id, error: err });
        setError(message);
        return false;
      }
    },
    []
  );

  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    try {
      const success = await boqService.delete(id);
      if (success) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
      return success;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Σφάλμα διαγραφής';
      logger.error('Failed to delete BOQ item', { id, error: err });
      setError(message);
      return false;
    }
  }, []);

  const updateStatus = useCallback(
    async (id: string, status: BOQItemStatus): Promise<boolean> => {
      try {
        const success = await boqService.transition(id, status, userId);
        if (success) {
          setItems((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item
            )
          );
        }
        return success;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Σφάλμα αλλαγής κατάστασης';
        logger.error('Failed to transition BOQ item', { id, status, error: err });
        setError(message);
        return false;
      }
    },
    [userId]
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
    refreshItems: fetchItems,
  };
}
