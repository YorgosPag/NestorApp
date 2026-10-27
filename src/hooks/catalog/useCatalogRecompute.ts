'use client';
/**
 * **Επανυπολογισμός παραγώγων** (πληρότητα «5/7», facets) — ο βρόχος της εργασίας του διακομιστή (ADR-923 §5.10.2 Δ7).
 *
 * Μετά από αλλαγή οικογένειας ή ρυθμίσεων τα παράγωγα **αποδεικνύονται** μπαγιάτικα στην ανάγνωση. Ο διακομιστής
 * ξαναϋπολογίζει 25 σύνολα ανά κλήση με δρομέα· εδώ ο βρόχος ως το `nextCursor === null`, με πρόοδο.
 * Ιδεμπότητος: δεύτερη εκτέλεση = **μηδέν** εγγραφές (μετρημένο στη 2β) ⇒ ασφαλής επανάληψη μετά από αποτυχία.
 *
 * 🔑 **Γενιές, όχι σημαία** (σφάλμα που βρέθηκε ζωντανά 2026-10-26): μετά από ένα «Ολοκληρώθηκε», δεύτερη αλλαγή
 * γλωσσών **δεν** ξαναπρότεινε επανυπολογισμό. Και ένα απλό «μηδένισε την κατάσταση» δεν αρκεί: αλλαγή **ενώ τρέχει**
 * ο βρόχος αφήνει πίσω σύνολα που κρίθηκαν με τις παλιές εισόδους, και το τέλος θα έγραφε ψευδές «Ολοκληρώθηκε».
 * Κάθε αλλαγή ζητά νέα γενιά (`invalidate`)· κάθε εκτέλεση καλύπτει τη γενιά που ίσχυε **όταν ξεκίνησε**.
 *
 * @module hooks/catalog/useCatalogRecompute
 */

import { useCallback, useRef, useState } from 'react';

import { useMountedRef } from '@/hooks/useMountedRef';
import { recomputeCatalogDerived } from '@/services/catalog/catalog-api.client';

export type CatalogRecomputeState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running'; readonly processed: number; readonly rejected: number }
  | { readonly kind: 'done'; readonly processed: number; readonly rejected: number }
  | { readonly kind: 'failed'; readonly processed: number };

export interface CatalogRecompute {
  readonly state: CatalogRecomputeState;
  /** Υπάρχει αλλαγή που **δεν** έχει καλυφθεί από ολοκληρωμένη εκτέλεση. */
  readonly needed: boolean;
  /** Μια αλλαγή επηρεάζει την πληρότητα (αποθηκεύτηκαν ρυθμίσεις/οικογένεια). */
  readonly invalidate: () => void;
  /** `familyId: null` ⇒ όλος ο χώρος. Δεύτερη κλήση όσο τρέχει ⇒ αγνοείται. */
  readonly run: (familyId: string | null) => Promise<void>;
}

interface Generations {
  readonly requested: number;
  readonly covered: number;
}

async function runAllPages(familyId: string | null, onPage: (processed: number, rejected: number) => boolean) {
  let processed = 0;
  let rejected = 0;
  let cursor: string | null = null;
  do {
    const page = await recomputeCatalogDerived({ familyId, cursor });
    processed += page.processed;
    rejected += page.rejected;
    cursor = page.nextCursor;
    if (!onPage(processed, rejected)) return null;
  } while (cursor !== null);
  return { processed, rejected };
}

export function useCatalogRecompute(): CatalogRecompute {
  const [state, setState] = useState<CatalogRecomputeState>({ kind: 'idle' });
  const [generations, setGenerations] = useState<Generations>({ requested: 0, covered: 0 });
  const requested = useRef(0);
  const running = useRef(false);
  // SSoT `useMountedRef`: ξαναγράφει `true` στο mount. Το χειρόγραφο «μόνο cleanup» άφηνε ψευδές `false` μετά από
  // effects που ξανατρέχουν (StrictMode · Fast Refresh · Activity) ⇒ ζωντανά «Επανυπολογισμός… 0 σύνολα» για πάντα.
  const alive = useMountedRef();

  const invalidate = useCallback(() => {
    requested.current += 1;
    setGenerations((prev) => ({ ...prev, requested: requested.current }));
  }, []);

  const run = useCallback(async (familyId: string | null) => {
    if (running.current) return;
    running.current = true;
    const target = requested.current;
    setState({ kind: 'running', processed: 0, rejected: 0 });
    try {
      const total = await runAllPages(familyId, (processed, rejected) => {
        if (alive.current) setState({ kind: 'running', processed, rejected });
        return alive.current;
      });
      if (!total || !alive.current) return;
      setState({ kind: 'done', ...total });
      setGenerations((prev) => ({ ...prev, covered: Math.max(prev.covered, target) }));
    } catch {
      if (alive.current) setState((prev) => ({ kind: 'failed', processed: prev.kind === 'running' ? prev.processed : 0 }));
    } finally {
      running.current = false;
    }
  }, []);

  return { state, needed: generations.requested > generations.covered, invalidate, run };
}
