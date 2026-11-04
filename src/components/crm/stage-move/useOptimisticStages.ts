'use client';

/**
 * @fileoverview **Η αισιόδοξη εικόνα του σταδίου πάνω στα ζωντανά δεδομένα** (ADR-929).
 * @module components/crm/stage-move/useOptimisticStages
 *
 * Η κάρτα πηγαίνει στη νέα στήλη **αμέσως**· η εγγραφή επικυρώνεται πίσω από αυτήν. Η αισιόδοξη τιμή φεύγει όταν:
 *  - το ζωντανό στιγμιότυπο φτάσει στην ίδια τιμή (η αλήθεια πρόλαβε την εικόνα), ή
 *  - η εντολή ζητήσει επαναφορά (σύγκρουση / άρνηση / σφάλμα).
 * Δεύτερη αποθήκη σταδίων **δεν** υπάρχει: ό,τι μένει εδώ είναι «σε πτήση», τίποτα παραπάνω.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { OpportunityStage } from '@/config/crm/opportunity-stages';
import type { Opportunity } from '@/types/crm';

/** Καθαρό: ποιες αισιόδοξες τιμές ισχύουν ακόμη, δεδομένων των ζωντανών δεδομένων. */
export function reconcilePending(
  pending: ReadonlyMap<string, OpportunityStage>,
  opportunities: readonly Opportunity[],
): ReadonlyMap<string, OpportunityStage> {
  if (pending.size === 0) return pending;
  const actual = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity.stage]));
  const next = new Map([...pending].filter(([id, stage]) => actual.has(id) && actual.get(id) !== stage));
  return next.size === pending.size ? pending : next;
}

export function applyPending(opportunities: readonly Opportunity[], pending: ReadonlyMap<string, OpportunityStage>): Opportunity[] {
  if (pending.size === 0) return [...opportunities];
  return opportunities.map((opportunity) => {
    const stage = opportunity.id ? pending.get(opportunity.id) : undefined;
    return stage ? { ...opportunity, stage } : opportunity;
  });
}

export function useOptimisticStages(opportunities: readonly Opportunity[]) {
  const [pending, setPending] = useState<ReadonlyMap<string, OpportunityStage>>(new Map());
  // Κλάδεμα ΣΤΗΝ ΚΑΤΑΣΤΑΣΗ, όχι μόνο στην προβολή: μια επιβεβαιωμένη τιμή που απλώς φιλτράρεται θα ξαναζωντάνευε
  // όταν αργότερα άλλος χρήστης μετακινήσει την κάρτα. Ίδια αναφορά όταν δεν αλλάζει τίποτα ⇒ κανένας βρόχος.
  useEffect(() => { setPending((current) => reconcilePending(current, opportunities)); }, [opportunities]);
  const displayed = useMemo(() => applyPending(opportunities, pending), [opportunities, pending]);

  const onOptimistic = useCallback((id: string, stage: OpportunityStage) => {
    setPending((current) => new Map(current).set(id, stage));
  }, []);
  const onRevert = useCallback((id: string) => {
    setPending((current) => { const next = new Map(current); next.delete(id); return next; });
  }, []);
  return { displayed, onOptimistic, onRevert };
}
