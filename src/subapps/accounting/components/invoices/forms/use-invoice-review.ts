/**
 * @fileoverview **Ο έλεγχος πριν την έκδοση, ζωντανά στη φόρμα** (ADR-ACC-003 §22.8).
 * @module subapps/accounting/components/invoices/forms/use-invoice-review
 *
 * Χτίζει το πρόχειρο **όπως θα το στείλει** η υποβολή (αρίθμηση γραμμών + καθαρό από τον ΕΝΑ υπολογισμό, §22.2) και
 * ρωτά τον ΕΝΑ συνθέτη (`reviewInvoiceDraft`). Κανένας κανόνας εδώ.
 *
 * 🔑 **Το προφίλ φτάνει μετά τη φόρμα** (ίδιο race με §22.4β): όσο ο ΑΦΜ του εκδότη δεν είναι γνωστός, το
 * `ISSUER_VAT_INVALID` **δεν** εμφανίζεται — άγνωστο ≠ λάθος. Δεν «αναβοσβήνει» σφάλμα στο πρώτο render.
 */

import { useMemo } from 'react';

import type { InvoiceCustomer, InvoiceLineItem, InvoiceType, PaymentMethod } from '@/subapps/accounting/types';
import {
  reviewInvoiceDraft,
  type InvoiceReviewFinding,
} from '@/subapps/accounting/services/invoices/invoice-review';
import { lineNetAmount, type InvoiceAmounts } from '@/subapps/accounting/utils/invoice-amounts';

export interface InvoiceReviewFormSlice {
  readonly type: InvoiceType;
  readonly customer: InvoiceCustomer;
  readonly lineItems: readonly InvoiceLineItem[];
  readonly paymentMethod: PaymentMethod;
  readonly withholdingRate: number;
}

/** Ο ΑΦΜ του εκδότη από το προφίλ — `null` όσο το προφίλ δεν έχει φτάσει. */
export type IssuerVatNumber = string | null;

function submittedLines(lineItems: readonly InvoiceLineItem[]): InvoiceLineItem[] {
  return lineItems.map((item, index) => ({
    ...item,
    lineNumber: index + 1,
    netAmount: lineNetAmount(item.quantity, item.unitPrice),
  }));
}

export function useInvoiceReview(
  form: InvoiceReviewFormSlice,
  totals: Pick<InvoiceAmounts, 'totalNetAmount' | 'totalVatAmount'>,
  issuerVatNumber: IssuerVatNumber,
): readonly InvoiceReviewFinding[] {
  const { type, customer, lineItems, paymentMethod, withholdingRate } = form;
  const { totalNetAmount, totalVatAmount } = totals;
  return useMemo(() => {
    const findings = reviewInvoiceDraft({
      type,
      customer,
      lineItems: submittedLines(lineItems),
      paymentMethod,
      withholdingRate: withholdingRate > 0 ? withholdingRate : null,
      totalNetAmount,
      totalVatAmount,
      issuer: { vatNumber: issuerVatNumber ?? '' },
    });
    return issuerVatNumber === null ? findings.filter((item) => item.code !== 'ISSUER_VAT_INVALID') : findings;
  }, [type, customer, lineItems, paymentMethod, withholdingRate, totalNetAmount, totalVatAmount, issuerVatNumber]);
}
