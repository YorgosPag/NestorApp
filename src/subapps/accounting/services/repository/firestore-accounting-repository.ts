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

import { sanitizeForFirestore, isoNow } from './firestore-helpers';

// Domain modules — standalone functions
import * as financial from './accounting-repo-financial';
import * as entities from './accounting-repo-entities';
import * as operations from './accounting-repo-operations';
import * as balances from './accounting-repo-balances';

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
        updatedAt: now,
        createdAt: existing.exists
          ? (existing.data() as CompanyProfile).createdAt
          : now,
      } as unknown as Record<string, unknown>);

      await docRef.set(doc);
    }, undefined);
  }

  // ── Financial: Journal Entries ─────────────────────────────────────────
  createJournalEntry = financial.createJournalEntry;
  getJournalEntry = financial.getJournalEntry;
  updateJournalEntry = financial.updateJournalEntry;
  deleteJournalEntry = financial.deleteJournalEntry;
  listJournalEntries = financial.listJournalEntries;
  getJournalEntryByInvoiceId = financial.getJournalEntryByInvoiceId;

  // ── Financial: Invoices ───────────────────────────────────────────────
  createInvoice = financial.createInvoice;
  getInvoice = financial.getInvoice;
  updateInvoice = financial.updateInvoice;
  listInvoices = financial.listInvoices;
  getNextInvoiceNumber = financial.getNextInvoiceNumber;
  getInvoiceSeries = financial.getInvoiceSeries;

  // ── Financial: Service Presets ────────────────────────────────────────
  getServicePresets = financial.getServicePresets;
  saveServicePresets = financial.saveServicePresets;

  // ── Financial: Tax Installments ───────────────────────────────────────
  getTaxInstallments = financial.getTaxInstallments;
  updateTaxInstallment = financial.updateTaxInstallment;

  // ── Entities: Partners ────────────────────────────────────────────────
  getPartners = entities.getPartners;
  savePartners = entities.savePartners;
  getPartnerEFKAPayments = entities.getPartnerEFKAPayments;

  // ── Entities: Members ─────────────────────────────────────────────────
  getMembers = entities.getMembers;
  saveMembers = entities.saveMembers;
  getMemberEFKAPayments = entities.getMemberEFKAPayments;

  // ── Entities: Shareholders ────────────────────────────────────────────
  getShareholders = entities.getShareholders;
  saveShareholders = entities.saveShareholders;
  getShareholderEFKAPayments = entities.getShareholderEFKAPayments;

  // ── Entities: EFKA ────────────────────────────────────────────────────
  getEFKAPayments = entities.getEFKAPayments;
  updateEFKAPayment = entities.updateEFKAPayment;
  getEFKAUserConfig = entities.getEFKAUserConfig;
  saveEFKAUserConfig = entities.saveEFKAUserConfig;

  // ── Operations: Bank Transactions ─────────────────────────────────────
  createBankTransaction = operations.createBankTransaction;
  getBankTransaction = operations.getBankTransaction;
  updateBankTransaction = operations.updateBankTransaction;
  listBankTransactions = operations.listBankTransactions;
  getBankAccounts = operations.getBankAccounts;
  createImportBatch = operations.createImportBatch;

  // ── Operations: Fixed Assets ──────────────────────────────────────────
  createFixedAsset = operations.createFixedAsset;
  getFixedAsset = operations.getFixedAsset;
  updateFixedAsset = operations.updateFixedAsset;
  listFixedAssets = operations.listFixedAssets;
  createDepreciationRecord = operations.createDepreciationRecord;
  getDepreciationRecords = operations.getDepreciationRecords;

  // ── Operations: Expense Documents ─────────────────────────────────────
  createExpenseDocument = operations.createExpenseDocument;
  getExpenseDocument = operations.getExpenseDocument;
  updateExpenseDocument = operations.updateExpenseDocument;
  listExpenseDocuments = operations.listExpenseDocuments;

  // ── Operations: APY Certificates ──────────────────────────────────────
  createAPYCertificate = operations.createAPYCertificate;
  getAPYCertificate = operations.getAPYCertificate;
  listAPYCertificates = operations.listAPYCertificates;
  updateAPYCertificate = operations.updateAPYCertificate;
  pushAPYEmailRecord = operations.pushAPYEmailRecord;

  // ── Operations: Custom Categories ─────────────────────────────────────
  createCustomCategory = operations.createCustomCategory;
  getCustomCategory = operations.getCustomCategory;
  listCustomCategories = operations.listCustomCategories;
  updateCustomCategory = operations.updateCustomCategory;
  deleteCustomCategory = operations.deleteCustomCategory;

  // ── Balances: Customer Balances (Phase 1b) ───────────────────────────
  getCustomerBalance = balances.getCustomerBalance;
  upsertCustomerBalance = balances.upsertCustomerBalance;
  listCustomerBalances = balances.listCustomerBalances;

  // ── Balances: Fiscal Periods (Phase 1b) ──────────────────────────────
  getFiscalPeriod = balances.getFiscalPeriod;
  listFiscalPeriods = balances.listFiscalPeriods;
  updateFiscalPeriod = balances.updateFiscalPeriod;
  createFiscalPeriods = balances.createFiscalPeriods;
}
