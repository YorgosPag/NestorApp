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
  EPETaxResult,
  AETaxResult,
  EntityTaxInput,
  EntityHolder,
} from '../../types/tax';
import type { ExpenseCategory, IncomeCategory } from '../../types/common';
import { getTaxScaleForYear, getProfessionalTaxForEntity } from '../config/tax-config';
import { getQuarterFromDate } from '../repository/firestore-helpers';
import { loadLedger } from '../journal/journal-ledger';
import { resolvePrepayment } from '../tax/prepayment-policy';
import { nowISO } from '@/lib/date-local';
import { roundToTwo } from '../../utils/math';
import { calculateBracketTax } from './helpers/tax-brackets';
import { computeEntityTax, dividendFieldsOf, dividendResultShellOf } from './helpers/entity-tax';
import { calculateInstallments as calculateInstallmentsPure } from './helpers/tax-installments';
import { yearToDateProgress } from './helpers/tax-date-utils';

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
   * Κλιμακωτή εφαρμογή φορολογικών συντελεστών ανά φορολογικό έτος.
   * Η κλίμακα ΔΕΝ ζει εδώ: SSoT = `GREEK_TAX_SCALES` στο `services/config/tax-config.ts`
   * (2024–2025: 9/22/28/36/44% · 2026+: 9/20/26/34/39/44%, ν.5246/2025).
   */
  calculateAnnualTax(params: TaxCalculationParams): TaxResult {
    const scale = this.getTaxScale(params.fiscalYear);

    const taxableIncome = Math.max(
      0,
      params.totalIncome - params.totalDeductibleExpenses - params.totalEfkaContributions
    );

    const { bracketBreakdown, incomeTax } = calculateBracketTax(taxableIncome, scale);

    const solidarityContribution = roundToTwo(taxableIncome * (scale.solidarityRate / 100));

    // Φυσικό πρόσωπο: 55%, μισή ΜΟΝΟ το έτος πρώτης απόκτησης (ν.4172/2013 άρθρο 69 §1) — βλ. prepayment-policy
    const prepaymentBasis = resolvePrepayment('sole_proprietor', params.fiscalYear, params.businessStart);
    const prepaymentRate = prepaymentBasis.rate;
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
      prepaymentBasis,
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

    const ledger = await loadLedger(this.repository, { kind: 'fiscalYear', fiscalYear });
    const actualIncome = ledger.totalIncomeNet;
    const actualExpenses = ledger.totalExpenseNet;

    // SSoT αναγωγής: κλεισμένη χρήση ⇒ ×1 (πριν: ημέρα-του-έτους της ΣΗΜΕΡΙΝΗΣ ημερομηνίας και για παρελθόντα έτη).
    const projectionMultiplier = yearToDateProgress(fiscalYear, refDate).factor;
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
      businessStart: profile?.businessStart ?? null,
    });

    const incomeCatMap = new Map<string, number>();
    for (const e of ledger.income) {
      incomeCatMap.set(e.category, (incomeCatMap.get(e.category) ?? 0) + e.netAmount);
    }
    const expenseCatMap = new Map<string, number>();
    for (const e of ledger.expense) {
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
   * Υπολογισμός φόρου ΟΕ — ως **οντότητα** (22%, προκαταβολή 80% / 40% τα 3 πρώτα έτη) και διανομή στους
   * εταίρους (παρακράτηση 0% με απλογραφικά, 5% με διπλογραφικά).
   *
   * Ως τις 2026-11-06: διαφανής φορολόγηση (κάθε εταίρος με την κλίμακα φυσικών, 55%) — λάθος, ADR-ACC-024 §6.
   */
  calculatePartnershipTax(input: EntityTaxInput, partners: readonly EntityHolder[]): PartnershipTaxResult {
    const result = computeEntityTax('oe', input, partners);
    return {
      corporateTax: result.corporateTax,
      profitAfterTax: result.profitAfterTax,
      distributedProfits: result.distributed,
      retainedEarnings: result.retained,
      partnerDistributions: result.distributions.map((d) => ({
        partnerId: d.holder.id,
        partnerName: d.holder.name,
        profitSharePercent: d.holder.sharePercent,
        grossDistribution: d.gross,
        withholdingRate: d.withholdingRate,
        withholdingAmount: d.withholdingAmount,
        netDistribution: d.net,
      })),
      totalDistributionWithholding: result.totalWithholding,
      distributionCoverage: result.coverage,
    };
  }

  /**
   * Υπολογισμός εταιρικού φόρου ΕΠΕ (22% flat · προκαταβολή 80% / 40% τα 3 πρώτα έτη · μερίσματα 5%).
   */
  calculateCorporateTax(input: EntityTaxInput, members: readonly EntityHolder[]): EPETaxResult {
    const result = computeEntityTax('epe', input, members);
    return {
      ...dividendResultShellOf(result),
      memberDividends: result.distributions.map((d) => ({
        memberId: d.holder.id,
        memberName: d.holder.name,
        ...dividendFieldsOf(d),
      })),
    };
  }

  /**
   * Υπολογισμός εταιρικού φόρου ΑΕ — ίδια φορολόγηση με ΕΠΕ, μέτοχοι αντί μελών.
   *
   * @see ADR-ACC-016 AE Corporate Tax & Dividends
   */
  calculateAETax(input: EntityTaxInput, shareholders: readonly EntityHolder[]): AETaxResult {
    const result = computeEntityTax('ae', input, shareholders);
    return {
      ...dividendResultShellOf(result),
      shareholderDividends: result.distributions.map((d) => ({
        shareholderId: d.holder.id,
        shareholderName: d.holder.name,
        ...dividendFieldsOf(d),
      })),
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
