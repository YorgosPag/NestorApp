/**
 * @fileoverview Firestore Accounting Repository — Data Access Layer
 * @description Implements IAccountingRepository using Firebase Admin SDK
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-010 Portability & Abstraction Layers
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import { getAdminFirestore, safeFirestoreOperation, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  generateJournalEntryId,
  generateInvoiceAccId,
  generateBankTransactionId,
  generateFixedAssetId,
  generateDepreciationId,
  generateEfkaPaymentId,
  generateImportBatchId,
  generateExpenseDocId,
} from '@/services/enterprise-id.service';
import type { PaginatedResult } from '@/lib/pagination';
import type { IAccountingRepository } from '../../types/interfaces';

// Types
import type {
  JournalEntry,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  JournalEntryFilters,
} from '../../types/journal';
import type {
  Invoice,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceFilters,
  InvoiceSeries,
} from '../../types/invoice';
import type {
  BankTransaction,
  BankTransactionFilters,
  BankAccountConfig,
  ImportBatch,
} from '../../types/bank';
import type {
  FixedAsset,
  CreateFixedAssetInput,
  FixedAssetFilters,
  DepreciationRecord,
} from '../../types/assets';
import type {
  EFKAPayment,
  EFKAUserConfig,
} from '../../types/efka';
import type { TaxInstallment } from '../../types/tax';
import type { ReceivedExpenseDocument } from '../../types/documents';

import { sanitizeForFirestore, isoNow } from './firestore-helpers';

// ============================================================================
// FIRESTORE ACCOUNTING REPOSITORY IMPLEMENTATION
// ============================================================================

/**
 * Firestore-backed implementation of IAccountingRepository
 *
 * Uses: getAdminFirestore(), safeFirestoreOperation(), COLLECTIONS, enterpriseIdService
 * Pattern: Same as existing repository pattern in src/services/
 */
export class FirestoreAccountingRepository implements IAccountingRepository {

  // ── Journal Entries ─────────────────────────────────────────────────────

  async createJournalEntry(data: CreateJournalEntryInput): Promise<{ id: string }> {
    const id = generateJournalEntryId();
    const now = isoNow();
    const doc: JournalEntry = {
      ...sanitizeForFirestore(data as unknown as Record<string, unknown>) as unknown as CreateJournalEntryInput,
      entryId: id,
      createdAt: now,
      updatedAt: now,
    };

    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES).doc(id).set(sanitizeForFirestore(doc as unknown as Record<string, unknown>));
    }, undefined);

    return { id };
  }

  async getJournalEntry(entryId: string): Promise<JournalEntry | null> {
    return safeFirestoreOperation(async (db) => {
      const snap = await db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES).doc(entryId).get();
      if (!snap.exists) return null;
      return snap.data() as JournalEntry;
    }, null);
  }

  async updateJournalEntry(entryId: string, updates: UpdateJournalEntryInput): Promise<void> {
    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES).doc(entryId).update(
        sanitizeForFirestore({ ...updates, updatedAt: isoNow() } as Record<string, unknown>)
      );
    }, undefined);
  }

  async deleteJournalEntry(entryId: string): Promise<void> {
    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES).doc(entryId).delete();
    }, undefined);
  }

  async listJournalEntries(
    filters: JournalEntryFilters,
    pageSize: number = 50
  ): Promise<PaginatedResult<JournalEntry>> {
    return safeFirestoreOperation(async (db) => {
      let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES);

      if (filters.type) query = query.where('type', '==', filters.type);
      if (filters.category) query = query.where('category', '==', filters.category);
      if (filters.fiscalYear) query = query.where('fiscalYear', '==', filters.fiscalYear);
      if (filters.quarter) query = query.where('quarter', '==', filters.quarter);
      if (filters.paymentMethod) query = query.where('paymentMethod', '==', filters.paymentMethod);
      if (filters.contactId) query = query.where('contactId', '==', filters.contactId);

      query = query.orderBy('date', 'desc').limit(pageSize);

      const snap = await query.get();
      const items = snap.docs.map((d) => d.data() as JournalEntry);

      return {
        items,
        hasNext: items.length === pageSize,
        totalShown: items.length,
        pageSize,
      };
    }, { items: [], hasNext: false, totalShown: 0, pageSize });
  }

  // ── Invoices ────────────────────────────────────────────────────────────

  async createInvoice(data: CreateInvoiceInput): Promise<{ id: string; number: number }> {
    const id = generateInvoiceAccId();
    const now = isoNow();

    // Atomic invoice counter
    const nextNumber = await this.getNextInvoiceNumber(data.series);

    const doc: Invoice = {
      ...sanitizeForFirestore(data as unknown as Record<string, unknown>) as unknown as CreateInvoiceInput,
      invoiceId: id,
      number: nextNumber,
      createdAt: now,
      updatedAt: now,
    };

    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.ACCOUNTING_INVOICES).doc(id).set(sanitizeForFirestore(doc as unknown as Record<string, unknown>));
    }, undefined);

    return { id, number: nextNumber };
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    return safeFirestoreOperation(async (db) => {
      const snap = await db.collection(COLLECTIONS.ACCOUNTING_INVOICES).doc(invoiceId).get();
      if (!snap.exists) return null;
      return snap.data() as Invoice;
    }, null);
  }

  async updateInvoice(invoiceId: string, updates: UpdateInvoiceInput): Promise<void> {
    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.ACCOUNTING_INVOICES).doc(invoiceId).update(
        sanitizeForFirestore({ ...updates, updatedAt: isoNow() } as Record<string, unknown>)
      );
    }, undefined);
  }

  async listInvoices(
    filters: InvoiceFilters,
    pageSize: number = 50
  ): Promise<PaginatedResult<Invoice>> {
    return safeFirestoreOperation(async (db) => {
      let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.ACCOUNTING_INVOICES);

      if (filters.type) query = query.where('type', '==', filters.type);
      if (filters.paymentStatus) query = query.where('paymentStatus', '==', filters.paymentStatus);
      if (filters.fiscalYear) query = query.where('fiscalYear', '==', filters.fiscalYear);
      if (filters.customerId) query = query.where('customer.contactId', '==', filters.customerId);
      if (filters.projectId) query = query.where('projectId', '==', filters.projectId);

      query = query.orderBy('issueDate', 'desc').limit(pageSize);

      const snap = await query.get();
      const items = snap.docs.map((d) => d.data() as Invoice);

      return {
        items,
        hasNext: items.length === pageSize,
        totalShown: items.length,
        pageSize,
      };
    }, { items: [], hasNext: false, totalShown: 0, pageSize });
  }

  async getNextInvoiceNumber(seriesCode: string): Promise<number> {
    return safeFirestoreOperation(async (db) => {
      const counterRef = db.collection(COLLECTIONS.ACCOUNTING_INVOICE_COUNTERS).doc(seriesCode);

      return db.runTransaction(async (txn) => {
        const counterSnap = await txn.get(counterRef);
        const currentNumber = counterSnap.exists
          ? (counterSnap.data() as { nextNumber: number }).nextNumber
          : 1;

        txn.set(counterRef, { nextNumber: currentNumber + 1 }, { merge: true });
        return currentNumber;
      });
    }, 1);
  }

  async getInvoiceSeries(): Promise<InvoiceSeries[]> {
    return safeFirestoreOperation(async (db) => {
      const snap = await db.collection(COLLECTIONS.ACCOUNTING_INVOICE_COUNTERS).get();
      return snap.docs.map((d) => d.data() as InvoiceSeries);
    }, []);
  }

  // ── Bank Transactions ───────────────────────────────────────────────────

  async createBankTransaction(
    data: Omit<BankTransaction, 'transactionId' | 'createdAt' | 'updatedAt'>
  ): Promise<{ id: string }> {
    const id = generateBankTransactionId();
    const now = isoNow();
    const doc = sanitizeForFirestore({
      ...data,
      transactionId: id,
      createdAt: now,
      updatedAt: now,
    } as unknown as Record<string, unknown>);

    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS).doc(id).set(doc);
    }, undefined);

    return { id };
  }

  async getBankTransaction(transactionId: string): Promise<BankTransaction | null> {
    return safeFirestoreOperation(async (db) => {
      const snap = await db.collection(COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS).doc(transactionId).get();
      if (!snap.exists) return null;
      return snap.data() as BankTransaction;
    }, null);
  }

  async updateBankTransaction(transactionId: string, updates: Partial<BankTransaction>): Promise<void> {
    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS).doc(transactionId).update(
        sanitizeForFirestore({ ...updates, updatedAt: isoNow() } as Record<string, unknown>)
      );
    }, undefined);
  }

  async listBankTransactions(
    filters: BankTransactionFilters,
    pageSize: number = 50
  ): Promise<PaginatedResult<BankTransaction>> {
    return safeFirestoreOperation(async (db) => {
      let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS);

      if (filters.accountId) query = query.where('accountId', '==', filters.accountId);
      if (filters.direction) query = query.where('direction', '==', filters.direction);
      if (filters.matchStatus) query = query.where('matchStatus', '==', filters.matchStatus);

      query = query.orderBy('transactionDate', 'desc').limit(pageSize);

      const snap = await query.get();
      const items = snap.docs.map((d) => d.data() as BankTransaction);

      return {
        items,
        hasNext: items.length === pageSize,
        totalShown: items.length,
        pageSize,
      };
    }, { items: [], hasNext: false, totalShown: 0, pageSize });
  }

  async getBankAccounts(): Promise<BankAccountConfig[]> {
    return safeFirestoreOperation(async (db) => {
      const snap = await db
        .collection(COLLECTIONS.ACCOUNTING_BANK_ACCOUNTS)
        .where('isActive', '==', true)
        .get();
      return snap.docs.map((d) => d.data() as BankAccountConfig);
    }, []);
  }

  async createImportBatch(data: Omit<ImportBatch, 'batchId'>): Promise<{ id: string }> {
    const id = generateImportBatchId();
    const doc = sanitizeForFirestore({
      ...data,
      batchId: id,
    } as unknown as Record<string, unknown>);

    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.ACCOUNTING_IMPORT_BATCHES).doc(id).set(doc);
    }, undefined);

    return { id };
  }

  // ── Fixed Assets ────────────────────────────────────────────────────────

  async createFixedAsset(data: CreateFixedAssetInput): Promise<{ id: string }> {
    const id = generateFixedAssetId();
    const now = isoNow();
    const doc: FixedAsset = {
      ...sanitizeForFirestore(data as unknown as Record<string, unknown>) as unknown as CreateFixedAssetInput,
      assetId: id,
      accumulatedDepreciation: 0,
      netBookValue: data.acquisitionCost - data.residualValue,
      fullyDepreciatedDate: null,
      disposalDate: null,
      createdAt: now,
      updatedAt: now,
    };

    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.ACCOUNTING_FIXED_ASSETS).doc(id).set(sanitizeForFirestore(doc as unknown as Record<string, unknown>));
    }, undefined);

    return { id };
  }

  async getFixedAsset(assetId: string): Promise<FixedAsset | null> {
    return safeFirestoreOperation(async (db) => {
      const snap = await db.collection(COLLECTIONS.ACCOUNTING_FIXED_ASSETS).doc(assetId).get();
      if (!snap.exists) return null;
      return snap.data() as FixedAsset;
    }, null);
  }

  async updateFixedAsset(assetId: string, updates: Partial<FixedAsset>): Promise<void> {
    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.ACCOUNTING_FIXED_ASSETS).doc(assetId).update(
        sanitizeForFirestore({ ...updates, updatedAt: isoNow() } as Record<string, unknown>)
      );
    }, undefined);
  }

  async listFixedAssets(
    filters: FixedAssetFilters,
    pageSize: number = 50
  ): Promise<PaginatedResult<FixedAsset>> {
    return safeFirestoreOperation(async (db) => {
      let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.ACCOUNTING_FIXED_ASSETS);

      if (filters.category) query = query.where('category', '==', filters.category);
      if (filters.status) query = query.where('status', '==', filters.status);
      if (filters.acquisitionYear) query = query.where('acquisitionFiscalYear', '==', filters.acquisitionYear);

      query = query.orderBy('acquisitionDate', 'desc').limit(pageSize);

      const snap = await query.get();
      const items = snap.docs.map((d) => d.data() as FixedAsset);

      return {
        items,
        hasNext: items.length === pageSize,
        totalShown: items.length,
        pageSize,
      };
    }, { items: [], hasNext: false, totalShown: 0, pageSize });
  }

  async createDepreciationRecord(data: Omit<DepreciationRecord, 'recordId'>): Promise<{ id: string }> {
    const id = generateDepreciationId();
    const doc = sanitizeForFirestore({
      ...data,
      recordId: id,
    } as unknown as Record<string, unknown>);

    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.ACCOUNTING_DEPRECIATION_RECORDS).doc(id).set(doc);
    }, undefined);

    return { id };
  }

  async getDepreciationRecords(assetId: string, fiscalYear?: number): Promise<DepreciationRecord[]> {
    return safeFirestoreOperation(async (db) => {
      let query: FirebaseFirestore.Query = db
        .collection(COLLECTIONS.ACCOUNTING_DEPRECIATION_RECORDS)
        .where('assetId', '==', assetId);

      if (fiscalYear !== undefined) {
        query = query.where('fiscalYear', '==', fiscalYear);
      }

      query = query.orderBy('fiscalYear', 'asc');

      const snap = await query.get();
      return snap.docs.map((d) => d.data() as DepreciationRecord);
    }, []);
  }

  // ── EFKA Payments ───────────────────────────────────────────────────────

  async getEFKAPayments(year: number): Promise<EFKAPayment[]> {
    return safeFirestoreOperation(async (db) => {
      const snap = await db
        .collection(COLLECTIONS.ACCOUNTING_EFKA_PAYMENTS)
        .where('year', '==', year)
        .orderBy('month', 'asc')
        .get();
      return snap.docs.map((d) => d.data() as EFKAPayment);
    }, []);
  }

  async updateEFKAPayment(paymentId: string, updates: Partial<EFKAPayment>): Promise<void> {
    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.ACCOUNTING_EFKA_PAYMENTS).doc(paymentId).update(
        sanitizeForFirestore(updates as Record<string, unknown>)
      );
    }, undefined);
  }

  async getEFKAUserConfig(): Promise<EFKAUserConfig | null> {
    return safeFirestoreOperation(async (db) => {
      const snap = await db.collection(COLLECTIONS.ACCOUNTING_EFKA_CONFIG).doc('user_config').get();
      if (!snap.exists) return null;
      return snap.data() as EFKAUserConfig;
    }, null);
  }

  async saveEFKAUserConfig(config: EFKAUserConfig): Promise<void> {
    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.ACCOUNTING_EFKA_CONFIG).doc('user_config').set(
        sanitizeForFirestore(config as unknown as Record<string, unknown>)
      );
    }, undefined);
  }

  // ── Tax ─────────────────────────────────────────────────────────────────

  async getTaxInstallments(fiscalYear: number): Promise<TaxInstallment[]> {
    return safeFirestoreOperation(async (db) => {
      const snap = await db
        .collection(COLLECTIONS.ACCOUNTING_TAX_INSTALLMENTS)
        .where('fiscalYear', '==', fiscalYear)
        .orderBy('installmentNumber', 'asc')
        .get();

      // The collection stores installments with a fiscalYear field
      // Filter is done server-side, but we store them under a single collection
      return snap.docs.map((d) => d.data() as TaxInstallment);
    }, []);
  }

  async updateTaxInstallment(
    installmentNumber: number,
    fiscalYear: number,
    updates: Partial<TaxInstallment>
  ): Promise<void> {
    const docId = `${fiscalYear}_${installmentNumber}`;
    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.ACCOUNTING_TAX_INSTALLMENTS).doc(docId).update(
        sanitizeForFirestore(updates as Record<string, unknown>)
      );
    }, undefined);
  }

  // ── Expense Documents ───────────────────────────────────────────────────

  async createExpenseDocument(
    data: Omit<ReceivedExpenseDocument, 'documentId' | 'createdAt' | 'updatedAt'>
  ): Promise<{ id: string }> {
    const id = generateExpenseDocId();
    const now = isoNow();
    const doc = sanitizeForFirestore({
      ...data,
      documentId: id,
      createdAt: now,
      updatedAt: now,
    } as unknown as Record<string, unknown>);

    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS).doc(id).set(doc);
    }, undefined);

    return { id };
  }

  async getExpenseDocument(documentId: string): Promise<ReceivedExpenseDocument | null> {
    return safeFirestoreOperation(async (db) => {
      const snap = await db.collection(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS).doc(documentId).get();
      if (!snap.exists) return null;
      return snap.data() as ReceivedExpenseDocument;
    }, null);
  }

  async updateExpenseDocument(documentId: string, updates: Partial<ReceivedExpenseDocument>): Promise<void> {
    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS).doc(documentId).update(
        sanitizeForFirestore({ ...updates, updatedAt: isoNow() } as Record<string, unknown>)
      );
    }, undefined);
  }

  async listExpenseDocuments(
    fiscalYear: number,
    status?: ReceivedExpenseDocument['status']
  ): Promise<ReceivedExpenseDocument[]> {
    return safeFirestoreOperation(async (db) => {
      let query: FirebaseFirestore.Query = db
        .collection(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS)
        .where('fiscalYear', '==', fiscalYear);

      if (status) {
        query = query.where('status', '==', status);
      }

      query = query.orderBy('createdAt', 'desc');

      const snap = await query.get();
      return snap.docs.map((d) => d.data() as ReceivedExpenseDocument);
    }, []);
  }
}
