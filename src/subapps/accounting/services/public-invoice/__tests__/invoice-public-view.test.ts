/**
 * ADR-ACC-018 §16 — η δημόσια όψη τιμολογίου: τι βγαίνει, τι ΔΕΝ βγαίνει, πόσο οφείλεται.
 */

import type { Invoice } from '../../../types';
import { buildInvoicePublicView } from '../invoice-public-view';

const TODAY = '2026-11-11';

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    invoiceId: 'inv_1',
    series: 'A',
    number: 7,
    type: 'service_invoice',
    issueDate: '2026-11-01',
    dueDate: '2026-11-30',
    issuer: {
      name: 'Pagonis', vatNumber: '123456789', taxOffice: 'Α΄ Αθηνών', address: 'Οδός 1', city: 'Αθήνα',
      postalCode: '11111', phone: '210', mobile: null, email: 'i@x.gr', website: null, profession: 'Μηχανικός',
      bankAccounts: [{ bankName: 'Πειραιώς', iban: 'GR16 0110 1250 0000 0001 2300 695', bic: 'PIRBGRAA', holderName: null }],
    },
    customer: {
      contactId: 'cont_secret', name: 'ACME', vatNumber: '987654321', taxOffice: null, address: null, city: null,
      postalCode: null, country: 'GR', email: 'secret@customer.gr',
    },
    lineItems: [{ lineNumber: 1, description: 'Μελέτη', quantity: 1, unit: 'τεμ', unitPrice: 100, vatRate: 24, netAmount: 100, mydataCode: 'category1_3' }],
    currency: 'EUR',
    totalNetAmount: 100,
    totalVatAmount: 24,
    totalGrossAmount: 124,
    vatBreakdown: [{ vatRate: 24, netAmount: 100, vatAmount: 24 }],
    paymentMethod: 'bank_transfer',
    paymentStatus: 'unpaid',
    payments: [],
    totalPaid: 0,
    balanceDue: 124,
    mydata: { status: 'draft', mark: null, uid: 'uid_secret', authCode: 'auth_secret', submittedAt: null, respondedAt: null, errorMessage: null },
    emailHistory: [{ sentAt: '2026-11-02', recipientEmail: 'secret@customer.gr', subject: 's', mailgunMessageId: null, status: 'sent', error: null }],
    companyId: 'comp_secret',
    createdBy: 'user_secret',
    notes: 'Ευχαριστούμε',
    ...overrides,
  } as Invoice;
}

describe('buildInvoicePublicView', () => {
  it('never carries tenant, author, contact ids, customer email, email history or myDATA internals', () => {
    const serialized = JSON.stringify(buildInvoicePublicView(invoice(), TODAY, []));
    for (const secret of ['comp_secret', 'user_secret', 'cont_secret', 'secret@customer.gr', 'uid_secret', 'auth_secret']) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('payable: amount due = balance, one EPC QR per account with that amount, IBAN without spaces', () => {
    const view = buildInvoicePublicView(invoice({ balanceDue: 50, paymentStatus: 'partial' }), TODAY, []);
    expect(view.standing).toBe('payable');
    expect(view.amountDue).toBe(50);
    expect(view.payment?.accounts[0]?.iban).toBe('GR1601101250000000012300695');
    expect(view.payment?.accounts[0]?.epcQrPayload?.split('\n')).toContain('EUR50');
    expect(view.payment?.accounts[0]?.beneficiary).toBe('Pagonis');
  });

  it('overdue only when payable and past the due date', () => {
    expect(buildInvoicePublicView(invoice({ dueDate: '2026-11-10' }), TODAY, []).overdue).toBe(true);
    expect(buildInvoicePublicView(invoice({ dueDate: '2026-11-11' }), TODAY, []).overdue).toBe(false);
    expect(buildInvoicePublicView(invoice({ dueDate: '2026-11-10', paymentStatus: 'paid' }), TODAY, []).overdue).toBe(false);
  });

  it('paid / cancelled / cash: no payment instructions and nothing due', () => {
    const paid = buildInvoicePublicView(invoice({ paymentStatus: 'paid', balanceDue: 0 }), TODAY, []);
    expect([paid.standing, paid.amountDue, paid.payment]).toEqual(['paid', 0, null]);
    const cancelled = buildInvoicePublicView(invoice({ mydata: { ...invoice().mydata, status: 'cancelled' } }), TODAY, []);
    expect([cancelled.standing, cancelled.amountDue, cancelled.payment]).toEqual(['cancelled', 0, null]);
    const cash = buildInvoicePublicView(invoice({ paymentMethod: 'cash' }), TODAY, []);
    expect([cash.standing, cash.payment]).toEqual(['not-payable', null]);
  });
});
