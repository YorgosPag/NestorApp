/**
 * @fileoverview Accounting Repository — Operations Domain (Bank, Assets, Expenses, APY, Categories)
 * @description Standalone functions extracted from FirestoreAccountingRepository
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-25
 * @see ADR-ACC-010, ADR-ACC-020 APY, ADR-ACC-021 Custom Categories
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import { safeFirestoreOperation, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import {
  generateBankTransactionId,
  generateFixedAssetId,
  generateDepreciationId,
  generateImportBatchId,
  generateExpenseDocId,
  generateApyCertificateId,
  generateCustomCategoryId,
} from '@/services/enterprise-id.service';
import type { PaginatedResult } from '@/lib/pagination';

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
import type { ReceivedExpenseDocument } from '../../types/documents';
import type { APYCertificate, APYEmailSendRecord } from '../../types/apy-certificate';
import type {
  CustomCategoryDocument,
  CreateCustomCategoryInput,
  UpdateCustomCategoryInput,
  CustomCategoryCode,
} from '../../types/custom-category';

import { sanitizeForFirestore, isoNow } from './firestore-helpers';

// ============================================================================
// BANK TRANSACTIONS
// ============================================================================

export async function createBankTransaction(
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

export async function getBankTransaction(
  transactionId: string
): Promise<BankTransaction | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS).doc(transactionId).get();
    if (!snap.exists) return null;
    return snap.data() as BankTransaction;
  }, null);
}

export async function updateBankTransaction(
  transactionId: string,
  updates: Partial<BankTransaction>
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS).doc(transactionId).update(
      sanitizeForFirestore({ ...updates, updatedAt: isoNow() } as Record<string, unknown>)
    );
  }, undefined);
}

export async function listBankTransactions(
  filters: BankTransactionFilters,
  pageSize: number = 50
): Promise<PaginatedResult<BankTransaction>> {
  return safeFirestoreOperation(async (db) => {
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS);

    if (filters.accountId) query = query.where('accountId', '==', filters.accountId);
    if (filters.direction) query = query.where('direction', '==', filters.direction);
    if (filters.matchStatus) query = query.where('matchStatus', '==', filters.matchStatus);
    if (filters.matchGroupId) query = query.where('matchGroupId', '==', filters.matchGroupId);

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

export async function getBankAccounts(): Promise<BankAccountConfig[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_BANK_ACCOUNTS)
      .where('isActive', '==', true)
      .get();
    return snap.docs.map((d) => d.data() as BankAccountConfig);
  }, []);
}

export async function createImportBatch(
  data: Omit<ImportBatch, 'batchId'>
): Promise<{ id: string }> {
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

// ============================================================================
// FIXED ASSETS
// ============================================================================

export async function createFixedAsset(
  data: CreateFixedAssetInput
): Promise<{ id: string }> {
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
    await db.collection(COLLECTIONS.ACCOUNTING_FIXED_ASSETS).doc(id).set(
      sanitizeForFirestore(doc as unknown as Record<string, unknown>)
    );
  }, undefined);

  return { id };
}

export async function getFixedAsset(
  assetId: string
): Promise<FixedAsset | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.ACCOUNTING_FIXED_ASSETS).doc(assetId).get();
    if (!snap.exists) return null;
    return snap.data() as FixedAsset;
  }, null);
}

export async function updateFixedAsset(
  assetId: string,
  updates: Partial<FixedAsset>
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_FIXED_ASSETS).doc(assetId).update(
      sanitizeForFirestore({ ...updates, updatedAt: isoNow() } as Record<string, unknown>)
    );
  }, undefined);
}

export async function listFixedAssets(
  filters: FixedAssetFilters,
  pageSize: number = 50
): Promise<PaginatedResult<FixedAsset>> {
  return safeFirestoreOperation(async (db) => {
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.ACCOUNTING_FIXED_ASSETS);

    if (filters.category) query = query.where('category', '==', filters.category);
    if (filters.status) query = query.where(FIELDS.STATUS, '==', filters.status);
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

export async function createDepreciationRecord(
  data: Omit<DepreciationRecord, 'recordId'>
): Promise<{ id: string }> {
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

export async function getDepreciationRecords(
  assetId: string,
  fiscalYear?: number
): Promise<DepreciationRecord[]> {
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

// ============================================================================
// EXPENSE DOCUMENTS
// ============================================================================

export async function createExpenseDocument(
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

export async function getExpenseDocument(
  documentId: string
): Promise<ReceivedExpenseDocument | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS).doc(documentId).get();
    if (!snap.exists) return null;
    return snap.data() as ReceivedExpenseDocument;
  }, null);
}

export async function updateExpenseDocument(
  documentId: string,
  updates: Partial<ReceivedExpenseDocument>
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS).doc(documentId).update(
      sanitizeForFirestore({ ...updates, updatedAt: isoNow() } as Record<string, unknown>)
    );
  }, undefined);
}

export async function listExpenseDocuments(
  fiscalYear: number,
  status?: ReceivedExpenseDocument['status']
): Promise<ReceivedExpenseDocument[]> {
  return safeFirestoreOperation(async (db) => {
    let query: FirebaseFirestore.Query = db
      .collection(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS)
      .where('fiscalYear', '==', fiscalYear);

    if (status) {
      query = query.where(FIELDS.STATUS, '==', status);
    }

    query = query.orderBy(FIELDS.CREATED_AT, 'desc');

    const snap = await query.get();
    return snap.docs.map((d) => d.data() as ReceivedExpenseDocument);
  }, []);
}

// ============================================================================
// APY CERTIFICATES (ADR-ACC-020)
// ============================================================================

export async function createAPYCertificate(
  data: Omit<APYCertificate, 'certificateId' | 'createdAt' | 'updatedAt'>
): Promise<{ id: string }> {
  const id = generateApyCertificateId();
  const now = isoNow();
  const doc = sanitizeForFirestore({
    ...data,
    certificateId: id,
    createdAt: now,
    updatedAt: now,
  } as unknown as Record<string, unknown>);

  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_APY_CERTIFICATES).doc(id).set(doc);
  }, undefined);

  return { id };
}

export async function getAPYCertificate(
  certificateId: string
): Promise<APYCertificate | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_APY_CERTIFICATES)
      .doc(certificateId)
      .get();
    if (!snap.exists) return null;
    return snap.data() as APYCertificate;
  }, null);
}

export async function listAPYCertificates(
  fiscalYear?: number,
  customerId?: string
): Promise<APYCertificate[]> {
  return safeFirestoreOperation(async (db) => {
    let query: FirebaseFirestore.Query = db.collection(
      COLLECTIONS.ACCOUNTING_APY_CERTIFICATES
    );

    if (fiscalYear !== undefined) {
      query = query.where('fiscalYear', '==', fiscalYear);
    }
    if (customerId !== undefined) {
      query = query.where('customerId', '==', customerId);
    }

    query = query.orderBy(FIELDS.CREATED_AT, 'desc');

    const snap = await query.get();
    return snap.docs.map((d) => d.data() as APYCertificate);
  }, []);
}

export async function updateAPYCertificate(
  certificateId: string,
  updates: Partial<Omit<APYCertificate, 'certificateId' | 'createdAt'>>
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db
      .collection(COLLECTIONS.ACCOUNTING_APY_CERTIFICATES)
      .doc(certificateId)
      .update(
        sanitizeForFirestore({
          ...updates,
          updatedAt: isoNow(),
        } as Record<string, unknown>)
      );
  }, undefined);
}

export async function pushAPYEmailRecord(
  certificateId: string,
  record: APYEmailSendRecord
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db
      .collection(COLLECTIONS.ACCOUNTING_APY_CERTIFICATES)
      .doc(certificateId)
      .update({
        emailHistory: FieldValue.arrayUnion(
          sanitizeForFirestore(record as unknown as Record<string, unknown>)
        ),
        updatedAt: isoNow(),
      });
  }, undefined);
}

// ============================================================================
// CUSTOM CATEGORIES (ADR-ACC-021)
// ============================================================================

export async function createCustomCategory(
  data: CreateCustomCategoryInput
): Promise<{ id: string; code: string }> {
  const id = generateCustomCategoryId();
  const shortHash = id.replace('custcat_', '').split('-')[0];
  const code: CustomCategoryCode = `custom_${shortHash}`;
  const now = isoNow();

  const doc = sanitizeForFirestore({
    ...data,
    categoryId: id,
    code,
    sortOrder: data.sortOrder ?? 100,
    icon: data.icon ?? 'Tag',
    kadCode: data.kadCode ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  } as Record<string, unknown>);

  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_CUSTOM_CATEGORIES).doc(id).set(doc);
  }, undefined);

  return { id, code };
}

export async function getCustomCategory(
  categoryId: string
): Promise<CustomCategoryDocument | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_CUSTOM_CATEGORIES)
      .doc(categoryId)
      .get();
    if (!snap.exists) return null;
    return snap.data() as CustomCategoryDocument;
  }, null);
}

export async function listCustomCategories(
  includeInactive = false
): Promise<CustomCategoryDocument[]> {
  return safeFirestoreOperation(async (db) => {
    let query: FirebaseFirestore.Query = db.collection(
      COLLECTIONS.ACCOUNTING_CUSTOM_CATEGORIES
    );

    if (!includeInactive) {
      query = query.where('isActive', '==', true);
    }

    query = query.orderBy('sortOrder', 'asc');

    const snap = await query.get();
    return snap.docs.map((d) => d.data() as CustomCategoryDocument);
  }, []);
}

export async function updateCustomCategory(
  categoryId: string,
  updates: UpdateCustomCategoryInput
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db
      .collection(COLLECTIONS.ACCOUNTING_CUSTOM_CATEGORIES)
      .doc(categoryId)
      .update(
        sanitizeForFirestore({
          ...updates,
          updatedAt: isoNow(),
        } as Record<string, unknown>)
      );
  }, undefined);
}

export async function deleteCustomCategory(categoryId: string): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db
      .collection(COLLECTIONS.ACCOUNTING_CUSTOM_CATEGORIES)
      .doc(categoryId)
      .delete();
  }, undefined);
}
