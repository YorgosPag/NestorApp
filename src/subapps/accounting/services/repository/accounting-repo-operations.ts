/**
 * @fileoverview Accounting Repository — Operations Domain (Bank, Assets, Import Batches)
 * @description Standalone functions extracted from FirestoreAccountingRepository.
 *   Documents domain (Expenses, APY, Categories) moved to accounting-repo-documents.ts
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-25
 * @modified 2026-03-31 — Split: Expenses/APY/Categories → accounting-repo-documents.ts
 * @see ADR-ACC-010
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  generateBankTransactionId,
  generateFixedAssetId,
  generateDepreciationId,
  generateImportBatchId,
} from '@/services/enterprise-id.service';
import { FIRST_PAGE, type PageRequest, type PaginatedResult } from '@/lib/pagination';

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
import type { TenantContext } from '../../types/common';

import { sanitizeForFirestore, isoNow } from './firestore-helpers';
import { readAccountingListPage } from './accounting-repo-list';
import { BANK_TRANSACTION_LIST, FIXED_ASSET_LIST } from './accounting-list-specs';

// ============================================================================
// BANK TRANSACTIONS
// ============================================================================

export async function createBankTransaction(
  tenant: TenantContext,
  data: Omit<BankTransaction, 'transactionId' | 'createdAt' | 'updatedAt'>
): Promise<{ id: string }> {
  const id = generateBankTransactionId();
  const now = isoNow();
  const doc = sanitizeForFirestore({
    ...data,
    companyId: tenant.companyId,
    createdBy: tenant.userId,
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
  tenant: TenantContext,
  transactionId: string
): Promise<BankTransaction | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS).doc(transactionId).get();
    if (!snap.exists) return null;
    return snap.data() as BankTransaction;
  }, null);
}

export async function updateBankTransaction(
  tenant: TenantContext,
  transactionId: string,
  updates: Partial<BankTransaction>
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS).doc(transactionId).update(
      sanitizeForFirestore({ ...updates, updatedAt: isoNow() } as Record<string, unknown>)
    );
  }, undefined);
}

/** ΣΕΛΙΔΑ οθόνης (ADR-ACC-010 §2.1.1 Φάση 3β) — δρομέας keyset, πετά σε σφάλμα, ποτέ «κενή λίστα». */
export function listBankTransactions(
  tenant: TenantContext,
  filters: BankTransactionFilters,
  page: PageRequest = FIRST_PAGE
): Promise<PaginatedResult<BankTransaction>> {
  return readAccountingListPage(tenant, BANK_TRANSACTION_LIST, filters, page, (data) => data as BankTransaction);
}

export async function getBankAccounts(tenant: TenantContext): Promise<BankAccountConfig[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_BANK_ACCOUNTS)
      .where('isActive', '==', true)
      .get();
    return snap.docs.map((d) => d.data() as BankAccountConfig);
  }, []);
}

export async function createImportBatch(
  tenant: TenantContext,
  data: Omit<ImportBatch, 'batchId'>
): Promise<{ id: string }> {
  const id = generateImportBatchId();
  const doc = sanitizeForFirestore({
    ...data,
    companyId: tenant.companyId,
    createdBy: tenant.userId,
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
  tenant: TenantContext,
  data: CreateFixedAssetInput
): Promise<{ id: string }> {
  const id = generateFixedAssetId();
  const now = isoNow();
  const doc: FixedAsset = {
    ...sanitizeForFirestore(data as unknown as Record<string, unknown>) as unknown as CreateFixedAssetInput,
    assetId: id,
    companyId: tenant.companyId,
    createdBy: tenant.userId,
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
  tenant: TenantContext,
  assetId: string
): Promise<FixedAsset | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.ACCOUNTING_FIXED_ASSETS).doc(assetId).get();
    if (!snap.exists) return null;
    return snap.data() as FixedAsset;
  }, null);
}

export async function updateFixedAsset(
  tenant: TenantContext,
  assetId: string,
  updates: Partial<FixedAsset>
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_FIXED_ASSETS).doc(assetId).update(
      sanitizeForFirestore({ ...updates, updatedAt: isoNow() } as Record<string, unknown>)
    );
  }, undefined);
}

/** ΣΕΛΙΔΑ οθόνης (ADR-ACC-010 §2.1.1 Φάση 3β) — δρομέας keyset, πετά σε σφάλμα, ποτέ «κενή λίστα». */
export function listFixedAssets(
  tenant: TenantContext,
  filters: FixedAssetFilters,
  page: PageRequest = FIRST_PAGE
): Promise<PaginatedResult<FixedAsset>> {
  return readAccountingListPage(tenant, FIXED_ASSET_LIST, filters, page, (data) => data as FixedAsset);
}

export async function createDepreciationRecord(
  tenant: TenantContext,
  data: Omit<DepreciationRecord, 'recordId'>
): Promise<{ id: string }> {
  const id = generateDepreciationId();
  const doc = sanitizeForFirestore({
    ...data,
    companyId: tenant.companyId,
    createdBy: tenant.userId,
    recordId: id,
  } as unknown as Record<string, unknown>);

  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_DEPRECIATION_RECORDS).doc(id).set(doc);
  }, undefined);

  return { id };
}

export async function getDepreciationRecords(
  tenant: TenantContext,
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

