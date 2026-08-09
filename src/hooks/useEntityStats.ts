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
  /** Total monetary value — sums only the items that HAVE a value */
  totalValue: number;
  /** Average monetary value over the items that have one (see `valuedCount`) */
  averageValue: number;
  /** How many items contributed a value to `totalValue`. */
  valuedCount: number;
  /** How many items were skipped because `getValue` returned `null`. */
  unvaluedCount: number;
  /** Distribution by status field */
  byStatus: Record<string, number>;
  /** Distribution by type field */
  byType: Record<string, number>;
}

// ─── Config Interface ────────────────────────────────────────────────────────

export interface EntityStatsConfig<T> {
  /** Extract numeric area value from an item (default: 0) */
  getArea?: (item: T) => number;
  /**
   * Extract the monetary value of an item.
   *
   * Return `null` when the item genuinely has none — it is then left out of
   * both the sum and the average's denominator. Returning `0` instead states
   * that the item is worth nothing, which drags the average down and makes an
   * incomplete total look complete.
   */
  getValue?: (item: T) => number | null;
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
        valuedCount: 0,
        unvaluedCount: 0,
        byStatus: {},
        byType: {},
      };
    }

    const totalArea = getArea ? sumBy(items, getArea) : 0;

    // Items whose `getValue` returns `null` are absent from the sum AND from
    // the average's denominator. `sumBy` is deliberately not taught about
    // `null` — it has many callers in other domains, and this is the one place
    // that needs the distinction.
    const values = getValue
      ? items.map(getValue).filter((v): v is number => v != null)
      : [];
    const totalValue = values.reduce((sum, value) => sum + value, 0);
    const valuedCount = values.length;

    const byStatus = getStatus ? groupBy(items, getStatus) : {};
    const byType = getType ? groupBy(items, getType) : {};

    return {
      total,
      totalArea,
      averageArea: avg(totalArea, total),
      totalValue,
      averageValue: avg(totalValue, valuedCount),
      valuedCount,
      unvaluedCount: getValue ? total - valuedCount : 0,
      byStatus,
      byType,
    };
  }, [items, getArea, getValue, getStatus, getType]);
}
