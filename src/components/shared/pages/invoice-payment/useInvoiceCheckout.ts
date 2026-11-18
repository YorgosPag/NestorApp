/**
 * useInvoiceCheckout — ξεκινά online πληρωμή από τη δημόσια σελίδα (ADR-ACC-030 §5).
 *
 * - **Κάρτα** (και Apple Pay / Google Pay): η σελίδα του παρόχου ανοίγει σε **νέα καρτέλα**. Η καρτέλα ανοίγει
 *   **συγχρονικά** στο πάτημα (αλλιώς ο browser τη μπλοκάρει ως αναδυόμενο) και παίρνει τη διεύθυνση μόλις απαντήσει
 *   ο διακομιστής. Η σελίδα μας μένει ανοιχτή και περιμένει την επιβεβαίωση. Μπλοκαρισμένη καρτέλα ⇒ ίδια καρτέλα.
 * - **IRIS**: φόρμα POST στην **ίδια** καρτέλα — η επιλογή τράπεζας / QR γίνεται στον πάροχο και η επιστροφή
 *   φέρνει τον πελάτη πίσω εδώ (`?payment=…`).
 *
 * Το σώμα φέρει μόνο τρόπο, γλώσσα, τη διαδρομή της σελίδας και — μόνο όταν η όψη το ζήτησε — το email του πληρωτή
 * (§5.11) — **ποτέ** ποσό. Ένα `Idempotency-Key` ανά πάτημα.
 * Επίσκεψη που έληξε (ο άνθρωπος διάβαζε πάνω από 15′) ⇒ αθόρυβα νέα και **νέο** αίτημα με νέο κλειδί
 * (`fetchInVisit`, ADR-315 Α6): η πρώτη απορρίφθηκε χωρίς να εκτελεστεί.
 *
 * @module components/shared/pages/invoice-payment/useInvoiceCheckout
 */

'use client';

import { useCallback, useState } from 'react';

import { launchCheckout, openPaymentWindow } from '@/components/shared/payments/checkout-launch';
import { keyedHeaders } from '@/lib/api/api-client-transport';
import type {
  InvoiceCheckoutRefusal,
  InvoiceCheckoutRequestBody,
  InvoiceCheckoutResponse,
  OnlinePaymentMethod,
} from '@/subapps/accounting/types/online-payment';

import { fetchInVisit, useShareVisitReopen } from './share-visit-fetch';
import { invoiceCheckoutUrl } from './useInvoicePublicView';

export type InvoiceCheckoutState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting'; readonly method: OnlinePaymentMethod }
  /** Η πληρωμή άνοιξε σε άλλη καρτέλα — η σελίδα παρακολουθεί την έκβαση **αυτής** της απόπειρας. */
  | { readonly kind: 'launched'; readonly checkoutId: string }
  | { readonly kind: 'refused'; readonly reason: InvoiceCheckoutRefusal | 'generic' };

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
  /** `payerEmail` μόνο όταν η όψη το ζήτησε (`cardPayerEmailRequired`) και το πεδίο το έκρινε έγκυρο. */
  readonly start: (method: OnlinePaymentMethod, payerEmail?: string) => void;
} {
  const reopenVisit = useShareVisitReopen();
  const [state, setState] = useState<InvoiceCheckoutState>({ kind: 'idle' });

  const start = useCallback((method: OnlinePaymentMethod, payerEmail?: string) => {
    // Συγχρονικά, μέσα στο πάτημα: αλλιώς ο browser μπλοκάρει την καρτέλα.
    const paymentWindow = openPaymentWindow(method);
    setState({ kind: 'starting', method });
    const body: InvoiceCheckoutRequestBody = {
      method, locale, returnPath: window.location.pathname, ...(payerEmail === undefined ? {} : { payerEmail }),
    };
    fetchInVisit(() => requestCheckout(shareId, body), reopenVisit)
      .then((outcome) => {
        if (outcome?.status === 'started') {
          setState(launchCheckout(outcome.launch, paymentWindow)
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
  }, [shareId, locale, reopenVisit]);

  return { state, start };
}
