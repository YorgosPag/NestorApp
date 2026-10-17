'use client';

/**
 * @fileoverview **Αισιόδοξες πράξεις, σειριακά ανά κλειδί** — ο μηχανισμός που μοιράζονται ο ορισμός υπευθύνου (§26) και
 *   η ανάθεση έκδοσης (§27) του μητρώου λήξεων.
 * @related useObligorDesignation.ts · useIssuanceAssignment.ts (οι καταναλωτές)
 * @module hooks/document-registry/useSerialOptimistic
 *
 * 🔑 **Αισιόδοξα** (Gmail): η πράξη φαίνεται **αμέσως** μέσα από το `pending`· ο καταναλωτής αποφασίζει τι σημαίνει
 *    «φαίνεται» (overlay πάνω στο μητρώο).
 * 🔑 **Χωρίς αγώνα**: οι πράξεις του **ίδιου** κλειδιού τρέχουν **σειριακά** (αλυσίδα υποσχέσεων) ⇒ η τελευταία πράξη του
 *    ανθρώπου είναι και η τελευταία που γράφεται. Μόνο η **νεότερη** εκκρεμότητα σβήνει το overlay — μια παλιά
 *    απάντηση δεν «ξεκλειδώνει» νεότερη πράξη.
 * ⚠️ Το `run` δεν πετά: αναφέρει την αποτυχία μόνο του (μήνυμα) και ξαναδιαβάζει όταν πετύχει.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

interface PendingEntry<P> {
  readonly seq: number;
  readonly payload: P;
}

export interface SerialOptimistic<P> {
  /** Κλειδί → η **νεότερη** εκκρεμής πράξη (για το overlay). */
  readonly pending: ReadonlyMap<string, P>;
  readonly submit: (key: string, payload: P) => void;
}

export function useSerialOptimistic<P>(run: (key: string, payload: P) => Promise<void>): SerialOptimistic<P> {
  const [entries, setEntries] = useState<ReadonlyMap<string, PendingEntry<P>>>(new Map());
  const seq = useRef(0);
  const chains = useRef(new Map<string, Promise<void>>());

  const settle = useCallback((key: string, mine: number) => {
    setEntries((prev) => {
      if (prev.get(key)?.seq !== mine) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const submit = useCallback((key: string, payload: P) => {
    const mine = ++seq.current;
    setEntries((prev) => new Map(prev).set(key, { seq: mine, payload }));
    const previous = chains.current.get(key) ?? Promise.resolve();
    const next = previous.then(() => run(key, payload)).then(() => settle(key, mine));
    chains.current.set(key, next);
  }, [run, settle]);

  const pending = useMemo(() => new Map([...entries].map(([key, entry]) => [key, entry.payload] as const)), [entries]);
  return { pending, submit };
}
