/**
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΣΥΝΟΨΗΣ ΤΙΜΟΛΟΓΙΩΝ** — ADR-ACC-010 §2.1.1 («κάρτες σύνοψης πάνω σε σελίδα»)
 * @related services/list-summaries/invoice-list-summary.ts · api/accounting/invoices/summary
 *
 * 🔑 Ο παρονομαστής σε κάθε αποκλεισμό: ένα εισπρακτέο ΔΙΠΛΑ στο αποκλεισμένο — αλλιώς «όλα 0» θα ήταν πράσινο.
 */

import type { Invoice } from '../../../types/invoice';
import { summarizeInvoiceList } from '../invoice-list-summary';

const AS_OF = '2026-10-30';

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    type: 'service_invoice',
    issueDate: '2026-03-01',
    paymentStatus: 'unpaid',
    balanceDue: 100,
    totalGrossAmount: 124,
    mydata: { status: 'sent', mark: null, uid: null, authCode: null },
    ...overrides,
  } as unknown as Invoice;
}

describe('summarizeInvoiceList', () => {
  it('Π — ο παρονομαστής: ένα ανεξόφλητο μετρά με το ανοιχτό του ποσό', () => {
    expect(summarizeInvoiceList([invoice()], AS_OF)).toEqual({
      invoiceCount: 1, unpaidBalance: 100, unpaidCount: 1, issuedThisMonth: 0, pendingMydata: 0, asOf: AS_OF,
    });
  });

  /**
   * 🔴 Το παλιό άθροισμα μετρούσε ΚΑΘΕ μη εξοφλημένο — και πιστωτικά, ακυρωμένα, πιστωμένα (που κρατούν
   * `paymentStatus: 'unpaid'` με `balanceDue > 0`). ΜΕΤΑΛΛΑΞΗ: σβήσε το `isCollectibleInvoice` ⇒ κόκκινο.
   */
  it('🔴 Α1 — πιστωτικό · ακυρωμένο · πιστωμένο ΔΕΝ είναι ανεξόφλητο υπόλοιπο', () => {
    const summary = summarizeInvoiceList(
      [
        invoice(),
        invoice({ type: 'credit_invoice' }),
        invoice({ mydata: { status: 'cancelled' } as Invoice['mydata'] }),
        invoice({ creditNoteInvoiceId: 'inv_credit' }),
      ],
      AS_OF,
    );

    expect({ count: summary.invoiceCount, unpaid: summary.unpaidBalance, unpaidCount: summary.unpaidCount })
      .toEqual({ count: 4, unpaid: 100, unpaidCount: 1 });
  });

  it('Α2 — εξοφλημένο ΔΕΝ μετρά (ούτε μέσω του fallback σε συνολικό ποσό)', () => {
    expect(summarizeInvoiceList([invoice(), invoice({ paymentStatus: 'paid', balanceDue: 0 })], AS_OF).unpaidBalance).toBe(100);
  });

  /** Ο Πίνακας Ελέγχου ζητούσε μόνο `paymentStatus=unpaid` ⇒ τα μερικώς εξοφλημένα δεν ήταν «εκκρεμή». */
  it('🔴 Α3 — μερικώς εξοφλημένο: μετρά το ΥΠΟΛΟΙΠΟ, και ΕΙΝΑΙ εκκρεμές', () => {
    const summary = summarizeInvoiceList([invoice({ paymentStatus: 'partial', balanceDue: 40 })], AS_OF);

    expect({ balance: summary.unpaidBalance, count: summary.unpaidCount }).toEqual({ balance: 40, count: 1 });
  });

  /**
   * 🔴 Ο μήνας κρινόταν με `new Date(issueDate).getMonth()` του browser — `2026-10-01` γινόταν Σεπτέμβριος δυτικά
   * του UTC, και `…T23:30:00Z` της 31/10 ήταν Οκτώβριος ενώ στην Αθήνα είναι ήδη Νοέμβριος.
   */
  it('🔴 Μ1 — «τρέχων μήνας» = ημέρα ΑΘΗΝΑΣ, χωρίς ακυρωμένα', () => {
    const summary = summarizeInvoiceList(
      [
        invoice({ issueDate: '2026-10-01' }),
        invoice({ issueDate: '2026-09-30T22:30:00Z' }), // 01:30 της 1/10 στην Αθήνα
        invoice({ issueDate: '2026-10-31T23:30:00Z' }), // 1/11 στην Αθήνα
        invoice({ issueDate: '2026-10-15', mydata: { status: 'cancelled' } as Invoice['mydata'] }),
        invoice({ issueDate: 'not-a-date' }),
      ],
      AS_OF,
    );

    expect(summary.issuedThisMonth).toBe(2);
  });

  it('Ε1 — εκκρεμή myDATA = πρόχειρα', () => {
    const summary = summarizeInvoiceList(
      [invoice({ mydata: { status: 'draft' } as Invoice['mydata'] }), invoice()],
      AS_OF,
    );

    expect(summary.pendingMydata).toBe(1);
  });

  it('Σ1 — στρογγυλοποίηση στο λεπτό στο ΤΕΛΟΣ', () => {
    expect(summarizeInvoiceList([invoice({ balanceDue: 0.1 }), invoice({ balanceDue: 0.2 })], AS_OF).unpaidBalance).toBe(0.3);
  });
});
