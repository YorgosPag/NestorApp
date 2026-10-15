/**
 * @jest-environment node
 *
 * Εκτέλεση αποσβέσεων χρήσης ΑΠΟ ΑΚΡΗ ΣΕ ΑΚΡΗ — μηχανή + πραγματικό repository πάνω στο verified fake Firestore
 * (ADR-ACC-010 §2.1.1 Φάσεις 4–5). Κάθε ομάδα κλειδώνει ένα από τα σφάλματα που βρέθηκαν:
 *
 *   Ε1  ΟΛΑ τα πάγια (120 > σελίδα των 50) — όχι τα 50 νεότερα ενεργά
 *   Ε2  ιδεμπότητα: η επανεκτέλεση δεν διπλασιάζει τίποτα (εγγραφές, βιβλίο, προβολή, ίχνος)
 *   Ε3  ποια συμμετέχουν: εκποιημένο μέσα στη χρήση ναι · inactive / μελλοντικό / ξένος μισθωτής όχι
 *   Ε4  σειρά: παλιά χρήση μετά από νεότερη = ίδια ποσά, η προβολή δεν γυρίζει πίσω
 *   Ε5  διακοπείσα εκτέλεση: η επανεκτέλεση ολοκληρώνει ό,τι έμεινε
 *   Ε6  ατομικότητα / ανταγωνισμός: εγγραφή + βιβλίο + πάγιο + ίχνος μαζί ή καθόλου
 *   Ε7  Φ5: οι αποσβέσεις ΦΤΑΝΟΥΝ στο Βιβλίο Ε-Ε — ό,τι διαβάζουν φόρος / P&L (`loadLedger`)
 *   Ε8  Φ5: SAP repeat run — διορθωμένο πάγιο ⇒ ΝΕΑ εγγραφή διαφοράς, η παλιά ανέγγιχτη
 *   Ε9  Φ5: Xero rollback — αντιλογισμός, μόνο νεότερη χρήση, ξανά-καταχώριση χωρίς διπλό
 *   Ε10 Φ5: περίοδος Δεκεμβρίου κλειστή (και ΚΑΤΑ τη διάρκεια της εκτέλεσης) ⇒ τίποτα στο βιβλίο
 *   Ε11 Φ5: το ίχνος το γράφει Ο ΓΡΑΦΕΑΣ — και χωρίς τον audited wrapper (έτσι καλούν τα routes)
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicDepreciationRecordId } from '@/services/enterprise-id.service';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

import type { DepreciationRecord, FixedAsset } from '../../../types/assets';
import type { AccountingAuditEntry } from '../../../types/accounting-audit';
import type { IAccountingRepository } from '../../../types/interfaces';
import type { JournalEntry } from '../../../types/journal';
import { createAuditedRepository } from '../../audited-repository-wrapper';
import { loadLedger } from '../../journal/journal-ledger';
import { FirestoreAccountingRepository } from '../../repository/firestore-accounting-repository';
import { DepreciationPeriodClosedError } from '../../repository/accounting-repo-depreciation';
import { DepreciationEngine } from '../depreciation-engine';

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

const TENANT = { companyId: 'comp_a', userId: 'user_a' } as const;
const ASSETS = COLLECTIONS.ACCOUNTING_FIXED_ASSETS;
const RECORDS = COLLECTIONS.ACCOUNTING_DEPRECIATION_RECORDS;
const JOURNAL = COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES;
const PERIODS = COLLECTIONS.ACCOUNTING_FISCAL_PERIODS;
const AUDIT = COLLECTIONS.ACCOUNTING_AUDIT_LOG;

function asset(id: string, overrides: Partial<FixedAsset> = {}): FixedAsset {
  return {
    assetId: id, description: id, category: 'machinery', status: 'active', companyId: TENANT.companyId,
    acquisitionCost: 12000, accumulatedDepreciation: 0, netBookValue: 12000, residualValue: 0,
    acquisitionDate: '2024-12-10', depreciationStartDate: '2024-12-10', fullyDepreciatedDate: null, disposalDate: null,
    depreciationRate: 10, depreciationMethod: 'straight_line', usefulLifeYears: 10, lastDepreciatedFiscalYear: null,
    purchaseInvoiceNumber: null, supplierName: null, supplierVatNumber: null, notes: null, acquisitionFiscalYear: 2024,
    createdAt: '2024-12-10T00:00:00.000Z', updatedAt: '2024-12-10T00:00:00.000Z',
    ...overrides,
  };
}

function seedAssets(list: readonly FixedAsset[]): void {
  fake.seedCollection(ASSETS, Object.fromEntries(list.map((a) => [a.assetId, { ...a }])));
}

function seedPeriods(status: 'OPEN' | 'CLOSED' | 'LOCKED' = 'OPEN'): void {
  fake.seedCollection(PERIODS, Object.fromEntries([2025, 2026].map((year) =>
    [`${year}-12`, { periodId: `${year}-12`, fiscalYear: year, status }])));
}

function auditedRepository(): IAccountingRepository {
  return createAuditedRepository(new FirestoreAccountingRepository(TENANT), TENANT.userId, TENANT.companyId);
}

const engineOn = (repo: IAccountingRepository = auditedRepository()) => new DepreciationEngine(repo, () => '2027-03-01');
const records = () => fake.all<DepreciationRecord>(RECORDS);
const journal = () => fake.all<JournalEntry>(JOURNAL);
const audits = (eventType = 'DEPRECIATION_POSTED') =>
  fake.all<AccountingAuditEntry>(AUDIT).filter((e) => e.eventType === eventType);
const stored = (id: string) => fake.getData(ASSETS, id) as unknown as FixedAsset;
const expenseOf = async (fiscalYear: number) =>
  (await loadLedger(new FirestoreAccountingRepository(TENANT), { kind: 'fiscalYear', fiscalYear })).totalExpenseNet;

beforeEach(() => {
  fake.reset();
  seedPeriods();
});

describe('Ε1 — όλα τα πάγια, όχι η σελίδα', () => {
  it('120 ενεργά πάγια ⇒ 120 εγγραφές × 1.200 € = 144.000 €', async () => {
    seedAssets(Array.from({ length: 120 }, (_, i) => asset(`ast_${String(i).padStart(3, '0')}`)));

    const result = await engineOn().bookDepreciations(2025);

    expect(result.posted).toHaveLength(120);
    expect(records()).toHaveLength(120);
    expect(result.totalDepreciation).toBe(144000);
  });
});

describe('Ε2 — ιδεμπότητα', () => {
  it('δεύτερη εκτέλεση: 0 νέες εγγραφές / έξοδα, ίδιο σύνολο, το πάγιο δεν ξαναχρεώνεται, κανένα νέο ίχνος', async () => {
    seedAssets([asset('ast_a'), asset('ast_b')]);
    const first = await engineOn().bookDepreciations(2025);
    const afterFirst = { asset: stored('ast_a'), audits: audits().length, journal: journal().length };

    const second = await engineOn().bookDepreciations(2025);

    expect(first.posted).toHaveLength(2);
    expect([second.posted.length, second.adjusted.length, second.unchanged.length]).toEqual([0, 0, 2]);
    expect([second.totalDepreciation, second.bookedDelta]).toEqual([first.totalDepreciation, 0]);
    expect(records()).toHaveLength(2);
    expect(journal()).toHaveLength(afterFirst.journal);
    expect(stored('ast_a')).toEqual(afterFirst.asset);
    expect(stored('ast_a').accumulatedDepreciation).toBe(1200);
    expect(audits()).toHaveLength(afterFirst.audits);
  });
});

describe('Ε3 — ποια πάγια συμμετέχουν', () => {
  beforeEach(() => {
    seedAssets([
      asset('ast_active'),
      asset('ast_disposed', { status: 'disposed', disposalDate: '2025-06-30' }),
      asset('ast_inactive', { status: 'inactive' }),
      asset('ast_future', { depreciationStartDate: '2026-02-01' }),
      asset('ast_foreign', { companyId: 'comp_b' }),
    ]);
  });

  it('εκποιημένο μέσα στη χρήση: 6 μήνες = 600 € και μένει `disposed`· τα άλλα τρία απέξω', async () => {
    const result = await engineOn().bookDepreciations(2025);

    const byAsset = Object.fromEntries(result.posted.map((c) => [c.record.assetId, c.record.annualDepreciation]));
    expect(byAsset).toEqual({ ast_active: 1200, ast_disposed: 600 });
    expect(stored('ast_disposed').status).toBe('disposed');
    expect(stored('ast_foreign').accumulatedDepreciation).toBe(0);
  });
});

describe('Ε4 — σειρά εκτέλεσης', () => {
  it('2026 πριν από 2025 = ίδια ποσά με τη σωστή σειρά· η προβολή μένει στο κλείσιμο του 2026', async () => {
    seedAssets([asset('ast_a')]);
    const engine = engineOn();

    const y2026 = await engine.bookDepreciations(2026);
    const y2025 = await engine.bookDepreciations(2025);

    expect([y2025.posted[0].record.annualDepreciation, y2026.posted[0].record.annualDepreciation]).toEqual([1200, 1200]);
    expect(y2026.posted[0].record.openingAccumulatedDepreciation).toBe(1200);
    expect(stored('ast_a')).toMatchObject({
      accumulatedDepreciation: 2400, netBookValue: 9600, lastDepreciatedFiscalYear: 2026, depreciatedFiscalYears: [2025, 2026],
    });
  });
});

describe('Ε5 — διακοπείσα εκτέλεση', () => {
  it('σφάλμα μετά από 10 καταχωρίσεις ⇒ η επανεκτέλεση γράφει τις υπόλοιπες 20 και δίνει το ΠΛΗΡΕΣ σύνολο', async () => {
    seedAssets(Array.from({ length: 30 }, (_, i) => asset(`ast_${String(i).padStart(2, '0')}`)));
    const real = auditedRepository();
    let calls = 0;
    const flaky: IAccountingRepository = {
      ...real,
      postDepreciation: (request) => {
        calls += 1;
        return calls > 10 ? Promise.reject(new Error('UNAVAILABLE')) : real.postDepreciation(request);
      },
    };

    await expect(engineOn(flaky).bookDepreciations(2025)).rejects.toThrow('UNAVAILABLE');
    const resumed = await engineOn().bookDepreciations(2025);

    expect([resumed.posted.length, resumed.unchanged.length]).toEqual([20, 10]);
    expect(resumed.totalDepreciation).toBe(36000);
    expect(records()).toHaveLength(30);
    expect(journal()).toHaveLength(30);
    expect(await expenseOf(2025)).toBe(36000);
  });
});

describe('Ε6 — ατομικότητα και ανταγωνισμός', () => {
  it('άλλη εκτέλεση πέρασε το ΣΩΣΤΟ ποσό ανάμεσα σε ανάγνωση και commit ⇒ καμία δεύτερη εγγραφή', async () => {
    seedAssets([asset('ast_a')]);
    const recordId = generateDeterministicDepreciationRecordId(TENANT.companyId, 'ast_a', 2025);
    fake.interfere = () => fake.write(RECORDS, recordId, { recordId, assetId: 'ast_a', fiscalYear: 2025, annualDepreciation: 1200 });

    const result = await engineOn().bookDepreciations(2025);

    expect([result.posted.length, result.unchanged.length]).toEqual([0, 1]);
    expect(journal()).toHaveLength(0);
    expect(stored('ast_a').accumulatedDepreciation).toBe(0);
    expect(audits()).toHaveLength(0);
  });

  it('σφάλμα ανάγνωσης ⇒ σφάλμα, καμία εγγραφή', async () => {
    seedAssets([asset('ast_a')]);
    fake.failReads = true;

    await expect(engineOn().bookDepreciations(2025)).rejects.toThrow();
    expect(fake.writeLog()).toEqual([]);
  });

  it('το id εγγραφής είναι ντετερμινιστικό ανά (μισθωτής, πάγιο, χρήση)', async () => {
    seedAssets([asset('ast_a')]);
    await engineOn().bookDepreciations(2025);

    const id = generateDeterministicDepreciationRecordId(TENANT.companyId, 'ast_a', 2025);
    expect(records().map((r) => r.recordId)).toEqual([id]);
    expect(generateDeterministicDepreciationRecordId('comp_b', 'ast_a', 2025)).not.toBe(id);
    expect(generateDeterministicDepreciationRecordId(TENANT.companyId, 'ast_a', 2026)).not.toBe(id);
  });
});

describe('Ε7 — οι αποσβέσεις φτάνουν στο Βιβλίο Ε-Ε', () => {
  it('μία εγγραφή Ε-Ε ανά πάγιο, συνδεδεμένη και στις δύο κατευθύνσεις· το καθολικό του φόρου τη βλέπει', async () => {
    seedAssets([asset('ast_a'), asset('ast_b', { acquisitionCost: 6000 })]);
    await engineOn().bookDepreciations(2025);

    const entries = journal();
    expect(entries).toHaveLength(2);
    for (const record of records()) {
      const entry = entries.find((e) => e.entryId === record.journalEntryId);
      expect(entry).toMatchObject({
        companyId: TENANT.companyId, date: '2025-12-31', category: 'depreciation', status: 'ACTIVE',
        netAmount: record.annualDepreciation, source: { kind: 'depreciation', depreciationRecordId: record.recordId, revision: 1 },
      });
    }
    expect(await expenseOf(2025)).toBe(1800);
  });
});

describe('Ε8 — SAP repeat run: μόνο η διαφορά', () => {
  it('διορθώθηκε το κόστος 12.000 → 15.000 ⇒ ΝΕΑ εγγραφή +300, η πρώτη ανέγγιχτη, σύνολο 1.500', async () => {
    seedAssets([asset('ast_a')]);
    await engineOn().bookDepreciations(2025);
    const [firstEntry] = journal();
    fake.write(ASSETS, 'ast_a', { ...stored('ast_a'), acquisitionCost: 15000 });

    const rerun = await engineOn().bookDepreciations(2025);

    expect(rerun.adjusted.map((c) => c.delta)).toEqual([300]);
    expect(journal()).toHaveLength(2);
    expect(journal().find((e) => e.entryId === firstEntry.entryId)).toEqual(firstEntry);
    expect(records()[0]).toMatchObject({ annualDepreciation: 1500, revision: 2 });
    expect(records()[0].journalEntryIds).toHaveLength(2);
    expect(await expenseOf(2025)).toBe(1500);
    expect(audits('DEPRECIATION_ADJUSTED')).toHaveLength(1);
  });
});

describe('Ε9 — Xero rollback', () => {
  it('αναίρεση ⇒ αντιλογιστική εγγραφή, η αρχική μένει, έξοδα 0, πάγιο ως καινούργιο· δεύτερη αναίρεση = τίποτα', async () => {
    seedAssets([asset('ast_a')]);
    await engineOn().bookDepreciations(2025);
    const [original] = journal();

    const reversal = await engineOn().reverseDepreciations(2025);
    const again = await engineOn().reverseDepreciations(2025);

    expect(reversal.adjusted.map((c) => c.delta)).toEqual([-1200]);
    expect(journal()).toHaveLength(2);
    expect(journal().find((e) => e.entryId === original.entryId)).toEqual(original);
    expect(await expenseOf(2025)).toBe(0);
    expect(stored('ast_a')).toMatchObject({ accumulatedDepreciation: 0, netBookValue: 12000, lastDepreciatedFiscalYear: null });
    expect([again.adjusted.length, again.bookedDelta]).toEqual([0, 0]);
    expect(audits('DEPRECIATION_REVERSED')).toHaveLength(1);
  });

  it('ξανά-καταχώριση μετά την αναίρεση ⇒ τρίτη εγγραφή, έξοδα πάλι 1.200 — ποτέ 2.400', async () => {
    seedAssets([asset('ast_a')]);
    await engineOn().bookDepreciations(2025);
    await engineOn().reverseDepreciations(2025);

    await engineOn().bookDepreciations(2025);

    expect(journal()).toHaveLength(3);
    expect(await expenseOf(2025)).toBe(1200);
    expect(records()[0].revision).toBe(3);
  });

  it('καταχωρημένο 2026 ⇒ η αναίρεση του 2025 αρνείται, τίποτα δεν αλλάζει', async () => {
    seedAssets([asset('ast_a')]);
    await engineOn().bookDepreciations(2025);
    await engineOn().bookDepreciations(2026);
    const before = journal().length;

    const result = await engineOn().reverseDepreciations(2025);

    expect(result.refused).toEqual([{ assetId: 'ast_a', reason: 'LATER_YEAR_POSTED' }]);
    expect(journal()).toHaveLength(before);
  });
});

describe('Ε10 — κλειστή περίοδος', () => {
  it.each(['CLOSED', 'LOCKED'] as const)('περίοδος %s ⇒ άρνηση, καμία εγγραφή', async (status) => {
    seedAssets([asset('ast_a')]);
    seedPeriods(status);

    await expect(engineOn().bookDepreciations(2025)).rejects.toMatchObject({ code: 'PERIOD_NOT_OPEN' });
    expect(fake.writeLog()).toEqual([]);
  });

  it('η περίοδος έκλεισε ΚΑΤΑ τη διάρκεια της εκτέλεσης ⇒ η συναλλαγή αρνείται, τίποτα στο βιβλίο', async () => {
    seedAssets([asset('ast_a')]);
    fake.interfere = () => fake.write(PERIODS, '2025-12', { periodId: '2025-12', fiscalYear: 2025, status: 'CLOSED' });

    await expect(engineOn().bookDepreciations(2025)).rejects.toBeInstanceOf(DepreciationPeriodClosedError);
    expect([records().length, journal().length, audits().length]).toEqual([0, 0, 0]);
    expect(stored('ast_a').accumulatedDepreciation).toBe(0);
  });
});

describe('Ε11 — το ίχνος το γράφει ο γραφέας', () => {
  it('χωρίς audited wrapper (όπως τα routes): ίχνος παγίου + ίχνος εγγραφής Ε-Ε, στην ίδια συναλλαγή', async () => {
    seedAssets([asset('ast_a')]);
    await engineOn(new FirestoreAccountingRepository(TENANT)).bookDepreciations(2025);

    expect(audits()).toHaveLength(1);
    expect(audits()[0]).toMatchObject({
      entityType: 'fixed_asset', entityId: 'ast_a', userId: TENANT.userId, companyId: TENANT.companyId,
      metadata: { fiscalYear: 2025, annualDepreciation: 1200, delta: 1200, journalEntryId: journal()[0].entryId },
    });
    expect(audits('JOURNAL_CREATED').map((e) => e.entityId)).toEqual([journal()[0].entryId]);
  });

  it('με audited wrapper: ΕΝΑ ίχνος, όχι δύο', async () => {
    seedAssets([asset('ast_a')]);
    await engineOn().bookDepreciations(2025);

    expect([audits().length, audits('JOURNAL_CREATED').length]).toEqual([1, 1]);
  });
});
