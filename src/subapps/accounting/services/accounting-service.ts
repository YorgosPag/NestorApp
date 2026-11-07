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
import type { DepreciationPreview, DepreciationRunResult } from '../types/assets';
import type { CreateJournalEntryInput, JournalEntry } from '../types/journal';
import type { FiscalQuarter } from '../types/common';
import { getCategoryByCode } from '../config/account-categories';
import { roundToTwo } from '../utils/math';
import {
  calculatePartnershipEfkaSummary,
  calculateEPEEfkaSummary,
  calculateAEEfkaSummary,
  buildEfkaAnnualSummary,
} from './accounting-efka-operations';
import { ledgerTaxTotals, loadLedger, type LedgerTaxTotals } from './journal/journal-ledger';
import {
  entityHoldersOf,
  entityTaxInputOf,
  loadAeProfile,
  loadEpeProfile,
  loadPartnershipProfile,
  taxStandingOf,
} from './tax/entity-tax-profile';
import type { TaxStanding } from './tax/entity-tax-profile';

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
    previousPrepayment: number
  ): Promise<TaxResult> {
    const scale = this.taxEngine.getTaxScale(fiscalYear);

    const totals = await this.loadYearTotals(fiscalYear);

    // ⚠️ Χωρίς καλούντα. Η ΕΦΚΑ του βιβλίου αφαιρείται εδώ· το `efkaTotal` του καλούντα είναι ΕΠΙΠΛΕΟΝ αφαίρεση
    //   (ίδια αριθμητική με πριν) — ποτέ από εγγραφές πληρωμών ΕΦΚΑ (ADR-ACC-006 §7.1).
    return this.taxEngine.calculateAnnualTax({
      fiscalYear,
      totalIncome: totals.totalIncome,
      totalDeductibleExpenses: totals.totalExpenses,
      totalEfkaContributions: roundToTwo(totals.efkaContributions + efkaTotal),
      professionalTax: scale.professionalTax,
      totalWithholdings: withholdings,
      previousYearPrepayment: previousPrepayment,
      businessStart: (await this.loadTaxStanding()).businessStart,
    });
  }

  // ── Depreciation ────────────────────────────────────────────────────────

  /** Προεπισκόπηση αποσβέσεων χρήσης — σωστό / καταχωρημένο / διαφορά ανά πάγιο, καμία εγγραφή (§2.1.1 Φάση 5). */
  async previewYearEndDepreciation(fiscalYear: number): Promise<DepreciationPreview> {
    return this.depreciationEngine.previewDepreciations(fiscalYear);
  }

  /**
   * Εκτέλεση ετήσιων αποσβέσεων χρήσης που έληξε — πλήρης σάρωση, ιδεμπότητη, καταχώριση στο Βιβλίο Ε-Ε
   * (ADR-ACC-010 §2.1.1 Φάσεις 4–5)
   */
  async runYearEndDepreciation(fiscalYear: number): Promise<DepreciationRunResult> {
    return this.depreciationEngine.bookDepreciations(fiscalYear);
  }

  /** Αναίρεση αποσβέσεων χρήσης (Xero rollback) — αντιλογισμός στο Βιβλίο Ε-Ε (§2.1.1 Φάση 5). */
  async reverseYearEndDepreciation(fiscalYear: number): Promise<DepreciationRunResult> {
    return this.depreciationEngine.reverseDepreciations(fiscalYear);
  }

  // ── Entity Tax (ADR-ACC-012 / 014 / 016 · ADR-ACC-024 §6) ─────────────────

  /** Έναρξη εργασιών + βιβλία του προφίλ — η φορολογική θέση της επιχείρησης. */
  private async loadTaxStanding(): Promise<TaxStanding> {
    return taxStandingOf(await this.repository.getCompanySetup());
  }

  /**
   * Υπολογισμός φόρου ΟΕ — ως οντότητα (22%) + διανομή στους εταίρους (ADR-ACC-024 §6)
   */
  async calculatePartnershipTax(fiscalYear: number): Promise<PartnershipTaxResult> {
    const standing = await this.loadTaxStanding();
    const [profile, totals] = await Promise.all([
      loadPartnershipProfile(this.repository, standing),
      this.loadYearTotals(fiscalYear),
    ]);
    return this.taxEngine.calculatePartnershipTax(entityTaxInputOf(profile, fiscalYear, totals), entityHoldersOf(profile));
  }

  /**
   * Υπολογισμός εταιρικού φόρου ΕΠΕ (22% flat + μερίσματα 5%)
   */
  async calculateEPETax(fiscalYear: number): Promise<EPETaxResult> {
    const standing = await this.loadTaxStanding();
    const [profile, totals] = await Promise.all([
      loadEpeProfile(this.repository, standing),
      this.loadYearTotals(fiscalYear),
    ]);
    return this.taxEngine.calculateCorporateTax(entityTaxInputOf(profile, fiscalYear, totals), entityHoldersOf(profile));
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
    const standing = await this.loadTaxStanding();
    const [profile, totals] = await Promise.all([
      loadAeProfile(this.repository, standing),
      this.loadYearTotals(fiscalYear),
    ]);
    return this.taxEngine.calculateAETax(entityTaxInputOf(profile, fiscalYear, totals), entityHoldersOf(profile));
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

  /**
   * Σύνολα φόρου ΟΛΗΣ της χρήσης — από το SSoT καθολικού, ποτέ από σελίδα. Η ΕΦΚΑ (κατηγορία `efka`) χωριστά
   * από τα έξοδα, ΜΙΑ φορά· οι εγγραφές πληρωμών ΕΦΚΑ δεν μετέχουν στον φόρο (ADR-ACC-006 §7.1).
   */
  private async loadYearTotals(fiscalYear: number): Promise<LedgerTaxTotals> {
    return ledgerTaxTotals(await loadLedger(this.repository, { kind: 'fiscalYear', fiscalYear }));
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
