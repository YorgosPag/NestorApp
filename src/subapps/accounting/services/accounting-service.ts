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
import type { TaxResult, TaxEstimate, PartnershipTaxResult, EPETaxResult, AETaxResult } from '../types/tax';
import type { EFKAAnnualSummary, PartnershipEFKASummary, EPEEFKASummary, AEEFKASummary } from '../types/efka';
import type { DepreciationRecord } from '../types/assets';
import type { CreateJournalEntryInput, JournalEntry } from '../types/journal';
import type { FiscalQuarter, AccountCategory, PaymentMethod } from '../types/common';
import { getCategoryByCode } from '../config/account-categories';
import {
  calculatePartnershipEfkaSummary,
  calculateEPEEfkaSummary,
  calculateAEEfkaSummary,
  buildEfkaAnnualSummary,
} from './accounting-efka-operations';
import { loadLedger } from './journal/journal-ledger';
import {
  deductibleEfka,
  loadAeProfile,
  loadEpeProfile,
  loadPartnershipProfile,
  partnershipTaxInputs,
} from './tax/entity-tax-profile';

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

  // ── Journal Entry from Expense Document ─────────────────────────────────

  /**
   * Δημιουργία εγγραφής Ε-Ε από επιβεβαιωμένο παραστατικό εξόδου
   *
   * Κεντρικοποιημένη λογική — ακριβώς όπως createJournalEntryFromInvoice().
   * Καλείται από τον documents/[id] PATCH handler κατά το confirm.
   */
  async createJournalEntryFromExpense(params: {
    documentId: string;
    fileName: string;
    confirmedNetAmount: number;
    confirmedVatAmount: number;
    confirmedCategory: AccountCategory;
    confirmedDate: string;
    confirmedIssuerName: string | null;
    confirmedPaymentMethod: PaymentMethod;
    fiscalYear: number;
  }): Promise<JournalEntry | null> {
    const grossAmount = params.confirmedNetAmount + params.confirmedVatAmount;
    const quarter = getQuarterFromMonth(
      parseInt(params.confirmedDate.substring(5, 7), 10)
    );
    const vatRate = params.confirmedVatAmount > 0
      ? Math.round((params.confirmedVatAmount / params.confirmedNetAmount) * 100)
      : 0;

    const description = params.confirmedIssuerName
      ? `Παραστατικό: ${params.fileName} — ${params.confirmedIssuerName}`
      : `Παραστατικό: ${params.fileName}`;

    const entryInput: CreateJournalEntryInput = {
      date: params.confirmedDate,
      type: 'expense',
      category: params.confirmedCategory,
      description,
      netAmount: params.confirmedNetAmount,
      vatRate,
      vatAmount: params.confirmedVatAmount,
      grossAmount,
      vatDeductible: true,
      paymentMethod: params.confirmedPaymentMethod,
      contactId: null,
      contactName: params.confirmedIssuerName,
      invoiceId: null,
      mydataCode: 'category2_4',
      e3Code: '585_001',
      fiscalYear: params.fiscalYear,
      quarter,
      notes: `AI Document: ${params.documentId}`,
    };

    const { id } = await this.repository.createJournalEntry(entryInput);
    return this.repository.getJournalEntry(id);
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

    const { totalIncome, totalExpenses } = await this.loadYearTotals(fiscalYear);

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
    const [profile, { totalIncome, totalExpenses }] = await Promise.all([
      loadPartnershipProfile(this.repository, fiscalYear),
      this.loadYearTotals(fiscalYear),
    ]);
    const { efkaByPartner, partners } = partnershipTaxInputs(profile);

    return this.taxEngine.calculatePartnershipTax(fiscalYear, totalIncome, totalExpenses, efkaByPartner, partners);
  }

  // ── EPE Corporate Tax (ADR-ACC-014) ──────────────────────────────────

  /**
   * Υπολογισμός εταιρικού φόρου ΕΠΕ (22% flat + μερίσματα 5%)
   */
  async calculateEPETax(fiscalYear: number): Promise<EPETaxResult> {
    // EFKA only for active managers — SSoT `entity-tax-profile`
    const [profile, { totalIncome, totalExpenses }] = await Promise.all([
      loadEpeProfile(this.repository, fiscalYear),
      this.loadYearTotals(fiscalYear),
    ]);

    return this.taxEngine.calculateCorporateTax(
      fiscalYear,
      totalIncome,
      totalExpenses,
      deductibleEfka(profile),
      profile.members.map((m) => ({
        memberId: m.memberId,
        memberName: m.fullName,
        dividendSharePercent: m.dividendSharePercent,
      }))
    );
  }

  /**
   * Σύνοψη ΕΦΚΑ ΕΠΕ (μόνο διαχειριστές)
   */
  async getEPEEfkaSummary(year: number): Promise<EPEEFKASummary> {
    return calculateEPEEfkaSummary(this.repository, year);
  }

  // ── AE Corporate Tax (ADR-ACC-016) ──────────────────────────────────

  /**
   * Υπολογισμός εταιρικού φόρου ΑΕ (22% flat + μερίσματα 5%)
   */
  async calculateAETax(fiscalYear: number): Promise<AETaxResult> {
    // EFKA only for self-employed board members with compensation — SSoT `entity-tax-profile` (ADR-ACC-017)
    const [profile, { totalIncome, totalExpenses }] = await Promise.all([
      loadAeProfile(this.repository, fiscalYear),
      this.loadYearTotals(fiscalYear),
    ]);

    return this.taxEngine.calculateAETax(
      fiscalYear,
      totalIncome,
      totalExpenses,
      deductibleEfka(profile),
      profile.shareholders.map((s) => ({
        shareholderId: s.shareholderId,
        shareholderName: s.fullName,
        dividendSharePercent: s.dividendSharePercent,
      }))
    );
  }

  /**
   * Σύνοψη ΕΦΚΑ ΑΕ — Dual mode (employee + self-employed)
   *
   * @see ADR-ACC-017 Board of Directors & EFKA
   */
  async getAEEfkaSummary(year: number): Promise<AEEFKASummary> {
    return calculateAEEfkaSummary(this.repository, year);
  }

  /**
   * Σύνοψη ΕΦΚΑ ΟΕ (per-partner)
   */
  async getPartnershipEfkaSummary(year: number): Promise<PartnershipEFKASummary> {
    return calculatePartnershipEfkaSummary(this.repository, year);
  }

  // ── EFKA ────────────────────────────────────────────────────────────────

  /**
   * Ετήσια σύνοψη ΕΦΚΑ
   */
  async getEfkaAnnualSummary(year: number): Promise<EFKAAnnualSummary> {
    const [userConfig, payments] = await Promise.all([
      this.repository.getEFKAUserConfig(),
      this.repository.getEFKAPayments(year),
    ]);
    return buildEfkaAnnualSummary(year, payments, userConfig);
  }

  /** Καθαρά έσοδα / έξοδα ΟΛΗΣ της χρήσης — από το SSoT καθολικού, ποτέ από σελίδα. */
  private async loadYearTotals(
    fiscalYear: number
  ): Promise<{ totalIncome: number; totalExpenses: number }> {
    const ledger = await loadLedger(this.repository, { kind: 'fiscalYear', fiscalYear });
    return { totalIncome: ledger.totalIncomeNet, totalExpenses: ledger.totalExpenseNet };
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
