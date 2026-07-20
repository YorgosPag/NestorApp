/**
 * search-query-params — ανάγνωση των παραμέτρων του `GET /api/search`.
 *
 * Εξήχθη από το `./route.ts` (όριο 300 γραμμών για API routes). Η ευθύνη είναι μία:
 * **αναξιόπιστο query string → έγκυρες τιμές**. Κάθε συνάρτηση εδώ είναι ολικά ορισμένη —
 * δέχεται `null` και ό,τι σκουπίδι στείλει ο client και επιστρέφει πάντα κάτι χρησιμοποιήσιμο,
 * ώστε ο handler να μην χρειάζεται ούτε μία άμυνα εισόδου.
 *
 * @see ./route.ts — ο μοναδικός καταναλωτής
 * @see ./search-result-transform — η αντίστροφη πλευρά (έγγραφο → απάντηση)
 */

import { SEARCH_CONFIG, isSearchEntityType, type SearchEntityType } from '@/types/search';

/**
 * Parse entity types from query parameter.
 *
 * @param typesParam - Comma-separated types string
 * @returns Array of valid SearchEntityType values
 */
export function parseEntityTypes(typesParam: string | null): SearchEntityType[] | undefined {
  if (!typesParam) return undefined;

  const types = typesParam
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(isSearchEntityType);

  return types.length > 0 ? types : undefined;
}

/**
 * Parse limit from query parameter with bounds checking.
 *
 * @param limitParam - Limit string from query
 * @returns Validated limit number
 */
export function parseLimit(limitParam: string | null): number {
  if (!limitParam) return SEARCH_CONFIG.DEFAULT_LIMIT;

  const parsed = parseInt(limitParam, 10);
  if (isNaN(parsed) || parsed < 1) return SEARCH_CONFIG.DEFAULT_LIMIT;
  if (parsed > SEARCH_CONFIG.MAX_LIMIT) return SEARCH_CONFIG.MAX_LIMIT;

  return parsed;
}
