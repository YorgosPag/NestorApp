'use client';

/**
 * @fileoverview **ΑΙΣΙΟΔΟΞΗ ΑΛΛΑΓΗ ΜΕ ΣΥΜΦΙΛΙΩΣΗ** — ο ΕΝΑΣ τρόπος (Gmail/Drive) (ADR-884 Κ3β · N.0.2).
 * @related `components/sharing/link-management/useShareLinks.ts` (ο πρώτος καταναλωτής, από όπου εξήχθη) ·
 *   `components/spatial-tour/useTourPhotographers.ts` · `components/spatial-tour/useTourAccessRequests.ts`
 * @module hooks/useReconciledResource
 *
 * 🔑 **Η γραμμή φεύγει ΑΜΕΣΩΣ από την οθόνη**· αν ο διακομιστής αρνηθεί, **ξαναδιαβάζουμε** την αλήθεια αντί να
 * μαντέψουμε τι να επαναφέρουμε (η αποτυχία μπορεί να ήταν μισή — π.χ. μαζική πράξη που πέρασε για κάποιους).
 *
 * 🔑 **Κανένας αγώνας αναγνώσεων**: κάθε ανάγνωση παίρνει αύξοντα αριθμό· εφαρμόζεται **μόνο** η τελευταία. Μια
 * αισιόδοξη αλλαγή **ακυρώνει** κάθε ανάγνωση σε πτήση — θα έφερνε την προ-αλλαγής εικόνα.
 *
 * 🔴 **Γιατί ΕΝΑ hook**: το σχήμα ζούσε μέσα στο `useShareLinks`, και το Κ3β θα το χρειαζόταν **δύο** φορές ακόμη
 * (ανάκληση φωτογράφου · αποφάσεις θέασης). Τρία αντίγραφα αποκλίνουν στο πιο λεπτό σημείο: την ακύρωση πτήσης.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type ReconciledStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Η ανάγνωση: η τιμή, ή `null` ⇒ αποτυχία (η οθόνη λέει «δεν φορτώθηκε», ποτέ κενή λίστα). */
export type ReconciledLoad<S> = () => Promise<S | null>;

export interface ReconciledResource<S> {
  readonly data: S | null;
  readonly status: ReconciledStatus;
  readonly refresh: () => Promise<void>;
  /**
   * **Αισιόδοξη πράξη**: εφάρμοσε `apply` αμέσως, κάλεσε τον διακομιστή, και σε **αποτυχία** (εξαίρεση ή
   * `failed(result) === true`) ξαναδιάβασε. `reconcile: 'always'` ⇒ ξαναδιάβασε και σε επιτυχία (πράξεις με
   * παρενέργειες που ξέρει μόνο ο διακομιστής — π.χ. η έκδοση πρόσκλησης ανακαλεί την προηγούμενη).
   */
  readonly optimistic: <R>(
    apply: (current: S) => S,
    call: () => Promise<R>,
    options?: { readonly failed?: (result: R) => boolean; readonly reconcile?: 'on-failure' | 'always' },
  ) => Promise<R>;
}

export function useReconciledResource<S>(load: ReconciledLoad<S>, enabled: boolean = true): ReconciledResource<S> {
  const [data, setData] = useState<S | null>(null);
  const [status, setStatus] = useState<ReconciledStatus>('idle');
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    setStatus((prev) => (prev === 'ready' ? prev : 'loading'));
    const next = await load().catch(() => null);
    if (mine !== seq.current) return;
    if (next === null) {
      setStatus('error');
      return;
    }
    setData(next);
    setStatus('ready');
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  const optimistic = useCallback(async <R,>(
    apply: (current: S) => S,
    call: () => Promise<R>,
    options: { readonly failed?: (result: R) => boolean; readonly reconcile?: 'on-failure' | 'always' } = {},
  ): Promise<R> => {
    seq.current++; // ακύρωσε κάθε ανάγνωση σε πτήση — θα έφερνε την προ-αλλαγής εικόνα
    setData((current) => (current === null ? current : apply(current)));
    try {
      const result = await call();
      if (options.reconcile === 'always' || options.failed?.(result) === true) void refresh();
      return result;
    } catch (error) {
      void refresh();
      throw error;
    }
  }, [refresh]);

  return { data, status, refresh, optimistic };
}
