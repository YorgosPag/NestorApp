/**
 * @fileoverview Ο **κύκλος ζωής** των παράγωγων αποτυπωμάτων στην οθόνη: ζητά τη
 * φόρτωση μία φορά και δίνει αναγνώστη **σωστής ταυτότητας**. ADR-846 Φάση 2.5.
 * @related lib/geo/admin-footprints.ts (τα δεδομένα) · hooks/useLazySnapshot.ts
 * @module hooks/useAdminFootprints
 */

'use client';

import { useCallback } from 'react';

import { useLazySnapshot } from '@/hooks/useLazySnapshot';
import { ADMIN_FOOTPRINTS_SOURCE, EMPTY_FOOTPRINTS } from '@/lib/geo/admin-footprints';
import type { FootprintResolver } from '@/types/geo/admin-footprint';

interface UseAdminFootprintsReturn {
  /** `true` όσο **δεν ξέρουμε ακόμη** — ούτε «υπάρχουν» ούτε «δεν υπάρχουν». */
  readonly isLoading: boolean;
  /**
   * Ο αναγνώστης για τον κριτή.
   *
   * 🔑 **Η ταυτότητά του κρέμεται από το στιγμιότυπο, και ΜΟΝΟ από αυτό.** Ένας
   * καταναλωτής που τον βάζει σε `useMemo(…, [footprintOf])` είναι **σωστός εξ
   * ορισμού**: όταν φτάσει το αρχείο, η ταυτότητα αλλάζει και το φιλτράρισμα ξαναγίνεται
   * μόνο του. Ο ίδιος ο module-level {@link footprintOf} **δεν** θα το πετύχαινε αυτό —
   * είναι το ακριβές σφάλμα της §6.2 *(«ψεύτικες λίστες εξαρτήσεων»)*, που άφησε τον
   * επιλογέα περιοχής άδειο σε κάθε κρύο φόρτωμα.
   */
  readonly footprintOf: FootprintResolver;
}

/** Φορτώνει τα αποτυπώματα (μία φορά ανά σελίδα) και τα δίνει ως αναγνώστη. */
export function useAdminFootprints(): UseAdminFootprintsReturn {
  const snapshot = useLazySnapshot(ADMIN_FOOTPRINTS_SOURCE, EMPTY_FOOTPRINTS);

  const footprintOf = useCallback<FootprintResolver>(
    (adminId) => snapshot?.get(adminId) ?? null,
    [snapshot],
  );

  return { isLoading: snapshot === null, footprintOf };
}
