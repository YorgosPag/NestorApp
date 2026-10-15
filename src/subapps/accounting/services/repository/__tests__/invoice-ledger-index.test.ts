/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΑ ΙΣΟΤΙΜΙΑΣ «ερώτημα ⇄ δείκτης» — καθολικό τιμολογίων για απαιτήσεις (ADR-ACC-010 §2.1.1, Φάση 3).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το υπόλοιπο πελάτη ζητούσε `companyId + customer.contactId + fiscalYear` ταξινομημένο κατά
 * `issueDate` — ΧΩΡΙΣ δείκτη. Στην παραγωγή `FAILED_PRECONDITION` ⇒ fallback ⇒ «κανένα τιμολόγιο» ⇒ υπόλοιπο 0 €
 * γραμμένο σε κάθε αλλαγή τιμολογίου. Η σάρωση περνά από το `processAdminBatch`, άρα το CHECK 3.91 ΔΕΝ τη βλέπει·
 * η άγκυρα ΕΚΤΕΛΕΙ τον πραγματικό κατασκευαστή και απαιτεί δείκτη για ό,τι κατέγραψε.
 */

import type { Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  indexesForShape,
  readCompositeIndexes,
  recordQueryShape,
  type RecordedQueryShape,
} from '@/test-utils/firestore-indexes';

import type { InvoiceLedgerQuery } from '../../../types/customer-balance';
import { buildInvoiceLedgerQuery, INVOICE_CUSTOMER_FIELD } from '../accounting-repo-invoice-ledger';

const INDEXES = readCompositeIndexes();

const shapeOf = (query: InvoiceLedgerQuery) =>
  recordQueryShape<Query>((recorder) => buildInvoiceLedgerQuery(recorder, 'comp_a', query));

const CASES: ReadonlyArray<readonly [label: string, shape: RecordedQueryShape]> = [
  ['πελάτης ως ημερομηνία', shapeOf({ scope: { kind: 'customer', customerId: 'cont_1', asOf: '2026-10-15' } })],
  ['όλες οι απαιτήσεις ως ημερομηνία', shapeOf({ scope: { kind: 'receivables', asOf: '2026-10-15' } })],
];

describe('Ι — κάθε σχήμα σάρωσης τιμολογίων έχει δείκτη', () => {
  it.each(CASES)('Ι-1 %s', (_label, shape) => {
    expect(shape.equality).toContain('companyId');
    expect(indexesForShape(INDEXES, COLLECTIONS.ACCOUNTING_INVOICES, shape).length).toBeGreaterThanOrEqual(1);
  });

  it('Ι-2 οι δύο εμβέλειες είναι ΔΙΑΦΟΡΕΤΙΚΑ σχήματα (αλλιώς το Ι-1 θα έλεγχε το ίδιο δύο φορές)', () => {
    expect(CASES[0][1].equality).toContain(INVOICE_CUSTOMER_FIELD);
    expect(CASES[1][1].equality).not.toContain(INVOICE_CUSTOMER_FIELD);
  });

  it('Ι-3 το παλιό σχήμα του υπολοίπου (με `fiscalYear`) ΔΕΝ έχει δείκτη — ο φύλακας δεν είναι διακοσμητικός', () => {
    const legacy = recordQueryShape<Query>((r) =>
      r.where('companyId', '==', 'c').where('fiscalYear', '==', 2026).where(INVOICE_CUSTOMER_FIELD, '==', 'x')
        .orderBy('issueDate', 'desc'));
    expect(indexesForShape(INDEXES, COLLECTIONS.ACCOUNTING_INVOICES, legacy)).toEqual([]);
  });

  it('Ι-4 η λίστα υπολοίπων (`companyId` + `netBalance` DESC) έχει δείκτη', () => {
    const list = recordQueryShape<Query>((r) => r.where('companyId', '==', 'c').orderBy('netBalance', 'desc'));
    expect(indexesForShape(INDEXES, COLLECTIONS.ACCOUNTING_CUSTOMER_BALANCES, list).length).toBeGreaterThanOrEqual(1);
  });
});

describe('Ο — όριο ημερομηνίας', () => {
  function upperBoundOf(asOf: string): unknown {
    let bound: unknown;
    const recorder = {
      where(field: string, _op: string, value: unknown) {
        if (field === 'issueDate') bound = value;
        return recorder;
      },
      orderBy: () => recorder,
    };
    buildInvoiceLedgerQuery(recorder as unknown as Query, 'c', { scope: { kind: 'receivables', asOf } });
    return bound;
  }

  it('Ο-1 αποκλειστικό όριο = η ΕΠΟΜΕΝΗ ημέρα (πιάνει και πλήρες ISO της ίδιας ημέρας), και μέσα σε δίσεκτο', () => {
    expect(upperBoundOf('2026-10-15')).toBe('2026-10-16');
    expect(upperBoundOf('2028-02-28')).toBe('2028-02-29');
    expect(upperBoundOf('2026-12-31')).toBe('2027-01-01');
  });

  it('Ο-2 ανύπαρκτη / κακογραμμένη ημέρα ⇒ σφάλμα, όχι σιωπηλά λάθος εύρος', () => {
    expect(() => upperBoundOf('2026-02-30')).toThrow(/asOf/);
    expect(() => upperBoundOf('2026-10-15T00:00:00Z')).toThrow(/asOf/);
  });
});
