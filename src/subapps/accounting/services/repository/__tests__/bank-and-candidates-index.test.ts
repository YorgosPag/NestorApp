/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΑ ΙΣΟΤΙΜΙΑΣ «ερώτημα ⇄ δείκτης» — καθολικό τράπεζας + στένεμα υποψηφίων αντιστοίχισης (ADR-ACC-010 §2.1.1).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: και οι δύο σαρώσεις περνούν από το `processAdminBatch`, άρα το CHECK 3.91 ΔΕΝ τις βλέπει.
 * Το προηγούμενο ερώτημα υποψηφίων τιμολογίων (`paymentStatus` + ταξινόμηση `issueDate`) ΔΕΝ είχε δείκτη: στην
 * παραγωγή γινόταν `FAILED_PRECONDITION` ⇒ fallback ⇒ «κανένα τιμολόγιο υποψήφιο», χωρίς κανείς να το μάθει.
 * Η άγκυρα ΕΚΤΕΛΕΙ τους πραγματικούς κατασκευαστές και απαιτεί δείκτη για ό,τι κατέγραψαν.
 */

import type { Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  indexesForShape,
  readCompositeIndexes,
  recordQueryShape,
  type RecordedQueryShape,
} from '@/test-utils/firestore-indexes';

import type { BankLedgerQuery } from '../../../types/bank';
import { buildBankLedgerQuery } from '../accounting-repo-bank-ledger';
import {
  INVOICE_OPEN_AMOUNT_FIELDS,
  buildJournalBandQuery,
  buildOpenInvoiceBandQuery,
} from '../accounting-repo-match-candidates';

const INDEXES = readCompositeIndexes();
const BAND = { min: 95.23, max: 105.27 } as const;

type Case = readonly [label: string, collection: string, shape: RecordedQueryShape];

const bank = (query: BankLedgerQuery) =>
  recordQueryShape<Query>((recorder) => buildBankLedgerQuery(recorder, 'comp_a', query));

const CASES: readonly Case[] = [
  ['τράπεζα · περίοδος', COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS,
    bank({ scope: { kind: 'period', period: { from: '2026-01-01', to: '2026-03-31' } } })],
  ['τράπεζα · ομάδα N:M', COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS,
    bank({ scope: { kind: 'matchGroup', matchGroupId: 'mgrp_1' } })],
  ...INVOICE_OPEN_AMOUNT_FIELDS.map((field): Case => [
    `υποψήφια τιμολόγια · ${field}`, COLLECTIONS.ACCOUNTING_INVOICES,
    recordQueryShape<Query>((recorder) => buildOpenInvoiceBandQuery(recorder, 'comp_a', field, BAND)),
  ]),
  ['υποψήφιες εγγραφές · μικτό ποσό', COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES,
    recordQueryShape<Query>((recorder) => buildJournalBandQuery(recorder, 'comp_a', 2026, BAND))],
];

describe('Ι — κάθε σχήμα σάρωσης τράπεζας / υποψηφίων έχει δείκτη', () => {
  it.each(CASES)('Ι-1 %s', (_label, collection, shape) => {
    expect(shape.equality).toContain('companyId');
    expect(indexesForShape(INDEXES, collection, shape).length).toBeGreaterThanOrEqual(1);
  });

  it('Ι-2 ο καταγραφέας ΟΝΤΩΣ βλέπει διαφορά ανάμεσα στα σχήματα (αλλιώς το Ι-1 θα περνούσε κενό)', () => {
    const distinct = new Set(CASES.map(([, collection, s]) =>
      `${collection}|${[...s.equality].sort().join(',')}|${[...s.range].join(',')}|${s.orderBy?.field}`));
    expect(distinct.size).toBe(CASES.length);
  });

  it('Ι-3 εύρος σε άλλο πεδίο από την ταξινόμηση ⇒ καμία κάλυψη (ο φύλακας δεν είναι διακοσμητικός)', () => {
    const wrong = recordQueryShape<Query>((recorder) =>
      recorder.where('companyId', '==', 'c').where('balanceDue', '>=', 1).orderBy('issueDate', 'desc'));
    expect(indexesForShape(INDEXES, COLLECTIONS.ACCOUNTING_INVOICES, wrong)).toEqual([]);
  });

  it('Ι-4 ανάποδη / μη πεπερασμένη ζώνη ⇒ σφάλμα, όχι σιωπηλά κενό αποτέλεσμα', () => {
    expect(() => recordQueryShape<Query>((r) =>
      buildOpenInvoiceBandQuery(r, 'c', 'balanceDue', { min: 10, max: 5 }))).toThrow(/band/);
    expect(() => recordQueryShape<Query>((r) =>
      buildJournalBandQuery(r, 'c', 2026, { min: 0, max: Number.NaN }))).toThrow(/band/);
  });
});
