/**
 * Έλεγχος πριν τη διαβίβαση — κάθε κωδικός προβλήματος έχει ένα σενάριο που τον προκαλεί.
 */

import { preflightMyDataInvoice } from '../mydata-preflight';
import type { MyDataPreflightIssueCode, MyDataTransmissionInput } from '../mydata-preflight';
import type { Invoice } from '../../../types/invoice';
import { makeInvoice, makeLine } from './mydata-fixtures';

function codesOf(invoice: Invoice, correlatedMarks: readonly string[] = []): MyDataPreflightIssueCode[] {
  const input: MyDataTransmissionInput = { invoice, correlatedMarks };
  return preflightMyDataInvoice(input).map((issue) => issue.code);
}

describe('preflightMyDataInvoice', () => {
  it('έγκυρο ΤΠΥ 24% → καμία ένσταση', () => {
    expect(codesOf(makeInvoice())).toEqual([]);
  });

  it('ήδη διαβιβασμένο / ακυρωμένο → STATUS_NOT_TRANSMITTABLE· το απορριφθέν ξαναστέλνεται', () => {
    const meta = makeInvoice().mydata;
    expect(codesOf(makeInvoice({ mydata: { ...meta, status: 'accepted' } }))).toContain('STATUS_NOT_TRANSMITTABLE');
    expect(codesOf(makeInvoice({ mydata: { ...meta, status: 'cancelled' } }))).toContain('STATUS_NOT_TRANSMITTABLE');
    expect(codesOf(makeInvoice({ mydata: { ...meta, status: 'rejected' } }))).toEqual([]);
  });

  it('νόμισμα ≠ EUR → UNSUPPORTED_CURRENCY', () => {
    expect(codesOf(makeInvoice({ currency: 'USD' }))).toContain('UNSUPPORTED_CURRENCY');
  });

  it('ΑΦΜ εκδότη με λάθος ψηφίο ελέγχου → ISSUER_VAT_INVALID', () => {
    const base = makeInvoice();
    expect(codesOf(makeInvoice({ issuer: { ...base.issuer, vatNumber: '094014202' } }))).toContain('ISSUER_VAT_INVALID');
  });

  it('τιμολόγιο χωρίς ΑΦΜ λήπτη → COUNTERPART_VAT_MISSING· η ΑΠΥ όχι', () => {
    const base = makeInvoice();
    const anonymous = { ...base.customer, vatNumber: null };
    expect(codesOf(makeInvoice({ customer: anonymous }))).toContain('COUNTERPART_VAT_MISSING');
    expect(codesOf(makeInvoice({ customer: anonymous, type: 'service_receipt' }))).toEqual([]);
  });

  it('ελληνικός λήπτης με άκυρο ΑΦΜ → COUNTERPART_VAT_INVALID· ο αλλοδαπός δεν ελέγχεται με mod-11', () => {
    const base = makeInvoice();
    expect(codesOf(makeInvoice({ customer: { ...base.customer, vatNumber: '800123457' } })))
      .toContain('COUNTERPART_VAT_INVALID');
    const foreign = { ...base.customer, country: 'DE', vatNumber: 'DE123456789' };
    expect(codesOf(makeInvoice({ type: 'service_invoice_eu', customer: foreign }))).toEqual([]);
  });

  it('αλλοδαπός λήπτης χωρίς ΤΚ/πόλη → COUNTERPART_ADDRESS_MISSING', () => {
    const base = makeInvoice();
    const foreign = { ...base.customer, country: 'DE', vatNumber: 'DE123456789', city: null };
    expect(codesOf(makeInvoice({ type: 'service_invoice_eu', customer: foreign }))).toContain('COUNTERPART_ADDRESS_MISSING');
  });

  it('πιστωτικό χωρίς ΜΑΡΚ αρχικού → CORRELATED_MARK_MISSING', () => {
    expect(codesOf(makeInvoice({ type: 'credit_invoice' }))).toContain('CORRELATED_MARK_MISSING');
    expect(codesOf(makeInvoice({ type: 'credit_invoice' }), ['400000000000001'])).toEqual([]);
  });

  it('μικτή πληρωμή → PAYMENT_METHOD_NOT_TRANSMITTABLE', () => {
    expect(codesOf(makeInvoice({ paymentMethod: 'mixed' }))).toContain('PAYMENT_METHOD_NOT_TRANSMITTABLE');
  });

  it('χωρίς γραμμές → NO_LINES (και κανένας έλεγχος συνόλων)', () => {
    expect(codesOf(makeInvoice({ lineItems: [] }))).toEqual(['NO_LINES']);
  });

  it('άγνωστος συντελεστής ΦΠΑ → VAT_RATE_UNKNOWN με αριθμό γραμμής', () => {
    const issues = preflightMyDataInvoice({
      invoice: makeInvoice({ lineItems: [makeLine({ vatRate: 23 })], totalVatAmount: 230 }),
      correlatedMarks: [],
    });
    expect(issues).toContainEqual({ code: 'VAT_RATE_UNKNOWN', lineNumber: 1 });
  });

  it('0% χωρίς αιτία εξαίρεσης → VAT_EXEMPTION_MISSING· με αιτία → καθαρό', () => {
    const zero = { lineItems: [makeLine({ vatRate: 0 })], totalVatAmount: 0, totalGrossAmount: 1000 };
    expect(codesOf(makeInvoice(zero))).toContain('VAT_EXEMPTION_MISSING');
    const exempt = { ...zero, lineItems: [makeLine({ vatRate: 0, vatExemptionCategory: 1 })] };
    expect(codesOf(makeInvoice(exempt))).toEqual([]);
  });

  it('παρακράτηση 20% (ασαφής κατηγορία ΑΑΔΕ) → WITHHOLDING_CATEGORY_AMBIGUOUS· 3% → καθαρό', () => {
    expect(codesOf(makeInvoice({ withholdingRate: 20, withholdingAmount: 200 }))).toContain('WITHHOLDING_CATEGORY_AMBIGUOUS');
    expect(codesOf(makeInvoice({ withholdingRate: 3, withholdingAmount: 30 }))).toEqual([]);
  });

  it('σύνολα που δεν συμφωνούν με τις γραμμές → NET_/VAT_TOTAL_MISMATCH', () => {
    expect(codesOf(makeInvoice({ totalNetAmount: 999 }))).toContain('NET_TOTAL_MISMATCH');
    expect(codesOf(makeInvoice({ totalVatAmount: 241 }))).toContain('VAT_TOTAL_MISMATCH');
  });
});
