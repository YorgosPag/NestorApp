'use client';

/**
 * @fileoverview ADR-943 §5.9 — **η κατάσταση του βήματος «Πληρωμή προκαταβολής»**: έναρξη (ένα κλειδί ιδεμποτίας ανά
 *   πάτημα), οδήγηση στον πάροχο, αναμονή επιβεβαίωσης (ο ΕΝΑΣ βρόχος `usePaymentAttemptWatch`), σιωπηλή ανανέωση όψης.
 * @related DocumentRequestAdvance.tsx · document-request-api.ts · components/shared/payments/*
 * @module app/(auth)/document-request/useAdvancePayment
 *
 * 🔑 Η επιστροφή από τον πάροχο φέρνει `?payment=pchk_…`: η σελίδα **ρωτά** την έκβαση, δεν τη μαντεύει (πρότυπο Stripe).
 * 🔑 Η αναμονή τελειώνει όταν η **όψη** πει ότι η προκαταβολή δεν περιμένει πια πληρωμή (κρατείται).
 */

import { useCallback, useEffect, useState } from 'react';

import { launchCheckout, openPaymentWindow } from '@/components/shared/payments/checkout-launch';
import { forgetReturnedAttempt, returnedAttemptId } from '@/components/shared/payments/returned-attempt';
import { usePaymentAttemptWatch, type AttemptReading, type PaymentWatchPhase } from '@/components/shared/payments/usePaymentAttemptWatch';
import type { OnlinePaymentMethod } from '@/subapps/accounting/types/online-payment';
import type { IssuanceAdvanceCheckoutRefusal, IssuanceAdvancePaymentView } from '@/types/issuance-invitation';

import { fetchDocumentRequest, readAdvanceAttempt, startAdvanceCheckout, type DocumentRequestFailure } from './document-request-api';

export type AdvancePaymentPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting' }
  | { readonly kind: 'refused'; readonly reason: IssuanceAdvanceCheckoutRefusal }
  | { readonly kind: 'failed'; readonly failure: DocumentRequestFailure };

export interface AdvancePayment {
  readonly view: IssuanceAdvancePaymentView;
  readonly phase: AdvancePaymentPhase;
  /** Η απόπειρα που παρακολουθείται και πού βρίσκεται η αναμονή — `null` ⇒ καμία. */
  readonly watch: PaymentWatchPhase | null;
  readonly pay: (method: OnlinePaymentMethod) => void;
}

/** Σιωπηλή ανανέωση της όψης — μόνο όταν ο σύνδεσμος δείχνει ακόμη την πληρωμή (αλλιώς μένει η τελευταία γνωστή). */
function useAdvanceView(token: string, initial: IssuanceAdvancePaymentView) {
  const [view, setView] = useState(initial);
  const refresh = useCallback(async () => {
    const outcome = await fetchDocumentRequest(token);
    if (outcome.ok && outcome.data.access === 'advance') setView(outcome.data.advance);
  }, [token]);
  return { view, refresh };
}

export function useAdvancePayment(token: string, initial: IssuanceAdvancePaymentView, accessCode: string | null, locale: 'el' | 'en'): AdvancePayment {
  const { view, refresh } = useAdvanceView(token, initial);
  const [phase, setPhase] = useState<AdvancePaymentPhase>({ kind: 'idle' });
  const [attemptId, setAttemptId] = useState<string | null>(returnedAttemptId);
  const readAttempt = useCallback(async (checkoutId: string): Promise<AttemptReading | null> => {
    const outcome = await readAdvanceAttempt(token, checkoutId);
    return outcome.ok && outcome.data.status === 'ok' ? { outcome: outcome.data.attempt, expiresInMs: outcome.data.expiresInMs } : null;
  }, [token]);
  const active = attemptId !== null && view.state === 'awaiting-payment';
  const { phase: watch } = usePaymentAttemptWatch({ checkoutId: attemptId, active, refresh, readAttempt });
  const ended = attemptId !== null && (!active || watch === 'failed' || watch === 'timed-out');
  useEffect(() => { if (ended) forgetReturnedAttempt(); }, [ended]);

  const pay = useCallback((method: OnlinePaymentMethod) => {
    const paymentWindow = openPaymentWindow(method);
    setPhase({ kind: 'starting' });
    void startAdvanceCheckout(token, { method, locale, startRequested: true, acknowledgesWithdrawalLoss: true, accessCode }).then((outcome) => {
      if (!outcome.ok) { paymentWindow?.close(); setPhase({ kind: 'failed', failure: outcome.failure }); return; }
      const result = outcome.data;
      if (result.status === 'refused') { paymentWindow?.close(); setPhase({ kind: 'refused', reason: result.reason }); return; }
      if (launchCheckout(result.launch, paymentWindow)) setAttemptId(result.checkoutId);
      setPhase({ kind: 'idle' });
    });
  }, [token, locale, accessCode]);

  return { view, phase, watch: active ? watch : null, pay };
}
