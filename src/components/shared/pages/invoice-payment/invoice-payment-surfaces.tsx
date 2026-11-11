'use client';

/**
 * @fileoverview Η τεμπέλικη **επιφάνεια** της σελίδας πληρωμής τιμολογίου (ADR-ACC-018 §16 · ADR-280 §11.8 Β4.1 · ADR-744 §27).
 * @module components/shared/pages/invoice-payment/invoice-payment-surfaces
 *
 * 🔑 Η σελίδα `/shared/[token]` εξυπηρετεί **όλα** τα είδη συνδέσμων. Η σελίδα τιμολογίου μοντάρεται μόνο όταν ο
 *    σύνδεσμος είναι τιμολόγιο, άρα πίσω από το `defineLazySurfaces`: κώδικας **και** κείμενα
 *    (`accounting-public-payment`) φτάνουν ως ένα αίτημα, χωρίς ωμό κλειδί, και δεν μπαίνουν στην αναμονή κάθε
 *    άλλου συνδέσμου (CHECK 3.34).
 * ⚠️ Λεπτό μητρώο: εισάγει μόνο το factory και τύπους. Η πρόσοψη ξαναδίνει τον τύπο των props.
 */

import type { InvoicePaymentShareResolvedData } from '@/services/sharing/resolvers/invoice-payment.resolver';
import { defineLazySurfaces } from '@/utils/lazyRouteFactory';

const InvoicePaymentSurfaces = defineLazySurfaces({
  SharedInvoicePayment: {
    load: () => import('./SharedInvoicePaymentPageContent')
      .then((module) => ({ default: module.SharedInvoicePaymentPageContent })),
  },
});

export function SharedInvoicePaymentSlot({ data }: { readonly data: InvoicePaymentShareResolvedData }) {
  return <InvoicePaymentSurfaces.SharedInvoicePayment data={data} />;
}
