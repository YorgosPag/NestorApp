/**
 * @fileoverview Greek-aware fuzzy string equality via Levenshtein distance.
 * Normalizes diacritics + final sigma before comparison.
 * @adr ADR-328 §5.AA.1 · ADR-883 §5.11 (η απόσταση ζει πλέον στο `edit-distance`)
 */

import { normalizeSearchText } from '@/lib/search/search';
import { editDistance } from '@/lib/string/edit-distance';

/**
 * True if normalized Levenshtein distance ≤ maxDistance (default 2).
 * Empty strings never match to avoid false positives on missing vendor names.
 */
export function fuzzyEqualGreek(a: string, b: string, maxDistance = 2): boolean {
  if (!a || !b) return false;
  return editDistance(normalizeSearchText(a), normalizeSearchText(b), { max: maxDistance }) <= maxDistance;
}
