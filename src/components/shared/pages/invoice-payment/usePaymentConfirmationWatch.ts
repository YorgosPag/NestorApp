/**
 * usePaymentConfirmationWatch — όσο περιμένουμε την έκβαση μιας online απόπειρας, ρωτά τον διακομιστή (ADR-ACC-030
 * §5.6). Πρότυπο Stripe: η σελίδα επιστροφής **ρωτά** «τι έγινε με αυτή την απόπειρα;» — δεν συμπεραίνει από τη
 * διεύθυνση. Δύο ερωτήσεις ανά γύρο:
 *   1. **η έκβαση της απόπειρας** (`GET …/checkout?checkout=pchk_…`): `failed` / `closed` ⇒ τέλος αναμονής·
 *   2. **η όψη** (σιωπηλή ανανέωση): μόλις πει «Εξοφλήθηκε», ο καλών σβήνει το `active` και η αναμονή τελειώνει.
 *      Κάθε ανάγνωση της όψης **ανανεώνει** και την επίσκεψη (ADR-315 Α6) — η αναμονή δεν κόβεται ποτέ στα 15′.
 *
 * Ρυθμός: ο πρώτος γύρος **αμέσως** (η επιστροφή IRIS έχει ήδη σημειώσει την άρνηση), μετά κάθε 3″ το πρώτο λεπτό,
 * μετά κάθε 15″, ως τη **λήξη της συνεδρίας** (του παρόχου — IRIS sandbox 35′) + 1′ ⇒ `timed-out` (ρητό τέλος — η
 * συμφιλίωση του διακομιστή συνεχίζει μόνη της). Τη λήξη τη λέει ο διακομιστής ως **υπόλοιπο** (`expiresInMs`), ώστε
 * το ρολόι του browser να μη μετρά· πριν από την πρώτη απάντηση ισχύουν 15′.
 *
 * 🔑 **Αντοχή στο πάγωμα καρτέλας** (μετρημένο ζωντανά 2026-11-13: κρυμμένη καρτέλα, κανένας γύρος για 11′): ο
 * browser περιορίζει ή παγώνει τους χρονοδιακόπτες κρυμμένων καρτελών (Chrome intensive throttling · Page
 * Lifecycle `freeze`). Γι' αυτό ένας γύρος γίνεται **αμέσως** όταν η καρτέλα ξαναγίνει ορατή (`visibilitychange`),
 * όταν η σελίδα επιστρέψει από την προσωρινή μνήμη (`pageshow`) και όταν επανέλθει το δίκτυο (`online`). Ένας γύρος
 * τη φορά: το ξύπνημα ακυρώνει τον εκκρεμή χρονοδιακόπτη, δεν τον διπλασιάζει.
 *
 * @module components/shared/pages/invoice-payment/usePaymentConfirmationWatch
 */

'use client';

import { useEffect, useState } from 'react';

import type { InvoiceCheckoutAttemptResponse, PaymentAttemptOutcome } from '@/subapps/accounting/types/online-payment';

import { fetchInVisit, useShareVisitReopen, type ReopenVisit } from './share-visit-fetch';
import { invoiceCheckoutAttemptUrl } from './useInvoicePublicView';

const FAST_INTERVAL_MS = 3_000;
const SLOW_INTERVAL_MS = 15_000;
const FAST_PHASE_MS = 60_000;
/** Όσο ο διακομιστής δεν έχει απαντήσει ποτέ (άρα δεν ξέρουμε τη λήξη), η αναμονή τελειώνει εδώ. */
const UNANSWERED_GIVE_UP_MS = 15 * 60_000;
/** Περιθώριο μετά τη λήξη της συνεδρίας: webhook + χρέωση μιας εξουσιοδότησης της τελευταίας στιγμής. */
const SETTLEMENT_GRACE_MS = 60_000;
/**
 * Γεγονότα του `window` μετά από τα οποία οι χρονοδιακόπτες μπορεί να έμειναν παγωμένοι ⇒ γύρος αμέσως (μαζί με
 * το `visibilitychange` του `document`).
 */
const WINDOW_WAKE_EVENTS = ['pageshow', 'online'] as const;

/**
 * - `waiting` — συνήθης αναμονή (λίγα δευτερόλεπτα).
 * - `slow` — αργεί πέρα από το πρώτο λεπτό («μην πληρώσετε ξανά»).
 * - `failed` — ο πάροχος αρνήθηκε / η απόπειρα έκλεισε χωρίς πληρωμή ⇒ «δοκιμάστε ξανά».
 * - `timed-out` — η συνεδρία έληξε (+ περιθώριο) χωρίς έκβαση ⇒ ουδέτερο μήνυμα, καμία άλλη ερώτηση.
 */
export type PaymentWatchPhase = 'waiting' | 'slow' | 'failed' | 'timed-out';

export interface PaymentWatchTarget {
  readonly shareId: string;
  /** Η απόπειρα που παρακολουθείται· `null` ⇒ καμία αναμονή. */
  readonly checkoutId: string | null;
  /** `false` μόλις η όψη πει ότι δεν οφείλεται πια ποσό. */
  readonly active: boolean;
  readonly refresh: () => Promise<void>;
}

/** Η έκβαση της απόπειρας, ή `null` όταν ο διακομιστής δεν απάντησε / αρνήθηκε (ο επόμενος γύρος ξαναρωτά). */
interface AttemptReading {
  readonly outcome: PaymentAttemptOutcome;
  readonly expiresInMs: number;
}

async function askAttempt(shareId: string, checkoutId: string): Promise<InvoiceCheckoutAttemptResponse | null> {
  try {
    const response = await fetch(invoiceCheckoutAttemptUrl(shareId, checkoutId), {
      credentials: 'same-origin', cache: 'no-store',
    });
    return response.ok ? ((await response.json()) as InvoiceCheckoutAttemptResponse) : null;
  } catch {
    return null;
  }
}

/** Η έκβαση μέσα σε ζωντανή επίσκεψη (`fetchInVisit`: επίσκεψη που έληξε ⇒ αθόρυβα νέα, ADR-315 Α6). */
async function fetchAttempt(shareId: string, checkoutId: string, reopenVisit: ReopenVisit): Promise<AttemptReading | null> {
  const body = await fetchInVisit(() => askAttempt(shareId, checkoutId), reopenVisit);
  return body?.status === 'ok' ? { outcome: body.attempt, expiresInMs: body.expiresInMs } : null;
}

function isTerminalFailure(outcome: PaymentAttemptOutcome | null): boolean {
  return outcome === 'failed' || outcome === 'closed';
}

/**
 * Το τέλος της αναμονής μετά από μια απάντηση: η λήξη της συνεδρίας **συν** περιθώριο για το webhook και τη χρέωση
 * που ακολουθεί μια εξουσιοδότηση στο τελευταίο δευτερόλεπτο. Χωρίς απάντηση ⇒ το τρέχον τέλος μένει.
 *
 * ⚠️ Η **πρώτη** απάντηση ορίζει το τέλος· οι επόμενες μπορούν μόνο να το **μικρύνουν**. Ο διακομιστής κόβει το
 * υπόλοιπο στο `0` μετά τη λήξη, άρα «τώρα + υπόλοιπο» ξαναϋπολογισμένο σε κάθε γύρο θα έδινε «τώρα + 1′» για πάντα
 * και η αναμονή δεν θα τελείωνε ποτέ (εύρημα 2026-11-13, γράφοντας το test του χρόνου).
 */
function deadlineAfter(reading: AttemptReading | null, current: { readonly at: number; readonly answered: boolean }): number {
  if (reading === null) return current.at;
  const estimate = Date.now() + reading.expiresInMs + SETTLEMENT_GRACE_MS;
  return current.answered ? Math.min(current.at, estimate) : estimate;
}

interface WatchLoopInput {
  readonly shareId: string;
  readonly checkoutId: string;
  readonly refresh: () => Promise<void>;
  readonly reopenVisit: ReopenVisit;
  readonly setPhase: (phase: PaymentWatchPhase) => void;
}

interface WatchLoop {
  /** Γύρος **τώρα** (ακυρώνει τον εκκρεμή χρονοδιακόπτη). Χωρίς αποτέλεσμα σε γύρο σε εξέλιξη ή μετά το τέλος. */
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
    const [reading] = await Promise.all([
      fetchAttempt(input.shareId, input.checkoutId, input.reopenVisit), input.refresh(),
    ]);
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

export function usePaymentConfirmationWatch(target: PaymentWatchTarget): { readonly phase: PaymentWatchPhase } {
  const { shareId, checkoutId, active, refresh } = target;
  const reopenVisit = useShareVisitReopen();
  const [phase, setPhase] = useState<PaymentWatchPhase>('waiting');

  useEffect(() => {
    if (!active || checkoutId === null) return undefined;
    setPhase('waiting');
    const loop = startWatchLoop({ shareId, checkoutId, refresh, reopenVisit, setPhase });
    const onWake = () => { if (document.visibilityState === 'visible') loop.wake(); };
    // Το `visibilitychange` πυροδοτείται στο `document` (MDN)· τα `pageshow` / `online` στο `window`.
    document.addEventListener('visibilitychange', onWake);
    for (const name of WINDOW_WAKE_EVENTS) window.addEventListener(name, onWake);
    return () => {
      loop.stop();
      document.removeEventListener('visibilitychange', onWake);
      for (const name of WINDOW_WAKE_EVENTS) window.removeEventListener(name, onWake);
    };
  }, [shareId, checkoutId, active, refresh, reopenVisit]);

  return { phase };
}
