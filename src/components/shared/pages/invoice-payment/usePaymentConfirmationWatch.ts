/**
 * usePaymentConfirmationWatch — όσο περιμένουμε την έκβαση μιας online απόπειρας, ρωτά τον διακομιστή (ADR-ACC-030
 * §5.6). Πρότυπο Stripe: η σελίδα επιστροφής **ρωτά** «τι έγινε με αυτή την απόπειρα;» — δεν συμπεραίνει από τη
 * διεύθυνση. Δύο ερωτήσεις ανά γύρο:
 *   1. **η έκβαση της απόπειρας** (`GET …/checkout?checkout=pchk_…`): `failed` / `closed` ⇒ τέλος αναμονής·
 *   2. **η όψη** (σιωπηλή ανανέωση): μόλις πει «Εξοφλήθηκε», ο καλών σβήνει το `active` και η αναμονή τελειώνει.
 *
 * Ρυθμός: ο πρώτος γύρος **αμέσως** (η επιστροφή IRIS έχει ήδη σημειώσει την άρνηση), μετά κάθε 3″ το πρώτο λεπτό,
 * μετά κάθε 15″, ως τη **λήξη της συνεδρίας** (του παρόχου — IRIS sandbox 35′) + 1′ ⇒ `timed-out` (ρητό τέλος — η
 * συμφιλίωση του διακομιστή συνεχίζει μόνη της). Τη λήξη τη λέει ο διακομιστής ως **υπόλοιπο** (`expiresInMs`), ώστε
 * το ρολόι του browser να μη μετρά· πριν από την πρώτη απάντηση ισχύουν 15′.
 *
 * @module components/shared/pages/invoice-payment/usePaymentConfirmationWatch
 */

'use client';

import { useEffect, useState } from 'react';

import type { InvoiceCheckoutAttemptResponse, PaymentAttemptOutcome } from '@/subapps/accounting/types/online-payment';

import { invoiceCheckoutAttemptUrl } from './useInvoicePublicView';

const FAST_INTERVAL_MS = 3_000;
const SLOW_INTERVAL_MS = 15_000;
const FAST_PHASE_MS = 60_000;
/** Όσο ο διακομιστής δεν έχει απαντήσει ποτέ (άρα δεν ξέρουμε τη λήξη), η αναμονή τελειώνει εδώ. */
const UNANSWERED_GIVE_UP_MS = 15 * 60_000;
/** Περιθώριο μετά τη λήξη της συνεδρίας: webhook + χρέωση μιας εξουσιοδότησης της τελευταίας στιγμής. */
const SETTLEMENT_GRACE_MS = 60_000;

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

async function fetchAttempt(shareId: string, checkoutId: string): Promise<AttemptReading | null> {
  try {
    const response = await fetch(invoiceCheckoutAttemptUrl(shareId, checkoutId), {
      credentials: 'same-origin', cache: 'no-store',
    });
    if (!response.ok) return null;
    const body = (await response.json()) as InvoiceCheckoutAttemptResponse;
    return body.status === 'ok' ? { outcome: body.attempt, expiresInMs: body.expiresInMs } : null;
  } catch {
    return null;
  }
}

function isTerminalFailure(outcome: PaymentAttemptOutcome | null): boolean {
  return outcome === 'failed' || outcome === 'closed';
}

/**
 * Το τέλος της αναμονής μετά από μια απάντηση: η λήξη της συνεδρίας **συν** περιθώριο για το webhook και τη χρέωση
 * που ακολουθεί μια εξουσιοδότηση στο τελευταίο δευτερόλεπτο. Χωρίς απάντηση ⇒ το τρέχον τέλος μένει.
 */
function deadlineAfter(reading: AttemptReading | null, currentDeadline: number): number {
  return reading === null ? currentDeadline : Date.now() + reading.expiresInMs + SETTLEMENT_GRACE_MS;
}

export function usePaymentConfirmationWatch(target: PaymentWatchTarget): { readonly phase: PaymentWatchPhase } {
  const { shareId, checkoutId, active, refresh } = target;
  const [phase, setPhase] = useState<PaymentWatchPhase>('waiting');

  useEffect(() => {
    if (!active || checkoutId === null) return undefined;
    const startedAt = Date.now();
    let deadline = startedAt + UNANSWERED_GIVE_UP_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    setPhase('waiting');
    const tick = async () => {
      const elapsed = Date.now() - startedAt;
      if (cancelled) return;
      if (Date.now() > deadline) { setPhase('timed-out'); return; }
      const [reading] = await Promise.all([fetchAttempt(shareId, checkoutId), refresh()]);
      if (cancelled) return;
      deadline = deadlineAfter(reading, deadline);
      if (isTerminalFailure(reading?.outcome ?? null)) { setPhase('failed'); return; }
      setPhase(elapsed > FAST_PHASE_MS ? 'slow' : 'waiting');
      timer = setTimeout(tick, elapsed > FAST_PHASE_MS ? SLOW_INTERVAL_MS : FAST_INTERVAL_MS);
    };
    timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [shareId, checkoutId, active, refresh]);

  return { phase };
}
