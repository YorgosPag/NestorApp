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

/** Sort direction for the comparator below. */
export type SortDirection = 'asc' | 'desc';

/** What a sortable column may hand back for one row. */
export type SortableValue = string | number | null | undefined;

/**
 * The comparator for a sortable column — text, number, or absent.
 *
 * Every sortable list in the app asks this one question, and until now three of
 * them answered it privately: `BuildingSpaceTable`, `ParkingsList` and
 * `StoragesList` carried the same twenty lines, which CHECK 3.28 measured as
 * one clone. The three rules they have to agree on are none of them obvious:
 *
 * 1. **Absent values go last in BOTH directions.** `null`/`undefined` means the
 *    value is unknown, not small — substituting `0` ranks a record with no data
 *    as the cheapest one and lets a sort invent an order the data does not
 *    contain. Both directions is deliberate: it follows the spreadsheet
 *    convention (Excel puts blanks last ascending AND descending), not the SQL
 *    default where NULLs flip to the front under `DESC`. Someone sorting a
 *    table is looking for an extreme, and a record with no value is a candidate
 *    for neither end.
 * 2. **Text is compared under an EXPLICIT locale.** A bare `localeCompare(b)`
 *    uses the runtime's default, so the same two rows could order one way on
 *    the server and another in the browser, and differently again for a user
 *    with another system language. Greek is pinned because it is the language
 *    these lists hold: only under `el` does «Ά» sort next to «Α» rather than
 *    after «Ω».
 * 3. **Mixed types fall back to text**, so a column returning a number for some
 *    rows and a string for others still yields a total order.
 *
 * @example
 * rows.sort((a, b) => compareSortValues(key(a), key(b), sortOrder));
 */
export function compareSortValues(
  a: SortableValue,
  b: SortableValue,
  direction: SortDirection = 'asc',
): number {
  const aMissing = a === null || a === undefined;
  const bMissing = b === null || b === undefined;

  // Missing values never take part in the ordering — they are appended.
  if (aMissing || bMissing) {
    if (aMissing && bMissing) return 0;
    return aMissing ? 1 : -1;
  }

  if (typeof a === 'number' && typeof b === 'number') {
    return direction === 'asc' ? a - b : b - a;
  }

  const cmp = String(a).toLowerCase().localeCompare(String(b).toLowerCase(), 'el');
  return direction === 'asc' ? cmp : -cmp;
}
