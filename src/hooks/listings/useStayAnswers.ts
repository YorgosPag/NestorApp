'use client';

/**
 * @fileoverview **ΟΙ ΑΠΑΝΤΗΣΕΙΣ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ ΓΙΑ ΤΙΣ ΗΜΕΡΟΜΗΝΙΕΣ ΤΟΥ ΕΠΙΣΚΕΠΤΗ** (ADR-835 §18.1 · §21).
 * @related services/stay-calendar/stay-public.client.ts · hooks/listings/useResultsLedgers.ts
 * @module hooks/listings/useStayAnswers
 *
 * 🔑 **Τρεις καταστάσεις, ποτέ δύο**: όσο φορτώνει, η λογιστική λέει «υπολογίζεται» — όχι
 * «14 χωρίς ημερολόγιο» που θα ήταν ψέμα για μισό δευτερόλεπτο. Αποτυχία ⇒ `failed`, που η
 * λογιστική μετρά ως `unreadable` (δικό μας χρέος).
 *
 * ⚠️ **Η παλιότερη απάντηση χάνει** (φρουρός σειράς) και τα αιτήματα αναβάλλονται λίγο, ώστε
 * το σύρσιμο του χάρτη να μη στέλνει ένα αίτημα ανά καρέ.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import type { StayQuery } from '@/lib/stay/stay-availability-vocabulary';
import type { PublicStayAnswer } from '@/lib/stay/stay-public-request';
import { fetchStayAnswers } from '@/services/stay-calendar/stay-public.client';

/** Αναμονή πριν το αίτημα (ms). */
const DEBOUNCE_MS = 250;

export type StayAnswersState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'loaded'; readonly answers: Readonly<Record<string, PublicStayAnswer>> }
  | { readonly kind: 'failed' };

/**
 * @param revision — αύξηση ⇒ **ξαναρωτά** την ίδια ερώτηση (π.χ. ο διακομιστής είπε `price-changed`:
 *   η τιμή που δείχνουμε είναι πλέον μπαγιάτικη). Προεπιλογή `0`: καμία αλλαγή για την αναζήτηση.
 */
export function useStayAnswers(listingIds: readonly string[], query: StayQuery | null, revision = 0): StayAnswersState {
  const [state, setState] = useState<StayAnswersState>({ kind: 'idle' });
  const sequence = useRef(0);
  // Οι τελευταίες τιμές, διαβασμένες τη στιγμή του αιτήματος (getter, όχι στιγμιότυπο).
  const latest = useRef({ listingIds, query });
  latest.current = { listingIds, query };
  // Σταθερό κλειδί: η ίδια ερώτηση για τις ίδιες αγγελίες ΔΕΝ ξαναστέλνεται.
  const key = useMemo(
    () => (query === null ? null : JSON.stringify([[...listingIds].sort(), query, revision])),
    [listingIds, query, revision],
  );

  useEffect(() => {
    const seq = ++sequence.current;
    const { listingIds: ids, query: asked } = latest.current;
    if (key === null || asked === null || ids.length === 0) {
      setState({ kind: 'idle' });
      return undefined;
    }
    setState({ kind: 'pending' });
    const timer = setTimeout(() => {
      void fetchStayAnswers(ids, asked).then((result) => {
        if (seq === sequence.current) setState(result);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [key]);

  return state;
}
