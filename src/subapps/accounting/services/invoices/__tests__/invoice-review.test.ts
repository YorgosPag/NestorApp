/**
 * @fileoverview invoice-review — ο συνθέτης του ελέγχου πριν την έκδοση (ADR-ACC-003 §22.8)
 */

import type { Invoice, InvoiceCustomer, InvoiceType } from '../../../types/invoice';
import { buildMyDataInvoicePayload } from '../../mydata/mydata-payload-builder';
import { MYDATA_PREFLIGHT_ISSUE_CODES, preflightMyDataDraft } from '../../mydata/mydata-preflight';
import { CUSTOMER_VAT, makeInvoice, makeLine } from '../../mydata/__tests__/mydata-fixtures';
import { INVOICE_VAT_REVIEW_CODES } from '../../tax/invoice-vat-review';
import {
  INVOICE_REVIEW_SEVERITY,
  isReadyForTransmission,
  reviewInvoiceDraft,
  type InvoiceReviewFinding,
} from '../invoice-review';

/** Τιμολόγιο με μία γραμμή 0% — σύνολα συνεπή, ώστε να μη μπλέκονται ευρήματα συνόλων. */
function zeroRated(vatExemptionCategory: number | null, overrides: Partial<Invoice> = {}): Invoice {
  return makeInvoice({
    lineItems: [makeLine({ vatRate: 0, vatExemptionCategory })],
    totalVatAmount: 0,
    totalGrossAmount: 1000,
    vatBreakdown: [{ vatRate: 0, netAmount: 1000, vatAmount: 0 }],
    ...overrides,
  });
}

function withCustomer(type: InvoiceType, country: string, base: Invoice = makeInvoice()): Invoice {
  // Έγκυρος ελληνικός ΑΦΜ για GR, ώστε να μη μπλέκεται το COUNTERPART_VAT_INVALID.
  const vatNumber = country === 'GR' ? CUSTOMER_VAT : 'X123';
  const customer: InvoiceCustomer = { ...base.customer, country, vatNumber, city: 'C', postalCode: '1' };
  return { ...base, type, customer };
}

function codesOf(findings: readonly InvoiceReviewFinding[]): string[] {
  return findings.map((finding) => finding.code);
}

describe('λεξιλόγιο', () => {
  it('κάθε κωδικός και των δύο ελέγχων έχει βαθμίδα', () => {
    const expected = [...MYDATA_PREFLIGHT_ISSUE_CODES, ...INVOICE_VAT_REVIEW_CODES].sort();
    expect(Object.keys(INVOICE_REVIEW_SEVERITY).sort()).toEqual(expected);
  });
});

describe('reviewInvoiceDraft', () => {
  it('έγκυρο ΤΠΥ 24% ⇒ κανένα εύρημα, έτοιμο', () => {
    const findings = reviewInvoiceDraft(makeInvoice());
    expect(findings).toEqual([]);
    expect(isReadyForTransmission(findings)).toBe(true);
  });

  it('γραμμή 0% χωρίς αιτία ⇒ block, άγκυρα στο πεδίο αιτίας της γραμμής, προλαβαίνει το 217', () => {
    const [finding] = reviewInvoiceDraft(zeroRated(null));
    expect(finding).toMatchObject({
      code: 'VAT_EXEMPTION_MISSING',
      severity: 'block',
      anchor: { kind: 'line', lineNumber: 1, field: 'vatExemption' },
      aadeErrors: [217],
    });
    expect(isReadyForTransmission([finding as InvoiceReviewFinding])).toBe(false);
  });

  it('άγνωστη χώρα σε αιτία 4 ⇒ άγκυρα στη χώρα του πελάτη, με τη γραμμή', () => {
    const invoice = withCustomer('service_invoice_eu', 'Ατλαντίδα', zeroRated(4));
    const finding = reviewInvoiceDraft(invoice).find((item) => item.code === 'VAT_EXEMPTION_COUNTRY_UNKNOWN');
    expect(finding).toMatchObject({ severity: 'warn', anchor: { kind: 'customer', field: 'country' }, lineNumber: 1 });
  });

  it('ταξινόμηση: block → warn → info', () => {
    // 2.2 με Έλληνα πελάτη (warn) · γραμμή 0% χωρίς αιτία (block) · γραμμή αιτίας 1 (info).
    const base = makeInvoice({
      type: 'service_invoice_eu',
      lineItems: [makeLine({ vatRate: 0, vatExemptionCategory: 1 }), makeLine({ lineNumber: 2, vatRate: 0 })],
      totalNetAmount: 2000,
      totalVatAmount: 0,
    });
    expect(reviewInvoiceDraft(base).map((finding) => finding.severity)).toEqual(['block', 'warn', 'info']);
  });
});

describe('χώρα λήπτη × τύπος (σφάλματα ΑΑΔΕ 243 / 244 / 287) — μόνο όπου το λέει ο τίτλος του τύπου', () => {
  const MISMATCH = 'COUNTERPART_COUNTRY_TYPE_MISMATCH';
  const cases: [InvoiceType, string, boolean][] = [
    ['service_invoice_eu', 'GR', true],
    ['service_invoice_eu', 'DE', false],
    ['service_invoice_eu', 'US', true],
    ['service_invoice_3rd', 'US', false],
    ['service_invoice_3rd', 'DE', true],
    ['service_invoice_3rd', 'GR', true],
    ['service_invoice', 'DE', false],
    ['service_invoice_eu', 'Ατλαντίδα', false],
  ];

  it.each(cases)('%s με λήπτη %s ⇒ εύρημα: %s', (type, country, expected) => {
    expect(codesOf(reviewInvoiceDraft(withCustomer(type, country))).includes(MISMATCH)).toBe(expected);
  });

  it('είναι warn: δεν σταματά τη διαβίβαση, αλλά ταξιδεύει μαζί της', () => {
    const invoice = withCustomer('service_invoice_eu', 'GR');
    const [finding] = reviewInvoiceDraft(invoice);
    expect(finding).toMatchObject({ code: MISMATCH, severity: 'warn', aadeErrors: [243, 244, 287] });
    const result = buildMyDataInvoicePayload({ invoice, correlatedMarks: [] });
    expect(result.ok && result.warnings.map((issue) => issue.code)).toEqual([MISMATCH]);
  });
});

describe('preflightMyDataDraft — ό,τι κρίνεται από το περιεχόμενο', () => {
  it('δεν κρίνει κατάσταση, νόμισμα ή ΜΑΡΚ συσχέτισης', () => {
    const meta = makeInvoice().mydata;
    const invoice = makeInvoice({ type: 'credit_invoice', currency: 'USD', mydata: { ...meta, status: 'accepted' } });
    expect(preflightMyDataDraft(invoice)).toEqual([]);
  });
});
