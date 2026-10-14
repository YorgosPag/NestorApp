/**
 * @jest-environment node
 *
 * Σάρωση καθολικού για ΥΠΟΛΟΓΙΣΜΟ — `collectJournalEntries` (περιστατικό 2026-10-14).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ο ΦΠΑ τριμήνου διάβαζε τη ΣΕΛΙΔΑ της οθόνης (όριο 50), οι αναφορές έστελναν `period`
 * που κανείς δεν εφάρμοζε, και ένα αποτυχημένο ερώτημα γινόταν «0 €». Κάθε ομάδα εδώ κλειδώνει ένα από αυτά:
 *
 *   Σ1  ΟΛΕΣ οι εγγραφές, πέρα από το μέγεθος παρτίδας (cursor) — ποτέ κομμένο
 *   Σ2  περίοδος = κλειστό διάστημα στο `date` · χρήση/τρίμηνο = αποθηκευμένα πεδία · μόνο ο μισθωτής
 *   Σ3  σφάλμα ανάγνωσης = ΣΦΑΛΜΑ, ποτέ κενή λίστα
 *   Σ4  ανώτατο όριο = σφάλμα, ποτέ κόψιμο · άκυρη περίοδος = σφάλμα
 *   Σ5  storno: αρχική + αντιλογιστική ⇒ καθαρό 0 στο SSoT `loadLedger`
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { BATCH_SIZE_READ } from '@/lib/admin-batch-utils';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

import type { JournalEntry, JournalLedgerQuery } from '../../../types/journal';
import {
  collectJournalEntries,
  JournalLedgerScanLimitError,
  JOURNAL_LEDGER_SCAN_CEILING,
} from '../accounting-repo-journal-ledger';
import { loadLedger } from '../../journal/journal-ledger';

const fake = new FakeFirestore();

// Ίδια σημασιολογία με το πραγματικό: χωρίς fallback το σφάλμα ΞΑΝΑΡΙΧΝΕΤΑΙ. Αν κάποιος δώσει fallback
// στη σάρωση, το Σ3 κοκκινίζει.
jest.mock('@/lib/firebaseAdmin', () => ({
  safeFirestoreOperation: async <T,>(op: (db: AdminFirestore) => Promise<T>, fallback?: T): Promise<T> => {
    try {
      return await op(fake as unknown as AdminFirestore);
    } catch (error) {
      if (fallback !== undefined) return fallback;
      throw error;
    }
  },
}));

const TENANT = { companyId: 'comp_a' } as const;
const COLL = COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES;

type Seed = Pick<JournalEntry, 'date' | 'type' | 'netAmount' | 'fiscalYear' | 'quarter'> &
  Partial<Pick<JournalEntry, 'status' | 'isReversal'>> & { readonly companyId?: string };

function entry(id: string, seed: Seed): Record<string, unknown> {
  return { entryId: id, companyId: TENANT.companyId, vatRate: 24, vatAmount: 0, status: 'ACTIVE', ...seed };
}

function seed(entries: Record<string, Record<string, unknown>>): void {
  fake.seedCollection(COLL, entries);
}

const ids = (rows: readonly JournalEntry[]) => rows.map((r) => r.entryId).sort();

beforeEach(() => {
  fake.failReads = false;
  seed({});
});

describe('Σ1 — όλη η εμβέλεια, πέρα από την παρτίδα', () => {
  it('επιστρέφει ΚΑΘΕ εγγραφή όταν είναι περισσότερες από μία παρτίδα', async () => {
    const total = BATCH_SIZE_READ * 2 + 7;
    const docs: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < total; i += 1) {
      const day = String((i % 28) + 1).padStart(2, '0');
      docs[`je_${i}`] = entry(`je_${i}`, { date: `2026-02-${day}`, type: 'income', netAmount: 1, fiscalYear: 2026, quarter: 1 });
    }
    seed(docs);

    const rows = await collectJournalEntries(TENANT, { scope: { kind: 'fiscalYear', fiscalYear: 2026, quarter: 1 } });

    expect(rows).toHaveLength(total);
    expect(new Set(rows.map((r) => r.entryId)).size).toBe(total);
  });
});

describe('Σ2 — η εμβέλεια εφαρμόζεται', () => {
  beforeEach(() => {
    seed({
      before: entry('before', { date: '2026-03-31', type: 'income', netAmount: 1, fiscalYear: 2026, quarter: 1 }),
      first: entry('first', { date: '2026-04-01', type: 'income', netAmount: 1, fiscalYear: 2026, quarter: 2 }),
      last: entry('last', { date: '2026-06-30', type: 'expense', netAmount: 1, fiscalYear: 2026, quarter: 2 }),
      after: entry('after', { date: '2026-07-01', type: 'income', netAmount: 1, fiscalYear: 2026, quarter: 3 }),
      foreign: entry('foreign', { date: '2026-05-01', type: 'income', netAmount: 1, fiscalYear: 2026, quarter: 2, companyId: 'comp_b' }),
    });
  });

  it('περίοδος: κλειστό διάστημα και στα δύο άκρα, μόνο ο μισθωτής', async () => {
    const q: JournalLedgerQuery = { scope: { kind: 'period', period: { from: '2026-04-01', to: '2026-06-30' } } };
    expect(ids(await collectJournalEntries(TENANT, q))).toEqual(['first', 'last']);
  });

  it('περίοδος + τύπος', async () => {
    const q: JournalLedgerQuery = { scope: { kind: 'period', period: { from: '2026-04-01', to: '2026-06-30' } }, type: 'income' };
    expect(ids(await collectJournalEntries(TENANT, q))).toEqual(['first']);
  });

  it('χρήση + τρίμηνο: τα αποθηκευμένα πεδία, όχι η ημερομηνία', async () => {
    const q: JournalLedgerQuery = { scope: { kind: 'fiscalYear', fiscalYear: 2026, quarter: 2 } };
    expect(ids(await collectJournalEntries(TENANT, q))).toEqual(['first', 'last']);
  });

  it('χρήση χωρίς τρίμηνο: όλο το έτος του μισθωτή', async () => {
    const q: JournalLedgerQuery = { scope: { kind: 'fiscalYear', fiscalYear: 2026 } };
    expect(ids(await collectJournalEntries(TENANT, q))).toEqual(['after', 'before', 'first', 'last']);
  });
});

describe('Σ3 — σφάλμα δεν γίνεται «μηδέν»', () => {
  it('η βάση δεν απαντά ⇒ η σάρωση ΑΠΟΡΡΙΠΤΕΤΑΙ (όχι [])', async () => {
    fake.failReads = true;
    await expect(
      collectJournalEntries(TENANT, { scope: { kind: 'fiscalYear', fiscalYear: 2026 } })
    ).rejects.toThrow();
  });
});

describe('Σ4 — ρητά όρια', () => {
  it('υπέρβαση ορίου ⇒ ΠΕΤΑ `JournalLedgerScanLimitError`, δεν επιστρέφει τις πρώτες N', async () => {
    seed({
      a: entry('a', { date: '2026-01-02', type: 'income', netAmount: 1, fiscalYear: 2026, quarter: 1 }),
      b: entry('b', { date: '2026-01-03', type: 'income', netAmount: 1, fiscalYear: 2026, quarter: 1 }),
      c: entry('c', { date: '2026-01-04', type: 'income', netAmount: 1, fiscalYear: 2026, quarter: 1 }),
    });
    const q: JournalLedgerQuery = { scope: { kind: 'fiscalYear', fiscalYear: 2026 } };

    await expect(collectJournalEntries(TENANT, q, 2)).rejects.toBeInstanceOf(JournalLedgerScanLimitError);
    await expect(collectJournalEntries(TENANT, q, 3)).resolves.toHaveLength(3);
  });

  it('το παραγωγικό όριο είναι σαφώς πάνω από ένα βιβλίο έτους', () => {
    expect(JOURNAL_LEDGER_SCAN_CEILING).toBeGreaterThanOrEqual(100_000);
  });

  it.each([
    [{ from: '2026-04-01T00:00:00Z', to: '2026-06-30' }],
    [{ from: '2026-06-30', to: '2026-04-01' }],
  ])('άκυρη περίοδος %j ⇒ σφάλμα, όχι σιωπηλά λάθος σύγκριση', async (period) => {
    await expect(collectJournalEntries(TENANT, { scope: { kind: 'period', period } })).rejects.toThrow(/period/);
  });
});

describe('Σ5 — storno στο SSoT `loadLedger`', () => {
  it('ακυρωμένο τιμολόγιο στην ίδια περίοδο ⇒ καθαρό 0, όχι −X', async () => {
    seed({
      orig: entry('orig', { date: '2026-05-10', type: 'income', netAmount: 1000, fiscalYear: 2026, quarter: 2, status: 'REVERSED' }),
      rev: entry('rev', { date: '2026-05-20', type: 'income', netAmount: -1000, fiscalYear: 2026, quarter: 2, isReversal: true }),
      kept: entry('kept', { date: '2026-05-21', type: 'income', netAmount: 250, fiscalYear: 2026, quarter: 2 }),
    });
    const repository = { collectJournalEntries: (q: JournalLedgerQuery) => collectJournalEntries(TENANT, q) };

    const ledger = await loadLedger(repository, { kind: 'period', period: { from: '2026-04-01', to: '2026-06-30' } });

    expect(ledger.totalIncomeNet).toBe(250);
    expect(ledger.expense).toHaveLength(0);
  });
});
