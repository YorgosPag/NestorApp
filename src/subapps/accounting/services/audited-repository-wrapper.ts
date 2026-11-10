/**
 * @fileoverview Audited Repository Wrapper — Automatic Audit Trail
 * @description Wraps IAccountingRepository mutations with automatic audit entries
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-1c.md Q7 (Google interceptors / SAP BAPI framework)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { IAccountingRepository } from '../types/interfaces';
import type {
  AccountingAuditEntry,
  AccountingAuditEventType,
  AuditEntityType,
} from '../types/accounting-audit';
import type { CompanyProfile } from '../types/company';
import type { BankAccountConfig } from '../types/bank';
import { maskIBAN } from '@/types/contacts/banking';
import { accountingAuditEntryOf, logAccountingEvent } from './accounting-audit-service';
import { diffCompanyOwnership } from './audit/company-ownership-audit';
import { legalNameChangeAudit } from './audit/company-legal-name-audit';

// ============================================================================
// AUDITED REPOSITORY WRAPPER (Q7 — automatic, zero developer effort)
// ============================================================================

/**
 * Wraps an IAccountingRepository with automatic audit logging
 *
 * - Mutations (create/update): automatic audit entry after successful operation
 * - Reads (get/list): pass-through, zero overhead
 * - Bulk operations (createBankTransaction): skipped (bulk imports) · `openFiscalYear` audits itself (Φ9)
 *
 * Pattern: Google infrastructure interceptors / SAP BAPI framework
 */
export function createAuditedRepository(
  repo: IAccountingRepository,
  userId: string,
  companyId: string
): IAccountingRepository {
  return {
    // ── Read methods — pass-through (NO audit) ────────────────────────────
    getCompanySetup: repo.getCompanySetup.bind(repo),
    getJournalEntry: repo.getJournalEntry.bind(repo),
    listJournalEntries: repo.listJournalEntries.bind(repo),
    collectJournalEntryList: repo.collectJournalEntryList.bind(repo),
    hasJournalEntriesInCategory: repo.hasJournalEntriesInCategory.bind(repo),
    collectJournalEntries: repo.collectJournalEntries.bind(repo),
    getJournalEntryByInvoiceId: repo.getJournalEntryByInvoiceId.bind(repo),
    getInvoice: repo.getInvoice.bind(repo),
    listInvoices: repo.listInvoices.bind(repo),
    collectInvoiceList: repo.collectInvoiceList.bind(repo),
    collectInvoices: repo.collectInvoices.bind(repo),
    getNextInvoiceNumber: repo.getNextInvoiceNumber.bind(repo),
    getInvoiceSeries: repo.getInvoiceSeries.bind(repo),
    getServicePresets: repo.getServicePresets.bind(repo),
    saveServicePresets: repo.saveServicePresets.bind(repo),
    getMatchingConfig: repo.getMatchingConfig.bind(repo),
    saveMatchingConfig: repo.saveMatchingConfig.bind(repo),
    getBankTransaction: repo.getBankTransaction.bind(repo),
    listBankTransactions: repo.listBankTransactions.bind(repo),
    collectBankTransactionList: repo.collectBankTransactionList.bind(repo),
    collectBankTransactions: repo.collectBankTransactions.bind(repo),
    collectOpenInvoicesByAmount: repo.collectOpenInvoicesByAmount.bind(repo),
    findOpenInvoicesByReference: repo.findOpenInvoicesByReference.bind(repo),
    collectActiveJournalEntriesByAmount: repo.collectActiveJournalEntriesByAmount.bind(repo),
    getBankAccounts: repo.getBankAccounts.bind(repo),
    listBankAccounts: repo.listBankAccounts.bind(repo),
    getFixedAsset: repo.getFixedAsset.bind(repo),
    listFixedAssets: repo.listFixedAssets.bind(repo),
    collectFixedAssetList: repo.collectFixedAssetList.bind(repo),
    collectFixedAssets: repo.collectFixedAssets.bind(repo),
    readDepreciationRecords: repo.readDepreciationRecords.bind(repo),
    // ADR-ACC-010 §2.1.1 Φ5: the ONE depreciation writer owns its trace (same transaction) — wrapping it here
    // would trace twice, and a caller WITHOUT this wrapper (every route) would post without a trace.
    postDepreciation: repo.postDepreciation.bind(repo),
    // ADR-ACC-010 §2.1.1 Φ6: ο γραφέας περιόδων γράφει το ίχνος `PERIOD_*` ΜΕΣΑ στη συναλλαγή της μετάβασης.
    transitionFiscalPeriod: repo.transitionFiscalPeriod.bind(repo),
    getDepreciationRecords: repo.getDepreciationRecords.bind(repo),
    getPartners: repo.getPartners.bind(repo),
    getPartnerEFKAPayments: repo.getPartnerEFKAPayments.bind(repo),
    getMembers: repo.getMembers.bind(repo),
    getMemberEFKAPayments: repo.getMemberEFKAPayments.bind(repo),
    getShareholders: repo.getShareholders.bind(repo),
    getShareholderEFKAPayments: repo.getShareholderEFKAPayments.bind(repo),
    getEFKAPayments: repo.getEFKAPayments.bind(repo),
    updateEFKAPayment: repo.updateEFKAPayment.bind(repo),
    getEFKAUserConfig: repo.getEFKAUserConfig.bind(repo),
    saveEFKAUserConfig: repo.saveEFKAUserConfig.bind(repo),
    getTaxInstallments: repo.getTaxInstallments.bind(repo),
    updateTaxInstallment: repo.updateTaxInstallment.bind(repo),
    getExpenseDocument: repo.getExpenseDocument.bind(repo),
    listExpenseDocuments: repo.listExpenseDocuments.bind(repo),
    getAPYCertificate: repo.getAPYCertificate.bind(repo),
    listAPYCertificates: repo.listAPYCertificates.bind(repo),
    getCustomCategory: repo.getCustomCategory.bind(repo),
    listCustomCategories: repo.listCustomCategories.bind(repo),
    getCustomerBalance: repo.getCustomerBalance.bind(repo),
    listCustomerBalances: repo.listCustomerBalances.bind(repo),
    getFiscalPeriod: repo.getFiscalPeriod.bind(repo),
    listFiscalPeriods: repo.listFiscalPeriods.bind(repo),
    listAuditEntries: repo.listAuditEntries.bind(repo),

    // ── Audit entry (pass-through — the wrapper itself uses this) ─────────
    createAuditEntry: repo.createAuditEntry.bind(repo),

    // ── Bulk / setup operations — NO audit (batch imports, setup) ─────────
    createBankTransaction: repo.createBankTransaction.bind(repo),
    createImportBatch: repo.createImportBatch.bind(repo),
    // Φ9: ο γραφέας γράφει ΜΟΝΟΣ του το ίχνος `FISCAL_YEAR_OPENED`, στην ίδια συναλλαγή.
    openFiscalYear: repo.openFiscalYear.bind(repo),
    createFixedAsset: repo.createFixedAsset.bind(repo),
    createExpenseDocument: repo.createExpenseDocument.bind(repo),
    createAPYCertificate: repo.createAPYCertificate.bind(repo),
    createCustomCategory: repo.createCustomCategory.bind(repo),
    updateAPYCertificate: repo.updateAPYCertificate.bind(repo),
    pushAPYEmailRecord: repo.pushAPYEmailRecord.bind(repo),
    updateCustomCategory: repo.updateCustomCategory.bind(repo),
    deleteCustomCategory: repo.deleteCustomCategory.bind(repo),
    updateFixedAsset: repo.updateFixedAsset.bind(repo),
    updateExpenseDocument: repo.updateExpenseDocument.bind(repo),
    // ADR-ACC-010 §2.1.1 Φ8: το ίχνος του αντιλογισμού το γράφει Ο ΓΡΑΦΕΑΣ, μέσα στη συναλλαγή — ποτέ ο wrapper.
    reverseJournalEntry: repo.reverseJournalEntry.bind(repo),
    // Μόνο κείμενο (περιγραφή / σημειώσεις) — το ίχνος το γράφει η διαδρομή (`logAuditEvent`).
    updateJournalEntry: repo.updateJournalEntry.bind(repo),

    // ── Audited mutations ─────────────────────────────────────────────────

    async saveCompanySetup(data, options) {
      // ADR-440 · ADR-841 §7 Α23 Φ3.2 Γ3: ownership and legal name are material data. The trace is
      // judged from the TRANSACTION's before/after and written INSIDE it — never a second read, never
      // a change without a trace, never a trace for a value the field mask did not write.
      return repo.saveCompanySetup(data, {
        ...options,
        auditOf: (before, after) => [
          ...(options?.auditOf?.(before, after) ?? []),
          ...companySetupAudit(before, after, userId, companyId),
        ],
      });
    },

    async createInvoice(data) {
      const result = await repo.createInvoice(data);
      await logAudit(repo, userId, 'INVOICE_CREATED', 'invoice', result.id,
        `Δημιουργία τιμολογίου #${result.number}`,
        { number: result.number, type: data.type ?? null });
      return result;
    },

    async updateInvoice(invoiceId, updates) {
      await repo.updateInvoice(invoiceId, updates);
      await logAudit(repo, userId, 'INVOICE_UPDATED', 'invoice', invoiceId,
        'Ενημέρωση τιμολογίου');
    },

    async createJournalEntry(data) {
      const result = await repo.createJournalEntry(data);
      await logAudit(repo, userId, 'JOURNAL_CREATED', 'journal', result.id,
        `Εγγραφή ημερολογίου: ${data.description}`,
        { type: data.type, netAmount: data.netAmount });
      return result;
    },

    async updateBankTransaction(transactionId, updates) {
      await repo.updateBankTransaction(transactionId, updates);
      // Audit BANK_MATCHED when matchStatus changes
      if (updates.matchStatus === 'manual_matched' || updates.matchStatus === 'auto_matched') {
        await logAudit(repo, userId, 'BANK_MATCHED', 'bank_transaction', transactionId,
          `Αντιστοίχιση τραπεζικής κίνησης → ${updates.matchedEntityId ?? 'N/A'}`,
          { matchStatus: updates.matchStatus, matchedEntityId: updates.matchedEntityId ?? null });
      }
    },

    // ADR-ACC-018 §15: ο λογαριασμός που τυπώνεται στα τιμολόγια — κάθε αλλαγή του αφήνει ίχνος (αντι-απάτη).
    async createBankAccount(data) {
      const created = await repo.createBankAccount(data);
      await logAudit(repo, userId, 'BANK_ACCOUNT_CREATED', 'bank_account', created.accountId,
        `Νέος τραπεζικός λογαριασμός ${maskIBAN(created.iban)}`, bankAccountAuditMetadata(created));
      return created;
    },

    async updateBankAccount(accountId, updates) {
      const saved = await repo.updateBankAccount(accountId, updates);
      await logAudit(repo, userId, 'BANK_ACCOUNT_UPDATED', 'bank_account', accountId,
        `Αλλαγή τραπεζικού λογαριασμού ${maskIBAN(saved.iban)}`, bankAccountAuditMetadata(saved));
      return saved;
    },

    async deactivateBankAccount(accountId) {
      const saved = await repo.deactivateBankAccount(accountId);
      await logAudit(repo, userId, 'BANK_ACCOUNT_DEACTIVATED', 'bank_account', accountId,
        `Απενεργοποίηση τραπεζικού λογαριασμού ${maskIBAN(saved.iban)}`, bankAccountAuditMetadata(saved));
      return saved;
    },

    async upsertCustomerBalance(customerId, balance) {
      await repo.upsertCustomerBalance(customerId, balance);
      await logAudit(repo, userId, 'BALANCE_UPDATED', 'balance', customerId,
        `Ενημέρωση υπολοίπου: €${balance.netBalance.toFixed(2)}`,
        { netBalance: balance.netBalance, fiscalYear: balance.fiscalYear });
    },

  };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/** The trace of a profile save — the EXISTING pure judges, one entry builder (ADR-440 · ADR-841 Α23). */
function companySetupAudit(
  before: CompanyProfile | null,
  after: CompanyProfile,
  userId: string,
  companyId: string
): AccountingAuditEntry[] {
  const subject = { entityType: 'company_profile', entityId: companyId, userId } as const;
  const entries: AccountingAuditEntry[] = [];

  const ownership = diffCompanyOwnership(before, after);
  if (ownership.changed) {
    entries.push(accountingAuditEntryOf({ ...subject, eventType: 'COMPANY_PROFILE_UPDATED',
      details: ownership.details, metadata: ownership.metadata }));
  }

  const rename = legalNameChangeAudit({ from: before?.businessName ?? null, to: after.businessName, source: 'profile' });
  if (rename !== null) {
    entries.push(accountingAuditEntryOf({ ...subject, eventType: 'COMPANY_LEGAL_NAME_CHANGED', ...rename }));
  }
  return entries;
}

/** Το ίχνος δεν αντιγράφει ολόκληρο το IBAN — το καλυμμένο αρκεί για ταυτοποίηση (ADR-ACC-018 §15). */
function bankAccountAuditMetadata(account: BankAccountConfig): Record<string, string | boolean | null> {
  return {
    iban: maskIBAN(account.iban),
    bic: account.bankCode,
    holderName: account.holderName ?? null,
    showOnInvoices: account.showOnInvoices === true,
    isDefaultForInvoices: account.isDefaultForInvoices === true,
    isActive: account.isActive,
  };
}

async function logAudit(
  repo: IAccountingRepository,
  userId: string,
  eventType: AccountingAuditEventType,
  entityType: AuditEntityType,
  entityId: string,
  details: string,
  metadata?: Record<string, string | number | boolean | null>
): Promise<void> {
  await logAccountingEvent(repo, {
    eventType,
    entityType,
    entityId,
    userId,
    details,
    metadata,
  });
}
