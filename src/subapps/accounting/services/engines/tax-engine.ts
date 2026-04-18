/**
 * @fileoverview Tax Engine — Greek Income Tax Calculation Service
 * @description Κλιμακωτός υπολογισμός φόρου + projections + δόσεις.
 *   Main orchestrator. Pure helpers extracted into ./helpers/ (SRP split, ADR-314 Phase C.5).
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @updated 2026-04-18 — SRP split: helpers/tax-brackets, helpers/tax-installments,
 *                      helpers/tax-date-utils + SSoT math (utils/math) + nowISO migration
 * @version 1.1.0
 * @see ADR-ACC-009 Tax Engine
 * @see ADR-314 SSoT Discovery — Phase C.5
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT, <500 lines
 */

import type { ITaxEngine, IAccountingRepository } from '../../types/interfaces';
import type {
  TaxScaleConfig,
  TaxCalculationParams,
  TaxResult,
  TaxEstimate,
  TaxInstallment,
  PartnershipTaxResult,
  PartnerTaxResult,
  EPETaxResult,
  CorporateTaxResult,
  MemberDividendResult,
  AETaxResult,
  ShareholderDividendResult,
} from '../../types/tax';
import type { EntityType } from '../../types/entity';
import type { ExpenseCategory, IncomeCategory } from '../../types/common';
import {
  getTaxScaleForYear,
  getProfessionalTaxForEntity,
  getCorporateTaxRate,
  getDividendTaxRate,
  getPrepaymentRateForEntity,
} from '../config/tax-config';
import { getQuarterFromDate } from '../repository/firestore-helpers';
import { nowISO } from '@/lib/date-local';
import { roundToTwo } from '../../utils/math';
import { calculateBracketTax } from './helpers/tax-brackets';
import { calculateInstallments as calculateInstallmentsPure } from './helpers/tax-installments';
import { getDayOfYear, isLeapYear } from './helpers/tax-date-utils';

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
   */
  calculateAnnualTax(params: TaxCalculationParams): TaxResult {
    const scale = this.getTaxScale(params.fiscalYear);

    const taxableIncome = Math.max(
      0,
      params.totalIncome - params.totalDeductibleExpenses - params.totalEfkaContributions
    );

    const { bracketBreakdown, incomeTax } = calculateBracketTax(taxableIncome, scale);

    const solidarityContribution = roundToTwo(taxableIncome * (scale.solidarityRate / 100));

    const prepaymentRate = params.isFirstFiveYears
      ? Math.min(scale.prepaymentRate, 27.5) // 50% μείωση τα πρώτα 5 χρόνια
      : scale.prepaymentRate;
    const prepaymentAmount = roundToTwo(incomeTax * (prepaymentRate / 100));

    const professionalTax = params.professionalTax;

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
   * Real-time πρόβλεψη φόρου βάσει τρεχόντων δεδομένων.
   *
   * Φέρνει τα journal entries μέχρι σήμερα, αναγάγει σε ετήσια βάση,
   * και υπολογίζει estimated φόρο.
   */
  async estimateTax(fiscalYear: number, upToDate?: string): Promise<TaxEstimate> {
    const refDate = upToDate ?? nowISO().split('T')[0];
    const dayOfYear = getDayOfYear(refDate);
    const daysInYear = isLeapYear(fiscalYear) ? 366 : 365;
    const progressRatio = dayOfYear / daysInYear;

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

    const projectionMultiplier = progressRatio > 0 ? 1 / progressRatio : 1;
    const projectedAnnualIncome = roundToTwo(actualIncome * projectionMultiplier);
    const projectedAnnualExpenses = roundToTwo(actualExpenses * projectionMultiplier);

    const profile = await this.repository.getCompanySetup();
    const entityType = profile?.entityType ?? 'sole_proprietor';
    const professionalTax = getProfessionalTaxForEntity(entityType);

    const taxResult = this.calculateAnnualTax({
      fiscalYear,
      totalIncome: projectedAnnualIncome,
      totalDeductibleExpenses: projectedAnnualExpenses,
      totalEfkaContributions: 0, // Will be filled from EFKA data later
      professionalTax,
      totalWithholdings: 0,
      previousYearPrepayment: 0,
      isFirstFiveYears: false,
    });

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
      estimatedAt: nowISO(),
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

  /** Λήψη φορολογικής κλίμακας για ένα έτος */
  getTaxScale(year: number): TaxScaleConfig {
    return getTaxScaleForYear(year);
  }

  /**
   * Υπολογισμός φόρου ΟΕ (pass-through ανά εταίρο).
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
   * Υπολογισμός εταιρικού φόρου ΕΠΕ/ΑΕ (22% flat rate).
   *
   * - Φορολόγηση: 22% flat (ΟΧΙ progressive brackets)
   * - Προκαταβολή: 80%
   * - Μερίσματα: 5% φόρος μερισμάτων ανά μέλος/μέτοχο
   */
  calculateCorporateTax(
    fiscalYear: number,
    totalIncome: number,
    totalExpenses: number,
    efkaManagerTotal: number,
    members: Array<{
      memberId: string;
      memberName: string;
      dividendSharePercent: number;
    }>,
    distributionPercent: number = 100,
    entityType: EntityType = 'epe'
  ): EPETaxResult {
    const corporateTaxRate = getCorporateTaxRate();
    const dividendTaxRate = getDividendTaxRate();
    const prepaymentRate = getPrepaymentRateForEntity(entityType);
    const professionalTax = getProfessionalTaxForEntity(entityType);

    const taxableIncome = Math.max(0, totalIncome - totalExpenses - efkaManagerTotal);
    const corporateTaxAmount = roundToTwo(taxableIncome * (corporateTaxRate / 100));
    const prepaymentAmount = roundToTwo(corporateTaxAmount * (prepaymentRate / 100));
    const totalObligation = roundToTwo(corporateTaxAmount + professionalTax + prepaymentAmount);

    const corporateTax: CorporateTaxResult = {
      fiscalYear,
      grossIncome: totalIncome,
      deductibleExpenses: totalExpenses,
      efkaContributions: efkaManagerTotal,
      taxableIncome,
      corporateTaxRate,
      corporateTaxAmount,
      professionalTax,
      prepaymentRate,
      prepaymentAmount,
      totalObligation,
    };

    const profitAfterTax = roundToTwo(taxableIncome - corporateTaxAmount);
    const distributedDividends = roundToTwo(profitAfterTax * (distributionPercent / 100));
    const retainedEarnings = roundToTwo(profitAfterTax - distributedDividends);

    const memberDividends: MemberDividendResult[] = members.map((m) => {
      const grossDividend = roundToTwo(distributedDividends * (m.dividendSharePercent / 100));
      const dividendTaxAmount = roundToTwo(grossDividend * (dividendTaxRate / 100));
      const netDividend = roundToTwo(grossDividend - dividendTaxAmount);

      return {
        memberId: m.memberId,
        memberName: m.memberName,
        dividendSharePercent: m.dividendSharePercent,
        grossDividend,
        dividendTaxRate,
        dividendTaxAmount,
        netDividend,
      };
    });

    const totalDividendTax = roundToTwo(
      memberDividends.reduce((sum, d) => sum + d.dividendTaxAmount, 0)
    );

    return {
      corporateTax,
      profitAfterTax,
      distributedDividends,
      retainedEarnings,
      memberDividends,
      totalDividendTax,
    };
  }

  /**
   * Υπολογισμός εταιρικού φόρου ΑΕ (22% flat + μερίσματα 5% + 80% προκαταβολή).
   * Ίδια φορολόγηση με ΕΠΕ, αλλά shareholders αντί members.
   *
   * @see ADR-ACC-016 AE Corporate Tax & Dividends
   */
  calculateAETax(
    fiscalYear: number,
    totalIncome: number,
    totalExpenses: number,
    efkaBoardTotal: number,
    shareholders: Array<{
      shareholderId: string;
      shareholderName: string;
      dividendSharePercent: number;
    }>,
    distributionPercent: number = 100
  ): AETaxResult {
    const epeResult = this.calculateCorporateTax(
      fiscalYear,
      totalIncome,
      totalExpenses,
      efkaBoardTotal,
      shareholders.map((s) => ({
        memberId: s.shareholderId,
        memberName: s.shareholderName,
        dividendSharePercent: s.dividendSharePercent,
      })),
      distributionPercent,
      'ae'
    );

    const shareholderDividends: ShareholderDividendResult[] = epeResult.memberDividends.map((md) => ({
      shareholderId: md.memberId,
      shareholderName: md.memberName,
      dividendSharePercent: md.dividendSharePercent,
      grossDividend: md.grossDividend,
      dividendTaxRate: md.dividendTaxRate,
      dividendTaxAmount: md.dividendTaxAmount,
      netDividend: md.netDividend,
    }));

    return {
      corporateTax: epeResult.corporateTax,
      profitAfterTax: epeResult.profitAfterTax,
      distributedDividends: epeResult.distributedDividends,
      retainedEarnings: epeResult.retainedEarnings,
      shareholderDividends,
      totalDividendTax: epeResult.totalDividendTax,
    };
  }

  /**
   * Υπολογισμός δόσεων φόρου.
   * Thin wrapper — delegates to pure helper `calculateInstallmentsPure`.
   */
  calculateInstallments(totalAmount: number, fiscalYear: number): TaxInstallment[] {
    return calculateInstallmentsPure(totalAmount, fiscalYear);
  }
}
