/**
 * @fileoverview Accounting Service — Business Logic Orchestrator
 * @description Orchestrates engines + repository for high-level accounting operations
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-000 Founding Decision
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type {
  IAccountingRepository,
  IVATEngine,
  ITaxEngine,
  IDepreciationEngine,
} from '../types/interfaces';
import type { VATQuarterSummary, VATAnnualSummary } from '../types/vat';
import type { TaxResult, TaxEstimate, PartnershipTaxResult } from '../types/tax';
import type { EFKAAnnualSummary, PartnershipEFKASummary, PartnerEFKASummary } from '../types/efka';
import type { DepreciationRecord } from '../types/assets';
import type { CreateJournalEntryInput, JournalEntry } from '../types/journal';
import type { FiscalQuarter } from '../types/common';
import type { Partner } from '../types/entity';
import { TaxEngine } from './engines/tax-engine';
import { getCategoryByCode } from '../config/account-categories';
import { getEfkaConfigForYear, calculateMonthlyBreakdown } from './config/efka-config';

// ============================================================================
// ACCOUNTING SERVICE — ORCHESTRATOR
// ============================================================================

/**
 * Accounting Service
 *
 * High-level orchestrator that combines engines + repository
 * for complex business operations.
 *
 * Pattern: Same as existing services (e.g. ProjectsService)
 */
export class AccountingService {
  constructor(
    private readonly repository: IAccountingRepository,
    private readonly vatEngine: IVATEngine,
    private readonly taxEngine: ITaxEngine,
    private readonly depreciationEngine: IDepreciationEngine
  ) {}

  // ── Journal Entry from Invoice ──────────────────────────────────────────

  /**
   * Δημιουργία εγγραφής Ε-Ε από τιμολόγιο
   *
   * Αυτόματη δημιουργία journal entry όταν εκδίδεται τιμολόγιο.
   */
  async createJournalEntryFromInvoice(invoiceId: string): Promise<JournalEntry | null> {
    const invoice = await this.repository.getInvoice(invoiceId);
    if (!invoice) return null;

    // Κατηγορία: πρώτη γραμμή τιμολογίου → αντιστοίχιση
    const primaryMydataCode = invoice.lineItems[0]?.mydataCode ?? 'category1_3';
    const category = getCategoryByCode('service_income'); // Default

    const entryInput: CreateJournalEntryInput = {
      date: invoice.issueDate,
      type: 'income',
      category: category?.code ?? 'service_income',
      description: `Τιμολόγιο ${invoice.series}-${invoice.number} — ${invoice.customer.name}`,
      netAmount: invoice.totalNetAmount,
      vatRate: invoice.vatBreakdown[0]?.vatRate ?? 24,
      vatAmount: invoice.totalVatAmount,
      grossAmount: invoice.totalGrossAmount,
      vatDeductible: false,
      paymentMethod: invoice.paymentMethod,
      contactId: invoice.customer.contactId,
      contactName: invoice.customer.name,
      invoiceId: invoice.invoiceId,
      mydataCode: primaryMydataCode,
      e3Code: category?.e3Code ?? '561_003',
      fiscalYear: invoice.fiscalYear,
      quarter: getQuarterFromMonth(parseInt(invoice.issueDate.substring(5, 7), 10)),
      notes: null,
    };

    const { id } = await this.repository.createJournalEntry(entryInput);
    const entry = await this.repository.getJournalEntry(id);

    // Ενημέρωση τιμολογίου με reference στο journal entry
    if (entry) {
      await this.repository.updateInvoice(invoiceId, {
        journalEntryId: id,
      });
    }

    return entry;
  }

  // ── VAT Dashboard ───────────────────────────────────────────────────────

  /**
   * VAT Dashboard — Τριμηνιαία σύνοψη ΦΠΑ
   */
  async getVATQuarterDashboard(
    fiscalYear: number,
    quarter: FiscalQuarter
  ): Promise<VATQuarterSummary> {
    return this.vatEngine.calculateQuarterSummary(fiscalYear, quarter);
  }

  /**
   * VAT Dashboard — Ετήσια σύνοψη ΦΠΑ
   */
  async getVATAnnualDashboard(fiscalYear: number): Promise<VATAnnualSummary> {
    return this.vatEngine.calculateAnnualSummary(fiscalYear);
  }

  // ── Tax Dashboard ───────────────────────────────────────────────────────

  /**
   * Tax Dashboard — Πρόβλεψη φόρου real-time
   */
  async getTaxEstimate(fiscalYear: number): Promise<TaxEstimate> {
    return this.taxEngine.estimateTax(fiscalYear);
  }

  /**
   * Tax Dashboard — Full tax calculation (τέλος χρήσης)
   */
  async calculateFullTax(
    fiscalYear: number,
    efkaTotal: number,
    withholdings: number,
    previousPrepayment: number,
    isFirstFiveYears: boolean
  ): Promise<TaxResult> {
    const scale = this.taxEngine.getTaxScale(fiscalYear);

    // Fetch actual income/expenses
    const incomeEntries = await this.repository.listJournalEntries({
      fiscalYear,
      type: 'income',
    });
    const expenseEntries = await this.repository.listJournalEntries({
      fiscalYear,
      type: 'expense',
    });

    const totalIncome = incomeEntries.items.reduce((sum, e) => sum + e.netAmount, 0);
    const totalExpenses = expenseEntries.items.reduce((sum, e) => sum + e.netAmount, 0);

    return this.taxEngine.calculateAnnualTax({
      fiscalYear,
      totalIncome,
      totalDeductibleExpenses: totalExpenses,
      totalEfkaContributions: efkaTotal,
      professionalTax: scale.professionalTax,
      totalWithholdings: withholdings,
      previousYearPrepayment: previousPrepayment,
      isFirstFiveYears,
    });
  }

  // ── Depreciation ────────────────────────────────────────────────────────

  /**
   * Εκτέλεση ετήσιων αποσβέσεων (τέλος χρήσης)
   */
  async runYearEndDepreciation(fiscalYear: number): Promise<DepreciationRecord[]> {
    return this.depreciationEngine.bookDepreciations(fiscalYear);
  }

  // ── Partnership Tax (ADR-ACC-012) ──────────────────────────────────────

  /**
   * Υπολογισμός φόρου ΟΕ (pass-through ανά εταίρο)
   */
  async calculatePartnershipTax(fiscalYear: number): Promise<PartnershipTaxResult> {
    const partners = await this.repository.getPartners();
    const incomeEntries = await this.repository.listJournalEntries({ fiscalYear, type: 'income' });
    const expenseEntries = await this.repository.listJournalEntries({ fiscalYear, type: 'expense' });

    const totalIncome = incomeEntries.items.reduce((sum, e) => sum + e.netAmount, 0);
    const totalExpenses = expenseEntries.items.reduce((sum, e) => sum + e.netAmount, 0);

    // Per-partner EFKA totals
    const efkaByPartner = new Map<string, number>();
    for (const p of partners) {
      const payments = await this.repository.getPartnerEFKAPayments(p.partnerId, fiscalYear);
      const paid = payments
        .filter((pay) => pay.status === 'paid')
        .reduce((sum, pay) => sum + pay.amount, 0);
      efkaByPartner.set(p.partnerId, paid);
    }

    // Cast to TaxEngine for partnership method
    const taxEngine = this.taxEngine as TaxEngine;

    return taxEngine.calculatePartnershipTax(
      fiscalYear,
      totalIncome,
      totalExpenses,
      efkaByPartner,
      partners.map((p) => ({
        partnerId: p.partnerId,
        partnerName: p.fullName,
        profitSharePercent: p.profitSharePercent,
        withholdings: 0,
        previousPrepayment: 0,
        isFirstFiveYears: p.isFirstFiveYears,
      }))
    );
  }

  /**
   * Σύνοψη ΕΦΚΑ ΟΕ (per-partner)
   */
  async getPartnershipEfkaSummary(year: number): Promise<PartnershipEFKASummary> {
    const partners = await this.repository.getPartners();
    const partnerSummaries: PartnerEFKASummary[] = [];
    let totalAllPartnersPaid = 0;
    let totalAllPartnersDue = 0;

    for (const p of partners) {
      const payments = await this.repository.getPartnerEFKAPayments(p.partnerId, year);
      const mainCode = p.efkaConfig.selectedMainPensionCode || 'main_1';
      const suppCode = p.efkaConfig.selectedSupplementaryCode || 'supplementary_1';
      const lumpCode = p.efkaConfig.selectedLumpSumCode || 'lump_sum_1';

      const monthlyBreakdown = calculateMonthlyBreakdown(year, mainCode, suppCode, lumpCode);

      const totalPaid = payments
        .filter((pay) => pay.status === 'paid')
        .reduce((sum, pay) => sum + pay.amount, 0);
      const totalDue = monthlyBreakdown.reduce((sum, m) => sum + m.totalMonthly, 0);
      const balanceDue = Math.round((totalDue - totalPaid) * 100) / 100;
      const paidMonths = payments.filter((pay) => pay.status === 'paid').length;
      const overdueMonths = payments.filter(
        (pay) => pay.status === 'overdue' || pay.status === 'keao'
      ).length;

      const summary = {
        year,
        monthlyBreakdown,
        payments,
        totalPaid,
        totalDue,
        balanceDue,
        taxDeductibleAmount: totalPaid,
        paidMonths,
        overdueMonths,
      };

      partnerSummaries.push({
        partnerId: p.partnerId,
        partnerName: p.fullName,
        summary,
      });

      totalAllPartnersPaid += totalPaid;
      totalAllPartnersDue += totalDue;
    }

    return {
      year,
      partnerSummaries,
      totalAllPartnersPaid,
      totalAllPartnersDue,
    };
  }

  // ── EFKA ────────────────────────────────────────────────────────────────

  /**
   * Ετήσια σύνοψη ΕΦΚΑ
   */
  async getEfkaAnnualSummary(year: number): Promise<EFKAAnnualSummary> {
    const userConfig = await this.repository.getEFKAUserConfig();
    const payments = await this.repository.getEFKAPayments(year);

    // Default codes if no user config
    const mainCode = userConfig?.selectedMainPensionCode ?? 'main_1';
    const suppCode = userConfig?.selectedSupplementaryCode ?? 'supplementary_1';
    const lumpCode = userConfig?.selectedLumpSumCode ?? 'lump_sum_1';

    const monthlyBreakdown = calculateMonthlyBreakdown(year, mainCode, suppCode, lumpCode);

    const totalPaid = payments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);
    const totalDue = monthlyBreakdown.reduce((sum, m) => sum + m.totalMonthly, 0);
    const balanceDue = Math.round((totalDue - totalPaid) * 100) / 100;
    const paidMonths = payments.filter((p) => p.status === 'paid').length;
    const overdueMonths = payments.filter((p) => p.status === 'overdue' || p.status === 'keao').length;

    return {
      year,
      monthlyBreakdown,
      payments,
      totalPaid,
      totalDue,
      balanceDue,
      taxDeductibleAmount: totalPaid,
      paidMonths,
      overdueMonths,
    };
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function getQuarterFromMonth(month: number): FiscalQuarter {
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}
