/**
 * ADR-ACC-003 §22.2 — ο ΕΝΑΣ υπολογισμός ποσών τιμολογίου (φόρμα · διακομιστής · preflight myDATA).
 */

import { invoiceAmountsOf, lineNetAmount, lineVatAmount } from '../invoice-amounts';
import { preflightMyDataInvoice } from '../../services/mydata/mydata-preflight';
import { makeInvoice, makeLine } from '../../services/mydata/__tests__/mydata-fixtures';

const line = (quantity: number, unitPrice: number, vatRate: number) => ({ quantity, unitPrice, vatRate });

describe('lineNetAmount / lineVatAmount', () => {
  it('στρογγυλεύει ανά γραμμή', () => {
    expect(lineNetAmount(3, 0.333)).toBe(1);
    expect(lineNetAmount(1, 0.125)).toBe(0.13);
    expect(lineVatAmount(10.01, 24)).toBe(2.4);
  });
});

describe('invoiceAmountsOf', () => {
  it('σύνολα = άθροισμα στρογγυλεμένων γραμμών (όχι στρογγύλευση αστρογγύλευτου αθροίσματος)', () => {
    // 3 × (1 × 0,005): αστρογγύλευτο άθροισμα 0,015 → 0,02· ανά γραμμή 0,01 × 3 = 0,03.
    const amounts = invoiceAmountsOf([line(1, 0.005, 0), line(1, 0.005, 0), line(1, 0.005, 0)]);
    expect(amounts.totalNetAmount).toBe(0.03);
  });

  it('μικτό = καθαρό + ΦΠΑ · ανάλυση ανά συντελεστή με σειρά πρώτης εμφάνισης', () => {
    const amounts = invoiceAmountsOf([line(2, 100, 24), line(1, 50, 13), line(1, 10, 24), line(1, 5, 0)]);
    expect(amounts).toEqual({
      totalNetAmount: 265,
      totalVatAmount: 56.9,
      totalGrossAmount: 321.9,
      vatBreakdown: [
        { vatRate: 24, netAmount: 210, vatAmount: 50.4 },
        { vatRate: 13, netAmount: 50, vatAmount: 6.5 },
        { vatRate: 0, netAmount: 5, vatAmount: 0 },
      ],
    });
  });

  it('χωρίς γραμμές = μηδενικά', () => {
    expect(invoiceAmountsOf([])).toEqual({ totalNetAmount: 0, totalVatAmount: 0, totalGrossAmount: 0, vatBreakdown: [] });
  });

  /**
   * Η εγγύηση που λείπει από τη φόρμα πριν: ό,τι υπολογίζει το `invoiceAmountsOf` ο preflight το δέχεται.
   * ΜΕΤΑΛΛΑΞΗ: σύνολα από αστρογγύλευτα καθαρά ⇒ `NET_TOTAL_MISMATCH` ⇒ κόκκινο.
   */
  it('συμφωνεί με τον έλεγχο συνόλων του preflight myDATA', () => {
    const lines = [line(1, 0.005, 24), line(1, 0.005, 24), line(1, 0.005, 24)];
    const amounts = invoiceAmountsOf(lines);
    const invoice = makeInvoice({
      lineItems: lines.map((l, i) => makeLine({ ...l, lineNumber: i + 1, netAmount: lineNetAmount(l.quantity, l.unitPrice) })),
      totalNetAmount: amounts.totalNetAmount,
      totalVatAmount: amounts.totalVatAmount,
      totalGrossAmount: amounts.totalGrossAmount,
      vatBreakdown: [...amounts.vatBreakdown],
    });
    const codes = preflightMyDataInvoice({ invoice, correlatedMarks: [] }).map((issue) => issue.code);
    expect(codes).not.toContain('NET_TOTAL_MISMATCH');
    expect(codes).not.toContain('VAT_TOTAL_MISMATCH');
  });
});
