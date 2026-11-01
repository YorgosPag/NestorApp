/**
 * search-access — ποιους τύπους οντοτήτων δικαιούται να βρει ο καλών (ADR-829 §7).
 *
 * Το `search:global:execute` ανοίγει την πόρτα· δεν λέει τι υπάρχει πίσω της. Κάθε τύπος
 * κρίνεται εδώ, **πριν** από το ερώτημα, ώστε ο καλών να μη μετρά ούτε έμμεσα ό,τι δεν
 * δικαιούται: φιλτράρισμα εκ των υστέρων θα έτρωγε το `limit` και θα χαλούσε τους μετρητές.
 *
 * ⚠️ **Χωρίς `projectId`, επίτηδες.** Η αναζήτηση είναι ερώτημα εμβέλειας χώρου· ο ρόλος
 * έργου δεν περνά από εδώ. Δεν είναι δεύτερος κριτής: η κάθε ετυμηγορία είναι του
 * `hasPermission`, και ο πίνακας τύπος → δικαίωμα είναι ο `SEARCH_REQUIRED_PERMISSIONS`.
 *
 * ⚠️ **Από τον πίνακα, ποτέ από το έγγραφο.** Το `requiredPermission` μιας αποθηκευμένης
 * εγγραφής μπορεί να είναι παλιότερο από τον πίνακα, και δεν εξουσιοδοτεί τίποτα.
 *
 * @module lib/search/search-access
 * @see config/search-index-core — ο πίνακας
 */

import 'server-only';

import { hasPermission } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import type { PermissionId } from '@/lib/auth/types';
import { SEARCH_REQUIRED_PERMISSIONS } from '@/config/search-index-core';
import type { SearchEntityType } from '@/types/search';

/**
 * Οι τύποι του `requested` που δικαιούται ο καλών, με την ίδια σειρά.
 *
 * Κλειστό σε αμφιβολία: τύπος χωρίς γραμμή στον πίνακα φτάνει στον κριτή ως άγνωστο
 * δικαίωμα (`invalid_permission`) και απορρίπτεται.
 *
 * ⚠️ Σειριακά, όπως ο βρόχος του `hasAllPermissions`: η `cache` γεμίζει σταδιακά.
 */
export async function grantedSearchEntityTypes(
  ctx: AuthContext,
  requested: readonly SearchEntityType[],
  cache: PermissionCache,
): Promise<SearchEntityType[]> {
  const granted: SearchEntityType[] = [];
  for (const entityType of requested) {
    const permission: PermissionId = SEARCH_REQUIRED_PERMISSIONS[entityType];
    if (await hasPermission(ctx, permission, {}, cache)) granted.push(entityType);
  }
  return granted;
}
