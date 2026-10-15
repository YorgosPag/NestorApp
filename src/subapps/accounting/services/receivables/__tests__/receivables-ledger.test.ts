/**
 * @jest-environment node
 *
 * Καθολικό απαιτήσεων — ανοιχτά στοιχεία σε ημερομηνία αναφοράς (ADR-ACC-010 §2.1.1, Φάση 3, 2026-10-15).
 *
 * Τα αναμενόμενα νούμερα είναι υπολογισμένα με το χέρι στο σχόλιο κάθε περίπτωσης — όχι αντιγραμμένα από έξοδο.
 * Κάθε `describe` καρφώνει ένα από τα λάθη που βρέθηκαν: υπόλοιπο ανά χρήση, ακυρωμένο που μετρά, πιστωτικό σε
 * άλλη χρήση από το τιμολόγιό του, ηλικίωση που διαφωνεί με το υπόλοιπο.
 */

import type { Invoice, InvoicePayment } from '../../../types/invoice';
import type { AgingBuckets } from '../../../types/customer-balance';
import { isCollectibleInvoice } from '../../../utils/invoice-open-amount';
import {
  agingBucketOf,
  buildOpenItems,
  groupInvoicesByCustomer,
  summarizeReceivables,
} from '../receivables-ledger';

const pay = (date: string, amount: number) => ({ paymentId: `p_${date}`, date, amount }) as InvoicePayment;

interface InvoiceSeed {
  id: string;
  issueDate: string;
  gross: number;
  dueDate?: string | null;
  payments?: InvoicePayment[];
  type?: Invoice['type'];
  status?: Invoice['mydata']['status'];
  relatedInvoiceId?: string | null;
  creditNoteInvoiceId?: string;
  isDisputed?: boolean;
  customerId?: string;
}

function invoice(seed: InvoiceSeed): Invoice {
  const payments = seed.payments ?? [];
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  return {
    invoiceId: seed.id,
    type: seed.type ?? 'service_invoice',
    issueDate: seed.issueDate,
    dueDate: seed.dueDate === undefined ? null : seed.dueDate,
    customer: { contactId: seed.customerId ?? 'cust_1', name: `Πελάτης ${seed.customerId ?? 'cust_1'}` },
    totalGrossAmount: seed.gross,
    payments,
    totalPaid,
    balanceDue: seed.gross - totalPaid,
    paymentStatus: totalPaid >= seed.gross ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid',
    mydata: { status: seed.status ?? 'accepted' },
    relatedInvoiceId: seed.relatedInvoiceId ?? null,
    creditNoteInvoiceId: seed.creditNoteInvoiceId,
    isDisputed: seed.isDisputed,
  } as Invoice;
}

const creditNote = (id: string, issueDate: string, gross: number, relatedInvoiceId: string | null) =>
  invoice({ id, issueDate, gross, type: 'credit_invoice', relatedInvoiceId, status: 'draft' });

const totalOf = (b: AgingBuckets) =>
  Math.round((b.current + b.days1_30 + b.days31_60 + b.days61_90 + b.days91_120 + b.days120plus) * 100) / 100;

describe('Α — διαχρονικό, όχι ανά χρήση (SAP FI-AR / Xero / QuickBooks)', () => {
  it('Α-1 απλήρωτο του Δεκεμβρίου οφείλεται τον Ιανουάριο, με ηλικία από τη λήξη', () => {
    // λήξη 31/12/2025, αναφορά 20/01/2026 ⇒ 20 ημέρες ⇒ κάδος 1-30
    const book = [invoice({ id: 'inv_dec', issueDate: '2025-12-10', dueDate: '2025-12-31', gross: 1000 })];
    const position = summarizeReceivables('cust_1', book, '2026-01-20');
    expect(position.netBalance).toBe(1000);
    expect(position.overdueBalance).toBe(1000);
    expect(position.aging.days1_30).toBe(1000);
    expect(position.asOf).toBe('2026-01-20');
  });

  it('Α-2 τιμολόγιο που εκδόθηκε ΜΕΤΑ την αναφορά δεν υπάρχει ακόμη', () => {
    const book = [invoice({ id: 'later', issueDate: '2026-02-01', gross: 500 })];
    expect(summarizeReceivables('cust_1', book, '2026-01-31').netBalance).toBe(0);
  });
});

describe('Β — κατά ημερομηνία από τα πρωτογενή: πληρωμές ως την αναφορά', () => {
  // 1.200 € · πληρωμή 200 € στις 10/03 και 400 € στις 20/04
  const book = [invoice({ id: 'inv', issueDate: '2026-03-01', dueDate: '2026-03-31', gross: 1200,
    payments: [pay('2026-03-10', 200), pay('2026-04-20T09:15:00.000Z', 400)] })];

  it('Β-1 στις 31/03 ανοιχτά 1.000 (η πληρωμή του Απριλίου δεν έγινε ακόμη)', () => {
    const p = summarizeReceivables('cust_1', book, '2026-03-31');
    expect([p.totalPaid, p.netBalance, p.aging.current, p.overdueBalance]).toEqual([200, 1000, 1000, 0]);
  });

  it('Β-2 στις 30/04 ανοιχτά 600, 30 ημέρες καθυστέρηση ⇒ 1-30', () => {
    const p = summarizeReceivables('cust_1', book, '2026-04-30');
    expect([p.totalPaid, p.netBalance, p.aging.days1_30, p.lastPaymentDate]).toEqual([600, 600, 600, '2026-04-20']);
  });

  it('Β-3 παλιό έγγραφο χωρίς `payments[]` αλλά με `totalPaid`: μετρά το `totalPaid`', () => {
    const legacy = { ...invoice({ id: 'old', issueDate: '2025-05-01', gross: 300 }), payments: [], totalPaid: 300 } as Invoice;
    expect(summarizeReceivables('cust_1', [legacy], '2026-01-01').netBalance).toBe(0);
  });
});

describe('Γ — ακυρωμένο (void) δεν εκδόθηκε ποτέ', () => {
  it('Γ-1 δεν μετρά ούτε στο υπόλοιπο ούτε στα τιμολογηθέντα', () => {
    const book = [
      invoice({ id: 'ok', issueDate: '2026-01-05', gross: 100 }),
      invoice({ id: 'void', issueDate: '2026-01-06', gross: 900, status: 'cancelled' }),
    ];
    const p = summarizeReceivables('cust_1', book, '2026-01-31');
    expect([p.totalInvoiced, p.netBalance, p.invoiceCount]).toEqual([100, 100, 1]);
  });
});

describe('Δ — πιστωτικό συμψηφίζεται με το τιμολόγιό του (SAP invoice reference / Xero allocation)', () => {
  // τιμολόγιο 2025 (1.000, λήξη 15/12/2025) · πιστωτικό 1.000 εκδόθηκε 15/01/2026
  const original = invoice({ id: 'inv', issueDate: '2025-12-01', dueDate: '2025-12-15', gross: 1000, creditNoteInvoiceId: 'cn' });
  const cn = creditNote('cn', '2026-01-15', 1000, 'inv');

  it('Δ-1 μετά το πιστωτικό: υπόλοιπο 0 ΚΑΙ ηλικίωση 0 (όχι 0 € με 1.000 € στο «>30»)', () => {
    const p = summarizeReceivables('cust_1', [original, cn], '2026-01-31');
    expect([p.netBalance, totalOf(p.aging), p.overdueBalance, p.totalCreditNotes]).toEqual([0, 0, 0, 1000]);
    expect(buildOpenItems([original, cn], '2026-01-31')).toEqual([]);
  });

  it('Δ-2 πριν το πιστωτικό: το τιμολόγιο ήταν ανοιχτό και ληξιπρόθεσμο', () => {
    // 15/12/2025 → 10/01/2026 = 26 ημέρες ⇒ 1-30
    const p = summarizeReceivables('cust_1', [original, cn], '2026-01-10');
    expect([p.netBalance, p.aging.days1_30]).toEqual([1000, 1000]);
  });

  it('Δ-3 πιστωτικό σε ήδη μερικώς πληρωμένο: ό,τι περισσεύει μένει πίστωση υπέρ του πελάτη', () => {
    // 1.000 − 300 πληρωμή = 700 ανοιχτά · πιστωτικό 1.000 ⇒ 700 συμψηφίζονται, −300 πίστωση
    const paid = invoice({ id: 'inv', issueDate: '2026-02-01', gross: 1000, payments: [pay('2026-02-05', 300)] });
    const items = buildOpenItems([paid, creditNote('cn', '2026-02-10', 1000, 'inv')], '2026-02-28');
    expect(items).toEqual([{ invoiceId: 'cn', kind: 'credit', dueDate: '2026-02-10', amount: -300, disputed: false }]);
  });

  it('Δ-4 πιστωτικό χωρίς αναφορά: μένει ολόκληρο πίστωση, στον κάδο της ημερομηνίας του', () => {
    const p = summarizeReceivables('cust_1', [creditNote('cn', '2026-03-01', 250, null)], '2026-03-15');
    expect([p.netBalance, p.aging.days1_30]).toEqual([-250, -250]);
  });
});

describe('Ε — ταυτότητες που πρέπει να ισχύουν ΠΑΝΤΑ', () => {
  const book = [
    invoice({ id: 'a', issueDate: '2024-06-01', dueDate: '2024-07-01', gross: 410.1 }),
    invoice({ id: 'b', issueDate: '2025-11-03', dueDate: '2025-12-03', gross: 99.99, payments: [pay('2025-12-01', 33.33)] }),
    invoice({ id: 'c', issueDate: '2026-01-02', dueDate: '2026-02-01', gross: 1234.56, isDisputed: true }),
    invoice({ id: 'd', issueDate: '2026-01-10', gross: 50, payments: [pay('2026-01-10', 60)] }),
    invoice({ id: 'v', issueDate: '2026-01-11', gross: 777, status: 'cancelled' }),
    creditNote('cn', '2026-01-20', 100, 'b'),
  ];
  const p = summarizeReceivables('cust_1', book, '2026-02-15');

  it('Ε-1 Σ ηλικίωσης = καθαρό υπόλοιπο = τιμολογήθηκαν − πληρώθηκαν − πιστώθηκαν', () => {
    // τιμολογήθηκαν 410,10 + 99,99 + 1.234,56 + 50 = 1.794,65 · πληρώθηκαν 33,33 + 60 = 93,33 · πιστωτικά 100
    expect([p.totalInvoiced, p.totalPaid, p.totalCreditNotes]).toEqual([1794.65, 93.33, 100]);
    expect(p.netBalance).toBe(1601.32);
    expect(totalOf(p.aging)).toBe(p.netBalance);
  });

  it('Ε-2 αμφισβητούμενο μένει στο υπόλοιπο (SAP) και φαίνεται χωριστά', () => {
    expect(p.disputedBalance).toBe(1234.56);
  });

  it('Ε-3 ανοιχτά τιμολόγια = μόνο όσα μας οφείλουν (όχι η υπερπληρωμή, όχι το πιστωτικό)', () => {
    // a 410,10 · b 66,66 − 100 πιστωτικό ⇒ κλείνει, −33,34 πίστωση · c 1.234,56 · d −10 υπερπληρωμή
    expect(p.invoiceCount).toBe(2);
  });
});

describe('ΣΤ — κάδοι ηλικίωσης (SAP S/4HANA, 6)', () => {
  it.each([
    [-5, 'current'], [0, 'current'], [1, 'days1_30'], [30, 'days1_30'], [31, 'days31_60'], [60, 'days31_60'],
    [61, 'days61_90'], [90, 'days61_90'], [91, 'days91_120'], [120, 'days91_120'], [121, 'days120plus'],
  ] as const)('ΣΤ-1 %i ημέρες ⇒ %s', (days, bucket) => {
    expect(agingBucketOf(days)).toBe(bucket);
  });

  it('ΣΤ-2 ημερομηνία που δεν είναι ημέρα ⇒ σφάλμα, όχι σιωπηλά «τρέχον»', () => {
    const bad = invoice({ id: 'bad', issueDate: '2026-01-01', dueDate: '2026-02-30', gross: 10 });
    expect(() => summarizeReceivables('cust_1', [bad], '2026-03-01')).toThrow(/invalid due date/);
  });
});

describe('Ζ — ομαδοποίηση και κριτήριο είσπραξης', () => {
  it('Ζ-1 ανά πελάτη· όσα δεν έχουν πελάτη μετρώνται, δεν χάνονται σιωπηλά', () => {
    const orphan = { ...invoice({ id: 'x', issueDate: '2026-01-01', gross: 1 }), customer: { name: 'λιανική' } } as Invoice;
    const { byCustomer, unattributed } = groupInvoicesByCustomer([
      invoice({ id: 'a', issueDate: '2026-01-01', gross: 1, customerId: 'c1' }),
      invoice({ id: 'b', issueDate: '2026-01-02', gross: 1, customerId: 'c2' }),
      invoice({ id: 'c', issueDate: '2026-01-03', gross: 1, customerId: 'c1' }),
      orphan,
    ]);
    expect([...byCustomer.entries()].map(([id, list]) => [id, list.length])).toEqual([['c1', 2], ['c2', 1]]);
    expect(unattributed).toBe(1);
  });

  it('Ζ-2 είσπραξη εξοφλεί μόνο απαίτηση: όχι πιστωτικό, όχι ακυρωμένο, όχι πιστωμένο', () => {
    expect(isCollectibleInvoice(invoice({ id: 'a', issueDate: '2026-01-01', gross: 1 }))).toBe(true);
    expect(isCollectibleInvoice(creditNote('cn', '2026-01-01', 1, 'a'))).toBe(false);
    expect(isCollectibleInvoice(invoice({ id: 'v', issueDate: '2026-01-01', gross: 1, status: 'cancelled' }))).toBe(false);
    expect(isCollectibleInvoice(invoice({ id: 'c', issueDate: '2026-01-01', gross: 1, creditNoteInvoiceId: 'cn' }))).toBe(false);
  });
});
