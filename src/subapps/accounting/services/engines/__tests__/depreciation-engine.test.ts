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

import { DepreciationEngine, DepreciationRunError } from '../depreciation-engine';
import type { DepreciationPostedChange, DepreciationRecord, FixedAsset } from '../../../types/assets';
import type { FiscalPeriod } from '../../../types/fiscal-period';
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
    readDepreciationRecords: jest.fn<ReturnType<IAccountingRepository['readDepreciationRecords']>, Parameters<IAccountingRepository['readDepreciationRecords']>>(),
    getFiscalPeriod: jest.fn<Promise<FiscalPeriod | null>, [string]>(),
  };
}

/** Καταχωρημένη εγγραφή απόσβεσης 2025 με ποσό `amount`. */
function recordOf(assetId: string, amount: number): DepreciationRecord {
  return {
    recordId: `depr_${assetId}`, assetId, fiscalYear: 2025, acquisitionCost: 10000, openingAccumulatedDepreciation: 0,
    annualDepreciation: amount, closingAccumulatedDepreciation: amount, closingNetBookValue: 10000 - amount,
    appliedRate: 10, monthsApplied: 12, journalEntryId: `je_${assetId}`, journalEntryIds: [`je_${assetId}`], revision: 1,
    calculatedAt: '2026-01-15T00:00:00.000Z',
  };
}

function changeOf(assetId: string, amount: number, delta: number, wasPosted: boolean): DepreciationPostedChange {
  return { intent: 'book', record: recordOf(assetId, amount), delta, journalEntryId: `je_${assetId}`, wasPosted };
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
  // B — εκτέλεση: ορχήστρωση (η πλήρης εκτέλεση πάνω σε Firestore: depreciation-run.test.ts)
  // ==========================================================================

  describe('bookDepreciations / reverseDepreciations', () => {
    const openPeriod = { periodId: '2025-12', status: 'OPEN' } as FiscalPeriod;

    beforeEach(() => {
      mockRepo.getFiscalPeriod.mockResolvedValue(openPeriod);
      mockRepo.readDepreciationRecords.mockResolvedValue(new Map());
    });

    it.each([2026, 2027])('χρήση %i που ΔΕΝ έληξε ⇒ άρνηση ΠΡΙΝ από κάθε ανάγνωση/εγγραφή', async (year) => {
      await expect(engine.bookDepreciations(year)).rejects.toMatchObject({ code: 'FISCAL_YEAR_NOT_ENDED' });
      expect(mockRepo.collectFixedAssets).not.toHaveBeenCalled();
      expect(mockRepo.postDepreciation).not.toHaveBeenCalled();
    });

    it.each([
      ['PERIOD_NOT_FOUND', null],
      ['PERIOD_NOT_OPEN', { ...openPeriod, status: 'CLOSED' }],
      ['PERIOD_NOT_OPEN', { ...openPeriod, status: 'LOCKED' }],
    ] as const)('περίοδος Δεκεμβρίου ⇒ %s, πριν από κάθε ανάγνωση (καταχώριση ΚΑΙ αναίρεση)', async (code, period) => {
      mockRepo.getFiscalPeriod.mockResolvedValue(period as FiscalPeriod | null);

      await expect(engine.bookDepreciations(2025)).rejects.toMatchObject({ code });
      await expect(engine.reverseDepreciations(2025)).rejects.toBeInstanceOf(DepreciationRunError);
      expect(mockRepo.getFiscalPeriod).toHaveBeenCalledWith('2025-12');
      expect(mockRepo.collectFixedAssets).not.toHaveBeenCalled();
    });

    it('πλήρης σάρωση της χρήσης — ποτέ η σελίδα της οθόνης', async () => {
      mockRepo.collectFixedAssets.mockResolvedValue([]);

      await engine.bookDepreciations(2025);

      expect(mockRepo.collectFixedAssets).toHaveBeenCalledWith({ scope: { kind: 'depreciationYear', fiscalYear: 2025 } });
    });

    it('συναλλαγή ΜΟΝΟ όπου ο προέλεγχος βρίσκει διαφορά· το `decide` ξαναπαίρνει την απόφαση στα ΦΡΕΣΚΑ έγγραφα', async () => {
      mockRepo.collectFixedAssets.mockResolvedValue([
        createMockAsset({ assetId: 'ast_a' }),
        createMockAsset({ assetId: 'ast_inactive', status: 'inactive' }),
        createMockAsset({ assetId: 'ast_done', depreciationStartDate: '2010-12-01' }),
        createMockAsset({ assetId: 'ast_booked' }),
      ]);
      mockRepo.readDepreciationRecords.mockResolvedValue(new Map([['ast_booked', recordOf('ast_booked', 1000)]]));
      mockRepo.postDepreciation.mockResolvedValue({ kind: 'unchanged', record: null });

      const result = await engine.bookDepreciations(2025);

      expect(mockRepo.postDepreciation).toHaveBeenCalledTimes(1);
      const request = mockRepo.postDepreciation.mock.calls[0][0];
      expect([request.assetId, request.fiscalYear]).toEqual(['ast_a', 2025]);
      // Το πάγιο έγινε `inactive` ανάμεσα σε σάρωση και συναλλαγή ⇒ τίποτα δεν γράφεται.
      expect(request.decide({ asset: createMockAsset({ assetId: 'ast_a', status: 'inactive' }), current: null }))
        .toEqual({ kind: 'unchanged' });
      // Το ήδη σωστό μετρά στο σύνολο, χωρίς συναλλαγή.
      expect(result.unchanged.map((r) => r.assetId)).toEqual(['ast_booked']);
      expect(result.totalDepreciation).toBe(1000);
    });

    it('σύνοψη: πρώτη καταχώριση / διόρθωση / ήδη σωστό / άρνηση — σύνολο και μεταβολή χωριστά', async () => {
      mockRepo.collectFixedAssets.mockResolvedValue(['a', 'b', 'c', 'd'].map((id) => createMockAsset({ assetId: id })));
      mockRepo.postDepreciation
        .mockResolvedValueOnce({ kind: 'posted', change: changeOf('a', 1000.1, 1000.1, false) })
        .mockResolvedValueOnce({ kind: 'posted', change: changeOf('b', 999.2, -0.8, true) })
        .mockResolvedValueOnce({ kind: 'unchanged', record: recordOf('c', 1000) })
        .mockResolvedValueOnce({ kind: 'refused', assetId: 'd', reason: 'LATER_YEAR_POSTED' });

      const result = await engine.bookDepreciations(2025);

      expect(result.posted.map((c) => c.record.assetId)).toEqual(['a']);
      expect(result.adjusted.map((c) => c.record.assetId)).toEqual(['b']);
      expect(result.unchanged.map((r) => r.assetId)).toEqual(['c']);
      expect(result.refused).toEqual([{ assetId: 'd', reason: 'LATER_YEAR_POSTED' }]);
      expect(result.totalDepreciation).toBe(roundToTwo(1000.1 + 999.2 + 1000));
      expect(result.bookedDelta).toBe(roundToTwo(1000.1 - 0.8));
    });

    it('σφάλμα σάρωσης ⇒ σφάλμα της εκτέλεσης, ποτέ «0 αποσβέσεις»', async () => {
      mockRepo.collectFixedAssets.mockRejectedValue(new Error('FAILED_PRECONDITION'));

      await expect(engine.bookDepreciations(2025)).rejects.toThrow('FAILED_PRECONDITION');
      expect(mockRepo.postDepreciation).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // C — previewDepreciations: ΚΑΜΙΑ εγγραφή, πάντα επιτρεπτή
  // ==========================================================================

  describe('previewDepreciations', () => {
    it('σωστό / καταχωρημένο / διαφορά ανά πάγιο· παραλείπει όσα δεν έχουν τίποτα· εμπόδιο χωρίς άρνηση', async () => {
      mockRepo.getFiscalPeriod.mockResolvedValue(null);
      mockRepo.collectFixedAssets.mockResolvedValue([
        createMockAsset({ assetId: 'ast_new' }),
        createMockAsset({ assetId: 'ast_half', acquisitionCost: 12000 }),
        createMockAsset({ assetId: 'ast_inactive', status: 'inactive' }),
      ]);
      mockRepo.readDepreciationRecords.mockResolvedValue(new Map([['ast_half', recordOf('ast_half', 600)]]));

      const preview = await engine.previewDepreciations(2025);

      expect(preview.lines.map((l) => [l.assetId, l.target, l.booked, l.delta]))
        .toEqual([['ast_new', 1000, 0, 1000], ['ast_half', 1200, 600, 600]]);
      expect([preview.totalTarget, preview.totalBooked, preview.totalDelta]).toEqual([2200, 600, 1600]);
      expect(preview.blocker).toBe('PERIOD_NOT_FOUND');
      expect(preview.hasBooked).toBe(true);
      expect(mockRepo.postDepreciation).not.toHaveBeenCalled();
    });

    it('τρέχουσα χρήση ⇒ προεπισκόπηση ΝΑΙ, καταχώριση όχι (`FISCAL_YEAR_NOT_ENDED`)', async () => {
      mockRepo.collectFixedAssets.mockResolvedValue([createMockAsset()]);
      mockRepo.readDepreciationRecords.mockResolvedValue(new Map());

      const preview = await engine.previewDepreciations(2026);

      expect(preview.lines).toHaveLength(1);
      expect(preview.blocker).toBe('FISCAL_YEAR_NOT_ENDED');
    });
  });
});
