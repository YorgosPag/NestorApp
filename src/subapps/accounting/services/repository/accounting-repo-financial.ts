/**
 * @fileoverview Accounting Repository — Financial Domain (Journal, Invoices, Tax, Presets)
 * @description Standalone functions extracted from FirestoreAccountingRepository
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-25
 * @see ADR-ACC-010 Portability & Abstraction Layers
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import {
  generateJournalEntryId,
  generateInvoiceAccId,
} from '@/services/enterprise-id.service';
import type { PaginatedResult } from '@/lib/pagination';

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
  ServicePreset,
  ServicePresetsDocument,
} from '../../types/invoice';
import type { TaxInstallment } from '../../types/tax';
import type { TenantContext } from '../../types/common';

import { sanitizeForFirestore, isoNow } from './firestore-helpers';

// ============================================================================
// JOURNAL ENTRIES
// ============================================================================

/** Backward compat: existing docs without status → ACTIVE */
function applyJournalDefaults(entry: JournalEntry): JournalEntry {
  if (!entry.status) {
    return { ...entry, status: 'ACTIVE' };
  }
  return entry;
}

export async function createJournalEntry(
  tenant: TenantContext,
  data: CreateJournalEntryInput
): Promise<{ id: string }> {
  const id = generateJournalEntryId();
  const now = isoNow();
  const doc: JournalEntry = {
    ...sanitizeForFirestore(data as unknown as Record<string, unknown>) as unknown as CreateJournalEntryInput,
    entryId: id,
    companyId: tenant.companyId,
    createdBy: tenant.userId,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES).doc(id).set(
      sanitizeForFirestore(doc as unknown as Record<string, unknown>)
    );
  }, undefined);

  return { id };
}

export async function getJournalEntry(
  tenant: TenantContext,
  entryId: string
): Promise<JournalEntry | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES).doc(entryId).get();
    if (!snap.exists) return null;
    return applyJournalDefaults(snap.data() as JournalEntry);
  }, null);
}

export async function updateJournalEntry(
  tenant: TenantContext,
  entryId: string,
  updates: UpdateJournalEntryInput
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES).doc(entryId).update(
      sanitizeForFirestore({ ...updates, updatedAt: isoNow() } as Record<string, unknown>)
    );
  }, undefined);
}

export async function deleteJournalEntry(tenant: TenantContext, entryId: string): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES).doc(entryId).delete();
  }, undefined);
}

export async function listJournalEntries(
  tenant: TenantContext,
  filters: JournalEntryFilters,
  pageSize: number = 50
): Promise<PaginatedResult<JournalEntry>> {
  return safeFirestoreOperation(async (db) => {
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES);

    query = query.where('companyId', '==', tenant.companyId);
    if (filters.type) query = query.where(FIELDS.TYPE, '==', filters.type);
    if (filters.category) query = query.where('category', '==', filters.category);
    if (filters.fiscalYear) query = query.where('fiscalYear', '==', filters.fiscalYear);
    if (filters.quarter) query = query.where('quarter', '==', filters.quarter);
    if (filters.paymentMethod) query = query.where('paymentMethod', '==', filters.paymentMethod);
    if (filters.contactId) query = query.where(FIELDS.CONTACT_ID, '==', filters.contactId);

    query = query.orderBy('date', 'desc').limit(pageSize);

    const snap = await query.get();
    const items = snap.docs.map((d) => applyJournalDefaults(d.data() as JournalEntry));

    return {
      items,
      hasNext: items.length === pageSize,
      totalShown: items.length,
      pageSize,
    };
  }, { items: [], hasNext: false, totalShown: 0, pageSize });
}

export async function getJournalEntryByInvoiceId(
  tenant: TenantContext,
  invoiceId: string
): Promise<JournalEntry | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES)
      .where('companyId', '==', tenant.companyId)
      .where('invoiceId', '==', invoiceId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return applyJournalDefaults(snap.docs[0].data() as JournalEntry);
  }, null);
}

// ============================================================================
// INVOICES
// ============================================================================

export async function getNextInvoiceNumber(tenant: TenantContext, seriesCode: string): Promise<number> {
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

export async function createInvoice(
  tenant: TenantContext,
  data: CreateInvoiceInput
): Promise<{ id: string; number: number }> {
  const id = generateInvoiceAccId();
  const now = isoNow();

  // Atomic invoice counter
  const nextNumber = await getNextInvoiceNumber(tenant, data.series);

  const doc: Invoice = {
    ...sanitizeForFirestore(data as unknown as Record<string, unknown>) as unknown as CreateInvoiceInput,
    invoiceId: id,
    companyId: tenant.companyId,
    createdBy: tenant.userId,
    number: nextNumber,
    createdAt: now,
    updatedAt: now,
  };

  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_INVOICES).doc(id).set(
      sanitizeForFirestore(doc as unknown as Record<string, unknown>)
    );
  }, undefined);

  return { id, number: nextNumber };
}

export async function getInvoice(tenant: TenantContext, invoiceId: string): Promise<Invoice | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.ACCOUNTING_INVOICES).doc(invoiceId).get();
    if (!snap.exists) return null;
    return snap.data() as Invoice;
  }, null);
}

export async function updateInvoice(
  tenant: TenantContext,
  invoiceId: string,
  updates: UpdateInvoiceInput
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_INVOICES).doc(invoiceId).update(
      sanitizeForFirestore({ ...updates, updatedAt: isoNow() } as Record<string, unknown>)
    );
  }, undefined);
}

export async function listInvoices(
  tenant: TenantContext,
  filters: InvoiceFilters,
  pageSize: number = 50
): Promise<PaginatedResult<Invoice>> {
  return safeFirestoreOperation(async (db) => {
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.ACCOUNTING_INVOICES);

    query = query.where('companyId', '==', tenant.companyId);
    if (filters.type) query = query.where(FIELDS.TYPE, '==', filters.type);
    if (filters.paymentStatus) query = query.where('paymentStatus', '==', filters.paymentStatus);
    if (filters.fiscalYear) query = query.where('fiscalYear', '==', filters.fiscalYear);
    if (filters.customerId) query = query.where('customer.contactId', '==', filters.customerId);
    if (filters.projectId) query = query.where(FIELDS.PROJECT_ID, '==', filters.projectId);
    if (filters.propertyId) query = query.where(FIELDS.PROPERTY_ID, '==', filters.propertyId);

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

export async function getInvoiceSeries(tenant: TenantContext): Promise<InvoiceSeries[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.ACCOUNTING_INVOICE_COUNTERS).get();
    return snap.docs.map((d) => d.data() as InvoiceSeries);
  }, []);
}

// ============================================================================
// SERVICE PRESETS (ADR-ACC-011)
// ============================================================================

export async function getServicePresets(tenant: TenantContext): Promise<ServicePreset[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_SETTINGS)
      .doc(SYSTEM_DOCS.ACCT_SERVICE_PRESETS)
      .get();
    if (!snap.exists) return [];
    const doc = snap.data() as ServicePresetsDocument;
    return doc.presets.filter((p) => p.isActive);
  }, []);
}

export async function saveServicePresets(tenant: TenantContext, presets: ServicePreset[]): Promise<void> {
  const now = isoNow();
  await safeFirestoreOperation(async (db) => {
    const docRef = db
      .collection(COLLECTIONS.ACCOUNTING_SETTINGS)
      .doc(SYSTEM_DOCS.ACCT_SERVICE_PRESETS);
    const doc = sanitizeForFirestore({
      presets,
      updatedAt: now,
    } as unknown as Record<string, unknown>);
    await docRef.set(doc);
  }, undefined);
}

// ============================================================================
// TAX INSTALLMENTS
// ============================================================================

export async function getTaxInstallments(
  tenant: TenantContext,
  fiscalYear: number
): Promise<TaxInstallment[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_TAX_INSTALLMENTS)
      .where('fiscalYear', '==', fiscalYear)
      .orderBy('installmentNumber', 'asc')
      .get();

    return snap.docs.map((d) => d.data() as TaxInstallment);
  }, []);
}

export async function updateTaxInstallment(
  tenant: TenantContext,
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
