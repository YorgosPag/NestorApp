/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΑ ΙΣΟΤΙΜΙΑΣ «ερώτημα ⇄ δείκτης» — σάρωση παγίων για αποσβέσεις χρήσης (ADR-ACC-010 §2.1.1, Φάση 4).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: η σάρωση περνά από το `processAdminBatch`, άρα το CHECK 3.91 ΔΕΝ τη βλέπει. Χωρίς δείκτη η εκτέλεση
 * αποσβέσεων θα έσκαγε `FAILED_PRECONDITION` στην παραγωγή. Η άγκυρα ΕΚΤΕΛΕΙ τον πραγματικό κατασκευαστή.
 */

import type { Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { indexesForShape, readCompositeIndexes, recordQueryShape } from '@/test-utils/firestore-indexes';

import { buildFixedAssetLedgerQuery, FIXED_ASSET_LEDGER_RANGE_FIELD } from '../accounting-repo-fixed-asset-ledger';

const INDEXES = readCompositeIndexes();

describe('Δ — η σάρωση παγίων έχει δείκτη', () => {
  const shape = recordQueryShape<Query>((recorder) =>
    buildFixedAssetLedgerQuery(recorder, 'comp_a', { scope: { kind: 'depreciationYear', fiscalYear: 2025 } }));

  it('Δ-1 μισθωτής + εύρος έναρξης χρήσης ⇒ δείκτης', () => {
    expect(shape.equality).toEqual(['companyId']);
    expect(indexesForShape(INDEXES, COLLECTIONS.ACCOUNTING_FIXED_ASSETS, shape).length).toBeGreaterThanOrEqual(1);
  });

  it('Δ-2 το παλιό σχήμα «σελίδα ενεργών» δεν είναι αυτό — η σάρωση δεν φιλτράρει κατάσταση', () => {
    expect(shape.equality).not.toContain('status');
  });
});

describe('Ο — όριο χρήσης', () => {
  function upperBoundOf(fiscalYear: number): unknown {
    let bound: unknown;
    const recorder = {
      where(field: string, _op: string, value: unknown) {
        if (field === FIXED_ASSET_LEDGER_RANGE_FIELD) bound = value;
        return recorder;
      },
      orderBy: () => recorder,
    };
    buildFixedAssetLedgerQuery(recorder as unknown as Query, 'c', { scope: { kind: 'depreciationYear', fiscalYear } });
    return bound;
  }

  it('Ο-1 αποκλειστικό όριο = 1/1 της επόμενης χρήσης', () => {
    expect(upperBoundOf(2025)).toBe('2026-01-01');
  });

  it('Ο-2 άκυρη χρήση ⇒ σφάλμα, όχι σιωπηλά λάθος εύρος', () => {
    expect(() => upperBoundOf(Number.NaN)).toThrow(/fiscalYear/);
    expect(() => upperBoundOf(25)).toThrow(/fiscalYear/);
  });
});
