/**
 * @fileoverview Greek-aware fuzzy string equality via Levenshtein distance.
 * Normalizes diacritics + final sigma before comparison.
 * @adr ADR-328 §5.AA.1
 */

import { normalizeSearchText } from '@/lib/search/search';

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0]++;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[n];
}

/**
 * True if normalized Levenshtein distance ≤ maxDistance (default 2).
 * Empty strings never match to avoid false positives on missing vendor names.
 */
export function fuzzyEqualGreek(a: string, b: string, maxDistance = 2): boolean {
  if (!a || !b) return false;
  return levenshtein(normalizeSearchText(a), normalizeSearchText(b)) <= maxDistance;
}
