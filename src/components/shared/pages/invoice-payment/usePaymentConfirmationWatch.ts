/**
 * usePaymentConfirmationWatch — η αναμονή επιβεβαίωσης της πληρωμής **τιμολογίου** (ADR-ACC-030 §5.6). Ο βρόχος (ρυθμός,
 * λήξη, αντοχή στο πάγωμα καρτέλας) ζει **μία** φορά στο `usePaymentAttemptWatch`· εδώ μόνο **πώς** ρωτάμε την έκβαση:
 * `GET …/invoice-payment/checkout?checkout=pchk_…` μέσα σε ζωντανή επίσκεψη (`fetchInVisit`: επίσκεψη που έληξε ⇒
 * αθόρυβα νέα, ADR-315 Α6 — η αναμονή δεν κόβεται ποτέ στα 15′).
 *
 * @module components/shared/pages/invoice-payment/usePaymentConfirmationWatch
 */

'use client';

import { useCallback } from 'react';

import {
  usePaymentAttemptWatch,
  type AttemptReading,
  type PaymentWatchPhase,
} from '@/components/shared/payments/usePaymentAttemptWatch';
import type { InvoiceCheckoutAttemptResponse } from '@/subapps/accounting/types/online-payment';

import { fetchInVisit, useShareVisitReopen } from './share-visit-fetch';
import { invoiceCheckoutAttemptUrl } from './useInvoicePublicView';

export type { PaymentWatchPhase };

export interface PaymentWatchTarget {
  readonly shareId: string;
  /** Η απόπειρα που παρακολουθείται· `null` ⇒ καμία αναμονή. */
  readonly checkoutId: string | null;
  /** `false` μόλις η όψη πει ότι δεν οφείλεται πια ποσό. */
  readonly active: boolean;
  readonly refresh: () => Promise<void>;
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

export function usePaymentConfirmationWatch(target: PaymentWatchTarget): { readonly phase: PaymentWatchPhase } {
  const { shareId, checkoutId, active, refresh } = target;
  const reopenVisit = useShareVisitReopen();
  const readAttempt = useCallback(async (attemptId: string): Promise<AttemptReading | null> => {
    const body = await fetchInVisit(() => askAttempt(shareId, attemptId), reopenVisit);
    return body?.status === 'ok' ? { outcome: body.attempt, expiresInMs: body.expiresInMs } : null;
  }, [shareId, reopenVisit]);
  return usePaymentAttemptWatch({ checkoutId, active, refresh, readAttempt });
}
