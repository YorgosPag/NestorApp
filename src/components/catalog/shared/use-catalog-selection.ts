'use client';

/**
 * @fileoverview **Η επιλογή μιας οθόνης του καταλόγου ζει στη διεύθυνση** (`?attribute=…`, ADR-923 Φάση 1γ).
 * @module components/catalog/shared/use-catalog-selection
 *
 * 🔑 Σύνδεσμος που μοιράζεται («δες αυτή την ιδιότητα»), ανανέωση που κρατά τη θέση, «πίσω» που δουλεύει — όπως η
 *    προβολή του μητρώου λήξεων (`?view=`). Αλλαγή με `replace`: η επιλογή δεν γεμίζει το ιστορικό.
 * 🔑 Η ειδική τιμή `NEW_SELECTION` = φόρμα δημιουργίας (ίδια θέση στη σελίδα με τις λεπτομέρειες).
 * ⚠️ Χρειάζεται `<Suspense>` στη σελίδα (`useSearchParams`, CHECK 3.55).
 */

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

import { usePathname, useRouter } from '@/lib/workspace/navigation';
import { declaredHref } from '@/lib/workspace/route-worlds';

export const NEW_SELECTION = 'new';

const SAME_PAGE = 'usePathname() είναι ΗΔΗ η έγκυρη τρέχουσα σελίδα του καταλόγου — ενημέρωση ερωτήματος, όχι νέος προορισμός.';

export function useCatalogSelection(param: string): readonly [string | null, (value: string | null) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = searchParams.get(param);
  const select = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === null) params.delete(param);
      else params.set(param, next);
      const query = params.toString();
      router.replace(declaredHref(SAME_PAGE, query ? `${pathname}?${query}` : pathname));
    },
    [param, router, pathname, searchParams],
  );
  return [value, select] as const;
}
