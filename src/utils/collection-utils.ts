/**
 * COLLECTION UTILITIES — Pure Functions for Array Aggregation
 *
 * Extracted from useEntityStats.ts (Phase 6, ADR-207) to enable server-side
 * and client-side reuse without React dependency.
 *
 * Zero dependencies. Zero React. Safe for API routes and 'use client' alike.
 *
 * @module utils/collection-utils
 * @see ADR-207 Phase 6 — Collection utilities extraction
 */

// ─── Grouping ────────────────────────────────────────────────────────────────

/** Group items into arrays by a string key accessor */
export function groupByKey<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

/** Count items per group (tally). Returns `Record<string, number>`. */
export function tallyBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}

/** Weighted tally — sum a numeric value per group key */
export function sumByKey<T>(
  items: T[],
  keyFn: (item: T) => string,
  valueFn: (item: T) => number,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    result[key] = (result[key] || 0) + valueFn(item);
  }
  return result;
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

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
