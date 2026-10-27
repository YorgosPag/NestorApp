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
import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/lib/workspace/navigation';
import { declaredHref } from '@/lib/workspace/route-worlds';
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get(PROCUREMENT_STATUS_PARAM);

  const statuses = useMemo(
    () => parseFilterArray(raw).filter((s): s is S => Object.prototype.hasOwnProperty.call(vocabulary, s)),
    [raw, vocabulary],
  );

  const set = useCallback((next: readonly S[]) => {
    const params = new URLSearchParams(searchParams.toString());
    const value = serializeFilterArray(next);
    if (value === undefined) params.delete(PROCUREMENT_STATUS_PARAM);
    else params.set(PROCUREMENT_STATUS_PARAM, value);
    const qs = params.toString();
    router.replace(declaredHref(
      'usePathname() είναι ΗΔΗ η έγκυρη τρέχουσα σελίδα — αλλαγή φίλτρου ερωτήματος, όχι νέος προορισμός.',
      qs ? `${pathname}?${qs}` : pathname,
    ));
  }, [router, pathname, searchParams]);

  const clear = useCallback(() => set([]), [set]);

  return { statuses, set, clear };
}
