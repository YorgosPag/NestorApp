'use client';

/**
 * **Θέσεις με πράξεις ανά θέση** — η ΜΙΑ μηχανή «ανάγνωση + πράξη σε εξέλιξη ανά κλειδί» για κάθε όψη θέσεων
 * (επαγγελματίες υπόθεσης ADR-901 Φ2 · πρόσβαση φακέλου ιδιώτη ADR-916 Φ-Ε1).
 *
 * - **Η αλήθεια είναι ο server**: κάθε πράξη επιστρέφει τη **νέα** όψη (`apply`), καμία δεύτερη παραγωγή στον client.
 * - **Ανά κλειδί «σε εξέλιξη»** (Gmail «Sending…»): δύο κλικ στο ίδιο κλειδί ⇒ ένα αίτημα· άλλο κλειδί δεν μπλοκάρεται.
 *   Η αλήθεια ζει σε `ref`, ώστε δύο γρήγορα κλικ να τη βλέπουν **πριν** από το render.
 * - **Καμία μπαγιάτικη ανάγνωση πάνω σε πράξη**: ανάγνωση που ξεκίνησε **πριν** από απάντηση πράξης δεν πατά ποτέ την
 *   όψη που επέστρεψε η πράξη (`epoch`).
 * - `reloadKey` ανεβαίνει ⇒ ξαναδιάβασμα **στο παρασκήνιο** (χωρίς spinner) — η ζωντάνια της όψης (ADR-901 §14.8).
 *
 * @module hooks/useSlotActions
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Η έκβαση μιας πράξης — το σφάλμα επιστρέφει **ωμό**: την ονομασία της άρνησης την κάνει ο καλών (κλειστό σύνολο). */
export type SlotActOutcome<A> =
  | { readonly ok: true; readonly result: A | null }
  | { readonly ok: false; readonly error: unknown };

export interface SlotActionsState<V, K> {
  /** Η όψη — `null` μέχρι την πρώτη επιτυχή ανάγνωση. */
  readonly view: V | null;
  readonly loading: boolean;
  readonly failed: boolean;
  /** Κλειδιά με πράξη σε εξέλιξη. */
  readonly pending: ReadonlySet<K>;
  /**
   * Μία πράξη στο κλειδί `key`. Ήδη σε εξέλιξη ⇒ `{ ok: true, result: null }` (το δεύτερο κλικ δεν στέλνει τίποτα).
   * Επιτυχία ⇒ η όψη γίνεται `apply(προηγούμενη, απάντηση)`.
   */
  readonly act: <A>(key: K, request: () => Promise<A>, apply: (previous: V | null, result: A) => V) => Promise<SlotActOutcome<A>>;
}

export function useSlotActions<V, K>(load: () => Promise<V>, sourceKey: string, reloadKey: number): SlotActionsState<V, K> {
  const [view, setView] = useState<V | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<ReadonlySet<K>>(new Set());
  const inFlight = useRef(new Set<K>());
  /** Αυξάνει σε κάθε απάντηση πράξης — ανάγνωση που ξεκίνησε πριν από αυτήν είναι μπαγιάτικη. */
  const epoch = useRef(0);
  /** Ο πιο πρόσφατος αναγνώστης — το εφέ ξανατρέχει μόνο όταν αλλάξει η **πηγή** (`sourceKey`) ή το `reloadKey`. */
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => { setLoading(true); }, [sourceKey]);

  useEffect(() => {
    let alive = true;
    const startedAt = epoch.current;
    loadRef.current()
      .then((result) => { if (alive && epoch.current === startedAt) { setView(result); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sourceKey, reloadKey]);

  const act = useCallback(async <A,>(
    key: K,
    request: () => Promise<A>,
    apply: (previous: V | null, result: A) => V,
  ): Promise<SlotActOutcome<A>> => {
    if (inFlight.current.has(key)) return { ok: true, result: null };
    inFlight.current.add(key);
    setPending(new Set(inFlight.current));
    try {
      const result = await request();
      epoch.current += 1;
      setView((previous) => apply(previous, result));
      return { ok: true, result };
    } catch (error: unknown) {
      return { ok: false, error };
    } finally {
      inFlight.current.delete(key);
      setPending(new Set(inFlight.current));
    }
  }, []);

  return { view, loading, failed, pending, act };
}
