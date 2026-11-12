/**
 * useInvoiceCheckout — ξεκινά online πληρωμή από τη δημόσια σελίδα (ADR-ACC-030 §5).
 *
 * - **Κάρτα** (και Apple Pay / Google Pay): η σελίδα του παρόχου ανοίγει σε **νέα καρτέλα**. Η καρτέλα ανοίγει
 *   **συγχρονικά** στο πάτημα (αλλιώς ο browser τη μπλοκάρει ως αναδυόμενο) και παίρνει τη διεύθυνση μόλις απαντήσει
 *   ο διακομιστής. Η σελίδα μας μένει ανοιχτή και περιμένει την επιβεβαίωση. Μπλοκαρισμένη καρτέλα ⇒ ίδια καρτέλα.
 * - **IRIS**: φόρμα POST στην **ίδια** καρτέλα — η επιλογή τράπεζας / QR γίνεται στον πάροχο και η επιστροφή
 *   φέρνει τον πελάτη πίσω εδώ (`?payment=…`).
 *
 * Το σώμα φέρει μόνο τρόπο, γλώσσα και τη διαδρομή της σελίδας — **ποτέ** ποσό. Ένα `Idempotency-Key` ανά πάτημα.
 *
 * @module components/shared/pages/invoice-payment/useInvoiceCheckout
 */

'use client';

import { useCallback, useState } from 'react';

import { keyedHeaders } from '@/lib/api/api-client-transport';
import type {
  CheckoutLaunch,
  InvoiceCheckoutRefusal,
  InvoiceCheckoutRequestBody,
  InvoiceCheckoutResponse,
  OnlinePaymentMethod,
} from '@/subapps/accounting/types/online-payment';

import { invoiceCheckoutUrl } from './useInvoicePublicView';

export type InvoiceCheckoutState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting'; readonly method: OnlinePaymentMethod }
  /** Η πληρωμή άνοιξε σε άλλη καρτέλα — η σελίδα παρακολουθεί την έκβαση **αυτής** της απόπειρας. */
  | { readonly kind: 'launched'; readonly checkoutId: string }
  | { readonly kind: 'refused'; readonly reason: InvoiceCheckoutRefusal | 'generic' };

/** Το όνομα της καρτέλας πληρωμής — μία, ώστε δεύτερο πάτημα να μην ανοίγει τρίτη. */
const PAYMENT_WINDOW_NAME = 'nestor-invoice-payment';

function submitForm(url: string, fields: Readonly<Record<string, string>>): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

/** Οδηγεί τον browser στον πάροχο. `true` όταν η πληρωμή άνοιξε σε **άλλη** καρτέλα. */
function launch(target: CheckoutLaunch, paymentWindow: Window | null): boolean {
  if (target.kind === 'form-post') {
    paymentWindow?.close();
    submitForm(target.url, target.fields);
    return false;
  }
  if (paymentWindow === null || paymentWindow.closed) {
    window.location.assign(target.url);
    return false;
  }
  paymentWindow.opener = null;
  paymentWindow.location.replace(target.url);
  return true;
}

async function requestCheckout(shareId: string, body: InvoiceCheckoutRequestBody): Promise<InvoiceCheckoutResponse | null> {
  const response = await fetch(invoiceCheckoutUrl(shareId), {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: keyedHeaders('POST', body, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  return response.ok ? ((await response.json()) as InvoiceCheckoutResponse) : null;
}

export function useInvoiceCheckout(shareId: string, locale: 'el' | 'en'): {
  readonly state: InvoiceCheckoutState;
  readonly start: (method: OnlinePaymentMethod) => void;
} {
  const [state, setState] = useState<InvoiceCheckoutState>({ kind: 'idle' });

  const start = useCallback((method: OnlinePaymentMethod) => {
    // Συγχρονικά, μέσα στο πάτημα: αλλιώς ο browser μπλοκάρει την καρτέλα.
    const paymentWindow = method === 'card' ? window.open('', PAYMENT_WINDOW_NAME) : null;
    setState({ kind: 'starting', method });
    requestCheckout(shareId, { method, locale, returnPath: window.location.pathname })
      .then((outcome) => {
        if (outcome?.status === 'started') {
          setState(launch(outcome.launch, paymentWindow)
            ? { kind: 'launched', checkoutId: outcome.checkoutId }
            : { kind: 'starting', method });
          return;
        }
        paymentWindow?.close();
        setState({ kind: 'refused', reason: outcome?.status === 'refused' ? outcome.reason : 'generic' });
      })
      .catch(() => {
        paymentWindow?.close();
        setState({ kind: 'refused', reason: 'generic' });
      });
  }, [shareId, locale]);

  return { state, start };
}
