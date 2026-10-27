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
import { parseFilterArray } from '@/lib/url-filters/multi-value';
import { PROCUREMENT_STATUS_PARAM } from '@/lib/navigation/procurement-urls';

export interface StatusDrill<S extends string> {
  /** Οι έγκυρες καταστάσεις του URL· κενό ⇒ χωρίς φίλτρο. */
  statuses: readonly S[];
  /** Αφαιρεί το φίλτρο χωρίς νέα εγγραφή ιστορικού. */
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

  const clear = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(PROCUREMENT_STATUS_PARAM);
    const qs = params.toString();
    router.replace(declaredHref(
      'usePathname() είναι ΗΔΗ η έγκυρη τρέχουσα σελίδα — αφαίρεση φίλτρου ερωτήματος, όχι νέος προορισμός.',
      qs ? `${pathname}?${qs}` : pathname,
    ));
  }, [router, pathname, searchParams]);

  return { statuses, clear };
}
