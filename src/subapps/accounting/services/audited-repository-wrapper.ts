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
  AccountingAuditEventType,
  AuditEntityType,
} from '../types/accounting-audit';
import type { FiscalPeriod } from '../types/fiscal-period';
import { logAccountingEvent } from './accounting-audit-service';

// ============================================================================
// PERIOD STATUS → EVENT TYPE MAPPING
// ============================================================================

function periodStatusToEventType(
  updates: Partial<FiscalPeriod>
): AccountingAuditEventType | null {
  if (updates.status === 'CLOSED') return 'PERIOD_CLOSED';
  if (updates.status === 'LOCKED') return 'PERIOD_LOCKED';
  if (updates.status === 'OPEN' && updates.reopenedAt) return 'PERIOD_REOPENED';
  return null;
}

// ============================================================================
// AUDITED REPOSITORY WRAPPER (Q7 — automatic, zero developer effort)
// ============================================================================

/**
 * Wraps an IAccountingRepository with automatic audit logging
 *
 * - Mutations (create/update): automatic audit entry after successful operation
 * - Reads (get/list): pass-through, zero overhead
 * - Bulk operations (createFiscalPeriods, createBankTransaction): skipped (bulk imports)
 *
 * Pattern: Google infrastructure interceptors / SAP BAPI framework
 */
export function createAuditedRepository(
  repo: IAccountingRepository,
  userId: string
): IAccountingRepository {
  return {
    // ── Read methods — pass-through (NO audit) ────────────────────────────
    getCompanySetup: repo.getCompanySetup.bind(repo),
    saveCompanySetup: repo.saveCompanySetup.bind(repo),
    getJournalEntry: repo.getJournalEntry.bind(repo),
    listJournalEntries: repo.listJournalEntries.bind(repo),
    getJournalEntryByInvoiceId: repo.getJournalEntryByInvoiceId.bind(repo),
    getInvoice: repo.getInvoice.bind(repo),
    listInvoices: repo.listInvoices.bind(repo),
    getNextInvoiceNumber: repo.getNextInvoiceNumber.bind(repo),
    getInvoiceSeries: repo.getInvoiceSeries.bind(repo),
    getServicePresets: repo.getServicePresets.bind(repo),
    saveServicePresets: repo.saveServicePresets.bind(repo),
    getBankTransaction: repo.getBankTransaction.bind(repo),
    listBankTransactions: repo.listBankTransactions.bind(repo),
    getBankAccounts: repo.getBankAccounts.bind(repo),
    getFixedAsset: repo.getFixedAsset.bind(repo),
    listFixedAssets: repo.listFixedAssets.bind(repo),
    getDepreciationRecords: repo.getDepreciationRecords.bind(repo),
    getPartners: repo.getPartners.bind(repo),
    savePartners: repo.savePartners.bind(repo),
    getPartnerEFKAPayments: repo.getPartnerEFKAPayments.bind(repo),
    getMembers: repo.getMembers.bind(repo),
    saveMembers: repo.saveMembers.bind(repo),
    getMemberEFKAPayments: repo.getMemberEFKAPayments.bind(repo),
    getShareholders: repo.getShareholders.bind(repo),
    saveShareholders: repo.saveShareholders.bind(repo),
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
    createFiscalPeriods: repo.createFiscalPeriods.bind(repo),
    createFixedAsset: repo.createFixedAsset.bind(repo),
    createDepreciationRecord: repo.createDepreciationRecord.bind(repo),
    createExpenseDocument: repo.createExpenseDocument.bind(repo),
    createAPYCertificate: repo.createAPYCertificate.bind(repo),
    createCustomCategory: repo.createCustomCategory.bind(repo),
    updateAPYCertificate: repo.updateAPYCertificate.bind(repo),
    pushAPYEmailRecord: repo.pushAPYEmailRecord.bind(repo),
    updateCustomCategory: repo.updateCustomCategory.bind(repo),
    deleteCustomCategory: repo.deleteCustomCategory.bind(repo),
    updateFixedAsset: repo.updateFixedAsset.bind(repo),
    updateExpenseDocument: repo.updateExpenseDocument.bind(repo),
    deleteJournalEntry: repo.deleteJournalEntry.bind(repo),

    // ── Audited mutations ─────────────────────────────────────────────────

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

    async updateJournalEntry(entryId, updates) {
      await repo.updateJournalEntry(entryId, updates);
      // Journal updates are rare (usually reversal) — log as JOURNAL_REVERSED if reversed
      const eventType: AccountingAuditEventType = updates.isReversed
        ? 'JOURNAL_REVERSED' : 'JOURNAL_CREATED';
      if (updates.isReversed) {
        await logAudit(repo, userId, eventType, 'journal', entryId,
          'Αντιλογιστική εγγραφή');
      }
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

    async upsertCustomerBalance(customerId, balance) {
      await repo.upsertCustomerBalance(customerId, balance);
      await logAudit(repo, userId, 'BALANCE_UPDATED', 'balance', customerId,
        `Ενημέρωση υπολοίπου: €${balance.netBalance.toFixed(2)}`,
        { netBalance: balance.netBalance, fiscalYear: balance.fiscalYear });
    },

    async updateFiscalPeriod(periodId, updates) {
      await repo.updateFiscalPeriod(periodId, updates);
      const eventType = periodStatusToEventType(updates);
      if (eventType) {
        await logAudit(repo, userId, eventType, 'period', periodId,
          `Αλλαγή κατάστασης περιόδου → ${updates.status ?? 'unknown'}`);
      }
    },
  };
}

// ============================================================================
// INTERNAL HELPER
// ============================================================================

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
