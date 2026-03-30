/**
 * @fileoverview DepreciationEngine — Comprehensive Jest Test Suite
 * @description Tests for annual depreciation, disposal, forecast, and batch booking
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-31
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, Google Presubmit Pattern
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

import { DepreciationEngine } from '../depreciation-engine';
import type { FixedAsset, DepreciationRecord } from '../../../types/assets';
import type { IAccountingRepository } from '../../../types/interfaces';

// ============================================================================
// MOCK HELPERS
// ============================================================================

/**
 * Creates a mock FixedAsset with sensible defaults.
 * Override individual fields as needed per test.
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
    acquisitionDate: '2025-01-01',
    depreciationStartDate: '2025-01-01',
    fullyDepreciatedDate: null,
    disposalDate: null,
    depreciationRate: 10,
    depreciationMethod: 'straight_line',
    usefulLifeYears: 10,
    purchaseInvoiceNumber: 'INV-2025-001',
    supplierName: 'ABC Μηχανήματα ΑΕ',
    supplierVatNumber: '123456789',
    notes: null,
    acquisitionFiscalYear: 2025,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Creates a mock IAccountingRepository with jest.fn() stubs
 * for depreciation-relevant methods.
 */
function createMockRepository(): jest.Mocked<Pick<
  IAccountingRepository,
  'listFixedAssets' | 'createDepreciationRecord' | 'updateFixedAsset'
>> & Record<string, jest.Mock> {
  return {
    listFixedAssets: jest.fn(),
    createDepreciationRecord: jest.fn(),
    updateFixedAsset: jest.fn(),
    // Stubs for other repository methods (not used by DepreciationEngine)
    createJournalEntry: jest.fn(),
    getJournalEntry: jest.fn(),
    updateJournalEntry: jest.fn(),
    listJournalEntries: jest.fn(),
    deleteJournalEntry: jest.fn(),
    createInvoice: jest.fn(),
    getInvoice: jest.fn(),
    updateInvoice: jest.fn(),
    listInvoices: jest.fn(),
    deleteInvoice: jest.fn(),
    getNextInvoiceNumber: jest.fn(),
    createFixedAsset: jest.fn(),
    getFixedAsset: jest.fn(),
    getDepreciationRecords: jest.fn(),
    createBankTransaction: jest.fn(),
    getBankTransaction: jest.fn(),
    updateBankTransaction: jest.fn(),
    listBankTransactions: jest.fn(),
    deleteBankTransaction: jest.fn(),
    createBankAccount: jest.fn(),
    getBankAccount: jest.fn(),
    updateBankAccount: jest.fn(),
    listBankAccounts: jest.fn(),
    deleteBankAccount: jest.fn(),
    createImportBatch: jest.fn(),
    getImportBatch: jest.fn(),
    listImportBatches: jest.fn(),
    saveMatchResult: jest.fn(),
    getMatchHistory: jest.fn(),
    getCompanyProfile: jest.fn(),
    saveCompanyProfile: jest.fn(),
    getInvoiceSeries: jest.fn(),
    saveInvoiceSeries: jest.fn(),
    getServicePresets: jest.fn(),
    saveServicePresets: jest.fn(),
    createReceivedDocument: jest.fn(),
    getReceivedDocument: jest.fn(),
    updateReceivedDocument: jest.fn(),
    listReceivedDocuments: jest.fn(),
    deleteReceivedDocument: jest.fn(),
    getMatchingConfig: jest.fn(),
    saveMatchingConfig: jest.fn(),
    createAPYCertificate: jest.fn(),
    getAPYCertificate: jest.fn(),
    listAPYCertificates: jest.fn(),
    updateAPYCertificate: jest.fn(),
    createCustomCategory: jest.fn(),
    getCustomCategory: jest.fn(),
    listCustomCategories: jest.fn(),
    updateCustomCategory: jest.fn(),
    deleteCustomCategory: jest.fn(),
    listCustomerBalances: jest.fn(),
    upsertCustomerBalance: jest.fn(),
    getCustomerBalance: jest.fn(),
    listFiscalPeriods: jest.fn(),
    upsertFiscalPeriod: jest.fn(),
    getFiscalPeriod: jest.fn(),
    createAuditEntry: jest.fn(),
    listAuditEntries: jest.fn(),
  } as unknown as jest.Mocked<Pick<
    IAccountingRepository,
    'listFixedAssets' | 'createDepreciationRecord' | 'updateFixedAsset'
  >> & Record<string, jest.Mock>;
}

/** Utility: rounds to 2 decimals (mirrors engine logic) */
function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('DepreciationEngine', () => {
  let engine: DepreciationEngine;
  let mockRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockRepo = createMockRepository();
    engine = new DepreciationEngine(mockRepo as unknown as IAccountingRepository);
    jest.clearAllMocks();
  });

  // ==========================================================================
  // A.1 — calculateAnnualDepreciation
  // ==========================================================================

  describe('calculateAnnualDepreciation', () => {
    // ── Full Year (12 months) ──────────────────────────────────────────────

    it('should calculate full-year depreciation for machinery at 10%', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 0,
        depreciationStartDate: '2025-01-01',
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.annualDepreciation).toBe(1000);
      expect(result.monthsApplied).toBe(12);
      expect(result.closingAccumulatedDepreciation).toBe(1000);
      expect(result.closingNetBookValue).toBe(9000);
      expect(result.appliedRate).toBe(10);
      expect(result.fiscalYear).toBe(2025);
      expect(result.assetId).toBe('ast_test_001');
    });

    it('should calculate full-year depreciation for buildings at 4%', () => {
      const asset = createMockAsset({
        category: 'buildings',
        acquisitionCost: 100000,
        residualValue: 0,
        depreciationRate: 4,
        accumulatedDepreciation: 0,
        depreciationStartDate: '2025-01-01',
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.annualDepreciation).toBe(4000);
      expect(result.monthsApplied).toBe(12);
      expect(result.closingNetBookValue).toBe(96000);
    });

    it('should calculate full-year depreciation for vehicles at 16%', () => {
      const asset = createMockAsset({
        category: 'vehicles',
        acquisitionCost: 25000,
        residualValue: 0,
        depreciationRate: 16,
        accumulatedDepreciation: 0,
        depreciationStartDate: '2025-01-01',
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.annualDepreciation).toBe(4000);
      expect(result.closingNetBookValue).toBe(21000);
    });

    it('should calculate full-year depreciation for computers at 20%', () => {
      const asset = createMockAsset({
        category: 'computers',
        acquisitionCost: 5000,
        residualValue: 0,
        depreciationRate: 20,
        accumulatedDepreciation: 0,
        depreciationStartDate: '2025-01-01',
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.annualDepreciation).toBe(1000);
      expect(result.closingNetBookValue).toBe(4000);
    });

    // ── Mid-year Acquisition (pro-rata) ────────────────────────────────────

    it('should pro-rate depreciation for July acquisition (6 months)', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 0,
        depreciationStartDate: '2025-07-01',
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.monthsApplied).toBe(6);
      expect(result.annualDepreciation).toBe(500);
      expect(result.closingAccumulatedDepreciation).toBe(500);
      expect(result.closingNetBookValue).toBe(9500);
    });

    it('should pro-rate depreciation for October acquisition (3 months)', () => {
      const asset = createMockAsset({
        acquisitionCost: 12000,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 0,
        depreciationStartDate: '2025-10-01',
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.monthsApplied).toBe(3);
      expect(result.annualDepreciation).toBe(300);
    });

    it('should pro-rate depreciation for December acquisition (1 month)', () => {
      const asset = createMockAsset({
        acquisitionCost: 6000,
        residualValue: 0,
        depreciationRate: 20,
        accumulatedDepreciation: 0,
        depreciationStartDate: '2025-12-01',
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.monthsApplied).toBe(1);
      expect(result.annualDepreciation).toBe(100);
    });

    it('should give full 12 months for an asset acquired before the fiscal year', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 1000,
        depreciationStartDate: '2024-01-01',
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.monthsApplied).toBe(12);
      expect(result.annualDepreciation).toBe(1000);
      expect(result.openingAccumulatedDepreciation).toBe(1000);
      expect(result.closingAccumulatedDepreciation).toBe(2000);
    });

    // ── Remaining Value Cap ────────────────────────────────────────────────

    it('should cap depreciation at remaining value (nearly fully depreciated)', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 9800, // Only 200 remaining
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      // Full-year would be 1000, but only 200 remaining
      expect(result.annualDepreciation).toBe(200);
      expect(result.closingAccumulatedDepreciation).toBe(10000);
      expect(result.closingNetBookValue).toBe(0);
    });

    it('should return zero depreciation for fully depreciated asset', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 10000, // Fully depreciated
        netBookValue: 0,
        status: 'fully_depreciated',
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.annualDepreciation).toBe(0);
      expect(result.closingAccumulatedDepreciation).toBe(10000);
      expect(result.closingNetBookValue).toBe(0);
    });

    // ── Residual Value > 0 ─────────────────────────────────────────────────

    it('should subtract residual value from depreciable base', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        residualValue: 2000, // Depreciable base = 8000
        depreciationRate: 10,
        accumulatedDepreciation: 0,
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      // 10% of 8000 = 800 (not 1000)
      expect(result.annualDepreciation).toBe(800);
      expect(result.closingAccumulatedDepreciation).toBe(800);
      // Net book value = acquisitionCost - closing accumulated
      expect(result.closingNetBookValue).toBe(9200);
    });

    it('should cap at remaining when residualValue is set and nearly done', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        residualValue: 2000, // Depreciable base = 8000
        depreciationRate: 10,
        accumulatedDepreciation: 7900, // Only 100 remaining in depreciable base
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.annualDepreciation).toBe(100);
      expect(result.closingAccumulatedDepreciation).toBe(8000);
    });

    // ── Disposal / Fully Depreciated Date within Year ──────────────────────

    it('should stop depreciation at disposal date within year', () => {
      const asset = createMockAsset({
        acquisitionCost: 12000,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 0,
        depreciationStartDate: '2025-01-01',
        disposalDate: '2025-06-30', // Disposed end of June
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.monthsApplied).toBe(6);
      expect(result.annualDepreciation).toBe(600);
    });

    it('should stop depreciation at fullyDepreciatedDate within year', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 0,
        depreciationStartDate: '2025-01-01',
        fullyDepreciatedDate: '2025-03-31', // Fully depreciated end of March
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.monthsApplied).toBe(3);
    });

    // ── Asset starts after fiscal year ─────────────────────────────────────

    it('should return zero months when asset starts after the fiscal year end', () => {
      const asset = createMockAsset({
        depreciationStartDate: '2026-03-01',
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.monthsApplied).toBe(0);
      expect(result.annualDepreciation).toBe(0);
    });

    // ── Record metadata ────────────────────────────────────────────────────

    it('should set recordId to empty string and journalEntryId to null', () => {
      const asset = createMockAsset();
      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.recordId).toBe('');
      expect(result.journalEntryId).toBeNull();
    });

    it('should include calculatedAt as ISO string', () => {
      const asset = createMockAsset();
      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.calculatedAt).toBeDefined();
      expect(() => new Date(result.calculatedAt)).not.toThrow();
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
  // A.3 — forecastDepreciations
  // ==========================================================================

  describe('forecastDepreciations', () => {
    it('should forecast 1 year of depreciation', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 0,
      });

      const records = engine.forecastDepreciations(asset, 1);

      expect(records).toHaveLength(1);
      expect(records[0].annualDepreciation).toBe(1000);
      expect(records[0].monthsApplied).toBe(12);
      expect(records[0].recordId).toMatch(/^forecast_/);
    });

    it('should forecast 3 years of depreciation', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 0,
      });

      const records = engine.forecastDepreciations(asset, 3);

      expect(records).toHaveLength(3);

      // Year 1
      expect(records[0].annualDepreciation).toBe(1000);
      expect(records[0].openingAccumulatedDepreciation).toBe(0);
      expect(records[0].closingAccumulatedDepreciation).toBe(1000);

      // Year 2
      expect(records[1].annualDepreciation).toBe(1000);
      expect(records[1].openingAccumulatedDepreciation).toBe(1000);
      expect(records[1].closingAccumulatedDepreciation).toBe(2000);

      // Year 3
      expect(records[2].annualDepreciation).toBe(1000);
      expect(records[2].openingAccumulatedDepreciation).toBe(2000);
      expect(records[2].closingAccumulatedDepreciation).toBe(3000);
    });

    it('should forecast exactly 5 years of depreciation', () => {
      const asset = createMockAsset({
        acquisitionCost: 50000,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 0,
      });

      const records = engine.forecastDepreciations(asset, 5);

      expect(records).toHaveLength(5);
      expect(records[4].closingAccumulatedDepreciation).toBe(25000);
      expect(records[4].closingNetBookValue).toBe(25000);
    });

    it('should cap forecast at 5 years even if more requested', () => {
      const asset = createMockAsset({
        acquisitionCost: 50000,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 0,
      });

      const records = engine.forecastDepreciations(asset, 10);

      expect(records).toHaveLength(5);
    });

    it('should stop forecasting when asset becomes fully depreciated', () => {
      const asset = createMockAsset({
        acquisitionCost: 5000,
        residualValue: 0,
        depreciationRate: 20, // 1000/year, fully depreciated in 5 years
        accumulatedDepreciation: 3500, // Only 1500 remaining
      });

      const records = engine.forecastDepreciations(asset, 5);

      // Year 1: 1000 → accumulated 4500
      // Year 2: 500 (capped at remaining) → accumulated 5000
      // Year 3: 0 remaining → stops
      expect(records).toHaveLength(2);
      expect(records[0].annualDepreciation).toBe(1000);
      expect(records[1].annualDepreciation).toBe(500);
      expect(records[1].closingNetBookValue).toBe(0);
    });

    it('should return empty array for fully depreciated asset', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 10000,
        netBookValue: 0,
      });

      const records = engine.forecastDepreciations(asset, 5);

      expect(records).toHaveLength(0);
    });

    it('should account for residualValue in forecast', () => {
      const asset = createMockAsset({
        acquisitionCost: 10000,
        residualValue: 2000, // Depreciable base = 8000
        depreciationRate: 10,
        accumulatedDepreciation: 0,
      });

      const records = engine.forecastDepreciations(asset, 5);

      expect(records).toHaveLength(5);
      // Each year: 10% of 8000 = 800
      expect(records[0].annualDepreciation).toBe(800);
      expect(records[4].closingAccumulatedDepreciation).toBe(4000);
      // Net book value = 10000 - 4000 = 6000
      expect(records[4].closingNetBookValue).toBe(6000);
    });

    it('should use future fiscal years starting from current year + 1', () => {
      const asset = createMockAsset();
      const currentYear = new Date().getFullYear();

      const records = engine.forecastDepreciations(asset, 3);

      expect(records[0].fiscalYear).toBe(currentYear + 1);
      expect(records[1].fiscalYear).toBe(currentYear + 2);
      expect(records[2].fiscalYear).toBe(currentYear + 3);
    });

    it('should set journalEntryId to null for forecast records', () => {
      const asset = createMockAsset();
      const records = engine.forecastDepreciations(asset, 2);

      for (const record of records) {
        expect(record.journalEntryId).toBeNull();
      }
    });
  });

  // ==========================================================================
  // B — bookDepreciations (async, with mock repository)
  // ==========================================================================

  describe('bookDepreciations', () => {
    it('should book depreciations for multiple active assets', async () => {
      const asset1 = createMockAsset({
        assetId: 'ast_001',
        acquisitionCost: 10000,
        depreciationRate: 10,
        accumulatedDepreciation: 0,
      });
      const asset2 = createMockAsset({
        assetId: 'ast_002',
        acquisitionCost: 5000,
        depreciationRate: 20,
        accumulatedDepreciation: 0,
        category: 'computers',
      });

      mockRepo.listFixedAssets.mockResolvedValue({
        items: [asset1, asset2],
        hasNext: false,
        totalShown: 2,
        pageSize: 20,
      });
      mockRepo.createDepreciationRecord
        .mockResolvedValueOnce({ id: 'dep_001' })
        .mockResolvedValueOnce({ id: 'dep_002' });
      mockRepo.updateFixedAsset.mockResolvedValue(undefined);

      const records = await engine.bookDepreciations(2025);

      expect(records).toHaveLength(2);
      expect(records[0].recordId).toBe('dep_001');
      expect(records[0].assetId).toBe('ast_001');
      expect(records[0].annualDepreciation).toBe(1000);
      expect(records[1].recordId).toBe('dep_002');
      expect(records[1].assetId).toBe('ast_002');
      expect(records[1].annualDepreciation).toBe(1000);
    });

    it('should call createDepreciationRecord for each asset with positive depreciation', async () => {
      const asset = createMockAsset({
        assetId: 'ast_single',
        acquisitionCost: 10000,
        depreciationRate: 10,
        accumulatedDepreciation: 0,
      });

      mockRepo.listFixedAssets.mockResolvedValue({
        items: [asset],
        hasNext: false,
        totalShown: 1,
        pageSize: 20,
      });
      mockRepo.createDepreciationRecord.mockResolvedValue({ id: 'dep_single' });
      mockRepo.updateFixedAsset.mockResolvedValue(undefined);

      await engine.bookDepreciations(2025);

      expect(mockRepo.createDepreciationRecord).toHaveBeenCalledTimes(1);
      const calledWith = mockRepo.createDepreciationRecord.mock.calls[0][0] as DepreciationRecord;
      expect(calledWith.annualDepreciation).toBe(1000);
      expect(calledWith.assetId).toBe('ast_single');
    });

    it('should update asset accumulatedDepreciation and netBookValue', async () => {
      const asset = createMockAsset({
        assetId: 'ast_update',
        acquisitionCost: 10000,
        depreciationRate: 10,
        accumulatedDepreciation: 5000,
        netBookValue: 5000,
      });

      mockRepo.listFixedAssets.mockResolvedValue({
        items: [asset],
        hasNext: false,
        totalShown: 1,
        pageSize: 20,
      });
      mockRepo.createDepreciationRecord.mockResolvedValue({ id: 'dep_x' });
      mockRepo.updateFixedAsset.mockResolvedValue(undefined);

      await engine.bookDepreciations(2025);

      expect(mockRepo.updateFixedAsset).toHaveBeenCalledWith('ast_update', {
        accumulatedDepreciation: 6000,
        netBookValue: 4000,
        status: 'active',
      });
    });

    it('should set status to fully_depreciated when NBV reaches residualValue', async () => {
      const asset = createMockAsset({
        assetId: 'ast_final',
        acquisitionCost: 10000,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 9500, // 500 remaining, full year would be 1000
      });

      mockRepo.listFixedAssets.mockResolvedValue({
        items: [asset],
        hasNext: false,
        totalShown: 1,
        pageSize: 20,
      });
      mockRepo.createDepreciationRecord.mockResolvedValue({ id: 'dep_final' });
      mockRepo.updateFixedAsset.mockResolvedValue(undefined);

      await engine.bookDepreciations(2025);

      expect(mockRepo.updateFixedAsset).toHaveBeenCalledWith('ast_final', {
        accumulatedDepreciation: 10000,
        netBookValue: 0,
        status: 'fully_depreciated',
        fullyDepreciatedDate: '2025-12-31',
      });
    });

    it('should skip assets acquired after the fiscal year', async () => {
      const futureAsset = createMockAsset({
        assetId: 'ast_future',
        depreciationStartDate: '2026-03-15', // After fiscal year 2025
      });

      mockRepo.listFixedAssets.mockResolvedValue({
        items: [futureAsset],
        hasNext: false,
        totalShown: 1,
        pageSize: 20,
      });

      const records = await engine.bookDepreciations(2025);

      expect(records).toHaveLength(0);
      expect(mockRepo.createDepreciationRecord).not.toHaveBeenCalled();
      expect(mockRepo.updateFixedAsset).not.toHaveBeenCalled();
    });

    it('should skip assets with zero depreciation', async () => {
      const fullyDepreciatedAsset = createMockAsset({
        assetId: 'ast_done',
        acquisitionCost: 10000,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 10000,
      });

      mockRepo.listFixedAssets.mockResolvedValue({
        items: [fullyDepreciatedAsset],
        hasNext: false,
        totalShown: 1,
        pageSize: 20,
      });

      const records = await engine.bookDepreciations(2025);

      expect(records).toHaveLength(0);
      expect(mockRepo.createDepreciationRecord).not.toHaveBeenCalled();
    });

    it('should return empty array when no active assets exist', async () => {
      mockRepo.listFixedAssets.mockResolvedValue({
        items: [],
        hasNext: false,
        totalShown: 0,
        pageSize: 20,
      });

      const records = await engine.bookDepreciations(2025);

      expect(records).toHaveLength(0);
    });

    it('should call listFixedAssets with status=active filter', async () => {
      mockRepo.listFixedAssets.mockResolvedValue({
        items: [],
        hasNext: false,
        totalShown: 0,
        pageSize: 20,
      });

      await engine.bookDepreciations(2025);

      expect(mockRepo.listFixedAssets).toHaveBeenCalledWith({ status: 'active' });
    });
  });

  // ==========================================================================
  // C — Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle very small acquisition cost', () => {
      const asset = createMockAsset({
        acquisitionCost: 100,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 0,
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.annualDepreciation).toBe(10);
    });

    it('should handle very large acquisition cost', () => {
      const asset = createMockAsset({
        acquisitionCost: 1000000,
        residualValue: 0,
        depreciationRate: 4,
        accumulatedDepreciation: 0,
        category: 'buildings',
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.annualDepreciation).toBe(40000);
    });

    it('should handle mid-year disposal combined with mid-year start', () => {
      const asset = createMockAsset({
        acquisitionCost: 12000,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 0,
        depreciationStartDate: '2025-04-01', // April start
        disposalDate: '2025-09-30', // September end
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      // April to September = 6 months
      expect(result.monthsApplied).toBe(6);
      expect(result.annualDepreciation).toBe(600);
    });

    it('should return 0 months for disposal before start date in same year', () => {
      const asset = createMockAsset({
        depreciationStartDate: '2025-07-01',
        disposalDate: '2025-03-31', // Disposed before depreciation starts
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.monthsApplied).toBe(0);
      expect(result.annualDepreciation).toBe(0);
    });

    it('should handle asset with acquisitionCost equal to residualValue', () => {
      const asset = createMockAsset({
        acquisitionCost: 5000,
        residualValue: 5000, // Depreciable base = 0
        depreciationRate: 10,
        accumulatedDepreciation: 0,
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      expect(result.annualDepreciation).toBe(0);
    });

    it('should produce consistent rounding across multiple calculations', () => {
      const asset = createMockAsset({
        acquisitionCost: 9999.99,
        residualValue: 0,
        depreciationRate: 10,
        accumulatedDepreciation: 0,
        depreciationStartDate: '2025-07-01',
      });

      const result = engine.calculateAnnualDepreciation(asset, 2025);

      // 9999.99 * 0.10 * (6/12) = 500.00 (rounded)
      expect(result.annualDepreciation).toBe(roundToTwo(9999.99 * 0.10 * (6 / 12)));
      // Ensure no floating point artifacts
      expect(Number.isFinite(result.annualDepreciation)).toBe(true);
      expect(result.annualDepreciation.toString()).not.toContain('e');
    });

    it('should handle forecast for asset with residualValue that stops before 5 years', () => {
      const asset = createMockAsset({
        acquisitionCost: 5000,
        residualValue: 1000, // Depreciable base = 4000
        depreciationRate: 20, // 800/year → fully depreciated in 5 years
        accumulatedDepreciation: 3500, // Only 500 remaining
      });

      const records = engine.forecastDepreciations(asset, 5);

      expect(records).toHaveLength(1);
      expect(records[0].annualDepreciation).toBe(500);
      expect(records[0].closingNetBookValue).toBe(1000); // residualValue
    });

    it('should handle disposal with decimal netBookValue', () => {
      const asset = createMockAsset({
        acquisitionCost: 7777.77,
        accumulatedDepreciation: 3333.33,
        netBookValue: 4444.44,
      });

      const result = engine.calculateDisposal(asset, 4000, '2025-06-15');

      expect(result.loss).toBe(roundToTwo(4444.44 - 4000));
      expect(result.gain).toBe(0);
    });
  });
});
