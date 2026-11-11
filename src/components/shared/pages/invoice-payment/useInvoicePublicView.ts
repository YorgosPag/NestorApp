/**
 * useInvoicePublicView — φέρνει την όψη του τιμολογίου για τον κάτοχο του συνδέσμου (ADR-ACC-018 §16).
 *
 * Το αίτημα φέρει μόνο το `shareId` και το `HttpOnly` κουπόνι επίσκεψης (cookie, `Path=/api`) που έγραψε
 * η επίλυση του token λίγο πριν. Το token δεν ξαναταξιδεύει. Μία ανάγνωση ανά άνοιγμα, χωρίς polling:
 * ένα τιμολόγιο δεν αλλάζει όσο ο πελάτης το διαβάζει.
 *
 * @module components/shared/pages/invoice-payment/useInvoicePublicView
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

import type { InvoicePublicRefusal, InvoicePublicView, InvoicePublicViewResponse } from '@/subapps/accounting/types/invoice-public-view';

export type InvoicePublicViewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly view: InvoicePublicView }
  | { readonly kind: 'refused'; readonly reason: InvoicePublicRefusal }
  /** Δίκτυο ή διακομιστής: ο πελάτης μπορεί να ξαναδοκιμάσει. */
  | { readonly kind: 'failed' };

/** Η διεύθυνση της όψης: ο ΕΝΑΣ ορισμός για την όψη και το PDF της. */
export function invoicePublicViewUrl(shareId: string): string {
  return `/api/shares/${encodeURIComponent(shareId)}/invoice-payment`;
}

export function invoicePublicPdfUrl(shareId: string): string {
  return `${invoicePublicViewUrl(shareId)}/pdf`;
}

async function fetchView(shareId: string, signal: AbortSignal): Promise<InvoicePublicViewState> {
  const response = await fetch(invoicePublicViewUrl(shareId), { credentials: 'same-origin', cache: 'no-store', signal });
  if (!response.ok) return { kind: 'failed' };
  const body = (await response.json()) as InvoicePublicViewResponse;
  return body.status === 'ok' ? { kind: 'ready', view: body.view } : { kind: 'refused', reason: body.reason };
}

export function useInvoicePublicView(shareId: string): { readonly state: InvoicePublicViewState; readonly retry: () => void } {
  const [state, setState] = useState<InvoicePublicViewState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    fetchView(shareId, controller.signal)
      .then(setState)
      .catch(() => { if (!controller.signal.aborted) setState({ kind: 'failed' }); });
    return () => controller.abort();
  }, [shareId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
