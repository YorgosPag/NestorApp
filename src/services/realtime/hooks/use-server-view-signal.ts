'use client';

/**
 * =============================================================================
 * Η ΖΩΝΤΑΝΗ ΟΨΗ ΠΟΥ ΠΑΡΑΓΕΤΑΙ ΣΤΟΝ SERVER — ΕΝΑ hook (ADR-901 §14.8)
 * =============================================================================
 *
 * Όταν μια όψη **δεν** μπορεί να ακούσει τα δεδομένα της (παράγεται στον server, φιλτραρισμένη ανά ακροατήριο — οι
 * συλλογές της είναι deny-all), ακούει **ένα** έγγραφο-σήμα με **μόνο** έναν αριθμό και ξαναρωτά τον server.
 * Ο ελεγκτής (`server-view-refresh.ts`) αποφασίζει **πότε**· εδώ ζει μόνο η καλωδίωση React:
 *
 * - το σήμα (`useLiveDocument` — `absent` ⇒ αναθεώρηση 0: ανύπαρκτο ή αρνημένο, επίτηδες αδιάκριτα)
 * - η αναθεώρηση της όψης που ήδη έχουμε (`freshness.revision`)
 * - **ρολόι** στο `freshUntil` (αλλαγή ημέρας · λήξη συμμετοχής) αντί για polling
 * - **δίχτυ**: ορατότητα καρτέλας + επανασύνδεση δικτύου ⇒ ανάγνωση χωρίς πύλη
 *
 * ⚠️ Χωρίς ανάπτυξη των κανόνων ο listener παίρνει `absent` ⇒ η σελίδα συμπεριφέρεται **ακριβώς** όπως πριν
 *    (ασφαλής εκφυλισμός), με το δίχτυ ορατότητας ενεργό.
 *
 * @module services/realtime/hooks/use-server-view-signal
 */

import { useCallback, useEffect, useRef } from 'react';
import type { DocumentData, DocumentReference } from 'firebase/firestore';

import { useTabVisibilityRefresh } from '@/hooks/useTabVisibilityRefresh';
import type { ViewFreshness } from '@/types/server-view';
import { createServerViewRefresh, type ServerViewFetch, type ServerViewRefresh } from '../server-view-refresh';
import { useLiveDocument } from './use-live-snapshot';

/** Σήματα που φτάνουν μαζί (π.χ. πράξη + ακύρωση συμμετοχών) ⇒ μία ανάγνωση. */
const COALESCE_MS = 250;
/** Το μέγιστο που δέχεται το `setTimeout` (~24,8 ημέρες) — πέρα από αυτό, ξανά υπολογισμός στο επόμενο render. */
const MAX_TIMER_MS = 2_147_483_647;

/** Το έγγραφο-σήμα: το κλειδί της συνδρομής (το id του) και η αναφορά του. */
export interface ServerViewSignalSource {
  readonly key: string;
  readonly ref: () => DocumentReference<DocumentData>;
}

export interface ServerViewSignalInput {
  /** `null` ⇒ καμία συνδρομή (π.χ. δεν ξέρουμε ακόμη ποια όψη). */
  readonly source: ServerViewSignalSource | null;
  /** Το σύνορο του εγγράφου: μόνο ο αριθμός. */
  readonly revisionOf: (raw: unknown) => number | null;
  /**
   * Η φρεσκάδα της όψης που δείχνει **τώρα** η οθόνη: `'pending'` ⇒ δεν φορτώθηκε ακόμη (καμία συνδρομή — αλλιώς το
   * πρώτο σήμα θα έφερνε ανάγνωση παράλληλα με την αρχική φόρτωση) · `null` ⇒ φορτώθηκε και **δεν υπάρχει** όψη
   * (αναθεώρηση 0 — π.χ. καμία υπόθεση ακόμη· το άνοιγμά της από άλλο μέλος φτάνει ως σήμα).
   */
  readonly freshness: ViewFreshness | null | 'pending';
  readonly fetch: ServerViewFetch;
  /** Εκκρεμούν αισιόδοξες εντολές; — τότε η ανάγνωση περιμένει (`release()` όταν αδειάσει η ουρά). */
  readonly isHeld?: () => boolean;
  readonly label: string;
}

export interface ServerViewSignalHandle {
  /** Η ουρά αισιόδοξων εντολών άδειασε. */
  readonly release: () => void;
}

const NEVER_HELD = () => false;

/** Καλείται **μόνο** όταν υπάρχει κλειδί (η συνδρομή ανοίγει μόνο τότε) — η άρνηση είναι προγραμματιστικό σφάλμα. */
function sourceRef(source: ServerViewSignalSource | null): DocumentReference<DocumentData> {
  if (!source) throw new Error('useServerViewSignal: subscription opened without a source');
  return source.ref();
}

function useRefreshController(fetch: ServerViewFetch, isHeld: () => boolean): ServerViewRefresh {
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;
  const heldRef = useRef(isHeld);
  heldRef.current = isHeld;
  const controller = useRef<ServerViewRefresh | null>(null);
  if (controller.current === null) {
    controller.current = createServerViewRefresh({
      fetch: () => fetchRef.current(),
      isHeld: () => heldRef.current(),
      coalesceMs: COALESCE_MS,
      setTimer: (run, ms) => setTimeout(run, ms),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    });
  }
  useEffect(() => () => controller.current?.dispose(), []);
  return controller.current;
}

/** Ρολόι στο `freshUntil` — ξανά ανάγνωση **ακριβώς** όταν η όψη μπαγιατεύει μόνη της. */
function useFreshUntil(freshUntil: string | null, controller: ServerViewRefresh): void {
  useEffect(() => {
    if (freshUntil === null) return undefined;
    const due = Date.parse(freshUntil);
    if (!Number.isFinite(due)) return undefined;
    const handle = setTimeout(() => controller.force(), Math.min(Math.max(due - Date.now(), 0), MAX_TIMER_MS));
    return () => clearTimeout(handle);
  }, [freshUntil, controller]);
}

/** Επανασύνδεση δικτύου ⇒ ό,τι έγινε όσο ήμασταν εκτός μπορεί να μην έφτασε ως σήμα. */
function useOnline(controller: ServerViewRefresh): void {
  useEffect(() => {
    const onOnline = () => controller.force();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [controller]);
}

export function useServerViewSignal(input: ServerViewSignalInput): ServerViewSignalHandle {
  const controller = useRefreshController(input.fetch, input.isHeld ?? NEVER_HELD);
  const loaded = input.freshness !== 'pending';
  const freshness = loaded ? input.freshness : null;
  const live = useLiveDocument(loaded && input.source ? input.source.key : null, () => sourceRef(input.source), input.revisionOf, input.label);
  const viewRevision = loaded ? (freshness?.revision ?? 0) : null;

  useEffect(() => {
    if (viewRevision !== null) controller.noteView(viewRevision);
  }, [viewRevision, controller]);

  useEffect(() => {
    if (live.state === 'ready') controller.noteSignal(live.value);
  }, [live, controller]);

  useFreshUntil(freshness?.freshUntil ?? null, controller);
  useOnline(controller);
  useTabVisibilityRefresh(useCallback(() => controller.force(), [controller]));

  return { release: useCallback(() => controller.release(), [controller]) };
}
