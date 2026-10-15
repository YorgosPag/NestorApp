/**
 * @jest-environment node
 *
 * Εκτέλεση αποσβέσεων χρήσης ΑΠΟ ΑΚΡΗ ΣΕ ΑΚΡΗ — μηχανή + πραγματικό repository (audited) πάνω στο verified fake
 * Firestore (ADR-ACC-010 §2.1.1 Φάση 4). Κάθε ομάδα κλειδώνει ένα από τα σφάλματα που βρέθηκαν:
 *
 *   Ε1  ΟΛΑ τα πάγια (120 > σελίδα των 50) — όχι τα 50 νεότερα ενεργά
 *   Ε2  ιδεμπότητα: η επανεκτέλεση δεν διπλασιάζει τίποτα (εγγραφές, προβολή, ίχνος)
 *   Ε3  ποια συμμετέχουν: εκποιημένο μέσα στη χρήση ναι · inactive / μελλοντικό / ξένος μισθωτής όχι
 *   Ε4  σειρά: παλιά χρήση μετά από νεότερη = ίδια ποσά, η προβολή δεν γυρίζει πίσω
 *   Ε5  διακοπείσα εκτέλεση: η επανεκτέλεση ολοκληρώνει ό,τι έμεινε
 *   Ε6  ατομικότητα / ανταγωνισμός: εγγραφή + πάγιο + ίχνος μαζί ή καθόλου
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicDepreciationRecordId } from '@/services/enterprise-id.service';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

import type { DepreciationRecord, FixedAsset } from '../../../types/assets';
import type { AccountingAuditEntry } from '../../../types/accounting-audit';
import type { IAccountingRepository } from '../../../types/interfaces';
import { createAuditedRepository } from '../../audited-repository-wrapper';
import { FirestoreAccountingRepository } from '../../repository/firestore-accounting-repository';
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

function repository(): IAccountingRepository {
  return createAuditedRepository(new FirestoreAccountingRepository(TENANT), TENANT.userId, TENANT.companyId);
}

const engineOn = (repo: IAccountingRepository = repository()) => new DepreciationEngine(repo, () => '2027-03-01');
const records = () => fake.all<DepreciationRecord>(RECORDS);
const audits = () => fake.all<AccountingAuditEntry>(AUDIT).filter((e) => e.eventType === 'DEPRECIATION_POSTED');
const stored = (id: string) => fake.getData(ASSETS, id) as unknown as FixedAsset;

beforeEach(() => {
  fake.reset();
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
  it('δεύτερη εκτέλεση: 0 νέες εγγραφές, ίδιο σύνολο, το πάγιο δεν ξαναχρεώνεται, κανένα νέο ίχνος', async () => {
    seedAssets([asset('ast_a'), asset('ast_b')]);
    const first = await engineOn().bookDepreciations(2025);
    const afterFirst = { asset: stored('ast_a'), audits: audits().length };

    const second = await engineOn().bookDepreciations(2025);

    expect(first.posted).toHaveLength(2);
    expect([second.posted.length, second.alreadyPosted.length]).toEqual([0, 2]);
    expect(second.totalDepreciation).toBe(first.totalDepreciation);
    expect(records()).toHaveLength(2);
    expect(stored('ast_a')).toEqual(afterFirst.asset);
    expect(stored('ast_a').accumulatedDepreciation).toBe(1200);
    expect(audits()).toHaveLength(afterFirst.audits);
  });

  it('ένα ίχνος ελέγχου ανά καταχώριση, με τον χρήστη και το ποσό', async () => {
    seedAssets([asset('ast_a')]);
    await engineOn().bookDepreciations(2025);

    expect(audits()).toHaveLength(1);
    expect(audits()[0]).toMatchObject({
      entityType: 'fixed_asset', entityId: 'ast_a', userId: TENANT.userId, companyId: TENANT.companyId,
      metadata: { fiscalYear: 2025, annualDepreciation: 1200 },
    });
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

    const byAsset = Object.fromEntries(result.posted.map((r) => [r.assetId, r.annualDepreciation]));
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

    expect([y2025.posted[0].annualDepreciation, y2026.posted[0].annualDepreciation]).toEqual([1200, 1200]);
    expect(y2026.posted[0].openingAccumulatedDepreciation).toBe(1200);
    expect(stored('ast_a')).toMatchObject({ accumulatedDepreciation: 2400, netBookValue: 9600, lastDepreciatedFiscalYear: 2026 });
  });
});

describe('Ε5 — διακοπείσα εκτέλεση', () => {
  it('σφάλμα μετά από 10 καταχωρίσεις ⇒ η επανεκτέλεση γράφει τις υπόλοιπες 20 και δίνει το ΠΛΗΡΕΣ σύνολο', async () => {
    seedAssets(Array.from({ length: 30 }, (_, i) => asset(`ast_${String(i).padStart(2, '0')}`)));
    const real = repository();
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

    expect([resumed.posted.length, resumed.alreadyPosted.length]).toEqual([20, 10]);
    expect(resumed.totalDepreciation).toBe(36000);
    expect(records()).toHaveLength(30);
  });
});

describe('Ε6 — ατομικότητα και ανταγωνισμός', () => {
  it('άλλη εκτέλεση έγραψε την ίδια εγγραφή ανάμεσα σε ανάγνωση και commit ⇒ `already_posted`, πάγιο ανέγγιχτο', async () => {
    seedAssets([asset('ast_a')]);
    const recordId = generateDeterministicDepreciationRecordId(TENANT.companyId, 'ast_a', 2025);
    fake.interfere = () => fake.write(RECORDS, recordId, { recordId, assetId: 'ast_a', fiscalYear: 2025, annualDepreciation: 1200 });

    const result = await engineOn().bookDepreciations(2025);

    expect([result.posted.length, result.alreadyPosted.length]).toEqual([0, 1]);
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
