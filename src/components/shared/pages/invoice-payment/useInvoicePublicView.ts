/**
 * useInvoicePublicView — φέρνει την όψη του τιμολογίου για τον κάτοχο του συνδέσμου (ADR-ACC-018 §16).
 *
 * Το αίτημα φέρει μόνο το `shareId` και το `HttpOnly` κουπόνι επίσκεψης (cookie, `Path=/api`) που έγραψε
 * η επίλυση του token λίγο πριν. Το token δεν ξαναταξιδεύει. Μία ανάγνωση ανά άνοιγμα· σιωπηλή ανανέωση όσο
 * περιμένουμε επιβεβαίωση online πληρωμής (ADR-ACC-030, `refresh`) **και** όταν η καρτέλα ξαναγίνει ορατή
 * (πρότυπο SWR `revalidateOnFocus`): ο άνθρωπος που γυρίζει μετά από ώρα βρίσκει ζωντανή επίσκεψη και τρέχουσα
 * κατάσταση πριν πατήσει «Πληρωμή» ή «PDF». Επίσκεψη που έληξε ⇒ αθόρυβη νέα επίσκεψη (`fetchInVisit`, ADR-315 Α6).
 *
 * @module components/shared/pages/invoice-payment/useInvoicePublicView
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { InvoicePublicRefusal, InvoicePublicView, InvoicePublicViewResponse } from '@/subapps/accounting/types/invoice-public-view';
import { INVOICE_CHECKOUT_ATTEMPT_PARAM } from '@/subapps/accounting/types/online-payment';

import { fetchInVisit, useShareVisitReopen, type ReopenVisit } from './share-visit-fetch';

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

async function askView(shareId: string, signal: AbortSignal): Promise<InvoicePublicViewResponse | null> {
  const response = await fetch(invoicePublicViewUrl(shareId), { credentials: 'same-origin', cache: 'no-store', signal });
  return response.ok ? ((await response.json()) as InvoicePublicViewResponse) : null;
}

async function fetchView(shareId: string, reopenVisit: ReopenVisit, signal: AbortSignal): Promise<InvoicePublicViewState> {
  const body = await fetchInVisit(() => askView(shareId, signal), reopenVisit);
  if (body === null) return { kind: 'failed' };
  return body.status === 'ok' ? { kind: 'ready', view: body.view } : { kind: 'refused', reason: body.reason };
}

/**
 * Η σιωπηλή ανανέωση αλλάζει την οθόνη **μόνο** με ετυμηγορία: σφάλμα δικτύου ή επίσκεψη που δεν ξανάνοιξε (ο
 * κάτοχος της σελίδας δείχνει ήδη πύλη κωδικού / άρνηση) αφήνουν την όψη στη θέση της.
 */
function isVerdict(next: InvoicePublicViewState): boolean {
  return next.kind !== 'failed' && !(next.kind === 'refused' && next.reason === 'visit-expired');
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

/** Σιωπηλή ανανέωση με **μία πτήση τη φορά**: ο γύρος αναμονής και η επιστροφή στην καρτέλα μοιράζονται το αίτημα. */
function useSilentRefresh(
  shareId: string, reopenVisit: ReopenVisit, setState: (next: InvoicePublicViewState) => void,
): () => Promise<void> {
  const inFlight = useRef<Promise<void> | null>(null);
  return useCallback(() => {
    if (inFlight.current === null) {
      inFlight.current = fetchView(shareId, reopenVisit, new AbortController().signal)
        .catch((): InvoicePublicViewState => ({ kind: 'failed' }))
        .then((next) => { if (isVerdict(next)) setState(next); })
        .finally(() => { inFlight.current = null; });
    }
    return inFlight.current;
  }, [shareId, reopenVisit, setState]);
}

/** Η καρτέλα ξαναέγινε ορατή ⇒ σιωπηλή ανανέωση (η κρυμμένη καρτέλα μπορεί να έμεινε παγωμένη για ώρα). */
function useRefreshWhenVisible(refresh: () => Promise<void>): void {
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refresh]);
}

export function useInvoicePublicView(shareId: string): InvoicePublicViewHandle {
  const reopenVisit = useShareVisitReopen();
  const [state, setState] = useState<InvoicePublicViewState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    fetchView(shareId, reopenVisit, controller.signal)
      .then(setState)
      .catch(() => { if (!controller.signal.aborted) setState({ kind: 'failed' }); });
    return () => controller.abort();
  }, [shareId, reopenVisit, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const refresh = useSilentRefresh(shareId, reopenVisit, setState);
  useRefreshWhenVisible(refresh);
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
