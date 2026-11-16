/**
 * **Η οδήγηση του browser στον πάροχο πληρωμών** — ένας δρόμος για κάθε πληρωτέο αντικείμενο (ADR-ACC-030 §5 ·
 * ADR-943 §5.9). Μεταφέρθηκε αυτούσιο από το `useInvoiceCheckout` όταν απέκτησε δεύτερο καλούντα.
 *
 * - **Κάρτα** (και Apple Pay / Google Pay): η σελίδα του παρόχου σε **νέα καρτέλα**, που ανοίγει **συγχρονικά** στο
 *   πάτημα (`openPaymentWindow`) — αλλιώς ο browser τη μπλοκάρει ως αναδυόμενο. Μπλοκαρισμένη ⇒ ίδια καρτέλα.
 * - **IRIS**: φόρμα POST στην **ίδια** καρτέλα — η επιλογή τράπεζας / QR γίνεται στον πάροχο.
 *
 * @module components/shared/payments/checkout-launch
 */

import type { CheckoutLaunch, OnlinePaymentMethod } from '@/subapps/accounting/types/online-payment';

/** Το όνομα της καρτέλας πληρωμής — μία, ώστε δεύτερο πάτημα να μην ανοίγει τρίτη. */
const PAYMENT_WINDOW_NAME = 'nestor-invoice-payment';

/** Συγχρονικά, **μέσα** στο πάτημα: η καρτέλα της κάρτας. IRIS ⇒ καμία (φόρμα στην ίδια καρτέλα). */
export function openPaymentWindow(method: OnlinePaymentMethod): Window | null {
  return method === 'card' ? window.open('', PAYMENT_WINDOW_NAME) : null;
}

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
export function launchCheckout(target: CheckoutLaunch, paymentWindow: Window | null): boolean {
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
