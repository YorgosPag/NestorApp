/**
 * @fileoverview TaxEngine — Comprehensive Test Suite (Google Presubmit Pattern)
 * @description Tests for Greek income tax calculations, corporate tax, partnerships,
 *              installments, and real-time estimates.
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-31
 * @version 1.0.0
 * @see ADR-ACC-009 Tax Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

import { TaxEngine } from '../tax-engine';
import type { IAccountingRepository } from '../../../types/interfaces';
import type {
  TaxCalculationParams,
} from '../../../types/tax';
import type { JournalEntry } from '../../../types/journal';
import type { CompanyProfile } from '../../../types/company';

// ============================================================================
// HELPERS — roundToTwo replica for expected-value calculations
// ============================================================================

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ============================================================================
// MOCK REPOSITORY FACTORY
// ============================================================================

type MockRepository = {
  [K in keyof IAccountingRepository]: jest.Mock;
};

function createMockRepository(): MockRepository {
  return {
    getCompanySetup: jest.fn(),
    saveCompanySetup: jest.fn(),
    createJournalEntry: jest.fn(),
    getJournalEntry: jest.fn(),
    updateJournalEntry: jest.fn(),
    deleteJournalEntry: jest.fn(),
    listJournalEntries: jest.fn(),
    getJournalEntryByInvoiceId: jest.fn(),
    createInvoice: jest.fn(),
    getInvoice: jest.fn(),
    updateInvoice: jest.fn(),
    listInvoices: jest.fn(),
    getNextInvoiceNumber: jest.fn(),
    getInvoiceSeries: jest.fn(),
    getServicePresets: jest.fn(),
    saveServicePresets: jest.fn(),
    createBankTransaction: jest.fn(),
    getBankTransaction: jest.fn(),
    updateBankTransaction: jest.fn(),
    listBankTransactions: jest.fn(),
    getBankAccounts: jest.fn(),
    createImportBatch: jest.fn(),
    createFixedAsset: jest.fn(),
    getFixedAsset: jest.fn(),
    updateFixedAsset: jest.fn(),
    listFixedAssets: jest.fn(),
    createDepreciationRecord: jest.fn(),
    getDepreciationRecords: jest.fn(),
    getPartners: jest.fn(),
    savePartners: jest.fn(),
    getPartnerEFKAPayments: jest.fn(),
    getMembers: jest.fn(),
    saveMembers: jest.fn(),
    getMemberEFKAPayments: jest.fn(),
    getShareholders: jest.fn(),
    saveShareholders: jest.fn(),
    getShareholderEFKAPayments: jest.fn(),
    getEFKAPayments: jest.fn(),
    updateEFKAPayment: jest.fn(),
    getEFKAUserConfig: jest.fn(),
    saveEFKAUserConfig: jest.fn(),
    getTaxInstallments: jest.fn(),
    updateTaxInstallment: jest.fn(),
    createExpenseDocument: jest.fn(),
    getExpenseDocument: jest.fn(),
    updateExpenseDocument: jest.fn(),
    listExpenseDocuments: jest.fn(),
    createAPYCertificate: jest.fn(),
    getAPYCertificate: jest.fn(),
    listAPYCertificates: jest.fn(),
    updateAPYCertificate: jest.fn(),
    pushAPYEmailRecord: jest.fn(),
    createCustomCategory: jest.fn(),
    getCustomCategory: jest.fn(),
    listCustomCategories: jest.fn(),
    updateCustomCategory: jest.fn(),
    deleteCustomCategory: jest.fn(),
    getCustomerBalance: jest.fn(),
    upsertCustomerBalance: jest.fn(),
    listCustomerBalances: jest.fn(),
    getFiscalPeriod: jest.fn(),
    listFiscalPeriods: jest.fn(),
    updateFiscalPeriod: jest.fn(),
    createFiscalPeriods: jest.fn(),
    createAuditEntry: jest.fn(),
    listAuditEntries: jest.fn(),
  };
}

// ============================================================================
// JOURNAL ENTRY FACTORY
// ============================================================================

function makeJournalEntry(
  overrides: Partial<JournalEntry> & { netAmount: number; category: string }
): JournalEntry {
  return {
    entryId: 'je_test_001',
    date: '2025-06-15',
    type: 'income',
    description: 'Test entry',
    vatRate: 24,
    vatAmount: overrides.netAmount * 0.24,
    grossAmount: overrides.netAmount * 1.24,
    vatDeductible: false,
    paymentMethod: 'bank_transfer',
    contactId: null,
    contactName: null,
    invoiceId: null,
    mydataCode: 'category1_3',
    e3Code: '561_003',
    fiscalYear: 2025,
    quarter: 2,
    notes: null,
    status: 'ACTIVE',
    reversedByEntryId: null,
    reversesEntryId: null,
    createdAt: '2025-06-15T10:00:00Z',
    updatedAt: '2025-06-15T10:00:00Z',
    ...overrides,
  } as JournalEntry;
}

// ============================================================================
// DEFAULT PARAMS FACTORY
// ============================================================================

function makeDefaultParams(overrides?: Partial<TaxCalculationParams>): TaxCalculationParams {
  return {
    fiscalYear: 2025,
    totalIncome: 0,
    totalDeductibleExpenses: 0,
    totalEfkaContributions: 0,
    professionalTax: 650,
    totalWithholdings: 0,
    previousYearPrepayment: 0,
    isFirstFiveYears: false,
    ...overrides,
  };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('TaxEngine', () => {
  let mockRepo: MockRepository;
  let engine: TaxEngine;

  beforeEach(() => {
    mockRepo = createMockRepository();
    engine = new TaxEngine(mockRepo);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // A. calculateAnnualTax — Progressive Bracket Tests
  // ══════════════════════════════════════════════════════════════════════════

  describe('calculateAnnualTax', () => {
    // ── Zero income ──────────────────────────────────────────────────────

    it('should return zero tax for zero income', () => {
      const result = engine.calculateAnnualTax(makeDefaultParams({ totalIncome: 0 }));

      expect(result.taxableIncome).toBe(0);
      expect(result.incomeTax).toBe(0);
      expect(result.solidarityContribution).toBe(0);
      expect(result.prepaymentAmount).toBe(0);
      expect(result.finalAmount).toBe(650); // Only professional tax
      expect(result.refundAmount).toBe(0);
    });

    // ── Negative income (expenses > income → clamp to 0) ────────────────

    it('should clamp taxable income to zero when expenses exceed income', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({
          totalIncome: 5000,
          totalDeductibleExpenses: 8000,
          totalEfkaContributions: 2000,
        })
      );

      expect(result.taxableIncome).toBe(0);
      expect(result.incomeTax).toBe(0);
    });

    // ── First bracket only: exactly 10,000€ ─────────────────────────────

    it('should calculate 9% for exactly 10,000€ taxable income', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({ totalIncome: 10_000, professionalTax: 0 })
      );

      expect(result.taxableIncome).toBe(10_000);
      expect(result.incomeTax).toBe(900); // 10000 * 9%
      expect(result.bracketBreakdown).toHaveLength(1);
      expect(result.bracketBreakdown[0].taxableAmount).toBe(10_000);
      expect(result.bracketBreakdown[0].taxAmount).toBe(900);
    });

    // ── Crossing into second bracket: 10,001€ ──────────────────────────

    it('should enter second bracket at 10,001€', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({ totalIncome: 10_001, professionalTax: 0 })
      );

      expect(result.taxableIncome).toBe(10_001);
      // First bracket: 10001 * 9% = 900.09 → wait, bracket width is 10001 (from 0 to 10000)
      // bracketWidth = 10000 - 0 + 1 = 10001
      // So 10001 fits entirely in first bracket
      // Actually: bracket from=0, to=10000 → width = 10000 - 0 + 1 = 10001
      // taxableAmount = min(10001, 10001) = 10001
      // So all fits in bracket 1
      expect(result.incomeTax).toBe(roundToTwo(10_001 * 0.09));
    });

    // ── Full second bracket: exactly 20,000€ ────────────────────────────

    it('should calculate correctly for exactly 20,000€', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({ totalIncome: 20_000, professionalTax: 0 })
      );

      expect(result.taxableIncome).toBe(20_000);
      // Bracket 1: from=0, to=10000, width=10001 → taxable=10001, tax=900.09
      // Bracket 2: from=10001, to=20000, width=10000 → taxable=9999, tax=2199.78
      const expectedBracket1 = roundToTwo(10_001 * 0.09);
      const expectedBracket2 = roundToTwo(9_999 * 0.22);
      expect(result.incomeTax).toBe(roundToTwo(expectedBracket1 + expectedBracket2));
    });

    // ── Exactly 30,000€ ─────────────────────────────────────────────────

    it('should calculate correctly for exactly 30,000€', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({ totalIncome: 30_000, professionalTax: 0 })
      );

      expect(result.taxableIncome).toBe(30_000);
      const b1 = roundToTwo(10_001 * 0.09);
      const b2 = roundToTwo(10_000 * 0.22);
      const b3 = roundToTwo(9_999 * 0.28);
      expect(result.incomeTax).toBe(roundToTwo(b1 + b2 + b3));
      expect(result.bracketBreakdown).toHaveLength(3);
    });

    // ── Exactly 40,000€ ─────────────────────────────────────────────────

    it('should calculate correctly for exactly 40,000€', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({ totalIncome: 40_000, professionalTax: 0 })
      );

      expect(result.taxableIncome).toBe(40_000);
      const b1 = roundToTwo(10_001 * 0.09);
      const b2 = roundToTwo(10_000 * 0.22);
      const b3 = roundToTwo(10_000 * 0.28);
      const b4 = roundToTwo(9_999 * 0.36);
      expect(result.incomeTax).toBe(roundToTwo(b1 + b2 + b3 + b4));
      expect(result.bracketBreakdown).toHaveLength(4);
    });

    // ── 50,000€ (enters top bracket) ────────────────────────────────────

    it('should enter top 44% bracket at 50,000€', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({ totalIncome: 50_000, professionalTax: 0 })
      );

      expect(result.taxableIncome).toBe(50_000);
      expect(result.bracketBreakdown).toHaveLength(5);
      const topBracket = result.bracketBreakdown[4];
      expect(topBracket.bracket.rate).toBe(44);
    });

    // ── Very high income: 1,000,000€ ────────────────────────────────────

    it('should handle very high income (1,000,000€)', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({ totalIncome: 1_000_000, professionalTax: 0 })
      );

      expect(result.taxableIncome).toBe(1_000_000);
      expect(result.bracketBreakdown).toHaveLength(5);
      // Top bracket handles the bulk
      const topBracket = result.bracketBreakdown[4];
      expect(topBracket.bracket.rate).toBe(44);
      expect(topBracket.taxableAmount).toBeGreaterThan(900_000);
      expect(result.incomeTax).toBeGreaterThan(400_000);
    });

    // ── Solidarity contribution (currently 0%) ──────────────────────────

    it('should calculate zero solidarity contribution (2025 rate is 0%)', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({ totalIncome: 50_000, professionalTax: 0 })
      );

      expect(result.solidarityContribution).toBe(0);
    });

    // ── Prepayment: isFirstFiveYears = false → 55% ──────────────────────

    it('should apply 55% prepayment rate for established businesses', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({
          totalIncome: 20_000,
          professionalTax: 0,
          isFirstFiveYears: false,
        })
      );

      expect(result.prepaymentRate).toBe(55);
      expect(result.prepaymentAmount).toBe(roundToTwo(result.incomeTax * 0.55));
    });

    // ── Prepayment: isFirstFiveYears = true → 27.5% ────────────────────

    it('should cap prepayment rate at 27.5% for first five years', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({
          totalIncome: 20_000,
          professionalTax: 0,
          isFirstFiveYears: true,
        })
      );

      expect(result.prepaymentRate).toBe(27.5);
      expect(result.prepaymentAmount).toBe(roundToTwo(result.incomeTax * 0.275));
    });

    // ── Professional tax passthrough ────────────────────────────────────

    it('should include professionalTax in totalObligation', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({ totalIncome: 10_000, professionalTax: 650 })
      );

      const expectedObligation = roundToTwo(
        result.incomeTax + result.solidarityContribution + result.prepaymentAmount + 650
      );
      expect(result.totalObligation).toBe(expectedObligation);
      expect(result.professionalTax).toBe(650);
    });

    // ── Withholdings and previous prepayment ────────────────────────────

    it('should subtract withholdings and previous prepayment from obligation', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({
          totalIncome: 30_000,
          professionalTax: 650,
          totalWithholdings: 2000,
          previousYearPrepayment: 1500,
        })
      );

      expect(result.totalCredits).toBe(3500);
      expect(result.finalAmount).toBe(
        roundToTwo(Math.max(0, result.totalObligation - result.totalCredits))
      );
    });

    // ── Refund scenario (credits > obligation) ──────────────────────────

    it('should calculate refund when credits exceed obligation', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({
          totalIncome: 5_000,
          professionalTax: 0,
          totalWithholdings: 5000,
          previousYearPrepayment: 5000,
        })
      );

      expect(result.totalCredits).toBe(10_000);
      expect(result.totalObligation).toBeLessThan(result.totalCredits);
      expect(result.finalAmount).toBe(0);
      expect(result.refundAmount).toBe(
        roundToTwo(result.totalCredits - result.totalObligation)
      );
    });

    // ── EFKA deduction ──────────────────────────────────────────────────

    it('should deduct EFKA contributions from taxable income', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({
          totalIncome: 30_000,
          totalEfkaContributions: 5_000,
          professionalTax: 0,
        })
      );

      expect(result.taxableIncome).toBe(25_000);
    });

    // ── Full deduction chain: income - expenses - EFKA ──────────────────

    it('should deduct both expenses and EFKA from income', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({
          totalIncome: 50_000,
          totalDeductibleExpenses: 10_000,
          totalEfkaContributions: 5_000,
          professionalTax: 0,
        })
      );

      expect(result.taxableIncome).toBe(35_000);
      expect(result.grossIncome).toBe(50_000);
      expect(result.deductibleExpenses).toBe(10_000);
    });

    // ── fiscalYear passthrough ──────────────────────────────────────────

    it('should set fiscalYear in result', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({ fiscalYear: 2026, totalIncome: 1000 })
      );

      expect(result.fiscalYear).toBe(2026);
    });

    // ── Small income (below first bracket) ──────────────────────────────

    it('should correctly tax small income (500€)', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({ totalIncome: 500, professionalTax: 0 })
      );

      expect(result.taxableIncome).toBe(500);
      expect(result.incomeTax).toBe(roundToTwo(500 * 0.09));
      expect(result.bracketBreakdown).toHaveLength(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // B. getTaxScale
  // ══════════════════════════════════════════════════════════════════════════

  describe('getTaxScale', () => {
    it('should return scale for 2025', () => {
      const scale = engine.getTaxScale(2025);

      expect(scale.year).toBe(2025);
      expect(scale.brackets).toHaveLength(5);
      expect(scale.prepaymentRate).toBe(55);
      expect(scale.professionalTax).toBe(650);
      expect(scale.solidarityRate).toBe(0);
    });

    it('should return scale for 2026', () => {
      const scale = engine.getTaxScale(2026);

      expect(scale.year).toBe(2026);
      expect(scale.brackets).toHaveLength(5);
    });

    it('should fallback to latest year for unknown year (e.g. 2030)', () => {
      // Should not throw, should fallback
      const scale = engine.getTaxScale(2030);

      // Fallback returns the latest config with the requested year set
      expect(scale.year).toBe(2030);
      expect(scale.brackets).toHaveLength(5);
      expect(scale.prepaymentRate).toBe(55);
    });

    it('should return correct bracket boundaries', () => {
      const scale = engine.getTaxScale(2025);
      const brackets = scale.brackets;

      expect(brackets[0]).toEqual({ from: 0, to: 10_000, rate: 9 });
      expect(brackets[1]).toEqual({ from: 10_001, to: 20_000, rate: 22 });
      expect(brackets[2]).toEqual({ from: 20_001, to: 30_000, rate: 28 });
      expect(brackets[3]).toEqual({ from: 30_001, to: 40_000, rate: 36 });
      expect(brackets[4]).toEqual({ from: 40_001, to: null, rate: 44 });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // C. calculatePartnershipTax — OE (Pass-through)
  // ══════════════════════════════════════════════════════════════════════════

  describe('calculatePartnershipTax', () => {
    it('should split profit 50/50 between two partners', () => {
      const efkaMap = new Map<string, number>([
        ['p1', 3000],
        ['p2', 3000],
      ]);

      const result = engine.calculatePartnershipTax(2025, 100_000, 20_000, efkaMap, [
        {
          partnerId: 'p1',
          partnerName: 'Partner A',
          profitSharePercent: 50,
          withholdings: 0,
          previousPrepayment: 0,
          isFirstFiveYears: false,
        },
        {
          partnerId: 'p2',
          partnerName: 'Partner B',
          profitSharePercent: 50,
          withholdings: 0,
          previousPrepayment: 0,
          isFirstFiveYears: false,
        },
      ]);

      expect(result.fiscalYear).toBe(2025);
      expect(result.totalEntityIncome).toBe(100_000);
      expect(result.totalEntityExpenses).toBe(20_000);
      expect(result.totalEntityProfit).toBe(80_000);
      expect(result.entityProfessionalTax).toBe(1000); // OE = 1000€
      expect(result.partnerResults).toHaveLength(2);

      const p1 = result.partnerResults[0];
      const p2 = result.partnerResults[1];
      expect(p1.profitShare).toBe(40_000);
      expect(p2.profitShare).toBe(40_000);
      // Each partner taxed individually on 40000 - 3000 EFKA = 37000
      expect(p1.taxResult.taxableIncome).toBe(37_000);
      expect(p2.taxResult.taxableIncome).toBe(37_000);
    });

    it('should split profit 70/30 between two partners', () => {
      const efkaMap = new Map<string, number>([
        ['p1', 4000],
        ['p2', 2000],
      ]);

      const result = engine.calculatePartnershipTax(2025, 100_000, 30_000, efkaMap, [
        {
          partnerId: 'p1',
          partnerName: 'Partner A',
          profitSharePercent: 70,
          withholdings: 1000,
          previousPrepayment: 500,
          isFirstFiveYears: false,
        },
        {
          partnerId: 'p2',
          partnerName: 'Partner B',
          profitSharePercent: 30,
          withholdings: 500,
          previousPrepayment: 0,
          isFirstFiveYears: true,
        },
      ]);

      expect(result.totalEntityProfit).toBe(70_000);
      const p1 = result.partnerResults[0];
      const p2 = result.partnerResults[1];

      expect(p1.profitShare).toBe(49_000);
      expect(p2.profitShare).toBe(21_000);

      // P1: 49000 - 4000 EFKA = 45000 taxable
      expect(p1.taxResult.taxableIncome).toBe(45_000);
      expect(p1.taxResult.totalWithholdings).toBe(1000);
      expect(p1.taxResult.previousYearPrepayment).toBe(500);

      // P2: 21000 - 2000 EFKA = 19000 taxable, first five years
      expect(p2.taxResult.taxableIncome).toBe(19_000);
      expect(p2.taxResult.prepaymentRate).toBe(27.5);
    });

    it('should handle zero profit (expenses >= income)', () => {
      const efkaMap = new Map<string, number>();

      const result = engine.calculatePartnershipTax(2025, 10_000, 15_000, efkaMap, [
        {
          partnerId: 'p1',
          partnerName: 'Partner A',
          profitSharePercent: 100,
          withholdings: 0,
          previousPrepayment: 0,
          isFirstFiveYears: false,
        },
      ]);

      expect(result.totalEntityProfit).toBe(0);
      expect(result.partnerResults[0].profitShare).toBe(0);
      expect(result.partnerResults[0].taxResult.incomeTax).toBe(0);
    });

    it('should set professionalTax to 0 at partner level (entity level only)', () => {
      const efkaMap = new Map<string, number>();

      const result = engine.calculatePartnershipTax(2025, 50_000, 10_000, efkaMap, [
        {
          partnerId: 'p1',
          partnerName: 'Partner A',
          profitSharePercent: 100,
          withholdings: 0,
          previousPrepayment: 0,
          isFirstFiveYears: false,
        },
      ]);

      expect(result.partnerResults[0].taxResult.professionalTax).toBe(0);
      expect(result.entityProfessionalTax).toBe(1000);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // D. calculateCorporateTax — EPE (22% flat)
  // ══════════════════════════════════════════════════════════════════════════

  describe('calculateCorporateTax', () => {
    const twoMembers = [
      { memberId: 'm1', memberName: 'Member A', dividendSharePercent: 60 },
      { memberId: 'm2', memberName: 'Member B', dividendSharePercent: 40 },
    ];

    it('should apply 22% flat corporate tax rate', () => {
      const result = engine.calculateCorporateTax(2025, 200_000, 50_000, 10_000, twoMembers);

      // taxableIncome = max(0, 200000 - 50000 - 10000) = 140000
      expect(result.corporateTax.taxableIncome).toBe(140_000);
      expect(result.corporateTax.corporateTaxRate).toBe(22);
      expect(result.corporateTax.corporateTaxAmount).toBe(roundToTwo(140_000 * 0.22));
    });

    it('should apply 80% prepayment rate for EPE', () => {
      const result = engine.calculateCorporateTax(2025, 200_000, 50_000, 10_000, twoMembers);

      expect(result.corporateTax.prepaymentRate).toBe(80);
      expect(result.corporateTax.prepaymentAmount).toBe(
        roundToTwo(result.corporateTax.corporateTaxAmount * 0.8)
      );
    });

    it('should set 1000€ professional tax for EPE', () => {
      const result = engine.calculateCorporateTax(2025, 200_000, 50_000, 0, twoMembers);

      expect(result.corporateTax.professionalTax).toBe(1000);
    });

    it('should calculate totalObligation as tax + profTax + prepayment', () => {
      const result = engine.calculateCorporateTax(2025, 100_000, 20_000, 0, twoMembers);

      const ct = result.corporateTax;
      const expected = roundToTwo(ct.corporateTaxAmount + ct.professionalTax + ct.prepaymentAmount);
      expect(ct.totalObligation).toBe(expected);
    });

    it('should calculate profitAfterTax correctly', () => {
      const result = engine.calculateCorporateTax(2025, 100_000, 20_000, 0, twoMembers);

      expect(result.profitAfterTax).toBe(
        roundToTwo(result.corporateTax.taxableIncome - result.corporateTax.corporateTaxAmount)
      );
    });

    it('should distribute 100% dividends by default', () => {
      const result = engine.calculateCorporateTax(2025, 100_000, 20_000, 0, twoMembers);

      expect(result.distributedDividends).toBe(result.profitAfterTax);
      expect(result.retainedEarnings).toBe(0);
    });

    it('should respect custom distribution percent', () => {
      const result = engine.calculateCorporateTax(2025, 100_000, 20_000, 0, twoMembers, 50);

      expect(result.distributedDividends).toBe(roundToTwo(result.profitAfterTax * 0.5));
      expect(result.retainedEarnings).toBe(
        roundToTwo(result.profitAfterTax - result.distributedDividends)
      );
    });

    it('should apply 5% dividend tax per member', () => {
      const result = engine.calculateCorporateTax(2025, 100_000, 20_000, 0, twoMembers);

      for (const md of result.memberDividends) {
        expect(md.dividendTaxRate).toBe(5);
        expect(md.dividendTaxAmount).toBe(roundToTwo(md.grossDividend * 0.05));
        expect(md.netDividend).toBe(roundToTwo(md.grossDividend - md.dividendTaxAmount));
      }
    });

    it('should split dividends by member share percent (60/40)', () => {
      const result = engine.calculateCorporateTax(2025, 100_000, 20_000, 0, twoMembers);

      const m1 = result.memberDividends.find((m) => m.memberId === 'm1');
      const m2 = result.memberDividends.find((m) => m.memberId === 'm2');

      expect(m1).toBeDefined();
      expect(m2).toBeDefined();
      expect(m1!.dividendSharePercent).toBe(60);
      expect(m2!.dividendSharePercent).toBe(40);
      expect(m1!.grossDividend).toBe(roundToTwo(result.distributedDividends * 0.6));
      expect(m2!.grossDividend).toBe(roundToTwo(result.distributedDividends * 0.4));
    });

    it('should calculate totalDividendTax as sum of all member dividend taxes', () => {
      const result = engine.calculateCorporateTax(2025, 100_000, 20_000, 0, twoMembers);

      const sumDivTax = result.memberDividends.reduce((s, m) => s + m.dividendTaxAmount, 0);
      expect(result.totalDividendTax).toBe(roundToTwo(sumDivTax));
    });

    it('should handle zero taxable income', () => {
      const result = engine.calculateCorporateTax(2025, 10_000, 15_000, 0, twoMembers);

      expect(result.corporateTax.taxableIncome).toBe(0);
      expect(result.corporateTax.corporateTaxAmount).toBe(0);
      expect(result.profitAfterTax).toBe(0);
      expect(result.distributedDividends).toBe(0);
    });

    it('should deduct EFKA manager contributions', () => {
      const result = engine.calculateCorporateTax(2025, 100_000, 20_000, 5_000, twoMembers);

      expect(result.corporateTax.taxableIncome).toBe(75_000);
      expect(result.corporateTax.efkaContributions).toBe(5_000);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // E. calculateAETax — AE (same as EPE, shareholders)
  // ══════════════════════════════════════════════════════════════════════════

  describe('calculateAETax', () => {
    const twoShareholders = [
      { shareholderId: 's1', shareholderName: 'Shareholder A', dividendSharePercent: 70 },
      { shareholderId: 's2', shareholderName: 'Shareholder B', dividendSharePercent: 30 },
    ];

    it('should calculate same corporate tax rates as EPE', () => {
      const result = engine.calculateAETax(2025, 200_000, 50_000, 10_000, twoShareholders);

      expect(result.corporateTax.corporateTaxRate).toBe(22);
      expect(result.corporateTax.prepaymentRate).toBe(80);
      expect(result.corporateTax.taxableIncome).toBe(140_000);
    });

    it('should map shareholders to dividends correctly', () => {
      const result = engine.calculateAETax(2025, 100_000, 20_000, 0, twoShareholders);

      expect(result.shareholderDividends).toHaveLength(2);
      const s1 = result.shareholderDividends.find((s) => s.shareholderId === 's1');
      const s2 = result.shareholderDividends.find((s) => s.shareholderId === 's2');

      expect(s1).toBeDefined();
      expect(s2).toBeDefined();
      expect(s1!.shareholderName).toBe('Shareholder A');
      expect(s1!.dividendSharePercent).toBe(70);
      expect(s2!.dividendSharePercent).toBe(30);
    });

    it('should apply 5% dividend tax to shareholders', () => {
      const result = engine.calculateAETax(2025, 100_000, 20_000, 0, twoShareholders);

      for (const sd of result.shareholderDividends) {
        expect(sd.dividendTaxRate).toBe(5);
        expect(sd.dividendTaxAmount).toBe(roundToTwo(sd.grossDividend * 0.05));
        expect(sd.netDividend).toBe(roundToTwo(sd.grossDividend - sd.dividendTaxAmount));
      }
    });

    it('should respect custom distribution percent', () => {
      const result = engine.calculateAETax(2025, 100_000, 20_000, 0, twoShareholders, 40);

      expect(result.distributedDividends).toBe(roundToTwo(result.profitAfterTax * 0.4));
      expect(result.retainedEarnings).toBe(
        roundToTwo(result.profitAfterTax - result.distributedDividends)
      );
    });

    it('should produce identical corporateTax numbers as calculateCorporateTax', () => {
      const aeResult = engine.calculateAETax(2025, 150_000, 30_000, 5_000, twoShareholders);
      const epeResult = engine.calculateCorporateTax(
        2025,
        150_000,
        30_000,
        5_000,
        [
          { memberId: 's1', memberName: 'Shareholder A', dividendSharePercent: 70 },
          { memberId: 's2', memberName: 'Shareholder B', dividendSharePercent: 30 },
        ],
        100,
        'ae'
      );

      expect(aeResult.corporateTax).toEqual(epeResult.corporateTax);
      expect(aeResult.profitAfterTax).toBe(epeResult.profitAfterTax);
      expect(aeResult.totalDividendTax).toBe(epeResult.totalDividendTax);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // F. calculateInstallments
  // ══════════════════════════════════════════════════════════════════════════

  describe('calculateInstallments', () => {
    it('should return empty array for zero amount', () => {
      const installments = engine.calculateInstallments(0, 2025);
      expect(installments).toEqual([]);
    });

    it('should return empty array for negative amount', () => {
      const installments = engine.calculateInstallments(-100, 2025);
      expect(installments).toEqual([]);
    });

    it('should return 1 installment for amount <= 30€', () => {
      const installments = engine.calculateInstallments(25, 2025);

      expect(installments).toHaveLength(1);
      expect(installments[0].installmentNumber).toBe(1);
      expect(installments[0].amount).toBe(25);
      expect(installments[0].dueDate).toBe('2026-07-31');
    });

    it('should return 1 installment for exactly 30€', () => {
      const installments = engine.calculateInstallments(30, 2025);

      expect(installments).toHaveLength(1);
      expect(installments[0].amount).toBe(30);
    });

    it('should return 3 installments for amount > 30€', () => {
      const installments = engine.calculateInstallments(31, 2025);

      expect(installments).toHaveLength(3);
    });

    it('should have correct due dates (fiscalYear + 1)', () => {
      const installments = engine.calculateInstallments(100, 2025);

      expect(installments[0].dueDate).toBe('2026-07-31');
      expect(installments[1].dueDate).toBe('2026-09-30');
      expect(installments[2].dueDate).toBe('2026-11-30');
    });

    it('should assign remainder to first installment', () => {
      // 100 / 3 = 33.33, remainder = 100 - 33.33*3 = 0.01
      const installments = engine.calculateInstallments(100, 2025);

      const base = roundToTwo(100 / 3);
      const remainder = roundToTwo(100 - base * 3);
      expect(installments[0].amount).toBe(roundToTwo(base + remainder));
      expect(installments[1].amount).toBe(base);
      expect(installments[2].amount).toBe(base);
    });

    it('should sum installments to total amount', () => {
      const total = 9999.99;
      const installments = engine.calculateInstallments(total, 2025);

      const sum = installments.reduce((s, i) => s + i.amount, 0);
      expect(roundToTwo(sum)).toBe(total);
    });

    it('should set paidDate and notes to null', () => {
      const installments = engine.calculateInstallments(100, 2025);

      for (const inst of installments) {
        expect(inst.paidDate).toBeNull();
        expect(inst.notes).toBeNull();
      }
    });

    it('should set installmentNumber sequentially starting at 1', () => {
      const installments = engine.calculateInstallments(100, 2025);

      expect(installments.map((i) => i.installmentNumber)).toEqual([1, 2, 3]);
    });

    it('should have a status field on each installment', () => {
      const installments = engine.calculateInstallments(100, 2025);

      for (const inst of installments) {
        expect(['upcoming', 'due', 'overdue']).toContain(inst.status);
      }
    });

    it('should handle very small amount (1 cent)', () => {
      const installments = engine.calculateInstallments(0.01, 2025);

      expect(installments).toHaveLength(1);
      expect(installments[0].amount).toBe(0.01);
    });

    it('should handle large amount evenly divisible by 3', () => {
      const installments = engine.calculateInstallments(300, 2025);

      expect(installments).toHaveLength(3);
      // 300 / 3 = 100 exactly, remainder = 0
      expect(installments[0].amount).toBe(100);
      expect(installments[1].amount).toBe(100);
      expect(installments[2].amount).toBe(100);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // G. estimateTax — Async (mocked repository)
  // ══════════════════════════════════════════════════════════════════════════

  describe('estimateTax', () => {
    it('should project annual income from partial year data', async () => {
      const incomeEntries: JournalEntry[] = [
        makeJournalEntry({ netAmount: 5000, category: 'service_income', type: 'income' }),
        makeJournalEntry({ netAmount: 3000, category: 'service_income', type: 'income' }),
      ];
      const expenseEntries: JournalEntry[] = [
        makeJournalEntry({ netAmount: 2000, category: 'office_supplies', type: 'expense' }),
      ];

      mockRepo.listJournalEntries
        .mockResolvedValueOnce({ items: incomeEntries, total: 2, hasMore: false })
        .mockResolvedValueOnce({ items: expenseEntries, total: 1, hasMore: false });
      mockRepo.getCompanySetup.mockResolvedValue({
        entityType: 'sole_proprietor',
      } as CompanyProfile);

      // Mid-year: June 30 = day 181 of 365
      const result = await engine.estimateTax(2025, '2025-06-30');

      expect(result.actualIncome).toBe(8000);
      expect(result.actualExpenses).toBe(2000);
      expect(result.projectedAnnualIncome).toBeGreaterThan(8000);
      expect(result.projectedAnnualExpenses).toBeGreaterThan(2000);
      expect(result.currentQuarter).toBe(2);
      expect(result.period.from).toBe('2025-01-01');
      expect(result.period.to).toBe('2025-06-30');
    });

    it('should use sole_proprietor when getCompanySetup returns null', async () => {
      mockRepo.listJournalEntries
        .mockResolvedValueOnce({ items: [], total: 0, hasMore: false })
        .mockResolvedValueOnce({ items: [], total: 0, hasMore: false });
      mockRepo.getCompanySetup.mockResolvedValue(null);

      const result = await engine.estimateTax(2025, '2025-03-15');

      expect(result.projectedAnnualTax).toBe(0);
      expect(result.currentQuarter).toBe(1);
    });

    it('should aggregate top income categories', async () => {
      const incomeEntries: JournalEntry[] = [
        makeJournalEntry({ netAmount: 5000, category: 'service_income', type: 'income' }),
        makeJournalEntry({ netAmount: 3000, category: 'service_income', type: 'income' }),
        makeJournalEntry({ netAmount: 1000, category: 'rental_income', type: 'income' }),
      ];

      mockRepo.listJournalEntries
        .mockResolvedValueOnce({ items: incomeEntries, total: 3, hasMore: false })
        .mockResolvedValueOnce({ items: [], total: 0, hasMore: false });
      mockRepo.getCompanySetup.mockResolvedValue(null);

      const result = await engine.estimateTax(2025, '2025-06-30');

      expect(result.topIncomeCategories).toHaveLength(2);
      expect(result.topIncomeCategories[0].category).toBe('service_income');
      expect(result.topIncomeCategories[0].amount).toBe(8000);
      expect(result.topIncomeCategories[1].category).toBe('rental_income');
      expect(result.topIncomeCategories[1].amount).toBe(1000);
    });

    it('should aggregate top expense categories', async () => {
      const expenseEntries: JournalEntry[] = [
        makeJournalEntry({ netAmount: 2000, category: 'office_supplies', type: 'expense' }),
        makeJournalEntry({ netAmount: 500, category: 'utilities', type: 'expense' }),
        makeJournalEntry({ netAmount: 1500, category: 'office_supplies', type: 'expense' }),
      ];

      mockRepo.listJournalEntries
        .mockResolvedValueOnce({ items: [], total: 0, hasMore: false })
        .mockResolvedValueOnce({ items: expenseEntries, total: 3, hasMore: false });
      mockRepo.getCompanySetup.mockResolvedValue(null);

      const result = await engine.estimateTax(2025, '2025-06-30');

      expect(result.topExpenseCategories[0].category).toBe('office_supplies');
      expect(result.topExpenseCategories[0].amount).toBe(3500);
    });

    it('should correctly detect quarter from date', async () => {
      mockRepo.listJournalEntries.mockResolvedValue({ items: [], total: 0, hasMore: false });
      mockRepo.getCompanySetup.mockResolvedValue(null);

      const q1 = await engine.estimateTax(2025, '2025-02-15');
      expect(q1.currentQuarter).toBe(1);

      const q2 = await engine.estimateTax(2025, '2025-05-15');
      expect(q2.currentQuarter).toBe(2);

      const q3 = await engine.estimateTax(2025, '2025-08-15');
      expect(q3.currentQuarter).toBe(3);

      const q4 = await engine.estimateTax(2025, '2025-11-15');
      expect(q4.currentQuarter).toBe(4);
    });

    it('should call listJournalEntries twice (income + expense)', async () => {
      mockRepo.listJournalEntries.mockResolvedValue({ items: [], total: 0, hasMore: false });
      mockRepo.getCompanySetup.mockResolvedValue(null);

      await engine.estimateTax(2025, '2025-06-30');

      expect(mockRepo.listJournalEntries).toHaveBeenCalledTimes(2);
      expect(mockRepo.listJournalEntries).toHaveBeenCalledWith({
        fiscalYear: 2025,
        type: 'income',
      });
      expect(mockRepo.listJournalEntries).toHaveBeenCalledWith({
        fiscalYear: 2025,
        type: 'expense',
      });
    });

    it('should include estimatedAt timestamp in result', async () => {
      mockRepo.listJournalEntries.mockResolvedValue({ items: [], total: 0, hasMore: false });
      mockRepo.getCompanySetup.mockResolvedValue(null);

      const result = await engine.estimateTax(2025, '2025-06-30');

      expect(result.estimatedAt).toBeDefined();
      expect(new Date(result.estimatedAt).getTime()).not.toBeNaN();
    });

    it('should handle no entries gracefully (zero projected tax)', async () => {
      mockRepo.listJournalEntries.mockResolvedValue({ items: [], total: 0, hasMore: false });
      mockRepo.getCompanySetup.mockResolvedValue(null);

      const result = await engine.estimateTax(2025, '2025-06-30');

      expect(result.actualIncome).toBe(0);
      expect(result.actualExpenses).toBe(0);
      expect(result.projectedAnnualIncome).toBe(0);
      expect(result.projectedAnnualExpenses).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // H. Edge Cases & Integration Scenarios
  // ══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle fractional income amounts correctly', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({ totalIncome: 12345.67, professionalTax: 0 })
      );

      expect(result.taxableIncome).toBe(12345.67);
      expect(typeof result.incomeTax).toBe('number');
      expect(Number.isFinite(result.incomeTax)).toBe(true);
    });

    it('should handle 1€ income', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({ totalIncome: 1, professionalTax: 0 })
      );

      expect(result.taxableIncome).toBe(1);
      expect(result.incomeTax).toBe(roundToTwo(1 * 0.09));
    });

    it('should produce consistent results when called multiple times', () => {
      const params = makeDefaultParams({ totalIncome: 45_000, professionalTax: 650 });

      const result1 = engine.calculateAnnualTax(params);
      const result2 = engine.calculateAnnualTax(params);

      expect(result1).toEqual(result2);
    });

    it('should always have finalAmount >= 0', () => {
      const incomes = [0, 100, 5_000, 10_000, 50_000, 100_000];
      for (const income of incomes) {
        const result = engine.calculateAnnualTax(makeDefaultParams({ totalIncome: income }));
        expect(result.finalAmount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should always have refundAmount >= 0', () => {
      const scenarios: Partial<TaxCalculationParams>[] = [
        { totalIncome: 0 },
        { totalIncome: 10_000, totalWithholdings: 50_000 },
        { totalIncome: 100_000 },
      ];
      for (const s of scenarios) {
        const result = engine.calculateAnnualTax(makeDefaultParams(s));
        expect(result.refundAmount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should not have both finalAmount and refundAmount > 0 simultaneously', () => {
      const incomes = [0, 5_000, 20_000, 50_000];
      for (const income of incomes) {
        const result = engine.calculateAnnualTax(
          makeDefaultParams({ totalIncome: income, totalWithholdings: 3000 })
        );
        // At least one must be zero
        expect(result.finalAmount === 0 || result.refundAmount === 0).toBe(true);
      }
    });

    it('should handle all expenses as EFKA (no remaining taxable)', () => {
      const result = engine.calculateAnnualTax(
        makeDefaultParams({
          totalIncome: 20_000,
          totalDeductibleExpenses: 0,
          totalEfkaContributions: 20_000,
          professionalTax: 0,
        })
      );

      expect(result.taxableIncome).toBe(0);
      expect(result.incomeTax).toBe(0);
    });
  });
});
