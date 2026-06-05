/**
 * Array utility functions — centralized, zero dependencies
 *
 * @module lib/array-utils
 * @see ADR-213 Phase 10 — chunkArray deduplication
 */

/**
 * Split an array into chunks of a given size.
 *
 * Common use case: Firestore `in` queries are limited to 10 items,
 * so arrays of IDs must be chunked before querying.
 *
 * @example
 * chunkArray([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Deterministic, locale-independent string comparator for `Array.prototype.sort`.
 *
 * Uses lexicographic (UTF-16 code-unit) ordering. Unlike `compareByLocale`
 * (`@/lib/intl-formatting`), the result NEVER depends on the active locale and
 * NEVER collapses case/accent differences — so it is the correct choice for
 * sorting machine identifiers, keys, and ISO timestamps where a stable,
 * reproducible order is required (e.g. geometry derivation, network ordering).
 *
 * Do NOT use this for user-facing text — use `compareByLocale` for that.
 *
 * @example
 * ids.sort(compareStrings);                          // ascending
 * items.sort((a, b) => compareStrings(b.id, a.id));  // descending
 */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
