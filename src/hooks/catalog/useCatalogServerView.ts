'use client';

/**
 * @fileoverview **Μια όψη καταλόγου του διακομιστή, ζωντανή** (τιμές · εκπτώσεις · προμήθεια · κόστη) — φόρτωση μετά την ταυτότητα, ανανέωση στο παρασκήνιο όταν
 *   αλλάξει το σήμα της, μονοτονική αποδοχή (ADR-923 §5.11 «3δ» Ζ · ADR-905 · ADR-901 §14.8).
 * @related services/catalog/catalog-pricing-api.client.ts (οι όψεις) · services/catalog/catalog-view-signal.client-ref.ts ·
 *   services/realtime/hooks/use-server-view-signal.ts (ο ΕΝΑΣ ελεγκτής: σήμα · `freshUntil` · δίκτυο · ορατότητα)
 * @module hooks/catalog/useCatalogServerView
 *
 * 🔑 **Κανένας νέος μηχανισμός**: η πρώτη ανάγνωση περνά από το `useIdentityGatedResource` (καμία ερώτηση πριν λυθεί η
 *    ταυτότητα — περιστατικό 0/251), η ζωντάνια από το `useServerViewSignal` (ίδιο ιδίωμα με την υπόθεση μεταβίβασης).
 * 🔑 **Stale-while-revalidate**: η ανανέωση δεν δείχνει ποτέ «φορτώνει»· αποτυχημένη ανανέωση κρατά τα δεδομένα.
 * ⚠️ **Μονοτονική αποδοχή**: όψη με **μικρότερη** αναθεώρηση σήματος από αυτή που δείχνουμε απορρίπτεται — μια αργή
 *    ανάγνωση δεν γυρίζει ποτέ πίσω την οθόνη ούτε τη βάση του CAS του επόμενου επεξεργαστή.
 * ⚠️ **`isHeld`**: όσο εκκρεμούν αισιόδοξες εγγραφές, η ανανέωση περιμένει (αλλιώς θα έσβηνε την αισιόδοξη εικόνα πριν
 *    απαντήσει ο γραφέας)· ο καλών καλεί `release()` όταν αδειάσει η ουρά του.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useCompanyId } from '@/hooks/useCompanyId';
import { useIdentityGatedResource } from '@/hooks/useIdentityGatedResource';
import { catalogFailureOf, type CatalogFailure } from '@/services/catalog/catalog-failure';
import { catalogViewSignalSource } from '@/services/catalog/catalog-view-signal.client-ref';
import { useServerViewSignal, type ServerViewSignalSource } from '@/services/realtime/hooks/use-server-view-signal';
import { viewSignalRevisionOf } from '@/services/realtime/view-signal-revision';
import type { CatalogView } from '@/subapps/catalog/views/catalog-view-key';
import type { CatalogLoadState } from './useCatalogCollection';
import type { ViewFreshness } from '@/types/server-view';

export interface FreshView {
  readonly freshness: ViewFreshness;
}

export type CatalogServerViewState<V> =
  | { readonly state: 'loading' }
  | { readonly state: 'failed'; readonly failure: CatalogFailure }
  | { readonly state: 'ready'; readonly view: V };

export interface CatalogServerViewApi<V> {
  readonly current: CatalogServerViewState<V>;
  /** Ρητή ξαναφόρτωση (κουμπί «Δοκιμάστε ξανά») — σβήνει την οθόνη σε «φορτώνει». */
  readonly reload: () => void;
  /** Ανανέωση **στο παρασκήνιο** μετά από πράξη της ίδιας οθόνης — τα δεδομένα μένουν ορατά. */
  readonly revalidate: () => Promise<void>;
  /** Η ουρά αισιόδοξων εγγραφών άδειασε — η ανανέωση που περίμενε προχωρά. */
  readonly release: () => void;
}

export interface CatalogServerViewInput<V extends FreshView> {
  /** Ποια όψη ακούμε· `null` ⇒ καμία (π.χ. δεν επιλέχθηκε ακόμη έκδοση). ⚠️ Σταθερή αναφορά (`useMemo`). */
  readonly view: CatalogView | null;
  /** Η ανάγνωση της όψης. ⚠️ Σταθερή αναφορά (`useCallback`), αλλιώς η πρώτη φόρτωση ξανατρέχει σε κάθε απόδοση. */
  readonly read: () => Promise<V>;
  readonly isHeld?: () => boolean;
  readonly label: string;
}

type Load<V> = { readonly kind: 'ready'; readonly view: V } | { readonly kind: 'failed'; readonly failure: CatalogFailure };

/** Λύθηκε η ταυτότητα και δεν υπάρχει κανείς ⇒ «δεν επιτρέπεται», όχι ατέρμονο «φορτώνει». */
const NOBODY: Load<never> = { kind: 'failed', failure: { kind: 'forbidden', issues: [], currentRevision: null, fence: null } };

/** Η νεότερη όψη που δέχτηκε το παρασκήνιο, **δεμένη** στη φόρτωση πάνω στην οποία ήρθε. */
interface Fresher<V> {
  readonly base: V;
  readonly next: V;
}

const shownOf = <V>(fresher: Fresher<V> | null, base: V | null): V | null =>
  fresher !== null && fresher.base === base ? fresher.next : base;

function acceptFresher<V extends FreshView>(prev: Fresher<V> | null, base: V, next: V): Fresher<V> | null {
  const shown = shownOf(prev, base) ?? base;
  return next.freshness.revision >= shown.freshness.revision ? { base, next } : prev;
}

function useSignalSource(view: CatalogView | null): ServerViewSignalSource | null {
  const companyId = useCompanyId()?.companyId ?? null;
  return useMemo(() => (companyId && view ? catalogViewSignalSource(companyId, view) : null), [companyId, view]);
}

function useInitialLoad<V>(read: () => Promise<V>) {
  const load = useCallback(async (): Promise<Load<V>> => {
    try {
      return { kind: 'ready', view: await read() };
    } catch (cause) {
      return { kind: 'failed', failure: catalogFailureOf(cause) };
    }
  }, [read]);
  return useIdentityGatedResource<Load<V>>(load, NOBODY);
}

export function useCatalogServerView<V extends FreshView>(input: CatalogServerViewInput<V>): CatalogServerViewApi<V> {
  const { read } = input;
  const { value: loaded, reload } = useInitialLoad(read);
  const base = loaded?.kind === 'ready' ? loaded.view : null;
  const [fresher, setFresher] = useState<Fresher<V> | null>(null);
  const shown = shownOf(fresher, base);

  const fetch = useCallback(async (): Promise<number | null> => {
    if (base === null) return null;
    const next = await read();
    setFresher((prev) => acceptFresher(prev, base, next));
    return next.freshness.revision;
  }, [base, read]);

  const { release } = useServerViewSignal({
    source: useSignalSource(input.view),
    revisionOf: viewSignalRevisionOf,
    freshness: shown === null ? 'pending' : shown.freshness,
    fetch,
    isHeld: input.isHeld,
    label: input.label,
  });
  // Αποτυχημένη ανανέωση στο παρασκήνιο κρατά ό,τι δείχνουμε (το σήμα/ρολόι θα ξαναρωτήσει) — ποτέ εξαίρεση προς την οθόνη.
  const revalidate = useCallback(async () => { await fetch().catch(() => undefined); }, [fetch]);

  if (loaded === null) return { current: { state: 'loading' }, reload, revalidate, release };
  if (loaded.kind === 'failed') return { current: { state: 'failed', failure: loaded.failure }, reload, revalidate, release };
  return { current: { state: 'ready', view: shown ?? loaded.view }, reload, revalidate, release };
}

/**
 * **Το «κράτημα» της ανανέωσης όσο εκκρεμούν αισιόδοξες εγγραφές** — η ΜΙΑ σύνδεση `isHeld` ↔ `release` για κάθε οθόνη
 * τιμών (τιμοκατάλογοι · εκπτώσεις). Δύο βήματα, επειδή η όψη χρειάζεται το `isHeld` **πριν** υπάρξουν οι ουρές της,
 * και οι ουρές χτίζονται **πάνω** στην όψη:
 *   1. `const hold = usePendingHold()` → `useXView(hold.isHeld)`·
 *   2. μετά τις ουρές: `useReleaseWhenSettled(hold, εκκρεμή, view.release)`.
 */
export interface PendingHold {
  readonly isHeld: () => boolean;
  readonly held: { current: boolean };
}

export function usePendingHold(): PendingHold {
  const held = useRef(false);
  const isHeld = useCallback(() => held.current, []);
  return useMemo(() => ({ isHeld, held }), [isHeld]);
}

/** Κρατά την ανανέωση όσο `pending > 0`· όταν αδειάσουν **όλες** οι ουρές, η ανανέωση που περίμενε προχωρά. */
export function useReleaseWhenSettled(hold: PendingHold, pending: number, release: () => void): void {
  hold.held.current = pending > 0;
  useEffect(() => { if (pending === 0) release(); }, [pending, release]);
}

/** Η κατάσταση φόρτωσης του πλαισίου σελίδας (`CatalogPageFrame`) από μια όψη καταλόγου. */
export function catalogViewLoadState<V>(current: CatalogServerViewState<V>): CatalogLoadState {
  return current.state;
}
