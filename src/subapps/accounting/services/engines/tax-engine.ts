/**
 * @fileoverview Tax Engine — Greek Income Tax Calculation Service
 * @description Κλιμακωτός υπολογισμός φόρου + projections + δόσεις
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-009 Tax Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { ITaxEngine, IAccountingRepository } from '../../types/interfaces';
import type {
  TaxScaleConfig,
  TaxCalculationParams,
  TaxResult,
  TaxBracketResult,
  TaxEstimate,
  TaxInstallment,
  TaxInstallmentStatus,
  PartnershipTaxResult,
  PartnerTaxResult,
} from '../../types/tax';
import type { FiscalQuarter, ExpenseCategory, IncomeCategory } from '../../types/common';
import { getTaxScaleForYear, getProfessionalTaxForEntity } from '../config/tax-config';

// ============================================================================
// TAX ENGINE IMPLEMENTATION
// ============================================================================

/**
 * Tax Engine — Υπολογισμός Φόρου Εισοδήματος
 *
 * Implements ITaxEngine interface.
 * Constructor injection pattern.
 */
export class TaxEngine implements ITaxEngine {
  constructor(private readonly repository: IAccountingRepository) {}

  // ── Pure Methods ──────────────────────────────────────────────────────────

  /**
   * Υπολογισμός ετήσιου φόρου εισοδήματος
   *
   * Κλιμακωτή εφαρμογή φορολογικών συντελεστών:
   * - Πρώτα 10.000€ → 9%
   * - 10.001–20.000€ → 22%
   * - 20.001–30.000€ → 28%
   * - 30.001–40.000€ → 36%
   * - 40.001€+ → 44%
   *
   * @param params - Παράμετροι υπολογισμού
   * @returns TaxResult (αναλυτικό αποτέλεσμα)
   */
  calculateAnnualTax(params: TaxCalculationParams): TaxResult {
    const scale = this.getTaxScale(params.fiscalYear);

    // 1. Φορολογητέο εισόδημα
    const taxableIncome = Math.max(
      0,
      params.totalIncome - params.totalDeductibleExpenses - params.totalEfkaContributions
    );

    // 2. Κλιμακωτός υπολογισμός κύριου φόρου
    const { bracketBreakdown, incomeTax } = calculateBracketTax(taxableIncome, scale);

    // 3. Εισφορά αλληλεγγύης
    const solidarityContribution = roundToTwo(taxableIncome * (scale.solidarityRate / 100));

    // 4. Προκαταβολή φόρου
    const prepaymentRate = params.isFirstFiveYears
      ? Math.min(scale.prepaymentRate, 27.5) // 50% μείωση τα πρώτα 5 χρόνια
      : scale.prepaymentRate;
    const prepaymentAmount = roundToTwo(incomeTax * (prepaymentRate / 100));

    // 5. Τέλος επιτηδεύματος
    const professionalTax = params.professionalTax;

    // 6. Σύνολα
    const totalObligation = roundToTwo(
      incomeTax + solidarityContribution + prepaymentAmount + professionalTax
    );
    const totalCredits = roundToTwo(
      params.totalWithholdings + params.previousYearPrepayment
    );
    const finalAmount = roundToTwo(Math.max(0, totalObligation - totalCredits));
    const refundAmount = roundToTwo(Math.max(0, totalCredits - totalObligation));

    return {
      fiscalYear: params.fiscalYear,
      grossIncome: params.totalIncome,
      deductibleExpenses: params.totalDeductibleExpenses,
      taxableIncome,
      bracketBreakdown,
      incomeTax,
      solidarityContribution,
      prepaymentRate,
      prepaymentAmount,
      professionalTax,
      totalWithholdings: params.totalWithholdings,
      previousYearPrepayment: params.previousYearPrepayment,
      totalObligation,
      totalCredits,
      finalAmount,
      refundAmount,
    };
  }

  /**
   * Real-time πρόβλεψη φόρου βάσει τρεχόντων δεδομένων
   *
   * Φέρνει τα journal entries μέχρι σήμερα, αναγάγει σε ετήσια βάση,
   * και υπολογίζει estimated φόρο.
   */
  async estimateTax(fiscalYear: number, upToDate?: string): Promise<TaxEstimate> {
    const refDate = upToDate ?? new Date().toISOString().split('T')[0];
    const dayOfYear = getDayOfYear(refDate);
    const daysInYear = isLeapYear(fiscalYear) ? 366 : 365;
    const progressRatio = dayOfYear / daysInYear;

    // Fetch actual data
    const incomeEntries = await this.repository.listJournalEntries({
      fiscalYear,
      type: 'income',
    });
    const expenseEntries = await this.repository.listJournalEntries({
      fiscalYear,
      type: 'expense',
    });

    const actualIncome = incomeEntries.items.reduce((sum, e) => sum + e.netAmount, 0);
    const actualExpenses = expenseEntries.items.reduce((sum, e) => sum + e.netAmount, 0);

    // Project to full year
    const projectionMultiplier = progressRatio > 0 ? 1 / progressRatio : 1;
    const projectedAnnualIncome = roundToTwo(actualIncome * projectionMultiplier);
    const projectedAnnualExpenses = roundToTwo(actualExpenses * projectionMultiplier);

    // Calculate projected tax
    const taxResult = this.calculateAnnualTax({
      fiscalYear,
      totalIncome: projectedAnnualIncome,
      totalDeductibleExpenses: projectedAnnualExpenses,
      totalEfkaContributions: 0, // Will be filled from EFKA data later
      professionalTax: 650,
      totalWithholdings: 0,
      previousYearPrepayment: 0,
      isFirstFiveYears: false,
    });

    // Top categories
    const incomeCatMap = new Map<string, number>();
    for (const e of incomeEntries.items) {
      incomeCatMap.set(e.category, (incomeCatMap.get(e.category) ?? 0) + e.netAmount);
    }
    const expenseCatMap = new Map<string, number>();
    for (const e of expenseEntries.items) {
      expenseCatMap.set(e.category, (expenseCatMap.get(e.category) ?? 0) + e.netAmount);
    }

    const topIncomeCategories = Array.from(incomeCatMap.entries())
      .map(([category, amount]) => ({ category: category as IncomeCategory, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const topExpenseCategories = Array.from(expenseCatMap.entries())
      .map(([category, amount]) => ({ category: category as ExpenseCategory, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const currentQuarter = getQuarterFromDate(refDate);

    return {
      estimatedAt: new Date().toISOString(),
      period: {
        from: `${fiscalYear}-01-01`,
        to: refDate,
      },
      currentQuarter,
      actualIncome,
      actualExpenses,
      projectedAnnualIncome,
      projectedAnnualExpenses,
      projectedAnnualTax: taxResult.incomeTax,
      projectedFinalAmount: taxResult.finalAmount,
      topIncomeCategories,
      topExpenseCategories,
    };
  }

  /**
   * Λήψη φορολογικής κλίμακας για ένα έτος
   */
  getTaxScale(year: number): TaxScaleConfig {
    return getTaxScaleForYear(year);
  }

  /**
   * Υπολογισμός φόρου ΟΕ (pass-through ανά εταίρο)
   *
   * Κάθε εταίρος φορολογείται ξεχωριστά στο μερίδιό του (ίδια κλίμακα 9%-44%).
   */
  calculatePartnershipTax(
    fiscalYear: number,
    totalIncome: number,
    totalExpenses: number,
    totalEfkaByPartner: Map<string, number>,
    partners: Array<{
      partnerId: string;
      partnerName: string;
      profitSharePercent: number;
      withholdings: number;
      previousPrepayment: number;
      isFirstFiveYears: boolean;
    }>
  ): PartnershipTaxResult {
    const totalProfit = Math.max(0, totalIncome - totalExpenses);
    const entityProfessionalTax = getProfessionalTaxForEntity('oe');

    const partnerResults: PartnerTaxResult[] = partners.map((p) => {
      const profitShare = roundToTwo(totalProfit * (p.profitSharePercent / 100));
      const partnerEfka = totalEfkaByPartner.get(p.partnerId) ?? 0;

      const taxResult = this.calculateAnnualTax({
        fiscalYear,
        totalIncome: profitShare,
        totalDeductibleExpenses: 0,
        totalEfkaContributions: partnerEfka,
        professionalTax: 0, // Professional tax is at entity level
        totalWithholdings: p.withholdings,
        previousYearPrepayment: p.previousPrepayment,
        isFirstFiveYears: p.isFirstFiveYears,
      });

      return {
        partnerId: p.partnerId,
        partnerName: p.partnerName,
        profitSharePercent: p.profitSharePercent,
        profitShare,
        taxResult,
      };
    });

    return {
      fiscalYear,
      totalEntityIncome: totalIncome,
      totalEntityExpenses: totalExpenses,
      totalEntityProfit: totalProfit,
      entityProfessionalTax,
      partnerResults,
    };
  }

  /**
   * Υπολογισμός δόσεων φόρου
   *
   * Ο φόρος εξοφλείται σε 3 δόσεις (αν >30€ ανά δόση):
   * - 1η: Ιούλιος (τελευταία εργάσιμη)
   * - 2η: Σεπτέμβριος (τελευταία εργάσιμη)
   * - 3η: Νοέμβριος (τελευταία εργάσιμη)
   */
  calculateInstallments(totalAmount: number, fiscalYear: number): TaxInstallment[] {
    if (totalAmount <= 0) return [];

    // Αν <=30€ → 1 δόση
    const installmentCount = totalAmount <= 30 ? 1 : 3;
    const baseAmount = roundToTwo(totalAmount / installmentCount);
    const remainder = roundToTwo(totalAmount - baseAmount * installmentCount);

    const dueDates = getInstallmentDueDates(fiscalYear);
    const installments: TaxInstallment[] = [];

    for (let i = 0; i < installmentCount; i++) {
      const amount = i === 0 ? roundToTwo(baseAmount + remainder) : baseAmount;
      const dueDate = dueDates[i];
      if (!dueDate) continue;

      installments.push({
        installmentNumber: i + 1,
        amount,
        dueDate,
        status: getInstallmentStatus(dueDate),
        paidDate: null,
        notes: null,
      });
    }

    return installments;
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Κλιμακωτός υπολογισμός φόρου
 */
function calculateBracketTax(
  taxableIncome: number,
  scale: TaxScaleConfig
): { bracketBreakdown: TaxBracketResult[]; incomeTax: number } {
  const bracketBreakdown: TaxBracketResult[] = [];
  let remainingIncome = taxableIncome;
  let totalTax = 0;

  for (const bracket of scale.brackets) {
    if (remainingIncome <= 0) break;

    const bracketWidth = bracket.to !== null ? bracket.to - bracket.from + 1 : Infinity;
    const taxableAmount = Math.min(remainingIncome, bracketWidth);
    const taxAmount = roundToTwo(taxableAmount * (bracket.rate / 100));

    bracketBreakdown.push({
      bracket,
      taxableAmount,
      taxAmount,
    });

    totalTax += taxAmount;
    remainingIncome -= taxableAmount;
  }

  return {
    bracketBreakdown,
    incomeTax: roundToTwo(totalTax),
  };
}

/**
 * Ημερομηνίες λήξης δόσεων (τελευταία εργάσιμη μήνα)
 */
function getInstallmentDueDates(fiscalYear: number): string[] {
  // Φόρος χρήσης X πληρώνεται τον Ιούλιο X+1
  const paymentYear = fiscalYear + 1;
  return [
    `${paymentYear}-07-31`,
    `${paymentYear}-09-30`,
    `${paymentYear}-11-30`,
  ];
}

/**
 * Κατάσταση δόσης βάσει ημερομηνίας
 */
function getInstallmentStatus(dueDate: string): TaxInstallmentStatus {
  const today = new Date().toISOString().split('T')[0];
  if (today > dueDate) return 'overdue';
  // Due month check
  const dueMonth = dueDate.substring(0, 7);
  const todayMonth = today.substring(0, 7);
  if (dueMonth === todayMonth) return 'due';
  return 'upcoming';
}

function getQuarterFromDate(date: string): FiscalQuarter {
  const month = parseInt(date.substring(5, 7), 10);
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

function getDayOfYear(date: string): number {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
