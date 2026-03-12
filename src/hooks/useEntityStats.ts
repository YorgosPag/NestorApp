'use client';

/**
 * =============================================================================
 * GENERIC ENTITY STATISTICS HOOK — useEntityStats<T>
 * =============================================================================
 *
 * Centralized statistics computation for entity collections.
 * Eliminates ~400 lines of duplicated useMemo logic across
 * useProjectsStats, useUnitsStats, useParkingStats, useStorageStats, useBuildingStats.
 *
 * Pattern: Config-driven generic hook + thin entity-specific wrappers.
 *
 * @module hooks/useEntityStats
 * @see ADR-203 (useEntityPageState) for the same generic pattern
 */

import { useMemo } from 'react';

// ─── Utility Functions ───────────────────────────────────────────────────────

/** Group items by a string accessor, returning counts per group */
export function groupBy<T>(items: T[], accessor: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const key = accessor(item);
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}

/** Sum a numeric field across all items */
export function sumBy<T>(items: T[], accessor: (item: T) => number): number {
  let total = 0;
  for (const item of items) {
    total += accessor(item);
  }
  return total;
}

/** Count items matching a predicate */
export function countBy<T>(items: T[], predicate: (item: T) => boolean): number {
  let count = 0;
  for (const item of items) {
    if (predicate(item)) count++;
  }
  return count;
}

/** Calculate percentage rate (0-100, rounded). Returns 0 if denominator is 0. */
export function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

/** Calculate average. Returns 0 if count is 0. */
export function avg(total: number, count: number): number {
  return count > 0 ? total / count : 0;
}

/** Calculate rounded average. Returns 0 if count is 0. */
export function avgRounded(total: number, count: number): number {
  return count > 0 ? Math.round(total / count) : 0;
}

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
