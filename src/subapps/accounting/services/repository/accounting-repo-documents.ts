/**
 * @fileoverview Accounting Repository — Documents Domain (Expenses, APY, Custom Categories)
 * @description Extracted from accounting-repo-operations.ts per CLAUDE.md N.7.1 (max 500 lines)
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-31
 * @see ADR-ACC-010, ADR-ACC-020 APY, ADR-ACC-021 Custom Categories
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import { safeFirestoreOperation, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import {
  generateExpenseDocId,
  generateApyCertificateId,
  generateCustomCategoryId,
} from '@/services/enterprise-id.service';

import type { ReceivedExpenseDocument } from '../../types/documents';
import type { APYCertificate, APYEmailSendRecord } from '../../types/apy-certificate';
import type {
  CustomCategoryDocument,
  CreateCustomCategoryInput,
  UpdateCustomCategoryInput,
  CustomCategoryCode,
} from '../../types/custom-category';

import type { TenantContext } from '../../types/common';

import { sanitizeForFirestore, isoNow } from './firestore-helpers';
import { deleteOwnedDoc, readOwnedDoc, updateOwnedDoc, type OwnedDocAddress } from './tenant-owned-doc';

// Κάθε πρόσβαση κατά id περνά από τον φράχτη εταιρείας (ADR-917 Φ4.0) — ο `tenant` δεν είναι διακοσμητικός.
const expenseDocAt = (id: string): OwnedDocAddress =>
  ({ collection: COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS, id, resource: 'expense document' });
const apyCertificateAt = (id: string): OwnedDocAddress =>
  ({ collection: COLLECTIONS.ACCOUNTING_APY_CERTIFICATES, id, resource: 'APY certificate' });
const customCategoryAt = (id: string): OwnedDocAddress =>
  ({ collection: COLLECTIONS.ACCOUNTING_CUSTOM_CATEGORIES, id, resource: 'custom category' });

// ============================================================================
// EXPENSE DOCUMENTS
// ============================================================================

export async function createExpenseDocument(
  tenant: TenantContext,
  data: Omit<ReceivedExpenseDocument, 'documentId' | 'createdAt' | 'updatedAt'>
): Promise<{ id: string }> {
  const id = generateExpenseDocId();
  const now = isoNow();
  const doc = sanitizeForFirestore({
    ...data,
    companyId: tenant.companyId,
    createdBy: tenant.userId,
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
  tenant: TenantContext,
  documentId: string
): Promise<ReceivedExpenseDocument | null> {
  return readOwnedDoc<ReceivedExpenseDocument>(tenant, expenseDocAt(documentId));
}

export async function updateExpenseDocument(
  tenant: TenantContext,
  documentId: string,
  updates: Partial<ReceivedExpenseDocument>
): Promise<void> {
  await updateOwnedDoc(
    tenant,
    expenseDocAt(documentId),
    sanitizeForFirestore({ ...updates, updatedAt: isoNow() } as Record<string, unknown>),
  );
}

export async function listExpenseDocuments(
  tenant: TenantContext,
  fiscalYear: number,
  status?: ReceivedExpenseDocument['status']
): Promise<ReceivedExpenseDocument[]> {
  return safeFirestoreOperation(async (db) => {
    let query: FirebaseFirestore.Query = db
      .collection(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS)
      .where('companyId', '==', tenant.companyId)
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
  tenant: TenantContext,
  data: Omit<APYCertificate, 'certificateId' | 'createdAt' | 'updatedAt'>
): Promise<{ id: string }> {
  const id = generateApyCertificateId();
  const now = isoNow();
  const doc = sanitizeForFirestore({
    ...data,
    companyId: tenant.companyId,
    createdBy: tenant.userId,
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
  tenant: TenantContext,
  certificateId: string
): Promise<APYCertificate | null> {
  return readOwnedDoc<APYCertificate>(tenant, apyCertificateAt(certificateId));
}

export async function listAPYCertificates(
  tenant: TenantContext,
  fiscalYear?: number,
  customerId?: string
): Promise<APYCertificate[]> {
  return safeFirestoreOperation(async (db) => {
    let query: FirebaseFirestore.Query = db.collection(
      COLLECTIONS.ACCOUNTING_APY_CERTIFICATES
    );

    query = query.where('companyId', '==', tenant.companyId);
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
  tenant: TenantContext,
  certificateId: string,
  updates: Partial<Omit<APYCertificate, 'certificateId' | 'createdAt'>>
): Promise<void> {
  await updateOwnedDoc(
    tenant,
    apyCertificateAt(certificateId),
    sanitizeForFirestore({ ...updates, updatedAt: isoNow() } as Record<string, unknown>),
  );
}

export async function pushAPYEmailRecord(
  tenant: TenantContext,
  certificateId: string,
  record: APYEmailSendRecord
): Promise<void> {
  await updateOwnedDoc(tenant, apyCertificateAt(certificateId), {
    emailHistory: FieldValue.arrayUnion(
      sanitizeForFirestore(record as unknown as Record<string, unknown>)
    ),
    updatedAt: isoNow(),
  });
}

// ============================================================================
// CUSTOM CATEGORIES (ADR-ACC-021)
// ============================================================================

export async function createCustomCategory(
  tenant: TenantContext,
  data: CreateCustomCategoryInput
): Promise<{ id: string; code: string }> {
  const id = generateCustomCategoryId();
  const shortHash = id.replace('custcat_', '').split('-')[0];
  const code: CustomCategoryCode = `custom_${shortHash}`;
  const now = isoNow();

  const doc = sanitizeForFirestore({
    ...data,
    companyId: tenant.companyId,
    createdBy: tenant.userId,
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
  tenant: TenantContext,
  categoryId: string
): Promise<CustomCategoryDocument | null> {
  return readOwnedDoc<CustomCategoryDocument>(tenant, customCategoryAt(categoryId));
}

export async function listCustomCategories(
  tenant: TenantContext,
  includeInactive = false
): Promise<CustomCategoryDocument[]> {
  return safeFirestoreOperation(async (db) => {
    let query: FirebaseFirestore.Query = db.collection(
      COLLECTIONS.ACCOUNTING_CUSTOM_CATEGORIES
    );

    query = query.where('companyId', '==', tenant.companyId);
    if (!includeInactive) {
      query = query.where('isActive', '==', true);
    }

    query = query.orderBy('sortOrder', 'asc');

    const snap = await query.get();
    return snap.docs.map((d) => d.data() as CustomCategoryDocument);
  }, []);
}

export async function updateCustomCategory(
  tenant: TenantContext,
  categoryId: string,
  updates: UpdateCustomCategoryInput
): Promise<void> {
  await updateOwnedDoc(
    tenant,
    customCategoryAt(categoryId),
    sanitizeForFirestore({ ...updates, updatedAt: isoNow() } as Record<string, unknown>),
  );
}

export async function deleteCustomCategory(tenant: TenantContext, categoryId: string): Promise<void> {
  await deleteOwnedDoc(tenant, customCategoryAt(categoryId));
}
