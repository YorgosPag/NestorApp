'use client';

/**
 * =============================================================================
 * GENERIC ENTITY STATISTICS HOOK — useEntityStats<T>
 * =============================================================================
 *
 * Centralized statistics computation for entity collections.
 * Eliminates ~400 lines of duplicated useMemo logic across
 * useProjectsStats, usePropertiesStats, useParkingStats, useStorageStats, useBuildingStats.
 *
 * Pattern: Config-driven generic hook + thin entity-specific wrappers.
 *
 * @module hooks/useEntityStats
 * @see ADR-203 (useEntityPageState) for the same generic pattern
 */

import { useMemo } from 'react';

// ─── Utility Functions (re-exported from server-safe module) ─────────────────
// ADR-207: Extracted to @/utils/collection-utils for server+client reuse.
// `groupBy` here is the tally variant (returns counts, not arrays).

export { tallyBy as groupBy, countBy, sumBy, rate, avg, avgRounded } from '@/utils/collection-utils';
import { tallyBy as groupBy, sumBy, avg } from '@/utils/collection-utils';

// ─── Base Stats Interface ────────────────────────────────────────────────────

export interface BaseEntityStats {
  /** Total number of items in the collection */
  total: number;
  /** Total area (m²) across all items */
  totalArea: number;
  /** Average area per item */
  averageArea: number;
  /** Total monetary value across all items */
  totalValue: number;
  /** Average monetary value per item */
  averageValue: number;
  /** Distribution by status field */
  byStatus: Record<string, number>;
  /** Distribution by type field */
  byType: Record<string, number>;
}

// ─── Config Interface ────────────────────────────────────────────────────────

export interface EntityStatsConfig<T> {
  /** Extract numeric area value from an item (default: 0) */
  getArea?: (item: T) => number;
  /** Extract numeric price/value from an item (default: 0) */
  getValue?: (item: T) => number;
  /** Extract status string from an item (default: 'unknown') */
  getStatus?: (item: T) => string;
  /** Extract type string from an item (default: 'unknown') */
  getType?: (item: T) => string;
}

// ─── Generic Hook ────────────────────────────────────────────────────────────

/**
 * Computes base statistics for any entity collection.
 *
 * Returns `BaseEntityStats` which wrappers can extend with entity-specific data.
 * The hook is memoized on the input array reference.
 *
 * @example
 * ```ts
 * const base = useEntityStats(projects, {
 *   getArea: p => p.totalArea ?? p.area ?? 0,
 *   getValue: p => p.budget ?? 0,
 *   getStatus: p => p.status ?? 'unknown',
 *   getType: p => p.type ?? 'unknown',
 * });
 * ```
 */
export function useEntityStats<T>(
  items: T[],
  config: EntityStatsConfig<T>,
): BaseEntityStats {
  const { getArea, getValue, getStatus, getType } = config;

  return useMemo(() => {
    const total = items.length;

    if (total === 0) {
      return {
        total: 0,
        totalArea: 0,
        averageArea: 0,
        totalValue: 0,
        averageValue: 0,
        byStatus: {},
        byType: {},
      };
    }

    const totalArea = getArea ? sumBy(items, getArea) : 0;
    const totalValue = getValue ? sumBy(items, getValue) : 0;

    const byStatus = getStatus ? groupBy(items, getStatus) : {};
    const byType = getType ? groupBy(items, getType) : {};

    return {
      total,
      totalArea,
      averageArea: avg(totalArea, total),
      totalValue,
      averageValue: avg(totalValue, total),
      byStatus,
      byType,
    };
  }, [items, getArea, getValue, getStatus, getType]);
}
