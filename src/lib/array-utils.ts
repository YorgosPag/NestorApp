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
