/**
 * useInvoicePublicView — φέρνει την όψη του τιμολογίου για τον κάτοχο του συνδέσμου (ADR-ACC-018 §16).
 *
 * Το αίτημα φέρει μόνο το `shareId` και το `HttpOnly` κουπόνι επίσκεψης (cookie, `Path=/api`) που έγραψε
 * η επίλυση του token λίγο πριν. Το token δεν ξαναταξιδεύει. Μία ανάγνωση ανά άνοιγμα· ανανέωση **μόνο** όσο
 * περιμένουμε επιβεβαίωση online πληρωμής (ADR-ACC-030, `refresh`).
 *
 * @module components/shared/pages/invoice-payment/useInvoicePublicView
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

import type { InvoicePublicRefusal, InvoicePublicView, InvoicePublicViewResponse } from '@/subapps/accounting/types/invoice-public-view';
import { INVOICE_CHECKOUT_ATTEMPT_PARAM } from '@/subapps/accounting/types/online-payment';

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

export interface InvoicePublicViewHandle {
  readonly state: InvoicePublicViewState;
  /** Νέα φόρτωση με ένδειξη «φόρτωση» (μετά από αποτυχία). */
  readonly retry: () => void;
  /**
   * Σιωπηλή ανανέωση: η τρέχουσα όψη μένει στην οθόνη ώσπου να έρθει η νέα (ADR-ACC-030 — αναμονή επιβεβαίωσης
   * πληρωμής). Αποτυχία δικτύου δεν σβήνει την όψη.
   */
  readonly refresh: () => Promise<void>;
}

export function useInvoicePublicView(shareId: string): InvoicePublicViewHandle {
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
  const refresh = useCallback(async () => {
    const next = await fetchView(shareId, new AbortController().signal).catch((): InvoicePublicViewState => ({ kind: 'failed' }));
    if (next.kind !== 'failed') setState(next);
  }, [shareId]);
  return { state, retry, refresh };
}

/** Η διεύθυνση έναρξης online πληρωμής (ADR-ACC-030) — δίπλα στην όψη, ίδιος ορισμός. */
export function invoiceCheckoutUrl(shareId: string): string {
  return `${invoicePublicViewUrl(shareId)}/checkout`;
}

/** Η έκβαση μιας απόπειρας (ADR-ACC-030 §5.6) — δίπλα στην έναρξη, ίδιος ορισμός. */
export function invoiceCheckoutAttemptUrl(shareId: string, checkoutId: string): string {
  const query = new URLSearchParams({ [INVOICE_CHECKOUT_ATTEMPT_PARAM]: checkoutId });
  return `${invoiceCheckoutUrl(shareId)}?${query.toString()}`;
}

/** Το νήμα «Γράψτε μας» (ADR-939) — δίπλα στην όψη, ίδιος ορισμός. */
export function invoicePortalMessagesUrl(shareId: string): string {
  return `${invoicePublicViewUrl(shareId)}/messages`;
}
