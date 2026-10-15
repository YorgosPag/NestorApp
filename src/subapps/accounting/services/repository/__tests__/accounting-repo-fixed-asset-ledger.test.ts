/**
 * @jest-environment node
 *
 * Σάρωση παγίων για ΥΠΟΛΟΓΙΣΜΟ αποσβέσεων — `collectFixedAssets` (ADR-ACC-010 §2.1.1 Φάση 4).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: οι αποσβέσεις χρήσης διάβαζαν τη ΣΕΛΙΔΑ της οθόνης (50 ενεργά πάγια):
 *
 *   Σ1  ΟΛΑ τα πάγια, πέρα από το μέγεθος παρτίδας (cursor) — ποτέ κομμένο
 *   Σ2  εμβέλεια = «σε χρήση ως το τέλος της χρήσης», ΑΝΕΞΑΡΤΗΤΑ κατάστασης · μόνο ο μισθωτής
 *   Σ3  σφάλμα ανάγνωσης = ΣΦΑΛΜΑ, ποτέ κενή λίστα · ανώτατο όριο = σφάλμα, ποτέ κόψιμο
 *   Σ4  ο συντελεστής του νέου παγίου = της κατηγορίας (SSoT), ποτέ ό,τι στείλει ο πελάτης
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { BATCH_SIZE_READ } from '@/lib/admin-batch-utils';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

import type { CreateFixedAssetInput, FixedAsset } from '../../../types/assets';
import { ASSET_DEPRECIATION_RATES } from '../../config/depreciation-config';
import { collectFixedAssets } from '../accounting-repo-fixed-asset-ledger';
import { createFixedAsset } from '../accounting-repo-operations';
import { LedgerScanLimitError } from '../accounting-repo-scan';

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
const COLL = COLLECTIONS.ACCOUNTING_FIXED_ASSETS;
const YEAR_2025 = { scope: { kind: 'depreciationYear', fiscalYear: 2025 } } as const;

function doc(id: string, start: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { assetId: id, companyId: TENANT.companyId, status: 'active', depreciationStartDate: start, ...extra };
}

const ids = (rows: readonly FixedAsset[]) => rows.map((r) => r.assetId).sort();

beforeEach(() => {
  fake.reset();
});

describe('Σ1 — όλη η εμβέλεια, πέρα από την παρτίδα', () => {
  it('επιστρέφει ΚΑΘΕ πάγιο όταν είναι περισσότερα από μία παρτίδα', async () => {
    const total = BATCH_SIZE_READ * 2 + 3;
    const docs: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < total; i += 1) docs[`ast_${i}`] = doc(`ast_${i}`, `2025-${String((i % 12) + 1).padStart(2, '0')}-01`);
    fake.seedCollection(COLL, docs);

    const rows = await collectFixedAssets(TENANT, YEAR_2025);

    expect(rows).toHaveLength(total);
    expect(new Set(rows.map((r) => r.assetId)).size).toBe(total);
  });
});

describe('Σ2 — η εμβέλεια εφαρμόζεται', () => {
  beforeEach(() => {
    fake.seedCollection(COLL, {
      old: doc('old', '2019-05-01'),
      last_day: doc('last_day', '2025-12-31'),
      last_day_iso: doc('last_day_iso', '2025-12-31T15:00:00.000Z'),
      next_year: doc('next_year', '2026-01-01'),
      disposed: doc('disposed', '2020-01-01', { status: 'disposed', disposalDate: '2025-06-30' }),
      fully: doc('fully', '2010-01-01', { status: 'fully_depreciated' }),
      foreign: doc('foreign', '2024-01-01', { companyId: 'comp_b' }),
    });
  });

  it('ως και 31/12 (και πλήρες ISO της ημέρας), κάθε κατάσταση, μόνο ο μισθωτής', async () => {
    expect(ids(await collectFixedAssets(TENANT, YEAR_2025))).toEqual(['disposed', 'fully', 'last_day', 'last_day_iso', 'old']);
  });

  it('άκυρη χρήση ⇒ σφάλμα πριν από τη βάση', async () => {
    await expect(collectFixedAssets(TENANT, { scope: { kind: 'depreciationYear', fiscalYear: 2025.5 } })).rejects.toThrow(/fiscalYear/);
  });
});

describe('Σ3 — σφάλμα ≠ κενό, όριο ≠ κόψιμο', () => {
  it('σφάλμα ανάγνωσης ⇒ σφάλμα', async () => {
    fake.seedCollection(COLL, { a: doc('a', '2024-01-01') });
    fake.failReads = true;

    await expect(collectFixedAssets(TENANT, YEAR_2025)).rejects.toThrow();
  });

  it('πάνω από το όριο ⇒ `LedgerScanLimitError`', async () => {
    fake.seedCollection(COLL, { a: doc('a', '2024-01-01'), b: doc('b', '2024-02-01'), c: doc('c', '2024-03-01') });

    await expect(collectFixedAssets(TENANT, YEAR_2025, 2)).rejects.toBeInstanceOf(LedgerScanLimitError);
  });
});

describe('Σ4 — ο συντελεστής τον αποφασίζει ο διακομιστής', () => {
  it('Η/Υ με «99%» από τον πελάτη ⇒ αποθηκεύεται ο συντελεστής της κατηγορίας, καμία καταχώριση ακόμη', async () => {
    const input = {
      description: 'laptop', category: 'computers', status: 'active', acquisitionCost: 1000, residualValue: 0,
      acquisitionDate: '2026-03-15', depreciationStartDate: '2026-03-15', depreciationMethod: 'straight_line',
      usefulLifeYears: 5, purchaseInvoiceNumber: null, supplierName: null, supplierVatNumber: null, notes: null,
      acquisitionFiscalYear: 2026, depreciationRate: 99,
    } as CreateFixedAssetInput;

    const { id } = await createFixedAsset(TENANT, input);

    expect(fake.getData(COLL, id)).toMatchObject({
      depreciationRate: ASSET_DEPRECIATION_RATES.computers, lastDepreciatedFiscalYear: null, accumulatedDepreciation: 0,
    });
  });
});
