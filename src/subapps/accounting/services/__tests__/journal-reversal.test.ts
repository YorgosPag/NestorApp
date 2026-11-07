/**
 * @jest-environment node
 *
 * Αντιλογισμός εγγραφής Βιβλίου Ε-Ε — ο ΕΝΑΣ γραφέας πάνω στο verified fake Firestore (ADR-ACC-010 §2.1.1 Φάση 8).
 *
 *   Α1  storno = ίδια πεδία, αντίθετα ποσά· αρχική `REVERSED`· ίχνος στην ΙΔΙΑ συναλλαγή· τα σύνολα φόρου μηδενίζονται
 *       (και η ΕΦΚΑ: η γραμμή της επιστρέφει στο 0 — η ζωντανή επαλήθευση του handoff §2, σε test)
 *   Α2  ιδεμπότητα: δεύτερο αίτημα ⇒ `already_reversed` με ΤΟ ΙΔΙΟ storno, καμία νέα εγγραφή· `REVERSED` χωρίς σύνδεσμο
 *       (παλιά δεδομένα) ⇒ επίσης αντιλογισμένη, ποτέ δεύτερο storno
 *   Α3  αρνήσεις: storno του storno · αποσβέσεις · τιμολόγιο (από το βιβλίο — όχι από την ακύρωσή του) · παραστατικό
 *   Α4  ξένη εγγραφή = ανύπαρκτη, τίποτα δεν γράφεται
 *   Α5  ημερομηνία: ανοιχτή περίοδος της αρχικής ⇒ η ημερομηνία της· κλειστή ⇒ σήμερα + σήμανση cross-period·
 *       καμία ανοιχτή ⇒ άρνηση με την περίοδο του ΣΗΜΕΡΑ, τίποτα δεν γράφεται
 *   Π   καθαρή πολιτική: υποψήφιες ημερομηνίες, πληρότητα λόγου, γενεαλογία στη δημιουργία, κωδικός άρνησης
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicJournalReversalEntryId } from '@/services/enterprise-id.service';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

import type { AccountingAuditEntry } from '../../types/accounting-audit';
import type { JournalEntry } from '../../types/journal';
import type { JournalReversalRequest } from '../../types/journal-reversal';
import { createFiscalYear } from '../fiscal-period-service';
import { ledgerTaxTotals } from '../journal/journal-ledger';
import {
  carriesLineageFields,
  isReversalReasonComplete,
  journalReversalRefusalCode,
  journalReversalRefusalOfErrorCode,
  reversalDateCandidates,
} from '../journal/journal-reversal-policy';
import { JournalReversalPeriodError } from '../journal/journal-reversal-errors';
import { FirestoreAccountingRepository } from '../repository/firestore-accounting-repository';

const fake = new FakeFirestore();

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

const A = { companyId: 'comp_a', userId: 'user_a' } as const;
const B = { companyId: 'comp_b', userId: 'user_b' } as const;
const JOURNAL = COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES;
const AUDIT = COLLECTIONS.ACCOUNTING_AUDIT_LOG;
const TODAY = '2026-11-07';

const repoOf = (tenant: typeof A | typeof B) => new FirestoreAccountingRepository(tenant);

function entryOf(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    entryId: 'je_orig',
    date: '2026-03-10',
    type: 'expense',
    category: 'efka',
    description: 'ΕΦΚΑ Μαρτίου',
    netAmount: 10,
    vatRate: 0,
    vatAmount: 0,
    grossAmount: 10,
    vatDeductible: false,
    paymentMethod: 'bank_transfer',
    contactId: null,
    contactName: null,
    invoiceId: null,
    mydataCode: 'category2_12',
    e3Code: '585_005',
    fiscalYear: 2026,
    quarter: 1,
    notes: 'δοκιμή επαλήθευσης',
    status: 'ACTIVE',
    companyId: A.companyId,
    createdBy: A.userId,
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: '2026-03-10T10:00:00.000Z',
    ...overrides,
  } as JournalEntry;
}

function requestOf(overrides: Partial<JournalReversalRequest> = {}): JournalReversalRequest {
  return {
    entryId: 'je_orig',
    trigger: 'manual',
    datePolicy: 'original_period_if_open',
    reasonCode: 'ENTRY_ERROR',
    reasonNotes: null,
    today: TODAY,
    ...overrides,
  };
}

const seedEntry = (entry: JournalEntry) => fake.seed(JOURNAL, entry.entryId, entry as unknown as Record<string, unknown>);
const stored = (id: string) => fake.getData(JOURNAL, id) as JournalEntry | undefined;
const reversalIdOf = (id: string) => generateDeterministicJournalReversalEntryId(id);

async function closePeriod(key: string) {
  await repoOf(A).transitionFiscalPeriod(key, { action: 'close', userId: A.userId, reason: null });
}

beforeEach(async () => {
  fake.reset();
  await createFiscalYear(repoOf(A), 2026);
});

describe('Α1 — storno: ίδια πεδία, αντίθετα ποσά, μία συναλλαγή', () => {
  it('γράφει την αντιλογιστική, σημαδεύει την αρχική, αφήνει ίχνος — και η ΕΦΚΑ επιστρέφει στο 0', async () => {
    seedEntry(entryOf());

    const outcome = await repoOf(A).reverseJournalEntry(requestOf());

    const reversalId = reversalIdOf('je_orig');
    expect(outcome).toEqual({
      kind: 'reversed', originalEntryId: 'je_orig', reversalEntryId: reversalId, reversalDate: '2026-03-10', crossPeriod: false,
    });
    expect(stored(reversalId)).toMatchObject({
      date: '2026-03-10', type: 'expense', category: 'efka', description: 'ΕΦΚΑ Μαρτίου',
      netAmount: -10, vatAmount: 0, grossAmount: -10, isReversal: true, originalEntryId: 'je_orig',
      reversalTrigger: 'manual', cancellationReasonCode: 'ENTRY_ERROR', status: 'ACTIVE', companyId: A.companyId,
    });
    expect(stored('je_orig')).toMatchObject({ status: 'REVERSED', reversalEntryId: reversalId, reversedBy: A.userId });

    const events = fake.all<AccountingAuditEntry>(AUDIT).filter((e) => e.entityType === 'journal');
    expect(events.map((e) => [e.eventType, e.entityId])).toEqual(
      expect.arrayContaining([['JOURNAL_REVERSED', 'je_orig'], ['JOURNAL_CREATED', reversalId]]),
    );

    const both = [stored('je_orig'), stored(reversalId)] as JournalEntry[];
    expect(ledgerTaxTotals({ income: [], expense: both })).toEqual({ totalIncome: 0, totalExpenses: 0, efkaContributions: 0 });
  });
});

describe('Α2 — ιδεμπότητα', () => {
  it('δεύτερο αίτημα ⇒ `already_reversed` με το ΙΔΙΟ storno, καμία νέα εγγραφή', async () => {
    seedEntry(entryOf());
    await repoOf(A).reverseJournalEntry(requestOf());
    const before = Object.keys(fake.getAllDocs(JOURNAL)).length;

    const again = await repoOf(A).reverseJournalEntry(requestOf());

    expect(again).toEqual({ kind: 'already_reversed', originalEntryId: 'je_orig', reversalEntryId: reversalIdOf('je_orig') });
    expect(Object.keys(fake.getAllDocs(JOURNAL))).toHaveLength(before);
  });

  it('`REVERSED` χωρίς σύνδεσμο (παλιά δεδομένα) ⇒ αντιλογισμένη, ΠΟΤΕ δεύτερο storno', async () => {
    seedEntry(entryOf({ status: 'REVERSED' }));

    expect(await repoOf(A).reverseJournalEntry(requestOf())).toEqual({
      kind: 'already_reversed', originalEntryId: 'je_orig', reversalEntryId: null,
    });
    expect(stored(reversalIdOf('je_orig'))).toBeUndefined();
  });
});

describe('Α3 — αρνήσεις', () => {
  it.each([
    ['IS_REVERSAL', { isReversal: true, originalEntryId: 'je_x' }],
    ['SUBSYSTEM_OWNED', { category: 'depreciation' }],
    ['INVOICE_LINKED', { invoiceId: 'inv_1' }],
  ] as const)('%s ⇒ άρνηση από το βιβλίο, τίποτα δεν γράφεται', async (reason, overrides) => {
    seedEntry(entryOf(overrides as Partial<JournalEntry>));

    expect(await repoOf(A).reverseJournalEntry(requestOf())).toEqual({ kind: 'refused', reason });
    expect(stored(reversalIdOf('je_orig'))).toBeUndefined();
    expect(stored('je_orig')?.status).toBe('ACTIVE');
  });

  it('εγγραφή τιμολογίου ΑΝΤΙΛΟΓΙΖΕΤΑΙ από την ακύρωση του τιμολογίου (σήμερα)', async () => {
    seedEntry(entryOf({ invoiceId: 'inv_1' }));

    const outcome = await repoOf(A).reverseJournalEntry(requestOf({ trigger: 'invoice_cancellation', datePolicy: 'today' }));

    expect(outcome).toMatchObject({ kind: 'reversed', reversalDate: TODAY, crossPeriod: true });
  });

  it('DOCUMENT_LINKED: εγγραφή επιβεβαιωμένου παραστατικού ⇒ άρνηση (ακυρώνεται από το παραστατικό)', async () => {
    seedEntry(entryOf());
    fake.seed(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS, 'doc_1', { companyId: A.companyId, journalEntryId: 'je_orig' });

    expect(await repoOf(A).reverseJournalEntry(requestOf())).toEqual({ kind: 'refused', reason: 'DOCUMENT_LINKED' });
  });
});

describe('Α4 — μισθωτής', () => {
  it('ξένη εγγραφή = ανύπαρκτη, τίποτα δεν γράφεται', async () => {
    await createFiscalYear(repoOf(B), 2026);
    seedEntry(entryOf());

    expect(await repoOf(B).reverseJournalEntry(requestOf())).toEqual({ kind: 'not_found' });
    expect(stored('je_orig')?.status).toBe('ACTIVE');
    expect(stored(reversalIdOf('je_orig'))).toBeUndefined();
  });
});

describe('Α5 — ημερομηνία αντιλογισμού', () => {
  it('κλειστή η περίοδος της αρχικής ⇒ σήμερα, με σήμανση cross-period (SAP alternative posting date)', async () => {
    seedEntry(entryOf());
    await closePeriod('2026-03');

    const outcome = await repoOf(A).reverseJournalEntry(requestOf());

    expect(outcome).toMatchObject({ kind: 'reversed', reversalDate: TODAY, crossPeriod: true });
    expect(stored(reversalIdOf('je_orig'))).toMatchObject({
      date: TODAY, fiscalYear: 2026, quarter: 4, crossPeriodReversal: true, originalPeriod: 3, reversalPeriod: 11,
    });
  });

  it('καμία ανοιχτή ⇒ άρνηση με την περίοδο του ΣΗΜΕΡΑ, τίποτα δεν γράφεται', async () => {
    seedEntry(entryOf());
    await closePeriod('2026-03');
    await closePeriod('2026-11');

    const attempt = repoOf(A).reverseJournalEntry(requestOf());

    await expect(attempt).rejects.toBeInstanceOf(JournalReversalPeriodError);
    await expect(attempt).rejects.toMatchObject({ code: 'PERIOD_CLOSED', postingDate: TODAY });
    expect(stored('je_orig')?.status).toBe('ACTIVE');
    expect(stored(reversalIdOf('je_orig'))).toBeUndefined();
  });
});

describe('Π — καθαρή πολιτική', () => {
  it('υποψήφιες ημερομηνίες', () => {
    expect(reversalDateCandidates('original_period_if_open', '2026-03-10', TODAY)).toEqual(['2026-03-10', TODAY]);
    expect(reversalDateCandidates('original_period_if_open', TODAY, TODAY)).toEqual([TODAY]);
    expect(reversalDateCandidates('today', '2026-03-10', TODAY)).toEqual([TODAY]);
  });

  it('πληρότητα λόγου: `OTHER` θέλει σημείωση', () => {
    expect(isReversalReasonComplete('DUPLICATE', '')).toBe(true);
    expect(isReversalReasonComplete('OTHER', '   ')).toBe(false);
    expect(isReversalReasonComplete('OTHER', 'λάθος προμηθευτής')).toBe(true);
    expect(isReversalReasonComplete('', null)).toBe(false);
  });

  it('γενεαλογία στη δημιουργία', () => {
    expect(carriesLineageFields({ date: '2026-01-01', netAmount: 5 })).toBe(false);
    expect(carriesLineageFields({ isReversal: false })).toBe(true);
    expect(carriesLineageFields({ status: 'ACTIVE' })).toBe(true);
  });

  it('κωδικός άρνησης: ΕΝΑ σχήμα για διακομιστή και πελάτη', () => {
    expect(journalReversalRefusalOfErrorCode(journalReversalRefusalCode('DOCUMENT_LINKED'))).toBe('DOCUMENT_LINKED');
    expect(journalReversalRefusalOfErrorCode('JOURNAL_REVERSAL_NOPE')).toBeNull();
    expect(journalReversalRefusalOfErrorCode('PERIOD_CLOSED')).toBeNull();
  });
});
