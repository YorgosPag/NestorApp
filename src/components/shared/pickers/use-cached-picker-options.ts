'use client';

/**
 * useCachedPickerOptions — φόρτωση επιλογών picker μία φορά ανά στιγμιότυπο (ADR-601).
 *
 * Οι pickers που φέρνουν όλη τη λίστα και φιλτράρουν στον client είχαν το ίδιο ζεύγος
 * `cacheRef` + `inFlightRef`. Εδώ κρατιέται η ίδια η υπόσχεση, άρα μια δεύτερη
 * αναζήτηση όσο τρέχει η πρώτη περιμένει το αποτέλεσμα αντί να πάρει κενή λίστα.
 * Αποτυχία δεν κρατιέται: η επόμενη αναζήτηση ξαναδοκιμάζει.
 *
 * ⚠️ Το `load` πρέπει να είναι σταθερή αναφορά (συνάρτηση επιπέδου module).
 */

import { useCallback, useRef } from 'react';

export function useCachedPickerOptions<T>(
  load: () => Promise<readonly T[]>,
): () => Promise<readonly T[]> {
  const pendingRef = useRef<Promise<readonly T[]> | null>(null);

  return useCallback(() => {
    if (pendingRef.current) return pendingRef.current;
    const pending = load().catch((): readonly T[] => {
      pendingRef.current = null;
      return [];
    });
    pendingRef.current = pending;
    return pending;
  }, [load]);
}
