'use client';

/**
 * @fileoverview **Η επιλογή μιας οθόνης του καταλόγου ζει στη διεύθυνση** (`?attribute=…`, ADR-923 Φάση 1γ).
 * @module components/catalog/shared/use-catalog-selection
 *
 * 🔑 Σύνδεσμος που μοιράζεται («δες αυτή την ιδιότητα»), ανανέωση που κρατά τη θέση, «πίσω» που δουλεύει — όπως η
 *    προβολή του μητρώου λήξεων (`?view=`). Αλλαγή με `replace`: η επιλογή δεν γεμίζει το ιστορικό.
 * 🔑 Η ειδική τιμή `NEW_SELECTION` = φόρμα δημιουργίας (ίδια θέση στη σελίδα με τις λεπτομέρειες).
 * 🔑 **Κάθε επιλογή είναι μια ΣΥΝΕΔΡΙΑ** (`key`), ακόμη κι όταν η διεύθυνση δεν αλλάζει: «Νέα» ενώ στέλνεται η
 *    προηγούμενη νέα ⇒ **καθαρή** φόρμα, όχι το πρόχειρο που ήδη φεύγει (μετρημένο ζωντανά, ADR-923 §5.9.2).
 * 🔑 **Η απάντηση του γραφέα δεν κλέβει την οθόνη** (`selectIfCurrent`): η δημιουργία μεταφέρει στη νέα εγγραφή
 *    **μόνο** αν ο άνθρωπος είναι ακόμη στη συνεδρία που την έστειλε. Αλλιώς η εγγραφή απλώς εμφανίζεται στη λίστα —
 *    ό,τι γράφει τώρα δεν πάει ποτέ σε άλλη εγγραφή (Linear/Figma: ασύγχρονη απάντηση ≠ πλοήγηση).
 * ⚠️ Χρειάζεται `<Suspense>` στη σελίδα (`useSearchParams`, CHECK 3.55).
 */

import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { usePathname, useRouter } from '@/lib/workspace/navigation';
import { declaredHref } from '@/lib/workspace/route-worlds';

export const NEW_SELECTION = 'new';

const SAME_PAGE = 'usePathname() είναι ΗΔΗ η έγκυρη τρέχουσα σελίδα του καταλόγου — ενημέρωση ερωτήματος, όχι νέος προορισμός.';

export interface CatalogSelection {
  readonly selected: string | null;
  readonly select: (value: string | null) => void;
  /** Ταυτότητα της τρέχουσας συνεδρίας επιλογής — το κλειδί του επεξεργαστή. */
  readonly key: string;
  /** Επιλέγει `value` μόνο αν η τρέχουσα συνεδρία είναι ακόμη η `sessionKey` (ασύγχρονες απαντήσεις). */
  readonly selectIfCurrent: (sessionKey: string, value: string | null) => void;
}

export function useCatalogSelection(param: string): CatalogSelection {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selected = searchParams.get(param);
  const [generation, setGeneration] = useState(0);
  const key = `${selected ?? ''}#${generation}`;
  const currentKey = useRef(key);
  currentKey.current = key;

  const select = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === null) params.delete(param);
      else params.set(param, next);
      const query = params.toString();
      // Η συνεδρία λήγει ΑΜΕΣΑ (όχι όταν αποδοθεί η νέα διεύθυνση): απάντηση που φτάνει ενδιάμεσα δεν πλοηγεί.
      currentKey.current = `${next ?? ''}#pending`;
      setGeneration((value) => value + 1);
      router.replace(declaredHref(SAME_PAGE, query ? `${pathname}?${query}` : pathname));
    },
    [param, router, pathname, searchParams],
  );
  const selectIfCurrent = useCallback(
    (sessionKey: string, value: string | null) => {
      if (currentKey.current === sessionKey) select(value);
    },
    [select],
  );
  return { selected, select, key, selectIfCurrent };
}
