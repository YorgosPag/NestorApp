'use client';

/**
 * @fileoverview **Η τρέχουσα ενότητα της σελίδας**, μετρημένη όσο ο άνθρωπος κυλά (scrollspy) — ADR-907 Φ2β-1.
 * @module hooks/useActiveSection
 * @related lib/a11y/active-section (η απόφαση, καθαρή) · hooks/listings/useListingRevealTracking (ίδια τεχνική μέτρησης)
 *
 * 🔑 **`scroll` στο `document` με `capture` + `requestAnimationFrame`**: η μέτρηση επιβάλλει διάταξη, άρα μία φορά ανά
 * καρέ. Συν `resize` — στενότερο παράθυρο μετακινεί ενότητες χωρίς καμία κύλιση.
 *
 * 🔑 **Ενότητα που δεν υπάρχει στο DOM απλώς δεν μετριέται**: ο καταναλωτής δίνει τη λίστα των `id` που *μπορεί* να
 * υπάρχουν· ό,τι φορτώνει αργότερα μπαίνει στη μέτρηση στο επόμενο καρέ κύλισης, χωρίς δεύτερο μηχανισμό.
 */

import { useEffect, useState } from 'react';

import { activeSectionOf } from '@/lib/a11y/active-section';

/** Το τέλος του εγγράφου, με ανοχή ενός pixel για κλασματικές κλίμακες οθόνης. */
function documentAtEnd(): boolean {
  const root = document.documentElement;
  const scrollable = root.scrollHeight - window.innerHeight;
  return scrollable > 1 && window.scrollY >= scrollable - 1;
}

function measureActive(ids: readonly string[], lineOf: () => number): string | null {
  const present = ids
    .map((id) => ({ id, element: document.getElementById(id) }))
    .filter((entry): entry is { id: string; element: HTMLElement } => entry.element !== null);
  const index = activeSectionOf({
    tops: present.map((entry) => entry.element.getBoundingClientRect().top),
    line: lineOf(),
    atEnd: documentAtEnd(),
  });
  return index === -1 ? null : present[index].id;
}

/**
 * @param ids    Τα `id` των ενοτήτων με τη σειρά του εγγράφου. ⚠️ **Σταθερή αναφορά** (σταθερά module ή `useMemo`).
 * @param lineOf Η γραμμή ανάγνωσης σε συντεταγμένες παραθύρου — διαβάζεται **τη στιγμή της μέτρησης**, όχι στο render.
 */
export function useActiveSection(ids: readonly string[], lineOf: () => number): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let pending = 0;
    const measure = (): void => {
      pending = 0;
      setActive(measureActive(ids, lineOf));
    };
    const schedule = (): void => {
      if (pending === 0) pending = requestAnimationFrame(measure);
    };

    measure();
    const listen = { capture: true, passive: true } as const;
    document.addEventListener('scroll', schedule, listen);
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      document.removeEventListener('scroll', schedule, listen);
      window.removeEventListener('resize', schedule);
      if (pending !== 0) cancelAnimationFrame(pending);
    };
  }, [ids, lineOf]);

  return active;
}
