/**
 * @fileoverview VATEngine — Comprehensive Test Suite
 * @description Tests for Greek VAT calculations: output/input VAT, deductibility, quarterly & annual summaries
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-31
 * @version 1.0.0
 * @see ADR-ACC-004 VAT Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, Google Presubmit Pattern
 */

// Mock next/server to avoid Request global dependency in test environment
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

import { VATEngine } from '../vat-engine';
import type { IAccountingRepository } from '../../../types/interfaces';
import type { JournalEntry } from '../../../types/journal';
import type { ExpenseCategory } from '../../../types/common';
import type {
  VATCalculation,
  VATInputCalculation,
  VATDeductibilityRule,
  VATQuarterSummary,
  VATAnnualSummary,
} from '../../../types/vat';

// ============================================================================
// MOCK REPOSITORY FACTORY
// ============================================================================

/**
 * Partial JournalEntry for test data — only the fields VATEngine accesses.
 * Avoids repeating boilerplate fields that are irrelevant to VAT calculations.
 */
interface TestJournalEntry {
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  category: string;
  type: 'income' | 'expense';
}

function createMockJournalEntry(overrides: TestJournalEntry): JournalEntry {
  return {
    entryId: `je_test_${Math.random().toString(36).slice(2, 8)}`,
    date: '2026-01-15',
    type: overrides.type,
    category: overrides.category as JournalEntry['category'],
    description: 'Test entry',
    netAmount: overrides.netAmount,
    vatRate: overrides.vatRate,
    vatAmount: overrides.vatAmount,
    grossAmount: overrides.netAmount + overrides.vatAmount,
    vatDeductible: overrides.type === 'expense',
    paymentMethod: 'bank_transfer',
    contactId: null,
    contactName: null,
    invoiceId: null,
    mydataCode: overrides.type === 'income' ? 'category1_3' : 'category2_4',
    e3Code: overrides.type === 'income' ? '561_003' : '585_001',
    fiscalYear: 2026,
    quarter: 1,
    notes: null,
    status: 'ACTIVE',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  };
}

/**
 * Creates a typed mock IAccountingRepository with only the methods VATEngine uses.
 * All other methods are stubbed as jest.fn() to satisfy the interface.
 */
function createMockRepository(): jest.Mocked<IAccountingRepository> {
  const noop = jest.fn();
  return {
    // VATEngine uses only listJournalEntries
    listJournalEntries: jest.fn(),
    // Stub everything else
    getCompanySetup: noop,
    saveCompanySetup: noop,
    createJournalEntry: noop,
    getJournalEntry: noop,
    updateJournalEntry: noop,
    deleteJournalEntry: noop,
    getJournalEntryByInvoiceId: noop,
    createInvoice: noop,
    getInvoice: noop,
    updateInvoice: noop,
    listInvoices: noop,
    getNextInvoiceNumber: noop,
    getInvoiceSeries: noop,
    getServicePresets: noop,
    saveServicePresets: noop,
    createBankTransaction: noop,
    getBankTransaction: noop,
    updateBankTransaction: noop,
    listBankTransactions: noop,
    getBankAccounts: noop,
    createImportBatch: noop,
    createFixedAsset: noop,
    getFixedAsset: noop,
    updateFixedAsset: noop,
    listFixedAssets: noop,
    createDepreciationRecord: noop,
    getDepreciationRecords: noop,
    getPartners: noop,
    savePartners: noop,
    getPartnerEFKAPayments: noop,
    getMembers: noop,
    saveMembers: noop,
    getMemberEFKAPayments: noop,
    getShareholders: noop,
    saveShareholders: noop,
    getShareholderEFKAPayments: noop,
    getEFKAPayments: noop,
    updateEFKAPayment: noop,
    getEFKAUserConfig: noop,
    saveEFKAUserConfig: noop,
    getTaxInstallments: noop,
    updateTaxInstallment: noop,
    createExpenseDocument: noop,
    getExpenseDocument: noop,
    updateExpenseDocument: noop,
    listExpenseDocuments: noop,
    createAPYCertificate: noop,
    getAPYCertificate: noop,
    listAPYCertificates: noop,
    updateAPYCertificate: noop,
    pushAPYEmailRecord: noop,
    createCustomCategory: noop,
    getCustomCategory: noop,
    listCustomCategories: noop,
    updateCustomCategory: noop,
    deleteCustomCategory: noop,
    getCustomerBalance: noop,
    upsertCustomerBalance: noop,
    listCustomerBalances: noop,
    getFiscalPeriod: noop,
    listFiscalPeriods: noop,
    updateFiscalPeriod: noop,
    createFiscalPeriods: noop,
    createAuditEntry: noop,
    listAuditEntries: noop,
  } as jest.Mocked<IAccountingRepository>;
}

/** Helper: empty PaginatedResult */
function emptyPaginatedResult() {
  return { items: [], hasNext: false, totalShown: 0, pageSize: 50 };
}

/** Helper: PaginatedResult with items */
function paginatedResult(items: JournalEntry[]) {
  return { items, hasNext: false, totalShown: items.length, pageSize: 50 };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('VATEngine', () => {
  let engine: VATEngine;
  let mockRepo: jest.Mocked<IAccountingRepository>;

  beforeEach(() => {
    mockRepo = createMockRepository();
    engine = new VATEngine(mockRepo);
  });

  // ==========================================================================
  // A. PURE FUNCTION TESTS — calculateOutputVat
  // ==========================================================================

  describe('calculateOutputVat', () => {
    it('calculates 24% VAT correctly on €1000', () => {
      const result: VATCalculation = engine.calculateOutputVat(1000, 24);
      expect(result).toEqual({
        netAmount: 1000,
        vatRate: 24,
        vatAmount: 240,
        grossAmount: 1240,
      });
    });

    it('calculates 13% VAT correctly on €500', () => {
      const result = engine.calculateOutputVat(500, 13);
      expect(result.vatAmount).toBe(65);
      expect(result.grossAmount).toBe(565);
    });

    it('calculates 6% VAT correctly on €200', () => {
      const result = engine.calculateOutputVat(200, 6);
      expect(result.vatAmount).toBe(12);
      expect(result.grossAmount).toBe(212);
    });

    it('calculates 0% VAT (exempt) correctly', () => {
      const result = engine.calculateOutputVat(750, 0);
      expect(result.vatAmount).toBe(0);
      expect(result.grossAmount).toBe(750);
    });

    it('handles zero net amount', () => {
      const result = engine.calculateOutputVat(0, 24);
      expect(result.vatAmount).toBe(0);
      expect(result.grossAmount).toBe(0);
    });

    it('handles small amounts with rounding (€0.01)', () => {
      const result = engine.calculateOutputVat(0.01, 24);
      expect(result.vatAmount).toBe(0);
      expect(result.grossAmount).toBe(0.01);
    });

    it('handles rounding for €33.33 at 24%', () => {
      // 33.33 * 0.24 = 7.9992 → should round to 8.00
      const result = engine.calculateOutputVat(33.33, 24);
      expect(result.vatAmount).toBe(8);
      expect(result.grossAmount).toBe(41.33);
    });

    it('handles rounding for €0.005 edge case', () => {
      // 0.005 * 24/100 = 0.0012 → rounds to 0
      const result = engine.calculateOutputVat(0.005, 24);
      expect(result.vatAmount).toBe(0);
      expect(result.grossAmount).toBe(0.01);
    });

    it('handles large amounts (€1,000,000) at 24%', () => {
      const result = engine.calculateOutputVat(1_000_000, 24);
      expect(result.vatAmount).toBe(240_000);
      expect(result.grossAmount).toBe(1_240_000);
    });

    it('preserves netAmount and vatRate in output', () => {
      const result = engine.calculateOutputVat(123.45, 13);
      expect(result.netAmount).toBe(123.45);
      expect(result.vatRate).toBe(13);
    });

    it('handles fractional cents correctly (€99.99 at 24%)', () => {
      // 99.99 * 0.24 = 23.9976 → 24.00
      const result = engine.calculateOutputVat(99.99, 24);
      expect(result.vatAmount).toBe(24);
      expect(result.grossAmount).toBe(123.99);
    });
  });

  // ==========================================================================
  // A. PURE FUNCTION TESTS — calculateInputVat
  // ==========================================================================

  describe('calculateInputVat', () => {
    // ── 100% deductible categories ────────────────────────────────────────

    it('calculates 100% deductible VAT for office_supplies', () => {
      const result: VATInputCalculation = engine.calculateInputVat(100, 24, 'office_supplies');
      expect(result.vatAmount).toBe(24);
      expect(result.deductiblePercent).toBe(100);
      expect(result.deductibleVatAmount).toBe(24);
      expect(result.nonDeductibleVatAmount).toBe(0);
    });

    it('calculates 100% deductible VAT for software at 24%', () => {
      const result = engine.calculateInputVat(500, 24, 'software');
      expect(result.vatAmount).toBe(120);
      expect(result.deductibleVatAmount).toBe(120);
      expect(result.nonDeductibleVatAmount).toBe(0);
    });

    it('calculates 100% deductible VAT for equipment', () => {
      const result = engine.calculateInputVat(2000, 24, 'equipment');
      expect(result.deductiblePercent).toBe(100);
      expect(result.deductibleVatAmount).toBe(480);
    });

    it('calculates 100% deductible VAT for fuel', () => {
      const result = engine.calculateInputVat(80, 24, 'fuel');
      expect(result.deductiblePercent).toBe(100);
      expect(result.deductibleVatAmount).toBe(19.2);
    });

    it('calculates 100% deductible VAT for utilities', () => {
      const result = engine.calculateInputVat(150, 13, 'utilities');
      expect(result.vatAmount).toBe(19.5);
      expect(result.deductiblePercent).toBe(100);
      expect(result.deductibleVatAmount).toBe(19.5);
    });

    it('calculates 100% deductible VAT for travel', () => {
      const result = engine.calculateInputVat(300, 24, 'travel');
      expect(result.deductiblePercent).toBe(100);
    });

    it('calculates 100% deductible VAT for training', () => {
      const result = engine.calculateInputVat(250, 24, 'training');
      expect(result.deductiblePercent).toBe(100);
    });

    it('calculates 100% deductible VAT for advertising', () => {
      const result = engine.calculateInputVat(1000, 24, 'advertising');
      expect(result.deductiblePercent).toBe(100);
    });

    it('calculates 100% deductible VAT for third_party_fees', () => {
      const result = engine.calculateInputVat(400, 24, 'third_party_fees');
      expect(result.deductiblePercent).toBe(100);
      expect(result.deductibleVatAmount).toBe(96);
    });

    it('calculates 100% deductible VAT for other_expense', () => {
      const result = engine.calculateInputVat(50, 24, 'other_expense');
      expect(result.deductiblePercent).toBe(100);
    });

    // ── 50% deductible categories ─────────────────────────────────────────

    it('calculates 50% deductible VAT for telecom', () => {
      const result = engine.calculateInputVat(100, 24, 'telecom');
      expect(result.vatAmount).toBe(24);
      expect(result.deductiblePercent).toBe(50);
      expect(result.deductibleVatAmount).toBe(12);
      expect(result.nonDeductibleVatAmount).toBe(12);
    });

    it('calculates 50% deductible VAT for vehicle_expenses', () => {
      const result = engine.calculateInputVat(200, 24, 'vehicle_expenses');
      expect(result.vatAmount).toBe(48);
      expect(result.deductiblePercent).toBe(50);
      expect(result.deductibleVatAmount).toBe(24);
      expect(result.nonDeductibleVatAmount).toBe(24);
    });

    // ── 0% deductible categories ──────────────────────────────────────────

    it('calculates 0% deductible VAT for rent', () => {
      const result = engine.calculateInputVat(800, 0, 'rent');
      expect(result.vatAmount).toBe(0);
      expect(result.deductiblePercent).toBe(0);
      expect(result.deductibleVatAmount).toBe(0);
      expect(result.nonDeductibleVatAmount).toBe(0);
    });

    it('calculates 0% deductible VAT for vehicle_insurance', () => {
      const result = engine.calculateInputVat(500, 0, 'vehicle_insurance');
      expect(result.deductiblePercent).toBe(0);
      expect(result.deductibleVatAmount).toBe(0);
    });

    it('calculates 0% deductible VAT for efka', () => {
      const result = engine.calculateInputVat(400, 0, 'efka');
      expect(result.deductiblePercent).toBe(0);
    });

    it('calculates 0% deductible VAT for professional_tax', () => {
      const result = engine.calculateInputVat(650, 0, 'professional_tax');
      expect(result.deductiblePercent).toBe(0);
    });

    it('calculates 0% deductible VAT for bank_fees', () => {
      const result = engine.calculateInputVat(15, 0, 'bank_fees');
      expect(result.deductiblePercent).toBe(0);
    });

    it('calculates 0% deductible VAT for tee_fees', () => {
      const result = engine.calculateInputVat(100, 0, 'tee_fees');
      expect(result.deductiblePercent).toBe(0);
    });

    it('calculates 0% deductible VAT for depreciation', () => {
      const result = engine.calculateInputVat(1000, 0, 'depreciation');
      expect(result.deductiblePercent).toBe(0);
    });

    // ── Edge cases ────────────────────────────────────────────────────────

    it('calculates correctly with zero net amount', () => {
      const result = engine.calculateInputVat(0, 24, 'office_supplies');
      expect(result.vatAmount).toBe(0);
      expect(result.grossAmount).toBe(0);
      expect(result.deductibleVatAmount).toBe(0);
      expect(result.nonDeductibleVatAmount).toBe(0);
    });

    it('handles rounding on 50% deductible split', () => {
      // 33.33 * 0.24 = 7.9992 → 8.00
      // 50% of 8.00 = 4.00
      const result = engine.calculateInputVat(33.33, 24, 'telecom');
      expect(result.vatAmount).toBe(8);
      expect(result.deductibleVatAmount).toBe(4);
      expect(result.nonDeductibleVatAmount).toBe(4);
    });

    it('returns correct grossAmount', () => {
      const result = engine.calculateInputVat(100, 24, 'software');
      expect(result.grossAmount).toBe(124);
    });
  });

  // ==========================================================================
  // A. PURE FUNCTION TESTS — getDeductibilityRule
  // ==========================================================================

  describe('getDeductibilityRule', () => {
    it('returns 100% rule for office_supplies', () => {
      const rule: VATDeductibilityRule = engine.getDeductibilityRule('office_supplies');
      expect(rule.category).toBe('office_supplies');
      expect(rule.deductiblePercent).toBe(100);
      expect(rule.legalBasis).toContain('vatConfig.legalBasis.');
    });

    it('returns 50% rule for telecom', () => {
      const rule = engine.getDeductibilityRule('telecom');
      expect(rule.deductiblePercent).toBe(50);
      expect(rule.notes).toBe('vatConfig.notes.mixedUse');
    });

    it('returns 50% rule for vehicle_expenses', () => {
      const rule = engine.getDeductibilityRule('vehicle_expenses');
      expect(rule.deductiblePercent).toBe(50);
    });

    it('returns 0% rule for rent', () => {
      const rule = engine.getDeductibilityRule('rent');
      expect(rule.deductiblePercent).toBe(0);
    });

    it('returns 0% rule for efka', () => {
      const rule = engine.getDeductibilityRule('efka');
      expect(rule.deductiblePercent).toBe(0);
    });

    it('returns 0% rule for bank_fees', () => {
      const rule = engine.getDeductibilityRule('bank_fees');
      expect(rule.deductiblePercent).toBe(0);
    });

    it('returns legal basis for every known category', () => {
      const categories: ExpenseCategory[] = [
        'third_party_fees', 'rent', 'utilities', 'telecom', 'fuel',
        'vehicle_expenses', 'vehicle_insurance', 'office_supplies',
        'software', 'equipment', 'travel', 'training', 'advertising',
        'efka', 'professional_tax', 'bank_fees', 'tee_fees',
        'depreciation', 'other_expense',
      ];

      for (const cat of categories) {
        const rule = engine.getDeductibilityRule(cat);
        expect(rule.category).toBe(cat);
        expect(rule.legalBasis).toBeTruthy();
        expect(typeof rule.deductiblePercent).toBe('number');
      }
    });

    it('returns 0% fallback for unknown category with correct legal basis', () => {
      // Force an unknown category through type assertion to test the fallback path
      const unknownCategory = 'unknown_category_xyz' as ExpenseCategory;
      const rule = engine.getDeductibilityRule(unknownCategory);
      expect(rule.deductiblePercent).toBe(0);
      expect(rule.legalBasis).toBe('Ν.2859/2000 — Κατηγορία χωρίς ρητή εκπτωσιμότητα');
      expect(rule.notes).toBeNull();
    });
  });

  // ==========================================================================
  // B. ASYNC TESTS — calculateQuarterSummary
  // ==========================================================================

  describe('calculateQuarterSummary', () => {
    it('returns empty summary when no entries exist', async () => {
      mockRepo.listJournalEntries.mockResolvedValue(emptyPaginatedResult());

      const result: VATQuarterSummary = await engine.calculateQuarterSummary(2026, 1);

      expect(result.fiscalYear).toBe(2026);
      expect(result.quarter).toBe(1);
      expect(result.totalOutputVat).toBe(0);
      expect(result.totalInputVat).toBe(0);
      expect(result.totalDeductibleInputVat).toBe(0);
      expect(result.vatPayable).toBe(0);
      expect(result.vatCredit).toBe(0);
      expect(result.outputBreakdown).toHaveLength(0);
      expect(result.inputBreakdown).toHaveLength(0);
    });

    it('sets correct Q1 period range', async () => {
      mockRepo.listJournalEntries.mockResolvedValue(emptyPaginatedResult());

      const result = await engine.calculateQuarterSummary(2026, 1);

      expect(result.period).toEqual({ from: '2026-01-01', to: '2026-03-31' });
    });

    it('sets correct Q2 period range', async () => {
      mockRepo.listJournalEntries.mockResolvedValue(emptyPaginatedResult());

      const result = await engine.calculateQuarterSummary(2026, 2);

      expect(result.period).toEqual({ from: '2026-04-01', to: '2026-06-30' });
    });

    it('sets correct Q3 period range', async () => {
      mockRepo.listJournalEntries.mockResolvedValue(emptyPaginatedResult());

      const result = await engine.calculateQuarterSummary(2026, 3);

      expect(result.period).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    });

    it('sets correct Q4 period range', async () => {
      mockRepo.listJournalEntries.mockResolvedValue(emptyPaginatedResult());

      const result = await engine.calculateQuarterSummary(2026, 4);

      expect(result.period).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    });

    it('calculates output VAT from income entries', async () => {
      const incomeEntries = [
        createMockJournalEntry({ netAmount: 1000, vatRate: 24, vatAmount: 240, category: 'service_income', type: 'income' }),
        createMockJournalEntry({ netAmount: 500, vatRate: 24, vatAmount: 120, category: 'service_income', type: 'income' }),
      ];

      mockRepo.listJournalEntries
        .mockResolvedValueOnce(paginatedResult(incomeEntries)) // income
        .mockResolvedValueOnce(emptyPaginatedResult());          // expense

      const result = await engine.calculateQuarterSummary(2026, 1);

      expect(result.totalOutputVat).toBe(360);
      expect(result.outputBreakdown).toHaveLength(1);
      expect(result.outputBreakdown[0].vatRate).toBe(24);
      expect(result.outputBreakdown[0].totalNetAmount).toBe(1500);
      expect(result.outputBreakdown[0].totalVatAmount).toBe(360);
      expect(result.outputBreakdown[0].entryCount).toBe(2);
    });

    it('groups output VAT by rate', async () => {
      const incomeEntries = [
        createMockJournalEntry({ netAmount: 1000, vatRate: 24, vatAmount: 240, category: 'service_income', type: 'income' }),
        createMockJournalEntry({ netAmount: 300, vatRate: 13, vatAmount: 39, category: 'construction_income', type: 'income' }),
        createMockJournalEntry({ netAmount: 200, vatRate: 24, vatAmount: 48, category: 'service_income', type: 'income' }),
      ];

      mockRepo.listJournalEntries
        .mockResolvedValueOnce(paginatedResult(incomeEntries))
        .mockResolvedValueOnce(emptyPaginatedResult());

      const result = await engine.calculateQuarterSummary(2026, 1);

      expect(result.outputBreakdown).toHaveLength(2);
      expect(result.totalOutputVat).toBe(327); // 240 + 48 + 39

      const rate24 = result.outputBreakdown.find(b => b.vatRate === 24);
      const rate13 = result.outputBreakdown.find(b => b.vatRate === 13);

      expect(rate24?.totalVatAmount).toBe(288);
      expect(rate24?.entryCount).toBe(2);
      expect(rate13?.totalVatAmount).toBe(39);
      expect(rate13?.entryCount).toBe(1);
    });

    it('calculates input VAT with full deductibility', async () => {
      const expenseEntries = [
        createMockJournalEntry({ netAmount: 200, vatRate: 24, vatAmount: 48, category: 'office_supplies', type: 'expense' }),
      ];

      mockRepo.listJournalEntries
        .mockResolvedValueOnce(emptyPaginatedResult())             // income
        .mockResolvedValueOnce(paginatedResult(expenseEntries));    // expense

      const result = await engine.calculateQuarterSummary(2026, 1);

      expect(result.totalInputVat).toBe(48);
      expect(result.totalDeductibleInputVat).toBe(48);
      expect(result.inputBreakdown).toHaveLength(1);
      expect(result.inputBreakdown[0].totalDeductibleVat).toBe(48);
      expect(result.inputBreakdown[0].totalNonDeductibleVat).toBe(0);
    });

    it('calculates input VAT with 50% deductibility for telecom', async () => {
      const expenseEntries = [
        createMockJournalEntry({ netAmount: 100, vatRate: 24, vatAmount: 24, category: 'telecom', type: 'expense' }),
      ];

      mockRepo.listJournalEntries
        .mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(paginatedResult(expenseEntries));

      const result = await engine.calculateQuarterSummary(2026, 1);

      expect(result.totalInputVat).toBe(24);
      expect(result.totalDeductibleInputVat).toBe(12);
      expect(result.inputBreakdown[0].totalDeductibleVat).toBe(12);
      expect(result.inputBreakdown[0].totalNonDeductibleVat).toBe(12);
    });

    it('calculates vatPayable when output > deductible input', async () => {
      const incomeEntries = [
        createMockJournalEntry({ netAmount: 1000, vatRate: 24, vatAmount: 240, category: 'service_income', type: 'income' }),
      ];
      const expenseEntries = [
        createMockJournalEntry({ netAmount: 200, vatRate: 24, vatAmount: 48, category: 'office_supplies', type: 'expense' }),
      ];

      mockRepo.listJournalEntries
        .mockResolvedValueOnce(paginatedResult(incomeEntries))
        .mockResolvedValueOnce(paginatedResult(expenseEntries));

      const result = await engine.calculateQuarterSummary(2026, 1);

      // vatPayable = max(0, 240 - 48) = 192
      expect(result.vatPayable).toBe(192);
      expect(result.vatCredit).toBe(0);
    });

    it('calculates vatCredit when deductible input > output', async () => {
      const incomeEntries = [
        createMockJournalEntry({ netAmount: 100, vatRate: 24, vatAmount: 24, category: 'service_income', type: 'income' }),
      ];
      const expenseEntries = [
        createMockJournalEntry({ netAmount: 1000, vatRate: 24, vatAmount: 240, category: 'equipment', type: 'expense' }),
      ];

      mockRepo.listJournalEntries
        .mockResolvedValueOnce(paginatedResult(incomeEntries))
        .mockResolvedValueOnce(paginatedResult(expenseEntries));

      const result = await engine.calculateQuarterSummary(2026, 1);

      // vatCredit = max(0, 240 - 24) = 216
      expect(result.vatPayable).toBe(0);
      expect(result.vatCredit).toBe(216);
    });

    it('handles mixed deductibility in same quarter', async () => {
      const expenseEntries = [
        createMockJournalEntry({ netAmount: 100, vatRate: 24, vatAmount: 24, category: 'office_supplies', type: 'expense' }),  // 100% → 24
        createMockJournalEntry({ netAmount: 100, vatRate: 24, vatAmount: 24, category: 'telecom', type: 'expense' }),          // 50% → 12
        createMockJournalEntry({ netAmount: 500, vatRate: 0, vatAmount: 0, category: 'rent', type: 'expense' }),               // 0% → 0
      ];

      mockRepo.listJournalEntries
        .mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(paginatedResult(expenseEntries));

      const result = await engine.calculateQuarterSummary(2026, 1);

      // Total input VAT = 24 + 24 + 0 = 48
      // Total deductible = 24 + 12 + 0 = 36
      expect(result.totalInputVat).toBe(48);
      expect(result.totalDeductibleInputVat).toBe(36);
    });

    it('sets status to open and submittedAt to null', async () => {
      mockRepo.listJournalEntries.mockResolvedValue(emptyPaginatedResult());

      const result = await engine.calculateQuarterSummary(2026, 1);

      expect(result.status).toBe('open');
      expect(result.submittedAt).toBeNull();
    });

    it('sets calculatedAt as ISO string', async () => {
      mockRepo.listJournalEntries.mockResolvedValue(emptyPaginatedResult());

      const before = new Date().toISOString();
      const result = await engine.calculateQuarterSummary(2026, 1);
      const after = new Date().toISOString();

      expect(result.calculatedAt).toBeTruthy();
      expect(result.calculatedAt >= before).toBe(true);
      expect(result.calculatedAt <= after).toBe(true);
    });

    it('calls listJournalEntries with correct filters for income and expense', async () => {
      mockRepo.listJournalEntries.mockResolvedValue(emptyPaginatedResult());

      await engine.calculateQuarterSummary(2026, 2);

      expect(mockRepo.listJournalEntries).toHaveBeenCalledTimes(2);
      expect(mockRepo.listJournalEntries).toHaveBeenCalledWith({
        fiscalYear: 2026,
        quarter: 2,
        type: 'income',
      });
      expect(mockRepo.listJournalEntries).toHaveBeenCalledWith({
        fiscalYear: 2026,
        quarter: 2,
        type: 'expense',
      });
    });

    it('handles entries with 0% VAT rate in output', async () => {
      const incomeEntries = [
        createMockJournalEntry({ netAmount: 1000, vatRate: 0, vatAmount: 0, category: 'rental_income', type: 'income' }),
      ];

      mockRepo.listJournalEntries
        .mockResolvedValueOnce(paginatedResult(incomeEntries))
        .mockResolvedValueOnce(emptyPaginatedResult());

      const result = await engine.calculateQuarterSummary(2026, 1);

      expect(result.totalOutputVat).toBe(0);
      expect(result.outputBreakdown).toHaveLength(1);
      expect(result.outputBreakdown[0].vatRate).toBe(0);
    });
  });

  // ==========================================================================
  // B. ASYNC TESTS — calculateAnnualSummary
  // ==========================================================================

  describe('calculateAnnualSummary', () => {
    it('returns summary for all 4 quarters', async () => {
      mockRepo.listJournalEntries.mockResolvedValue(emptyPaginatedResult());

      const result: VATAnnualSummary = await engine.calculateAnnualSummary(2026);

      expect(result.fiscalYear).toBe(2026);
      expect(result.quarters).toHaveLength(4);
      expect(result.quarters[0].quarter).toBe(1);
      expect(result.quarters[1].quarter).toBe(2);
      expect(result.quarters[2].quarter).toBe(3);
      expect(result.quarters[3].quarter).toBe(4);
    });

    it('aggregates annual output VAT across quarters', async () => {
      // Each quarter call = 2 listJournalEntries calls (income + expense)
      // Q1: income 240 VAT, Q2: income 120 VAT, Q3+Q4: empty
      const q1Income = [
        createMockJournalEntry({ netAmount: 1000, vatRate: 24, vatAmount: 240, category: 'service_income', type: 'income' }),
      ];
      const q2Income = [
        createMockJournalEntry({ netAmount: 500, vatRate: 24, vatAmount: 120, category: 'service_income', type: 'income' }),
      ];

      mockRepo.listJournalEntries
        // Q1
        .mockResolvedValueOnce(paginatedResult(q1Income))
        .mockResolvedValueOnce(emptyPaginatedResult())
        // Q2
        .mockResolvedValueOnce(paginatedResult(q2Income))
        .mockResolvedValueOnce(emptyPaginatedResult())
        // Q3
        .mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(emptyPaginatedResult())
        // Q4
        .mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(emptyPaginatedResult());

      const result = await engine.calculateAnnualSummary(2026);

      expect(result.annualOutputVat).toBe(360);
    });

    it('aggregates annual deductible input VAT across quarters', async () => {
      const q1Expense = [
        createMockJournalEntry({ netAmount: 200, vatRate: 24, vatAmount: 48, category: 'office_supplies', type: 'expense' }),
      ];
      const q3Expense = [
        createMockJournalEntry({ netAmount: 100, vatRate: 24, vatAmount: 24, category: 'telecom', type: 'expense' }),
      ];

      mockRepo.listJournalEntries
        // Q1: no income, office supplies expense
        .mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(paginatedResult(q1Expense))
        // Q2: empty
        .mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(emptyPaginatedResult())
        // Q3: no income, telecom expense
        .mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(paginatedResult(q3Expense))
        // Q4: empty
        .mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(emptyPaginatedResult());

      const result = await engine.calculateAnnualSummary(2026);

      // Q1 deductible = 48 (100%), Q3 deductible = 12 (50% of 24)
      expect(result.annualDeductibleInputVat).toBe(60);
    });

    it('calculates annualVatPayable when output > input', async () => {
      const income = [
        createMockJournalEntry({ netAmount: 5000, vatRate: 24, vatAmount: 1200, category: 'service_income', type: 'income' }),
      ];
      const expense = [
        createMockJournalEntry({ netAmount: 500, vatRate: 24, vatAmount: 120, category: 'software', type: 'expense' }),
      ];

      // Only Q1 has data
      mockRepo.listJournalEntries
        .mockResolvedValueOnce(paginatedResult(income))
        .mockResolvedValueOnce(paginatedResult(expense))
        // Q2-Q4 empty
        .mockResolvedValueOnce(emptyPaginatedResult()).mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(emptyPaginatedResult()).mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(emptyPaginatedResult()).mockResolvedValueOnce(emptyPaginatedResult());

      const result = await engine.calculateAnnualSummary(2026);

      expect(result.annualOutputVat).toBe(1200);
      expect(result.annualDeductibleInputVat).toBe(120);
      expect(result.annualVatPayable).toBe(1080);
      expect(result.annualVatCredit).toBe(0);
    });

    it('calculates annualVatCredit when input > output', async () => {
      const income = [
        createMockJournalEntry({ netAmount: 100, vatRate: 24, vatAmount: 24, category: 'service_income', type: 'income' }),
      ];
      const expense = [
        createMockJournalEntry({ netAmount: 2000, vatRate: 24, vatAmount: 480, category: 'equipment', type: 'expense' }),
      ];

      mockRepo.listJournalEntries
        .mockResolvedValueOnce(paginatedResult(income))
        .mockResolvedValueOnce(paginatedResult(expense))
        .mockResolvedValueOnce(emptyPaginatedResult()).mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(emptyPaginatedResult()).mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(emptyPaginatedResult()).mockResolvedValueOnce(emptyPaginatedResult());

      const result = await engine.calculateAnnualSummary(2026);

      expect(result.annualVatPayable).toBe(0);
      expect(result.annualVatCredit).toBe(456); // 480 - 24
    });

    it('calculates totalVatPaid from quarterly vatPayable sums', async () => {
      // Q1: 1000 income → 240 output, 200 expense → 48 input → payable = 192
      // Q2: 500 income → 120 output, no expense → payable = 120
      const q1Income = [
        createMockJournalEntry({ netAmount: 1000, vatRate: 24, vatAmount: 240, category: 'service_income', type: 'income' }),
      ];
      const q1Expense = [
        createMockJournalEntry({ netAmount: 200, vatRate: 24, vatAmount: 48, category: 'software', type: 'expense' }),
      ];
      const q2Income = [
        createMockJournalEntry({ netAmount: 500, vatRate: 24, vatAmount: 120, category: 'service_income', type: 'income' }),
      ];

      mockRepo.listJournalEntries
        // Q1
        .mockResolvedValueOnce(paginatedResult(q1Income))
        .mockResolvedValueOnce(paginatedResult(q1Expense))
        // Q2
        .mockResolvedValueOnce(paginatedResult(q2Income))
        .mockResolvedValueOnce(emptyPaginatedResult())
        // Q3-Q4
        .mockResolvedValueOnce(emptyPaginatedResult()).mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(emptyPaginatedResult()).mockResolvedValueOnce(emptyPaginatedResult());

      const result = await engine.calculateAnnualSummary(2026);

      // totalVatPaid = sum of quarterly vatPayable = 192 + 120 = 312
      expect(result.totalVatPaid).toBe(312);
    });

    it('calculates settlementAmount = annualVatPayable - totalVatPaid', async () => {
      // All data in Q1 for simplicity
      const income = [
        createMockJournalEntry({ netAmount: 1000, vatRate: 24, vatAmount: 240, category: 'service_income', type: 'income' }),
      ];

      mockRepo.listJournalEntries
        .mockResolvedValueOnce(paginatedResult(income))
        .mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(emptyPaginatedResult()).mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(emptyPaginatedResult()).mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(emptyPaginatedResult()).mockResolvedValueOnce(emptyPaginatedResult());

      const result = await engine.calculateAnnualSummary(2026);

      // annualVatPayable = 240 (all output, no deductible input)
      // totalVatPaid = 240 (Q1 payable = 240)
      // settlementAmount = 240 - 240 = 0
      expect(result.settlementAmount).toBe(0);
    });

    it('returns zero for all fields when no entries exist', async () => {
      mockRepo.listJournalEntries.mockResolvedValue(emptyPaginatedResult());

      const result = await engine.calculateAnnualSummary(2026);

      expect(result.annualOutputVat).toBe(0);
      expect(result.annualDeductibleInputVat).toBe(0);
      expect(result.annualVatPayable).toBe(0);
      expect(result.annualVatCredit).toBe(0);
      expect(result.totalVatPaid).toBe(0);
      expect(result.settlementAmount).toBe(0);
    });

    it('calls listJournalEntries 8 times (2 per quarter)', async () => {
      mockRepo.listJournalEntries.mockResolvedValue(emptyPaginatedResult());

      await engine.calculateAnnualSummary(2026);

      expect(mockRepo.listJournalEntries).toHaveBeenCalledTimes(8);
    });
  });

  // ==========================================================================
  // C. EDGE CASES — Rounding & Boundary Conditions
  // ==========================================================================

  describe('Edge Cases', () => {
    it('rounding: €0.005 VAT at 24% rounds correctly', () => {
      const result = engine.calculateOutputVat(0.005, 24);
      // 0.005 * 0.24 = 0.0012 → rounds to 0.00
      expect(result.vatAmount).toBe(0);
    });

    it('rounding consistency: deductible + non-deductible = total VAT', () => {
      // Test with amounts that might cause rounding discrepancies
      const testCases: Array<{ net: number; rate: number; cat: ExpenseCategory }> = [
        { net: 33.33, rate: 24, cat: 'telecom' },
        { net: 66.67, rate: 13, cat: 'vehicle_expenses' },
        { net: 111.11, rate: 6, cat: 'telecom' },
        { net: 0.01, rate: 24, cat: 'vehicle_expenses' },
      ];

      for (const tc of testCases) {
        const result = engine.calculateInputVat(tc.net, tc.rate, tc.cat);
        const sum = result.deductibleVatAmount + result.nonDeductibleVatAmount;
        // Due to rounding, the sum might differ by at most 0.01
        expect(Math.abs(sum - result.vatAmount)).toBeLessThanOrEqual(0.01);
      }
    });

    it('gross = net + vat for all VAT rates', () => {
      const rates = [0, 6, 13, 24];
      for (const rate of rates) {
        const result = engine.calculateOutputVat(1234.56, rate);
        expect(result.grossAmount).toBe(
          Math.round((result.netAmount + result.vatAmount + Number.EPSILON) * 100) / 100
        );
      }
    });

    it('negative settlement when input exceeds output across quarters', async () => {
      // Q1: big equipment purchase, Q2: some income
      const q1Expense = [
        createMockJournalEntry({ netAmount: 10000, vatRate: 24, vatAmount: 2400, category: 'equipment', type: 'expense' }),
      ];
      const q2Income = [
        createMockJournalEntry({ netAmount: 1000, vatRate: 24, vatAmount: 240, category: 'service_income', type: 'income' }),
      ];

      mockRepo.listJournalEntries
        // Q1: no income, big expense
        .mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(paginatedResult(q1Expense))
        // Q2: some income, no expense
        .mockResolvedValueOnce(paginatedResult(q2Income))
        .mockResolvedValueOnce(emptyPaginatedResult())
        // Q3-Q4 empty
        .mockResolvedValueOnce(emptyPaginatedResult()).mockResolvedValueOnce(emptyPaginatedResult())
        .mockResolvedValueOnce(emptyPaginatedResult()).mockResolvedValueOnce(emptyPaginatedResult());

      const result = await engine.calculateAnnualSummary(2026);

      // annualOutputVat = 240, annualDeductibleInputVat = 2400
      // annualVatPayable = max(0, 240-2400) = 0
      // annualVatCredit = max(0, 2400-240) = 2160
      // totalVatPaid = 0 (Q1 payable=0) + 240 (Q2 payable=240) = 240
      // settlementAmount = 0 - 240 = -240 (overpaid)
      expect(result.annualVatPayable).toBe(0);
      expect(result.annualVatCredit).toBe(2160);
      expect(result.settlementAmount).toBe(-240);
    });
  });
});
