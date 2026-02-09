/**
 * @fileoverview VAT Engine — Greek VAT Calculation Service
 * @description Υπολογισμοί ΦΠΑ εκροών/εισροών + τριμηνιαίες/ετήσιες συνόψεις
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-004 VAT Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { IVATEngine, IAccountingRepository } from '../../types/interfaces';
import type {
  VATCalculation,
  VATInputCalculation,
  VATDeductibilityRule,
  VATQuarterSummary,
  VATAnnualSummary,
  VATRateBreakdown,
  VATInputRateBreakdown,
} from '../../types/vat';
import type { ExpenseCategory, FiscalQuarter, PeriodRange } from '../../types/common';
import { getVatDeductibilityRules } from '../config/vat-config';

// ============================================================================
// VAT ENGINE IMPLEMENTATION
// ============================================================================

/**
 * VAT Engine — Υπολογισμός ΦΠΑ
 *
 * Implements IVATEngine interface.
 * Constructor injection pattern (same as ProjectsService).
 */
export class VATEngine implements IVATEngine {
  constructor(private readonly repository: IAccountingRepository) {}

  // ── Pure Methods ──────────────────────────────────────────────────────────

  /**
   * Υπολογισμός ΦΠΑ εκροών (τιμολόγιο → πελάτης)
   *
   * @param netAmount - Καθαρό ποσό (χωρίς ΦΠΑ)
   * @param vatRate - Συντελεστής ΦΠΑ (24, 13, 6, 0)
   * @returns VATCalculation
   *
   * @example
   * calculateOutputVat(1000, 24) → { netAmount: 1000, vatRate: 24, vatAmount: 240, grossAmount: 1240 }
   */
  calculateOutputVat(netAmount: number, vatRate: number): VATCalculation {
    const vatAmount = roundToTwoDecimals(netAmount * (vatRate / 100));
    const grossAmount = roundToTwoDecimals(netAmount + vatAmount);

    return {
      netAmount,
      vatRate,
      vatAmount,
      grossAmount,
    };
  }

  /**
   * Υπολογισμός ΦΠΑ εισροών (δαπάνη → εκπτωσιμότητα)
   *
   * @param netAmount - Καθαρό ποσό
   * @param vatRate - Συντελεστής ΦΠΑ
   * @param category - Κατηγορία δαπάνης (για deductibility)
   * @returns VATInputCalculation
   */
  calculateInputVat(
    netAmount: number,
    vatRate: number,
    category: ExpenseCategory
  ): VATInputCalculation {
    const vatAmount = roundToTwoDecimals(netAmount * (vatRate / 100));
    const grossAmount = roundToTwoDecimals(netAmount + vatAmount);
    const rule = this.getDeductibilityRule(category);

    const deductibleVatAmount = roundToTwoDecimals(vatAmount * (rule.deductiblePercent / 100));
    const nonDeductibleVatAmount = roundToTwoDecimals(vatAmount - deductibleVatAmount);

    return {
      netAmount,
      vatRate,
      vatAmount,
      grossAmount,
      deductiblePercent: rule.deductiblePercent,
      deductibleVatAmount,
      nonDeductibleVatAmount,
    };
  }

  /**
   * Λήψη κανόνα εκπτωσιμότητας ανά κατηγορία
   */
  getDeductibilityRule(category: ExpenseCategory): VATDeductibilityRule {
    const rules = getVatDeductibilityRules();
    const rule = rules.get(category);
    if (!rule) {
      return {
        category,
        deductiblePercent: 0,
        legalBasis: 'Ν.2859/2000 — Κατηγορία χωρίς ρητή εκπτωσιμότητα',
        notes: null,
      };
    }
    return rule;
  }

  // ── Async Methods (χρειάζονται repository) ─────────────────────────────

  /**
   * Υπολογισμός τριμηνιαίας σύνοψης ΦΠΑ
   *
   * Φέρνει τα journal entries του τριμήνου και υπολογίζει:
   * - ΦΠΑ εκροών (ανά συντελεστή)
   * - ΦΠΑ εισροών (ανά συντελεστή + εκπτωσιμότητα)
   * - ΦΠΑ προς απόδοση / πιστωτικό
   */
  async calculateQuarterSummary(
    fiscalYear: number,
    quarter: FiscalQuarter
  ): Promise<VATQuarterSummary> {
    const period = getQuarterPeriod(fiscalYear, quarter);

    // Fetch journal entries for the quarter
    const incomeEntries = await this.repository.listJournalEntries({
      fiscalYear,
      quarter,
      type: 'income',
    });
    const expenseEntries = await this.repository.listJournalEntries({
      fiscalYear,
      quarter,
      type: 'expense',
    });

    // Build output breakdown (income → output VAT)
    const outputMap = new Map<number, VATRateBreakdown>();
    for (const entry of incomeEntries.items) {
      const existing = outputMap.get(entry.vatRate) ?? {
        vatRate: entry.vatRate,
        totalNetAmount: 0,
        totalVatAmount: 0,
        entryCount: 0,
      };
      existing.totalNetAmount = roundToTwoDecimals(existing.totalNetAmount + entry.netAmount);
      existing.totalVatAmount = roundToTwoDecimals(existing.totalVatAmount + entry.vatAmount);
      existing.entryCount += 1;
      outputMap.set(entry.vatRate, existing);
    }

    // Build input breakdown (expenses → input VAT with deductibility)
    const inputMap = new Map<number, VATInputRateBreakdown>();
    for (const entry of expenseEntries.items) {
      const existing = inputMap.get(entry.vatRate) ?? {
        vatRate: entry.vatRate,
        totalNetAmount: 0,
        totalVatAmount: 0,
        entryCount: 0,
        totalDeductibleVat: 0,
        totalNonDeductibleVat: 0,
      };

      const inputCalc = this.calculateInputVat(
        entry.netAmount,
        entry.vatRate,
        entry.category as ExpenseCategory
      );

      existing.totalNetAmount = roundToTwoDecimals(existing.totalNetAmount + entry.netAmount);
      existing.totalVatAmount = roundToTwoDecimals(existing.totalVatAmount + entry.vatAmount);
      existing.entryCount += 1;
      existing.totalDeductibleVat = roundToTwoDecimals(
        existing.totalDeductibleVat + inputCalc.deductibleVatAmount
      );
      existing.totalNonDeductibleVat = roundToTwoDecimals(
        existing.totalNonDeductibleVat + inputCalc.nonDeductibleVatAmount
      );
      inputMap.set(entry.vatRate, existing);
    }

    const outputBreakdown = Array.from(outputMap.values());
    const inputBreakdown = Array.from(inputMap.values());

    const totalOutputVat = roundToTwoDecimals(
      outputBreakdown.reduce((sum, b) => sum + b.totalVatAmount, 0)
    );
    const totalInputVat = roundToTwoDecimals(
      inputBreakdown.reduce((sum, b) => sum + b.totalVatAmount, 0)
    );
    const totalDeductibleInputVat = roundToTwoDecimals(
      inputBreakdown.reduce((sum, b) => sum + b.totalDeductibleVat, 0)
    );

    const vatPayable = roundToTwoDecimals(
      Math.max(0, totalOutputVat - totalDeductibleInputVat)
    );
    const vatCredit = roundToTwoDecimals(
      Math.max(0, totalDeductibleInputVat - totalOutputVat)
    );

    return {
      fiscalYear,
      quarter,
      period,
      status: 'open',
      outputBreakdown,
      totalOutputVat,
      inputBreakdown,
      totalInputVat,
      totalDeductibleInputVat,
      vatPayable,
      vatCredit,
      calculatedAt: new Date().toISOString(),
      submittedAt: null,
    };
  }

  /**
   * Υπολογισμός ετήσιας σύνοψης ΦΠΑ
   *
   * Υπολογίζει και τα 4 τρίμηνα + εκκαθάριση.
   */
  async calculateAnnualSummary(fiscalYear: number): Promise<VATAnnualSummary> {
    const quarters: VATQuarterSummary[] = [];
    const allQuarters: FiscalQuarter[] = [1, 2, 3, 4];

    for (const q of allQuarters) {
      const summary = await this.calculateQuarterSummary(fiscalYear, q);
      quarters.push(summary);
    }

    const annualOutputVat = roundToTwoDecimals(
      quarters.reduce((sum, q) => sum + q.totalOutputVat, 0)
    );
    const annualDeductibleInputVat = roundToTwoDecimals(
      quarters.reduce((sum, q) => sum + q.totalDeductibleInputVat, 0)
    );
    const annualVatPayable = roundToTwoDecimals(
      Math.max(0, annualOutputVat - annualDeductibleInputVat)
    );
    const annualVatCredit = roundToTwoDecimals(
      Math.max(0, annualDeductibleInputVat - annualOutputVat)
    );
    const totalVatPaid = roundToTwoDecimals(
      quarters.reduce((sum, q) => sum + q.vatPayable, 0)
    );
    const settlementAmount = roundToTwoDecimals(annualVatPayable - totalVatPaid);

    return {
      fiscalYear,
      quarters,
      annualOutputVat,
      annualDeductibleInputVat,
      annualVatPayable,
      annualVatCredit,
      totalVatPaid,
      settlementAmount,
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Στρογγυλοποίηση σε 2 δεκαδικά (banker's rounding)
 */
function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Λήψη περιόδου τριμήνου
 */
function getQuarterPeriod(fiscalYear: number, quarter: FiscalQuarter): PeriodRange {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  const lastDay = new Date(fiscalYear, endMonth, 0).getDate();

  return {
    from: `${fiscalYear}-${String(startMonth).padStart(2, '0')}-01`,
    to: `${fiscalYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}
