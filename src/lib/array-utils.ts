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

/** Sort direction for the nullable comparators below. */
export type SortDirection = 'asc' | 'desc';

/**
 * Numeric comparator that keeps "no value" at the END in BOTH directions.
 *
 * `null`/`undefined` means the value is unknown, not small. Substituting `0`
 * ranks a record with no data as the cheapest/smallest one and lets a sort
 * invent an order that the data does not contain.
 *
 * The both-directions rule is deliberate and follows the spreadsheet
 * convention (Excel places blanks last in ascending AND descending sorts)
 * rather than the SQL default, where NULLs flip to the front under `DESC`.
 * A user sorting a table is looking for an extreme; a record with no value is
 * a candidate for neither end, so it belongs after the answers either way.
 *
 * @example
 * rows.sort((a, b) => compareNumericNullsLast(key(a), key(b), 'desc'));
 */
export function compareNumericNullsLast(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: SortDirection = 'asc',
): number {
  const aMissing = a === null || a === undefined;
  const bMissing = b === null || b === undefined;

  // Missing values never take part in the ordering — they are appended.
  if (aMissing || bMissing) {
    if (aMissing && bMissing) return 0;
    return aMissing ? 1 : -1;
  }

  return direction === 'asc' ? a - b : b - a;
}
