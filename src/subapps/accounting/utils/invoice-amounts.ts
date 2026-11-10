/**
 * @fileoverview **Ποσά τιμολογίου — ο ΕΝΑΣ υπολογισμός** (ADR-ACC-003 §22.2 · ADR-ACC-002).
 * @module subapps/accounting/utils/invoice-amounts
 *
 * 🔑 **Ένας υπολογισμός, τρεις αναγνώστες**: η φόρμα έκδοσης (σύνολα + προεπισκόπηση), ο διακομιστής (επικύρωση
 * POST/PATCH, όριο πίστωσης) και ο έλεγχος πριν τη διαβίβαση myDATA. Ό,τι η φόρμα δείχνει είναι ό,τι ο διακομιστής
 * δέχεται και ό,τι η ΑΑΔΕ θα ελέγξει.
 *
 * 🔑 **Στρογγύλευση ανά γραμμή, σύνολα = άθροισμα γραμμών**: το myDATA δηλώνει `netValue`/`vatAmount` **ανά γραμμή**
 * και τα `totalNetValue`/`totalVatAmount` ως το άθροισμά τους. Ένα σύνολο από αστρογγύλευτα καθαρά μπορεί να διαφέρει
 * κατά ένα λεπτό από το άθροισμα των γραμμών — και τότε το παραστατικό μπλοκάρει (`NET_TOTAL_MISMATCH`).
 *
 * 🔴 **Τι αντικατέστησε**: ο ίδιος υπολογισμός ήταν γραμμένος **τέσσερις** φορές (`InvoiceForm.calculateTotals`, η
 * ανάλυση ΦΠΑ του `InvoiceForm`, το `InvoicePreview`, το `lineVatAmount` του preflight), και οι τρεις της φόρμας
 * άθροιζαν **αστρογγύλευτα** καθαρά ενώ ο preflight έλεγχε τα στρογγυλεμένα.
 *
 * Καθαρό, χωρίς εξάρτηση εκτέλεσης πέρα από το `roundToTwo` — τρέχει και στον browser και στον διακομιστή.
 */

import type { InvoiceLineItem, VatBreakdown } from '../types/invoice';
import { roundToTwo } from './math';

/** Ό,τι χρειάζεται μια γραμμή για να βγάλει ποσά — τίποτε άλλο (η φόρμα έχει γραμμές πριν πάρουν `netAmount`). */
export type InvoiceAmountLine = Pick<InvoiceLineItem, 'quantity' | 'unitPrice' | 'vatRate'>;

export interface InvoiceAmounts {
  readonly totalNetAmount: number;
  readonly totalVatAmount: number;
  /** Καθαρό + ΦΠΑ (η παρακράτηση **δεν** αφαιρείται — είναι χωριστό ποσό του τιμολογίου). */
  readonly totalGrossAmount: number;
  /** Ανά συντελεστή, με τη σειρά πρώτης εμφάνισης στις γραμμές. */
  readonly vatBreakdown: readonly VatBreakdown[];
}

/** Καθαρό ποσό γραμμής (ποσότητα × τιμή μονάδας), στρογγυλεμένο **ανά γραμμή**. */
export function lineNetAmount(quantity: number, unitPrice: number): number {
  return roundToTwo(quantity * unitPrice);
}

/** Ποσό ΦΠΑ γραμμής, πάνω στο **στρογγυλεμένο** καθαρό της — στρογγύλευση ανά γραμμή (myDATA `vatAmount`). */
export function lineVatAmount(netAmount: number, vatRate: number): number {
  return roundToTwo(netAmount * (vatRate / 100));
}

/** Σύνολα + ανάλυση ΦΠΑ ενός τιμολογίου — αθροίσματα των στρογγυλεμένων ποσών γραμμής. */
export function invoiceAmountsOf(lines: readonly InvoiceAmountLine[]): InvoiceAmounts {
  const byRate = new Map<number, { netAmount: number; vatAmount: number }>();
  let totalNet = 0;
  let totalVat = 0;
  for (const line of lines) {
    const net = lineNetAmount(line.quantity, line.unitPrice);
    const vat = lineVatAmount(net, line.vatRate);
    totalNet += net;
    totalVat += vat;
    const bucket = byRate.get(line.vatRate) ?? { netAmount: 0, vatAmount: 0 };
    byRate.set(line.vatRate, { netAmount: bucket.netAmount + net, vatAmount: bucket.vatAmount + vat });
  }
  const totalNetAmount = roundToTwo(totalNet);
  const totalVatAmount = roundToTwo(totalVat);
  return {
    totalNetAmount,
    totalVatAmount,
    totalGrossAmount: roundToTwo(totalNetAmount + totalVatAmount),
    vatBreakdown: Array.from(byRate, ([vatRate, sums]) => ({
      vatRate,
      netAmount: roundToTwo(sums.netAmount),
      vatAmount: roundToTwo(sums.vatAmount),
    })),
  };
}
