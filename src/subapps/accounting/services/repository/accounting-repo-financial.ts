/**
 * @fileoverview Accounting Repository — Financial Domain (Journal, Invoices, Tax, Presets)
 * @description Standalone functions extracted from FirestoreAccountingRepository
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-25
 * @see ADR-ACC-010 Portability & Abstraction Layers
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { Firestore, Query } from 'firebase-admin/firestore';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  generateJournalEntryId,
  generateInvoiceAccId,
} from '@/services/enterprise-id.service';
import { FIRST_PAGE, type PageRequest, type PaginatedResult } from '@/lib/pagination';

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
import { getBankAccounts } from './accounting-repo-bank-accounts';
import { resolveInvoicePaymentAccounts } from '../payments/invoice-payment-accounts';
import { accountingDocId } from './accounting-doc-ids';
import { readAccountingListPage, scanAccountingList } from './accounting-repo-list';
import { INVOICE_LIST, JOURNAL_LIST } from './accounting-list-specs';

// ============================================================================
// JOURNAL ENTRIES
// ============================================================================

/** Backward compat: existing docs without status → ACTIVE */
export function applyJournalDefaults(entry: JournalEntry): JournalEntry {
  if (!entry.status) {
    return { ...entry, status: 'ACTIVE' };
  }
  return entry;
}

/**
 * The stored shape of a new journal entry — ONE composition, shared by `createJournalEntry` and by writers
 * that must post inside their own transaction (expense confirmation, ADR-917 Φ4.0).
 */
export function buildJournalEntryRecord(
  tenant: TenantContext,
  id: string,
  data: CreateJournalEntryInput,
  now: string,
): Record<string, unknown> {
  const doc: JournalEntry = {
    ...sanitizeForFirestore(data as unknown as Record<string, unknown>) as unknown as CreateJournalEntryInput,
    entryId: id,
    companyId: tenant.companyId,
    createdBy: tenant.userId,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  return sanitizeForFirestore(doc as unknown as Record<string, unknown>);
}

export async function createJournalEntry(
  tenant: TenantContext,
  data: CreateJournalEntryInput
): Promise<{ id: string }> {
  const id = generateJournalEntryId();
  const record = buildJournalEntryRecord(tenant, id, data, isoNow());

  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES).doc(id).set(record);
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

/**
 * Αλλαγή ΚΕΙΜΕΝΟΥ καταχωρημένης εγγραφής (`JOURNAL_EDITABLE_FIELDS` — ο τύπος δεν δέχεται ποσά). Διαγραφή δεν
 * υπάρχει: διόρθωση = αντιλογισμός (`accounting-repo-journal-reversal.ts`, ADR-ACC-010 §2.1.1 Φ8).
 */
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

/** ΣΕΛΙΔΑ οθόνης (ADR-ACC-010 §2.1.1 Φάση 3β) — δρομέας keyset, πετά σε σφάλμα, ποτέ «κενή λίστα». */
export function listJournalEntries(
  tenant: TenantContext,
  filters: JournalEntryFilters,
  page: PageRequest = FIRST_PAGE
): Promise<PaginatedResult<JournalEntry>> {
  return readAccountingListPage(tenant, JOURNAL_LIST, filters, page, (data) =>
    applyJournalDefaults(data as JournalEntry));
}

/** ΟΛΗ η εμβέλεια της λίστας (ίδια φίλτρα/δείκτες με το `listJournalEntries`) — για τα σύνολα της οθόνης, ποτέ μερικό. */
export function collectJournalEntryList(tenant: TenantContext, filters: JournalEntryFilters): Promise<JournalEntry[]> {
  return scanAccountingList(tenant, JOURNAL_LIST, filters, (data) => applyJournalDefaults(data as JournalEntry));
}

/**
 * «Αναφέρει κάποια εγγραφή αυτή την κατηγορία;» — ερώτημα ύπαρξης, όχι σελίδα. Μόνο ισότητες χωρίς ταξινόμηση
 * ⇒ ο Firestore το εξυπηρετεί με συγχώνευση μονοπεδιακών δεικτών. ΧΩΡΙΣ fallback: ένα «όχι» από σφάλμα θα
 * οδηγούσε σε ΟΡΙΣΤΙΚΗ διαγραφή κατηγορίας που χρησιμοποιείται.
 */
export function hasJournalEntriesInCategory(tenant: TenantContext, categoryCode: string): Promise<boolean> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES)
      .where('companyId', '==', tenant.companyId)
      .where('category', '==', categoryCode)
      .select()
      .limit(1)
      .get();
    return !snap.empty;
  });
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

  // ADR-ACC-018 §15: οι οδηγίες πληρωμής κάθε νέου τιμολογίου (φόρμα · γέφυρα πωλήσεων · πιστωτικό) γράφονται
  // ΕΔΩ, από το μητρώο της εταιρείας — ό,τι έφερε ο καλών στο `issuer.bankAccounts` αγνοείται.
  const bankAccounts = await resolveInvoicePaymentAccounts(
    () => getBankAccounts(tenant), data, data.issuer?.name ?? '',
  );
  const withAccounts: CreateInvoiceInput = data.issuer ? { ...data, issuer: { ...data.issuer, bankAccounts } } : data;

  // Atomic invoice counter
  const nextNumber = await getNextInvoiceNumber(tenant, data.series);

  const doc: Invoice = {
    ...sanitizeForFirestore(withAccounts as unknown as Record<string, unknown>) as unknown as CreateInvoiceInput,
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

/** ΣΕΛΙΔΑ οθόνης (ADR-ACC-010 §2.1.1 Φάση 3β) — δρομέας keyset, πετά σε σφάλμα, ποτέ «κενή λίστα». */
export function listInvoices(
  tenant: TenantContext,
  filters: InvoiceFilters,
  page: PageRequest = FIRST_PAGE
): Promise<PaginatedResult<Invoice>> {
  return readAccountingListPage(tenant, INVOICE_LIST, filters, page, (data) => data as Invoice);
}

/** ΟΛΗ η εμβέλεια της λίστας (ίδια φίλτρα/δείκτες με το `listInvoices`) — για τα σύνολα της οθόνης, ποτέ μερικό. */
export function collectInvoiceList(tenant: TenantContext, filters: InvoiceFilters): Promise<Invoice[]> {
  return scanAccountingList(tenant, INVOICE_LIST, filters, (data) => data as Invoice);
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
      .doc(accountingDocId(tenant.companyId, 'service_presets'))
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
      .doc(accountingDocId(tenant.companyId, 'service_presets'));
    const doc = sanitizeForFirestore({
      presets,
      companyId: tenant.companyId,
      updatedAt: now,
    } as unknown as Record<string, unknown>);
    await docRef.set(doc);
  }, undefined);
}

// ============================================================================
// TAX INSTALLMENTS — ΠΑΝΤΑ μέσα στον μισθωτή (ADR-ACC-009 · 2026-11-07)
// ============================================================================
//
// 🔴 Η ανάγνωση φίλτραρε ΜΟΝΟ με `fiscalYear` ⇒ ζητούσε δείκτη που δεν υπάρχει (FAILED_PRECONDITION
// στην παραγωγή) και, αν τον έφτιαχνε κάποιος από τον σύνδεσμο του σφάλματος, θα επέστρεφε τις δόσεις
// ΟΛΩΝ των εταιρειών. Η ενημέρωση έγραφε στο σκέτο `${fiscalYear}_${installmentNumber}` ⇒ ένα έγγραφο
// για όλους τους μισθωτές. Τώρα και οι δύο ρωτούν `companyId` πρώτο — ο δείκτης `companyId + fiscalYear
// + installmentNumber` υπήρχε ήδη (`firestore.indexes.json`).

/** Το ερώτημα των δόσεων μιας χρήσης του μισθωτή — ΕΝΑ σημείο για ανάγνωση και ενημέρωση. */
function tenantInstallmentsQuery(db: Firestore, tenant: TenantContext, fiscalYear: number): Query {
  return db
    .collection(COLLECTIONS.ACCOUNTING_TAX_INSTALLMENTS)
    .where('companyId', '==', tenant.companyId)
    .where('fiscalYear', '==', fiscalYear);
}

export async function getTaxInstallments(
  tenant: TenantContext,
  fiscalYear: number
): Promise<TaxInstallment[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await tenantInstallmentsQuery(db, tenant, fiscalYear)
      .orderBy('installmentNumber', 'asc')
      .get();

    return snap.docs.map((d) => d.data() as TaxInstallment);
  }, []);
}

/**
 * Ενημερώνει τη δόση `installmentNumber` της χρήσης ΜΟΝΟ αν ανήκει στον μισθωτή. Ανάγνωση + εγγραφή στην
 * ΙΔΙΑ συναλλαγή· η ταυτότητα της δόσης (`installmentNumber`) δεν αλλάζει ποτέ από το `updates`.
 */
export async function updateTaxInstallment(
  tenant: TenantContext,
  installmentNumber: number,
  fiscalYear: number,
  updates: Partial<TaxInstallment>
): Promise<void> {
  const { installmentNumber: _identity, ...fields } = updates;
  await safeFirestoreOperation((db) => db.runTransaction(async (transaction) => {
    const snap = await transaction.get(
      tenantInstallmentsQuery(db, tenant, fiscalYear).where('installmentNumber', '==', installmentNumber).limit(1)
    );
    if (snap.empty) throw new Error(`Tax installment not found: ${fiscalYear}/${installmentNumber}`);
    transaction.update(snap.docs[0].ref, sanitizeForFirestore(fields as Record<string, unknown>));
  }), undefined);
}
