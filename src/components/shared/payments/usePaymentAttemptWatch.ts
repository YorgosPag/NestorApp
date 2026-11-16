/**
 * usePaymentAttemptWatch — όσο περιμένουμε την έκβαση μιας online απόπειρας, ρωτά τον διακομιστή (ADR-ACC-030 §5.6 ·
 * ADR-943 §5.9). Πρότυπο Stripe: η σελίδα επιστροφής **ρωτά** «τι έγινε με αυτή την απόπειρα;» — δεν συμπεραίνει από τη
 * διεύθυνση. Δύο ερωτήσεις ανά γύρο:
 *   1. **η έκβαση της απόπειρας** (`readAttempt`): `failed` / `closed` ⇒ τέλος αναμονής·
 *   2. **η όψη** (σιωπηλή ανανέωση, `refresh`): μόλις πει «πληρώθηκε», ο καλών σβήνει το `active` και η αναμονή τελειώνει.
 *
 * Ρυθμός: ο πρώτος γύρος **αμέσως** (η επιστροφή IRIS έχει ήδη σημειώσει την άρνηση), μετά κάθε 3″ το πρώτο λεπτό,
 * μετά κάθε 15″, ως τη **λήξη της συνεδρίας** (του παρόχου) + 1′ ⇒ `timed-out` (ρητό τέλος — η συμφιλίωση του
 * διακομιστή συνεχίζει μόνη της). Τη λήξη τη λέει ο διακομιστής ως **υπόλοιπο** (`expiresInMs`), ώστε το ρολόι του
 * browser να μη μετρά· πριν από την πρώτη απάντηση ισχύουν 15′.
 *
 * 🔑 **Αντοχή στο πάγωμα καρτέλας** (μετρημένο ζωντανά 2026-11-13: κρυμμένη καρτέλα, κανένας γύρος για 11′): ένας γύρος
 * γίνεται **αμέσως** όταν η καρτέλα ξαναγίνει ορατή (`visibilitychange`), όταν η σελίδα επιστρέψει από την προσωρινή
 * μνήμη (`pageshow`) και όταν επανέλθει το δίκτυο (`online`). Ένας γύρος τη φορά.
 *
 * 🔑 **Ένας βρόχος για κάθε πληρωτέο αντικείμενο** (μεταφέρθηκε αυτούσιος από το `usePaymentConfirmationWatch` του
 * τιμολογίου όταν απέκτησε δεύτερο καλούντα): το **μόνο** που διαφέρει είναι **πώς** ρωτάς την έκβαση (`readAttempt`).
 *
 * @module components/shared/payments/usePaymentAttemptWatch
 */

'use client';

import { useEffect, useState } from 'react';

import type { PaymentAttemptOutcome } from '@/subapps/accounting/types/online-payment';

const FAST_INTERVAL_MS = 3_000;
const SLOW_INTERVAL_MS = 15_000;
const FAST_PHASE_MS = 60_000;
/** Όσο ο διακομιστής δεν έχει απαντήσει ποτέ (άρα δεν ξέρουμε τη λήξη), η αναμονή τελειώνει εδώ. */
const UNANSWERED_GIVE_UP_MS = 15 * 60_000;
/** Περιθώριο μετά τη λήξη της συνεδρίας: webhook + χρέωση μιας εξουσιοδότησης της τελευταίας στιγμής. */
const SETTLEMENT_GRACE_MS = 60_000;
/** Γεγονότα του `window` μετά από τα οποία οι χρονοδιακόπτες μπορεί να έμειναν παγωμένοι (μαζί με `visibilitychange`). */
const WINDOW_WAKE_EVENTS = ['pageshow', 'online'] as const;

/**
 * - `waiting` — συνήθης αναμονή (λίγα δευτερόλεπτα).
 * - `slow` — αργεί πέρα από το πρώτο λεπτό («μην πληρώσετε ξανά»).
 * - `failed` — ο πάροχος αρνήθηκε / η απόπειρα έκλεισε χωρίς πληρωμή ⇒ «δοκιμάστε ξανά».
 * - `timed-out` — η συνεδρία έληξε (+ περιθώριο) χωρίς έκβαση ⇒ ουδέτερο μήνυμα, καμία άλλη ερώτηση.
 */
export type PaymentWatchPhase = 'waiting' | 'slow' | 'failed' | 'timed-out';

/** Η έκβαση της απόπειρας, ή `null` όταν ο διακομιστής δεν απάντησε / αρνήθηκε (ο επόμενος γύρος ξαναρωτά). */
export interface AttemptReading {
  readonly outcome: PaymentAttemptOutcome;
  readonly expiresInMs: number;
}

export type ReadAttempt = (checkoutId: string) => Promise<AttemptReading | null>;

export interface PaymentAttemptWatchTarget {
  /** Η απόπειρα που παρακολουθείται· `null` ⇒ καμία αναμονή. */
  readonly checkoutId: string | null;
  /** `false` μόλις η όψη πει ότι η πληρωμή ολοκληρώθηκε. */
  readonly active: boolean;
  readonly refresh: () => Promise<void>;
  /** ⚠️ Σταθερή αναφορά (`useCallback`) — αλλιώς ο βρόχος ξαναξεκινά σε κάθε απόδοση. */
  readonly readAttempt: ReadAttempt;
}

function isTerminalFailure(outcome: PaymentAttemptOutcome | null): boolean {
  return outcome === 'failed' || outcome === 'closed';
}

/**
 * Το τέλος της αναμονής μετά από μια απάντηση: η λήξη της συνεδρίας **συν** περιθώριο. Η **πρώτη** απάντηση ορίζει το
 * τέλος· οι επόμενες μπορούν μόνο να το **μικρύνουν** — ο διακομιστής κόβει το υπόλοιπο στο `0` μετά τη λήξη, άρα «τώρα +
 * υπόλοιπο» σε κάθε γύρο θα έδινε «τώρα + 1′» για πάντα (εύρημα 2026-11-13).
 */
function deadlineAfter(reading: AttemptReading | null, current: { readonly at: number; readonly answered: boolean }): number {
  if (reading === null) return current.at;
  const estimate = Date.now() + reading.expiresInMs + SETTLEMENT_GRACE_MS;
  return current.answered ? Math.min(current.at, estimate) : estimate;
}

interface WatchLoopInput {
  readonly checkoutId: string;
  readonly refresh: () => Promise<void>;
  readonly readAttempt: ReadAttempt;
  readonly setPhase: (phase: PaymentWatchPhase) => void;
}

interface WatchLoop {
  readonly wake: () => void;
  readonly stop: () => void;
}

/** Ο βρόχος αναμονής: ένας γύρος τη φορά, ένας χρονοδιακόπτης τη φορά, ρητό τέλος. */
function startWatchLoop(input: WatchLoopInput): WatchLoop {
  const startedAt = Date.now();
  let deadline = startedAt + UNANSWERED_GIVE_UP_MS;
  let answered = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;
  let inRound = false;
  const schedule = (delayMs: number) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => { void round(); }, delayMs);
  };
  const finish = (phase: PaymentWatchPhase) => { finished = true; input.setPhase(phase); };
  const round = async () => {
    if (finished || inRound) return;
    if (Date.now() > deadline) { finish('timed-out'); return; }
    inRound = true;
    const elapsed = Date.now() - startedAt;
    const [reading] = await Promise.all([input.readAttempt(input.checkoutId), input.refresh()]);
    inRound = false;
    if (finished) return;
    deadline = deadlineAfter(reading, { at: deadline, answered });
    answered ||= reading !== null;
    if (isTerminalFailure(reading?.outcome ?? null)) { finish('failed'); return; }
    input.setPhase(elapsed > FAST_PHASE_MS ? 'slow' : 'waiting');
    schedule(elapsed > FAST_PHASE_MS ? SLOW_INTERVAL_MS : FAST_INTERVAL_MS);
  };
  schedule(0);
  return {
    wake: () => { if (!finished && !inRound) schedule(0); },
    stop: () => { finished = true; if (timer !== undefined) clearTimeout(timer); },
  };
}

export function usePaymentAttemptWatch(target: PaymentAttemptWatchTarget): { readonly phase: PaymentWatchPhase } {
  const { checkoutId, active, refresh, readAttempt } = target;
  const [phase, setPhase] = useState<PaymentWatchPhase>('waiting');

  useEffect(() => {
    if (!active || checkoutId === null) return undefined;
    setPhase('waiting');
    const loop = startWatchLoop({ checkoutId, refresh, readAttempt, setPhase });
    const onWake = () => { if (document.visibilityState === 'visible') loop.wake(); };
    // Το `visibilitychange` πυροδοτείται στο `document` (MDN)· τα `pageshow` / `online` στο `window`.
    document.addEventListener('visibilitychange', onWake);
    for (const name of WINDOW_WAKE_EVENTS) window.addEventListener(name, onWake);
    return () => {
      loop.stop();
      document.removeEventListener('visibilitychange', onWake);
      for (const name of WINDOW_WAKE_EVENTS) window.removeEventListener(name, onWake);
    };
  }, [checkoutId, active, refresh, readAttempt]);

  return { phase };
}
