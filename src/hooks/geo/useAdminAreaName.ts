'use client';

/**
 * @fileoverview **Το όνομα μιας διοικητικής περιοχής από την ταυτότητά της** (ADR-883) — το ΕΝΑ σημείο.
 * @related hooks/geo/useAdminAreaIndex.ts · components/search-results/AdminPlaceMarker.tsx ·
 *   components/mandate/ShowcaseContactCard.tsx (ADR-896 §6)
 * @module hooks/geo/useAdminAreaName
 *
 * 🔑 Το όνομα ζει **μόνο** στο ευρετήριο (ένα SSoT) — τα έγγραφα κρατούν ταυτότητα, ώστε μια διόρθωση ονόματος να
 * μη χρειάζεται μετάπτωση χιλιάδων εγγράφων.
 *
 * ⚡ `adminId === null` ⇒ **καμία** λήψη: τα ~100 KB του ευρετηρίου τα πληρώνει μόνο η σελίδα που έχει όνομα να δείξει.
 * `null` = δεν έχει φορτώσει ακόμη **ή** η ταυτότητα δεν αναγνωρίζεται — ο καλών σιωπά, ποτέ ωμό `municipality:0701`.
 */

import { useAdminAreaIndex } from '@/hooks/geo/useAdminAreaIndex';

export function useAdminAreaName(adminId: string | null): string | null {
  const index = useAdminAreaIndex(adminId !== null);
  return adminId === null ? null : (index?.areas.get(adminId)?.name ?? null);
}
