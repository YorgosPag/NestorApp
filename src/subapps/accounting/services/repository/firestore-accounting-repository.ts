/**
 * @fileoverview Firestore Accounting Repository — Thin Class Shell
 * @description Implements IAccountingRepository by delegating to domain modules.
 *   Split from 886-line monolith into 4 files (2026-03-25):
 *   - firestore-accounting-repository.ts (this file) — class shell + Company Setup
 *   - accounting-repo-financial.ts — Journal, Invoices, Tax, Service Presets
 *   - accounting-repo-entities.ts — Partners, Members, Shareholders, EFKA
 *   - accounting-repo-operations.ts — Bank, Assets, Expenses, APY, Categories
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @modified 2026-03-25 — Split to 4 files per CLAUDE.md N.7.1 (max 500 lines)
 * @see ADR-ACC-010 Portability & Abstraction Layers
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';
import type { IAccountingRepository } from '../../types/interfaces';
import type { CompanyProfile, CompanySetupInput } from '../../types/company';
import type { TenantContext } from '../../types/common';
import type {
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  JournalEntryFilters,
} from '../../types/journal';
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceFilters,
  ServicePreset,
} from '../../types/invoice';
import type { TaxInstallment } from '../../types/tax';
import type { Partner, Member, Shareholder } from '../../types/entity';
import type { EFKAPayment, EFKAUserConfig } from '../../types/efka';
import type {
  BankTransaction,
  BankTransactionFilters,
  ImportBatch,
} from '../../types/bank';
import type {
  CreateFixedAssetInput,
  FixedAssetFilters,
  FixedAsset,
  DepreciationRecord,
} from '../../types/assets';
import type { ReceivedExpenseDocument } from '../../types/documents';
import type { APYCertificate, APYEmailSendRecord } from '../../types/apy-certificate';
import type {
  CreateCustomCategoryInput,
  UpdateCustomCategoryInput,
} from '../../types/custom-category';
import type { CustomerBalance } from '../../types/customer-balance';
import type { FiscalPeriod } from '../../types/fiscal-period';
import type { AccountingAuditEntry, AuditEntryFilters } from '../../types/accounting-audit';

import { sanitizeForFirestore, isoNow } from './firestore-helpers';

// Domain modules — standalone functions
import * as financial from './accounting-repo-financial';
import * as entities from './accounting-repo-entities';
import * as operations from './accounting-repo-operations';
import * as documents from './accounting-repo-documents';
import * as balances from './accounting-repo-balances';
import * as audit from './accounting-repo-audit';

// ============================================================================
// FIRESTORE ACCOUNTING REPOSITORY IMPLEMENTATION
// ============================================================================

/**
 * Firestore-backed implementation of IAccountingRepository
 *
 * Core methods (Company Setup) are inline.
 * All other methods are delegated to domain-specific modules.
 */
export class FirestoreAccountingRepository implements IAccountingRepository {

  constructor(private readonly tenant: TenantContext) {}

  // ── Company Setup (M-001) ─────────────────────────────────────────────

  async getCompanySetup(): Promise<CompanyProfile | null> {
    return safeFirestoreOperation(async (db) => {
      const snap = await db.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(SYSTEM_DOCS.ACCT_COMPANY_PROFILE).get();
      if (!snap.exists) return null;
      const raw = snap.data() as Record<string, unknown>;
      // Backward compat: docs without entityType → sole_proprietor
      if (!raw.entityType) {
        raw.entityType = 'sole_proprietor';
      }
      return raw as unknown as CompanyProfile;
    }, null);
  }

  async saveCompanySetup(data: CompanySetupInput): Promise<void> {
    const now = isoNow();
    await safeFirestoreOperation(async (db) => {
      const docRef = db.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(SYSTEM_DOCS.ACCT_COMPANY_PROFILE);
      const existing = await docRef.get();

      const doc = sanitizeForFirestore({
        ...data,
        companyId: this.tenant.companyId,
        updatedAt: now,
        createdAt: existing.exists
          ? (existing.data() as CompanyProfile).createdAt
          : now,
      } as unknown as Record<string, unknown>);

      await docRef.set(doc);
    }, undefined);
  }

  // ── Financial: Journal Entries ─────────────────────────────────────────
  createJournalEntry = (data: CreateJournalEntryInput) =>
    financial.createJournalEntry(this.tenant, data);
  getJournalEntry = (entryId: string) =>
    financial.getJournalEntry(this.tenant, entryId);
  updateJournalEntry = (entryId: string, updates: UpdateJournalEntryInput) =>
    financial.updateJournalEntry(this.tenant, entryId, updates);
  deleteJournalEntry = (entryId: string) =>
    financial.deleteJournalEntry(this.tenant, entryId);
  listJournalEntries = (filters: JournalEntryFilters, pageSize?: number) =>
    financial.listJournalEntries(this.tenant, filters, pageSize);
  getJournalEntryByInvoiceId = (invoiceId: string) =>
    financial.getJournalEntryByInvoiceId(this.tenant, invoiceId);

  // ── Financial: Invoices ───────────────────────────────────────────────
  createInvoice = (data: CreateInvoiceInput) =>
    financial.createInvoice(this.tenant, data);
  getInvoice = (invoiceId: string) =>
    financial.getInvoice(this.tenant, invoiceId);
  updateInvoice = (invoiceId: string, updates: UpdateInvoiceInput) =>
    financial.updateInvoice(this.tenant, invoiceId, updates);
  listInvoices = (filters: InvoiceFilters, pageSize?: number) =>
    financial.listInvoices(this.tenant, filters, pageSize);
  getNextInvoiceNumber = (seriesCode: string) =>
    financial.getNextInvoiceNumber(this.tenant, seriesCode);
  getInvoiceSeries = () =>
    financial.getInvoiceSeries(this.tenant);

  // ── Financial: Service Presets ────────────────────────────────────────
  getServicePresets = () =>
    financial.getServicePresets(this.tenant);
  saveServicePresets = (presets: ServicePreset[]) =>
    financial.saveServicePresets(this.tenant, presets);

  // ── Financial: Tax Installments ───────────────────────────────────────
  getTaxInstallments = (fiscalYear: number) =>
    financial.getTaxInstallments(this.tenant, fiscalYear);
  updateTaxInstallment = (installmentNumber: number, fiscalYear: number, updates: Partial<TaxInstallment>) =>
    financial.updateTaxInstallment(this.tenant, installmentNumber, fiscalYear, updates);

  // ── Entities: Partners ────────────────────────────────────────────────
  getPartners = () =>
    entities.getPartners(this.tenant);
  savePartners = (partners: Partner[]) =>
    entities.savePartners(this.tenant, partners);
  getPartnerEFKAPayments = (partnerId: string, year: number) =>
    entities.getPartnerEFKAPayments(this.tenant, partnerId, year);

  // ── Entities: Members ─────────────────────────────────────────────────
  getMembers = () =>
    entities.getMembers(this.tenant);
  saveMembers = (members: Member[]) =>
    entities.saveMembers(this.tenant, members);
  getMemberEFKAPayments = (memberId: string, year: number) =>
    entities.getMemberEFKAPayments(this.tenant, memberId, year);

  // ── Entities: Shareholders ────────────────────────────────────────────
  getShareholders = () =>
    entities.getShareholders(this.tenant);
  saveShareholders = (shareholders: Shareholder[]) =>
    entities.saveShareholders(this.tenant, shareholders);
  getShareholderEFKAPayments = (shareholderId: string, year: number) =>
    entities.getShareholderEFKAPayments(this.tenant, shareholderId, year);

  // ── Entities: EFKA ────────────────────────────────────────────────────
  getEFKAPayments = (year: number) =>
    entities.getEFKAPayments(this.tenant, year);
  updateEFKAPayment = (paymentId: string, updates: Partial<EFKAPayment>) =>
    entities.updateEFKAPayment(this.tenant, paymentId, updates);
  getEFKAUserConfig = () =>
    entities.getEFKAUserConfig(this.tenant);
  saveEFKAUserConfig = (config: EFKAUserConfig) =>
    entities.saveEFKAUserConfig(this.tenant, config);

  // ── Operations: Bank Transactions ─────────────────────────────────────
  createBankTransaction = (data: Omit<BankTransaction, 'transactionId' | 'createdAt' | 'updatedAt'>) =>
    operations.createBankTransaction(this.tenant, data);
  getBankTransaction = (transactionId: string) =>
    operations.getBankTransaction(this.tenant, transactionId);
  updateBankTransaction = (transactionId: string, updates: Partial<BankTransaction>) =>
    operations.updateBankTransaction(this.tenant, transactionId, updates);
  listBankTransactions = (filters: BankTransactionFilters, pageSize?: number) =>
    operations.listBankTransactions(this.tenant, filters, pageSize);
  getBankAccounts = () =>
    operations.getBankAccounts(this.tenant);
  createImportBatch = (data: Omit<ImportBatch, 'batchId'>) =>
    operations.createImportBatch(this.tenant, data);

  // ── Operations: Fixed Assets ──────────────────────────────────────────
  createFixedAsset = (data: CreateFixedAssetInput) =>
    operations.createFixedAsset(this.tenant, data);
  getFixedAsset = (assetId: string) =>
    operations.getFixedAsset(this.tenant, assetId);
  updateFixedAsset = (assetId: string, updates: Partial<FixedAsset>) =>
    operations.updateFixedAsset(this.tenant, assetId, updates);
  listFixedAssets = (filters: FixedAssetFilters, pageSize?: number) =>
    operations.listFixedAssets(this.tenant, filters, pageSize);
  createDepreciationRecord = (data: Omit<DepreciationRecord, 'recordId'>) =>
    operations.createDepreciationRecord(this.tenant, data);
  getDepreciationRecords = (assetId: string, fiscalYear?: number) =>
    operations.getDepreciationRecords(this.tenant, assetId, fiscalYear);

  // ── Documents: Expense Documents ──────────────────────────────────────
  createExpenseDocument = (data: Omit<ReceivedExpenseDocument, 'documentId' | 'createdAt' | 'updatedAt'>) =>
    documents.createExpenseDocument(this.tenant, data);
  getExpenseDocument = (documentId: string) =>
    documents.getExpenseDocument(this.tenant, documentId);
  updateExpenseDocument = (documentId: string, updates: Partial<ReceivedExpenseDocument>) =>
    documents.updateExpenseDocument(this.tenant, documentId, updates);
  listExpenseDocuments = (fiscalYear: number, status?: ReceivedExpenseDocument['status']) =>
    documents.listExpenseDocuments(this.tenant, fiscalYear, status);

  // ── Documents: APY Certificates ───────────────────────────────────────
  createAPYCertificate = (data: Omit<APYCertificate, 'certificateId' | 'createdAt' | 'updatedAt'>) =>
    documents.createAPYCertificate(this.tenant, data);
  getAPYCertificate = (certificateId: string) =>
    documents.getAPYCertificate(this.tenant, certificateId);
  listAPYCertificates = (fiscalYear?: number, customerId?: string) =>
    documents.listAPYCertificates(this.tenant, fiscalYear, customerId);
  updateAPYCertificate = (certificateId: string, updates: Partial<Omit<APYCertificate, 'certificateId' | 'createdAt'>>) =>
    documents.updateAPYCertificate(this.tenant, certificateId, updates);
  pushAPYEmailRecord = (certificateId: string, record: APYEmailSendRecord) =>
    documents.pushAPYEmailRecord(this.tenant, certificateId, record);

  // ── Documents: Custom Categories ──────────────────────────────────────
  createCustomCategory = (data: CreateCustomCategoryInput) =>
    documents.createCustomCategory(this.tenant, data);
  getCustomCategory = (categoryId: string) =>
    documents.getCustomCategory(this.tenant, categoryId);
  listCustomCategories = (includeInactive?: boolean) =>
    documents.listCustomCategories(this.tenant, includeInactive);
  updateCustomCategory = (categoryId: string, updates: UpdateCustomCategoryInput) =>
    documents.updateCustomCategory(this.tenant, categoryId, updates);
  deleteCustomCategory = (categoryId: string) =>
    documents.deleteCustomCategory(this.tenant, categoryId);

  // ── Balances: Customer Balances (Phase 1b) ───────────────────────────
  getCustomerBalance = (customerId: string) =>
    balances.getCustomerBalance(this.tenant, customerId);
  upsertCustomerBalance = (customerId: string, balance: CustomerBalance) =>
    balances.upsertCustomerBalance(this.tenant, customerId, balance);
  listCustomerBalances = (fiscalYear: number) =>
    balances.listCustomerBalances(this.tenant, fiscalYear);

  // ── Balances: Fiscal Periods (Phase 1b) ──────────────────────────────
  getFiscalPeriod = (periodId: string) =>
    balances.getFiscalPeriod(this.tenant, periodId);
  listFiscalPeriods = (fiscalYear: number) =>
    balances.listFiscalPeriods(this.tenant, fiscalYear);
  updateFiscalPeriod = (periodId: string, updates: Partial<FiscalPeriod>) =>
    balances.updateFiscalPeriod(this.tenant, periodId, updates);
  createFiscalPeriods = (periods: FiscalPeriod[]) =>
    balances.createFiscalPeriods(this.tenant, periods);

  // ── Audit Log (Phase 1c — immutable: create + list ONLY) ──────────────
  createAuditEntry = (entry: AccountingAuditEntry) =>
    audit.createAuditEntry(this.tenant, entry);
  listAuditEntries = (filters: AuditEntryFilters, maxResults?: number) =>
    audit.listAuditEntries(this.tenant, filters, maxResults);
}
