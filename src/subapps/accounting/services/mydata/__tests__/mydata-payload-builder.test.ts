/**
 * Τιμολόγιο → payload ΑΑΔΕ. Ελέγχει τους κανόνες §5.1 (εκδότης/λήπτης GR), την κατανομή
 * παρακράτησης ανά γραμμή, τα σύνολα και ότι από άκυρο τιμολόγιο ΔΕΝ βγαίνει payload.
 */

import { buildMyDataInvoicePayload, distributeWithholding } from '../mydata-payload-builder';
import type { MyDataInvoicePayload } from '../mydata-payload.types';
import type { Invoice } from '../../../types/invoice';
import { CUSTOMER_VAT, ISSUER_VAT, makeInvoice, makeLine } from './mydata-fixtures';

function payloadOf(invoice: Invoice, correlatedMarks: readonly string[] = []): MyDataInvoicePayload {
  const result = buildMyDataInvoicePayload({ invoice, correlatedMarks });
  if (!result.ok) throw new Error(`unexpected issues: ${result.issues.map((i) => i.code).join(',')}`);
  return result.payload;
}

describe('buildMyDataInvoicePayload', () => {
  it('άκυρο τιμολόγιο → κανένα payload, μόνο τα προβλήματα', () => {
    const result = buildMyDataInvoicePayload({ invoice: makeInvoice({ paymentMethod: 'mixed' }), correlatedMarks: [] });
    expect(result).toEqual({ ok: false, issues: [{ code: 'PAYMENT_METHOD_NOT_TRANSMITTABLE', lineNumber: null }] });
  });

  it('εκδότης GR: μόνο ΑΦΜ/χώρα/έδρα — χωρίς επωνυμία και διεύθυνση (§5.1 παρ. 3)', () => {
    expect(payloadOf(makeInvoice()).issuer).toEqual({
      vatNumber: ISSUER_VAT, country: 'GR', branch: 0, name: null, address: null,
    });
  });

  it('λήπτης GR: χωρίς επωνυμία, με διεύθυνση· αλλοδαπός: με επωνυμία', () => {
    expect(payloadOf(makeInvoice()).counterpart).toEqual({
      vatNumber: CUSTOMER_VAT, country: 'GR', branch: 0, name: null,
      address: { street: 'Οδός 2', number: null, postalCode: '54621', city: 'Θεσσαλονίκη' },
    });
    const base = makeInvoice();
    const foreign = makeInvoice({
      type: 'service_invoice_eu',
      customer: { ...base.customer, country: 'DE', vatNumber: 'DE123456789', name: 'Kunde GmbH' },
    });
    expect(payloadOf(foreign).counterpart?.name).toBe('Kunde GmbH');
  });

  it('απόδειξη λιανικής → χωρίς λήπτη', () => {
    expect(payloadOf(makeInvoice({ type: 'retail_receipt' })).counterpart).toBeNull();
  });

  it('επικεφαλίδα: σειρά, ΑΑ, τύπος 2.1, συσχετιζόμενοι ΜΑΡΚ για πιστωτικό', () => {
    expect(payloadOf(makeInvoice()).invoiceHeader).toEqual({
      series: 'A', aa: '42', issueDate: '2026-11-09', invoiceType: '2.1', currency: 'EUR', correlatedInvoices: [],
    });
    const credit = payloadOf(makeInvoice({ type: 'credit_invoice' }), ['400000000000001']);
    expect(credit.invoiceHeader.invoiceType).toBe('5.1');
    expect(credit.invoiceHeader.correlatedInvoices).toEqual(['400000000000001']);
  });

  it('ΤΠΥ 24% χωρίς παρακράτηση: γραμμή + σύνολα + πληρωμή = συνολική αξία', () => {
    const payload = payloadOf(makeInvoice());
    expect(payload.invoiceDetails).toEqual([{
      lineNumber: 1, netValue: 1000, vatCategory: 1, vatAmount: 240, vatExemptionCategory: null,
      withheldAmount: null, withheldPercentCategory: null,
      incomeClassification: [{ classificationType: null, classificationCategory: 'category1_3', amount: 1000 }],
    }]);
    expect(payload.invoiceSummary.totalGrossValue).toBe(1240);
    expect(payload.paymentMethods).toEqual([
      { type: 1, amount: 1240, paymentMethodInfo: 'GR1601101250000000012300695' },
    ]);
  });

  it('παρακράτηση 3% (τεχνικά έργα): κατηγορία 4, αφαιρείται από τη συνολική αξία', () => {
    const payload = payloadOf(makeInvoice({ withholdingRate: 3, withholdingAmount: 30 }));
    expect(payload.invoiceDetails[0]).toMatchObject({ withheldAmount: 30, withheldPercentCategory: 4 });
    expect(payload.invoiceSummary).toMatchObject({ totalWithheldAmount: 30, totalGrossValue: 1210 });
    expect(payload.paymentMethods[0]?.amount).toBe(1210);
  });

  it('0% με αιτία εξαίρεσης: κατηγορία 7 + η αιτία στη γραμμή', () => {
    const payload = payloadOf(makeInvoice({
      lineItems: [makeLine({ vatRate: 0, vatExemptionCategory: 14 })], totalVatAmount: 0, totalGrossAmount: 1000,
    }));
    expect(payload.invoiceDetails[0]).toMatchObject({ vatCategory: 7, vatAmount: 0, vatExemptionCategory: 14 });
  });

  it('σύνοψη χαρακτηρισμών: ένα άθροισμα ανά κατηγορία', () => {
    const lines = [
      makeLine({ lineNumber: 1, netAmount: 100, mydataCode: 'category1_3' }),
      makeLine({ lineNumber: 2, netAmount: 50, mydataCode: 'category1_1' }),
      makeLine({ lineNumber: 3, netAmount: 25, mydataCode: 'category1_3' }),
    ];
    const payload = payloadOf(makeInvoice({ lineItems: lines, totalNetAmount: 175, totalVatAmount: 42 }));
    expect(payload.invoiceSummary.incomeClassification).toEqual([
      { classificationType: null, classificationCategory: 'category1_3', amount: 125 },
      { classificationType: null, classificationCategory: 'category1_1', amount: 50 },
    ]);
  });
});

describe('distributeWithholding', () => {
  it('το άθροισμα ισούται ΑΚΡΙΒΩΣ με το ποσό του τιμολογίου (η τελευταία γραμμή απορροφά τη στρογγύλευση)', () => {
    const lines = [makeLine({ netAmount: 33.33 }), makeLine({ netAmount: 33.33 }), makeLine({ netAmount: 33.34 })];
    const shares = distributeWithholding(lines, 3, 3);
    expect(shares).toEqual([1, 1, 1]);
    const odd = distributeWithholding([makeLine({ netAmount: 10.05 }), makeLine({ netAmount: 10.05 })], 3, 0.6);
    expect(Math.round(odd.reduce((sum, share) => sum + share, 0) * 100)).toBe(60);
  });
});
