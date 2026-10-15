/**
 * @fileoverview DepreciationEngine — Comprehensive Jest Test Suite
 * @description Ετήσια απόσβεση (από τον πίνακα αποσβέσεων), καταχώριση, εκποίηση, πρόβλεψη, άρνηση εκτέλεσης
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-31
 * @modified 2026-10-15 — ADR-ACC-010 §2.1.1 Φάση 4: έναρξη τον ΕΠΟΜΕΝΟ μήνα (ΚΦΕ αρ.24 παρ.6), υπόλοιπο αρχής από
 *   τον πίνακα, καταχώριση μέσω `postDepreciation`. Η πλήρης εκτέλεση πάνω σε Firestore: `depreciation-run.test.ts`.
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, Google Presubmit Pattern
 */

import { DepreciationEngine, DepreciationRunError, depreciationPostingFor } from '../depreciation-engine';
import type { FixedAsset } from '../../../types/assets';
import type { IAccountingRepository } from '../../../types/interfaces';
import { roundToTwo } from '../../../utils/math';

// ============================================================================
// MOCK HELPERS
// ============================================================================

/**
 * Πάγιο με λογικές προεπιλογές. Έναρξη χρήσης 10/12/2024 ⇒ πρώτος μήνας απόσβεσης Ιανουάριος 2025 ⇒ η χρήση 2025
 * είναι πλήρης (12 μήνες), ώστε τα παραδείγματα να είναι στρογγυλά.
 */
function createMockAsset(overrides: Partial<FixedAsset> = {}): FixedAsset {
  return {
    assetId: 'ast_test_001',
    description: 'Μηχάνημα Κοπής CNC',
    category: 'machinery',
    status: 'active',
    acquisitionCost: 10000,
    accumulatedDepreciation: 0,
    netBookValue: 10000,
    residualValue: 0,
    acquisitionDate: '2024-12-10',
    depreciationStartDate: '2024-12-10',
    fullyDepreciatedDate: null,
    disposalDate: null,
    depreciationRate: 10,
    depreciationMethod: 'straight_line',
    usefulLifeYears: 10,
    purchaseInvoiceNumber: 'INV-2024-001',
    supplierName: 'ABC Μηχανήματα ΑΕ',
    supplierVatNumber: '123456789',
    notes: null,
    acquisitionFiscalYear: 2024,
    createdAt: '2024-12-10T00:00:00.000Z',
    updatedAt: '2024-12-10T00:00:00.000Z',
    ...overrides,
  };
}

/** Μόνο ό,τι αγγίζει η μηχανή — αν αγγίξει κάτι άλλο, το test σκάει αντί να περάσει σιωπηλά. */
function createMockRepository() {
  return {
    collectFixedAssets: jest.fn<Promise<FixedAsset[]>, Parameters<IAccountingRepository['collectFixedAssets']>>(),
    postDepreciation: jest.fn<ReturnType<IAccountingRepository['postDepreciation']>, Parameters<IAccountingRepository['postDepreciation']>>(),
  };
}

const TODAY = '2026-10-15';

// ============================================================================
// TEST SUITES
// ============================================================================

describe('DepreciationEngine', () => {
  let engine: DepreciationEngine;
  let mockRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockRepo = createMockRepository();
    engine = new DepreciationEngine(mockRepo as unknown as IAccountingRepository, () => TODAY);
  });

  // ==========================================================================
  // A.1 — calculateAnnualDepreciation
  // ==========================================================================

  describe('calculateAnnualDepreciation', () => {
    it.each([
      ['μηχανήματα 10%', 'machinery', 10000, 10, 1000],
      ['κτίρια 4%', 'buildings', 100000, 4, 4000],
      ['οχήματα 16%', 'vehicles', 25000, 16, 4000],
      ['Η/Υ 20%', 'computers', 5000, 20, 1000],
    ] as const)('πλήρης χρήση — %s', (_label, category, cost, rate, expected) => {
      const result = engine.calculateAnnualDepreciation(
        createMockAsset({ category, acquisitionCost: cost, depreciationRate: rate }), 2025);

      expect(result.annualDepreciation).toBe(expected);
      expect(result.monthsApplied).toBe(12);
      expect(result.closingNetBookValue).toBe(cost - expected);
      expect(result.appliedRate).toBe(rate);
      expect(result.fiscalYear).toBe(2025);
    });

    it.each([
      ['Ιούλιος ⇒ Αύγ–Δεκ = 5 μήνες', '2025-07-01', 10000, 5, 416.67],
      ['Οκτώβριος ⇒ Νοέ–Δεκ = 2 μήνες', '2025-10-01', 12000, 2, 200],
      ['Νοέμβριος ⇒ Δεκ = 1 μήνας', '2025-11-15', 12000, 1, 100],
      ['Δεκέμβριος ⇒ 0 μήνες', '2025-12-01', 12000, 0, 0],
    ] as const)('pro-rata από τον ΕΠΟΜΕΝΟ μήνα (ΚΦΕ αρ.24 παρ.6) — %s', (_label, start, cost, months, expected) => {
      const result = engine.calculateAnnualDepreciation(
        createMockAsset({ acquisitionCost: cost, depreciationStartDate: start }), 2025);

      expect(result.monthsApplied).toBe(months);
      expect(result.annualDepreciation).toBe(expected);
    });

    it('🔴 το υπόλοιπο αρχής ΔΕΝ διαβάζεται από το μεταβλητό `accumulatedDepreciation` — βγαίνει από τον πίνακα', () => {
      // Ένα μπαγιάτικο / ήδη αυξημένο πεδίο δεν πρέπει να αλλάζει τίποτα (αλλιώς: διπλή απόσβεση στην επανεκτέλεση).
      const stale = createMockAsset({ depreciationStartDate: '2023-12-01', accumulatedDepreciation: 9999 });
      const result = engine.calculateAnnualDepreciation(stale, 2025);

      expect(result.openingAccumulatedDepreciation).toBe(1000);
      expect(result.annualDepreciation).toBe(1000);
      expect(result.closingAccumulatedDepreciation).toBe(2000);
    });

    it('πλαφόν: 6 πλήρεις χρήσεις οχήματος (24.000 / 25.000) ⇒ η 7η = 1.000', () => {
      const asset = createMockAsset({ acquisitionCost: 25000, depreciationRate: 16, depreciationStartDate: '2018-12-01' });
      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.annualDepreciation).toBe(1000);
      expect(result.closingNetBookValue).toBe(0);
    });

    it('υπολειμματική αξία: (10.000 − 2.000) × 10% = 800', () => {
      const result = engine.calculateAnnualDepreciation(createMockAsset({ residualValue: 2000 }), 2025);

      expect(result.annualDepreciation).toBe(800);
      expect(result.closingNetBookValue).toBe(9200);
    });

    it('εκποίηση 30/6 μέσα στη χρήση ⇒ 6 μήνες: 12.000 × 10% × 6/12 = 600', () => {
      const result = engine.calculateAnnualDepreciation(
        createMockAsset({ acquisitionCost: 12000, disposalDate: '2025-06-30', status: 'disposed' }), 2025);

      expect(result.monthsApplied).toBe(6);
      expect(result.annualDepreciation).toBe(600);
    });

    it('έναρξη μετά τη λήξη της χρήσης ⇒ 0', () => {
      const result = engine.calculateAnnualDepreciation(createMockAsset({ depreciationStartDate: '2026-03-01' }), 2025);

      expect([result.monthsApplied, result.annualDepreciation]).toEqual([0, 0]);
    });

    it('recordId κενό, journalEntryId null, calculatedAt ISO', () => {
      const result = engine.calculateAnnualDepreciation(createMockAsset(), 2025);

      expect(result.recordId).toBe('');
      expect(result.journalEntryId).toBeNull();
      expect(Number.isNaN(Date.parse(result.calculatedAt))).toBe(false);
    });
  });

  // ==========================================================================
  // A.1β — depreciationPostingFor (τρέχει ΜΕΣΑ στη συναλλαγή)
  // ==========================================================================

  describe('depreciationPostingFor', () => {
    it('ενεργό: εγγραφή + προβολή παγίου στο κλείσιμο της χρήσης', () => {
      const posting = depreciationPostingFor(createMockAsset(), 2025);

      expect(posting?.record.annualDepreciation).toBe(1000);
      expect(posting?.assetProjection).toEqual({
        accumulatedDepreciation: 1000, netBookValue: 9000, status: 'active', fullyDepreciatedDate: null,
      });
    });

    it('πλήρης απόσβεση: `active` ⇒ `fully_depreciated` με ημερομηνία το τέλος της χρήσης', () => {
      const asset = createMockAsset({ acquisitionCost: 25000, depreciationRate: 16, depreciationStartDate: '2018-12-01' });

      expect(depreciationPostingFor(asset, 2025)?.assetProjection).toMatchObject({
        status: 'fully_depreciated', fullyDepreciatedDate: '2025-12-31', netBookValue: 0,
      });
    });

    it('εκποιημένο μέσα στη χρήση: αποσβένεται ως την εκποίηση ΚΑΙ μένει `disposed`', () => {
      const asset = createMockAsset({ status: 'disposed', disposalDate: '2025-06-30', acquisitionCost: 12000 });
      const posting = depreciationPostingFor(asset, 2025);

      expect(posting?.record.annualDepreciation).toBe(600);
      expect(posting?.assetProjection.status).toBe('disposed');
    });

    it('εκτός εκμετάλλευσης (`inactive`) ⇒ τίποτα (ΠΟΛ 1073/2015)', () => {
      expect(depreciationPostingFor(createMockAsset({ status: 'inactive' }), 2025)).toBeNull();
    });

    it('μηδενική απόσβεση (πλήρως αποσβεσμένο / πριν από την έναρξη) ⇒ τίποτα', () => {
      expect(depreciationPostingFor(createMockAsset({ depreciationStartDate: '2010-12-01' }), 2025)).toBeNull();
      expect(depreciationPostingFor(createMockAsset({ depreciationStartDate: '2025-12-01' }), 2025)).toBeNull();
    });
  });

  // ==========================================================================
  // A.2 — calculateDisposal
  // ==========================================================================

  describe('calculateDisposal', () => {
    it('should calculate gain when salePrice > netBookValue', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        accumulatedDepreciation: 4000,
        netBookValue: 6000,
      });

      const result = engine.calculateDisposal(asset, 8000, '2025-06-15');

      expect(result.gain).toBe(2000);
      expect(result.loss).toBe(0);
      expect(result.disposalType).toBe('sale');
      expect(result.salePrice).toBe(8000);
      expect(result.netBookValue).toBe(6000);
      expect(result.disposalDate).toBe('2025-06-15');
    });

    it('should calculate loss when salePrice < netBookValue', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        accumulatedDepreciation: 4000,
        netBookValue: 6000,
      });

      const result = engine.calculateDisposal(asset, 3000, '2025-06-15');

      expect(result.gain).toBe(0);
      expect(result.loss).toBe(3000);
      expect(result.disposalType).toBe('sale');
    });

    it('should return write_off when salePrice = 0', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        accumulatedDepreciation: 4000,
        netBookValue: 6000,
      });

      const result = engine.calculateDisposal(asset, 0, '2025-09-01');

      expect(result.gain).toBe(0);
      expect(result.loss).toBe(6000);
      expect(result.disposalType).toBe('write_off');
    });

    it('should return gain=0 and loss=0 when salePrice = netBookValue', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        accumulatedDepreciation: 4000,
        netBookValue: 6000,
      });

      const result = engine.calculateDisposal(asset, 6000, '2025-12-31');

      expect(result.gain).toBe(0);
      expect(result.loss).toBe(0);
      expect(result.disposalType).toBe('sale');
    });

    it('should handle disposal of fully depreciated asset (NBV = 0)', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        accumulatedDepreciation: 10000,
        netBookValue: 0,
        status: 'fully_depreciated',
      });

      const result = engine.calculateDisposal(asset, 500, '2025-06-15');

      expect(result.gain).toBe(500);
      expect(result.loss).toBe(0);
      expect(result.disposalType).toBe('sale');
    });

    it('should handle write-off of fully depreciated asset', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        accumulatedDepreciation: 10000,
        netBookValue: 0,
      });

      const result = engine.calculateDisposal(asset, 0, '2025-06-15');

      expect(result.gain).toBe(0);
      expect(result.loss).toBe(0);
      expect(result.disposalType).toBe('write_off');
    });

    it('should pass through assetId and acquisitionCost', () => {
      const asset = createMockAsset({
        assetId: 'ast_vehicle_007',
        acquisitionCost: 25000,
        accumulatedDepreciation: 10000,
        netBookValue: 15000,
      });

      const result = engine.calculateDisposal(asset, 12000, '2025-11-20');

      expect(result.assetId).toBe('ast_vehicle_007');
      expect(result.acquisitionCost).toBe(25000);
      expect(result.accumulatedDepreciation).toBe(10000);
    });

    it('should handle decimal sale prices correctly', () => {
      const asset = createMockAsset({
        acquisitionCost: 5000,
        accumulatedDepreciation: 3333.33,
        netBookValue: 1666.67,
      });

      const result = engine.calculateDisposal(asset, 1500.50, '2025-07-01');

      expect(result.loss).toBe(roundToTwo(1666.67 - 1500.50));
      expect(result.gain).toBe(0);
    });
  });

  // ==========================================================================
  // A.3 — forecastDepreciations (ο ΙΔΙΟΣ πίνακας με την καταχώριση)
  // ==========================================================================

  describe('forecastDepreciations', () => {
    // Σήμερα 15/10/2026 ⇒ η πρόβλεψη αρχίζει από τη χρήση 2027.
    it('3 χρήσεις: υπόλοιπο αρχής συνεχές από τον πίνακα (2025: 1.000 · 2026: 2.000 · …)', () => {
      const records = engine.forecastDepreciations(createMockAsset(), 3);

      expect(records.map((r) => [r.fiscalYear, r.openingAccumulatedDepreciation, r.annualDepreciation]))
        .toEqual([[2027, 2000, 1000], [2028, 3000, 1000], [2029, 4000, 1000]]);
      expect(records[0].recordId).toBe('forecast_2027');
      expect(records.every((r) => r.journalEntryId === null)).toBe(true);
    });

    it('έως 5 χρήσεις, όσες κι αν ζητηθούν', () => {
      expect(engine.forecastDepreciations(createMockAsset({ acquisitionCost: 50000 }), 10)).toHaveLength(5);
    });

    it('σταματά στην πλήρη απόσβεση: Η/Υ 5.000 € (20%) από 2024 ⇒ 2027 + 2028 μόνο', () => {
      const asset = createMockAsset({ acquisitionCost: 5000, depreciationRate: 20, depreciationStartDate: '2023-12-01' });
      const records = engine.forecastDepreciations(asset, 5);

      expect(records.map((r) => r.fiscalYear)).toEqual([2027, 2028]);
      expect(records[1].closingNetBookValue).toBe(0);
    });

    it('πλήρως αποσβεσμένο ⇒ κενή πρόβλεψη', () => {
      expect(engine.forecastDepreciations(createMockAsset({ depreciationStartDate: '2010-12-01' }), 5)).toEqual([]);
    });
  });

  // ==========================================================================
  // B — bookDepreciations: ορχήστρωση (η πλήρης εκτέλεση: depreciation-run.test.ts)
  // ==========================================================================

  describe('bookDepreciations', () => {
    it.each([2026, 2027])('χρήση %i που ΔΕΝ έληξε ⇒ άρνηση ΠΡΙΝ από κάθε ανάγνωση/εγγραφή', async (year) => {
      await expect(engine.bookDepreciations(year)).rejects.toBeInstanceOf(DepreciationRunError);
      expect(mockRepo.collectFixedAssets).not.toHaveBeenCalled();
      expect(mockRepo.postDepreciation).not.toHaveBeenCalled();
    });

    it('πλήρης σάρωση της χρήσης — ποτέ η σελίδα της οθόνης', async () => {
      mockRepo.collectFixedAssets.mockResolvedValue([]);

      await engine.bookDepreciations(2025);

      expect(mockRepo.collectFixedAssets).toHaveBeenCalledWith({ scope: { kind: 'depreciationYear', fiscalYear: 2025 } });
    });

    it('μία καταχώριση ανά πάγιο με απόσβεση· το `compute` ξαναπαίρνει την απόφαση πάνω στο ΦΡΕΣΚΟ πάγιο', async () => {
      mockRepo.collectFixedAssets.mockResolvedValue([
        createMockAsset({ assetId: 'ast_a' }),
        createMockAsset({ assetId: 'ast_inactive', status: 'inactive' }),
        createMockAsset({ assetId: 'ast_done', depreciationStartDate: '2010-12-01' }),
      ]);
      mockRepo.postDepreciation.mockResolvedValue({ kind: 'nothing_to_post' });

      await engine.bookDepreciations(2025);

      expect(mockRepo.postDepreciation).toHaveBeenCalledTimes(1);
      const request = mockRepo.postDepreciation.mock.calls[0][0];
      expect([request.assetId, request.fiscalYear]).toEqual(['ast_a', 2025]);
      // Το πάγιο άλλαξε ανάμεσα σε σάρωση και συναλλαγή (έγινε `inactive`) ⇒ τίποτα δεν γράφεται.
      expect(request.compute(createMockAsset({ assetId: 'ast_a', status: 'inactive' }))).toBeNull();
    });

    it('σύνοψη: γραμμένα + ήδη γραμμένα, σύνολο = άθροισμα και των δύο', async () => {
      mockRepo.collectFixedAssets.mockResolvedValue([createMockAsset({ assetId: 'ast_a' }), createMockAsset({ assetId: 'ast_b' })]);
      const base = engine.calculateAnnualDepreciation(createMockAsset(), 2025);
      mockRepo.postDepreciation
        .mockResolvedValueOnce({ kind: 'posted', record: { ...base, recordId: 'depr_a', annualDepreciation: 1000.1 } })
        .mockResolvedValueOnce({ kind: 'already_posted', record: { ...base, recordId: 'depr_b', annualDepreciation: 999.2 } });

      const result = await engine.bookDepreciations(2025);

      expect(result.posted.map((r) => r.recordId)).toEqual(['depr_a']);
      expect(result.alreadyPosted.map((r) => r.recordId)).toEqual(['depr_b']);
      expect(result.totalDepreciation).toBe(roundToTwo(1000.1 + 999.2));
    });

    it('σφάλμα σάρωσης ⇒ σφάλμα της εκτέλεσης, ποτέ «0 αποσβέσεις»', async () => {
      mockRepo.collectFixedAssets.mockRejectedValue(new Error('FAILED_PRECONDITION'));

      await expect(engine.bookDepreciations(2025)).rejects.toThrow('FAILED_PRECONDITION');
      expect(mockRepo.postDepreciation).not.toHaveBeenCalled();
    });
  });
});
