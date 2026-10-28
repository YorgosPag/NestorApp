'use client';

/**
 * useStatusDrillParam — Ο αναγνώστης του `?status=` στις λίστες προμηθειών έργου (ADR-330 §5.1 S3.1).
 *
 * Ο γραφέας είναι οι κάρτες της επισκόπησης (`getProjectProcurementUrl(…, { status })`). Το URL είναι
 * η ΜΟΝΗ αλήθεια του φίλτρου: σύνδεσμος που μοιράζεται, σελιδοδείκτης και «Πίσω» δουλεύουν χωρίς
 * δεύτερη κατάσταση στη μνήμη.
 *
 * Τιμές εκτός λεξιλογίου πετιούνται σιωπηλά: ένα `?status=garbage` δεν πρέπει να δείξει άδεια λίστα.
 */

import { useCallback, useMemo } from 'react';
import { useLiveSearchParams } from '@/hooks/useUrlQuery';
import { replaceUrlSearchParams } from '@/lib/url-query-state';
import { parseFilterArray, serializeFilterArray } from '@/lib/url-filters/multi-value';
import { PROCUREMENT_STATUS_PARAM } from '@/lib/navigation/procurement-urls';

export interface StatusDrill<S extends string> {
  /** Οι έγκυρες καταστάσεις του URL· κενό ⇒ χωρίς φίλτρο. */
  statuses: readonly S[];
  /** Γράφει το φίλτρο (κενό ⇒ αφαίρεση) χωρίς νέα εγγραφή ιστορικού. */
  set: (statuses: readonly S[]) => void;
  /** Αφαιρεί το φίλτρο — `set([])`. */
  clear: () => void;
}

/**
 * @param vocabulary — εξαντλητικό `Record` ανά κατάσταση (π.χ. `PO_STATUS_TRANSITIONS`): τα κλειδιά του
 *   ΕΙΝΑΙ το λεξιλόγιο, χωρίς δεύτερη χειρόγραφη λίστα. Σταθερά επιπέδου module.
 */
export function useStatusDrillParam<S extends string>(vocabulary: Readonly<Record<S, unknown>>): StatusDrill<S> {
  // ADR-327: γραφή ΧΩΡΙΣ πλοήγηση (`url-query-state`) — ήταν `router.replace` ⇒ γύρος RSC σε κάθε κλικ φίλτρου.
  const raw = useLiveSearchParams().get(PROCUREMENT_STATUS_PARAM);

  const statuses = useMemo(
    () => parseFilterArray(raw).filter((s): s is S => Object.prototype.hasOwnProperty.call(vocabulary, s)),
    [raw, vocabulary],
  );

  const set = useCallback((next: readonly S[]) => {
    replaceUrlSearchParams((params) => {
      const value = serializeFilterArray(next);
      if (value === undefined) params.delete(PROCUREMENT_STATUS_PARAM);
      else params.set(PROCUREMENT_STATUS_PARAM, value);
    });
  }, []);

  const clear = useCallback(() => set([]), [set]);

  // Σταθερή ταυτότητα: οι καταναλωτές το βάζουν σε εξαρτήσεις `useMemo` (κάρτες της σελίδας RFQ, ADR-330 S3.3).
  return useMemo(() => ({ statuses, set, clear }), [statuses, set, clear]);
}
