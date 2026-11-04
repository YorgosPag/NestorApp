'use client';

/**
 * **Η μία πόρτα της σποράς στην οθόνη** (ADR-928 §5.20) — κενή βιβλιοθήκη, «Έλεγχος για ενημερώσεις του Nestor App» και
 * «Γράψε τα έτοιμα πρότυπα» περνούν **όλα** από εδώ. Η ίδια ιδεμποτική σπορά του διακομιστή, μία κατάσταση «τρέχει»,
 * μία αναφορά (`SeedReportNotice`).
 *
 * 🔑 Πριν υπήρχαν τρεις: η κενή οθόνη κρατούσε δικό της spinner, και το κουμπί των προτύπων **πετούσε** την αναφορά
 *    (ο άνθρωπος δεν μάθαινε τι γράφτηκε). Τώρα κάθε δρόμος δείχνει τι έγινε.
 * 🔑 Ένα αίτημα τη φορά: διπλό κλικ ή δεύτερο κουμπί όσο τρέχει ⇒ `null`, κανένα δεύτερο αίτημα (`ref`, όχι state —
 *    το state φτάνει ένα render αργότερα). Δεύτερη καρτέλα / επανάληψη δικτύου τα καλύπτει η ιδεμποτία του γραφέα.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { DefaultLibrarySeedReport } from '@/subapps/procurement/subcontracts/types/library-seed';

export interface LibrarySeed {
  readonly report: DefaultLibrarySeedReport | null;
  readonly seeding: boolean;
  readonly run: () => Promise<DefaultLibrarySeedReport | null>;
  readonly dismiss: () => void;
}

export function useLibrarySeed(seed: () => Promise<DefaultLibrarySeedReport | null>): LibrarySeed {
  const [report, setReport] = useState<DefaultLibrarySeedReport | null>(null);
  const [seeding, setSeeding] = useState(false);
  const inFlight = useRef(false);
  const run = useCallback(async () => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setSeeding(true);
    try {
      const next = await seed();
      if (next) setReport(next);
      return next;
    } finally {
      inFlight.current = false;
      setSeeding(false);
    }
  }, [seed]);
  const dismiss = useCallback(() => setReport(null), []);
  return useMemo(() => ({ report, seeding, run, dismiss }), [report, seeding, run, dismiss]);
}
