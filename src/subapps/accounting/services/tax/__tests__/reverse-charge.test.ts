/**
 * @fileoverview reverse-charge — ποιες γραμμές έχουν λήπτη υπόχρεο του ΦΠΑ (ADR-ACC-003 §22.9 · ν. 4308/2014 άρθρο 9 §1 ιγ)
 */

import type { InvoiceType } from '../../../types/invoice';
import type { CustomerVatFacts } from '../customer-vat-treatment';
import type { InvoiceVatReviewInput } from '../invoice-vat-review';
import { isReverseChargeLine, reverseChargeLineNumbers } from '../reverse-charge';

const GREEK: CustomerVatFacts = { country: 'GR', vatNumber: '094014201' };
const EU_BUSINESS: CustomerVatFacts = { country: 'DE', vatNumber: 'DE811569869' };
const EU_CONSUMER: CustomerVatFacts = { country: 'DE', vatNumber: null };
const US_BUSINESS: CustomerVatFacts = { country: 'US', vatNumber: '12-3456789' };

function isRc(code: number, customer: CustomerVatFacts, invoiceType: InvoiceType): boolean {
  return reverseChargeLineNumbers({
    type: invoiceType,
    customer,
    lineItems: [{ lineNumber: 1, vatRate: 0, vatExemptionCategory: code }],
  }).length === 1;
}

describe('isReverseChargeLine — η κατηγορία AE του ΕΝΟΣ επιλυτή', () => {
  it('αιτία 16 (καταβολή από τον λήπτη) ⇒ ναι, για κάθε πελάτη', () => {
    for (const customer of [GREEK, EU_BUSINESS, US_BUSINESS]) {
      expect(isReverseChargeLine({ vatExemptionCategory: 16, customer, invoiceType: 'service_invoice' })).toBe(true);
    }
  });

  it('αιτία 4 + επιχείρηση ΕΕ + 2.2 ⇒ ναι (Οδηγία 196 · 226 §11α)', () => {
    expect(isReverseChargeLine({ vatExemptionCategory: 4, customer: EU_BUSINESS, invoiceType: 'service_invoice_eu' }))
      .toBe(true);
  });

  it.each([
    ['ελληνικός πελάτης (αντίφαση)', GREEK, 'service_invoice'],
    ['ιδιώτης ΕΕ (αντίφαση)', EU_CONSUMER, 'service_invoice'],
    ['επιχείρηση εκτός ΕΕ (G, όχι AE)', US_BUSINESS, 'service_invoice_3rd'],
  ] as const)('αιτία 4 + %s ⇒ όχι', (_label, customer, invoiceType) => {
    expect(isReverseChargeLine({ vatExemptionCategory: 4, customer, invoiceType })).toBe(false);
  });

  it('ενδοκοινοτική παράδοση αγαθών (αιτία 14 ⇒ K) ⇒ όχι — είναι απαλλαγή, όχι αντίστροφη επιβάρυνση', () => {
    expect(isRc(14, EU_BUSINESS, 'sales_invoice')).toBe(false);
  });
});

describe('reverseChargeLineNumbers', () => {
  it('κρατά μόνο γραμμές 0% με έγκυρη αιτία AE, με σειρά γραμμής', () => {
    const input: InvoiceVatReviewInput = {
      type: 'service_invoice_eu',
      customer: EU_BUSINESS,
      lineItems: [
        { lineNumber: 1, vatRate: 0, vatExemptionCategory: 4 },
        { lineNumber: 2, vatRate: 24, vatExemptionCategory: 4 },
        { lineNumber: 3, vatRate: 0 },
        { lineNumber: 4, vatRate: 0, vatExemptionCategory: 99 },
        { lineNumber: 5, vatRate: 0, vatExemptionCategory: 16 },
      ],
    };
    expect(reverseChargeLineNumbers(input)).toEqual([1, 5]);
  });

  it('χωρίς γραμμή AE ⇒ κενό', () => {
    expect(reverseChargeLineNumbers({
      type: 'service_invoice',
      customer: GREEK,
      lineItems: [{ lineNumber: 1, vatRate: 24 }],
    })).toEqual([]);
  });
});
