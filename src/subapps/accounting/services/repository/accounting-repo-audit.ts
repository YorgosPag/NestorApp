/**
 * @fileoverview Accounting Repository — Audit Log Domain (IMMUTABLE)
 * @description Create + List ONLY — zero update/delete (ΚΦΔ 5-year retention)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-1c.md Q2-Q3
 * @compliance SAP CDHDR append-only pattern, ΚΦΔ Ν.4987/2022
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

import type { AccountingAuditEntry, AuditEntryFilters } from '../../types/accounting-audit';
import type { TenantContext } from '../../types/common';

import { sanitizeForFirestore } from './firestore-helpers';

// ============================================================================
// CREATE (append-only — the ONLY write operation)
// ============================================================================

/**
 * **The stored shape of an audit entry** — tenant-stamped, sanitized (ADR-841 §7 Α23).
 *
 * One builder for both write paths: {@link createAuditEntry} and {@link appendAuditEntryInTransaction}.
 * Module-private since Γ3: writers outside this module append through the in-transaction helper.
 */
function auditLogDocumentOf(
  tenant: Pick<TenantContext, 'companyId'>,
  entry: AccountingAuditEntry
): Record<string, unknown> {
  return sanitizeForFirestore({
    ...entry,
    companyId: tenant.companyId,
  } as unknown as Record<string, unknown>);
}

/**
 * **The ONE in-transaction append of an audit entry** (ADR-841 §7 Α23 Φ3.2 Γ3).
 *
 * The material change and its trace commit together or not at all — never a change without a
 * trace, never a trace for a change that was rolled back. Writers: «Υιοθέτηση επωνυμίας ΓΕΜΗ» ·
 * company profile save.
 */
export function appendAuditEntryInTransaction(
  db: Firestore,
  transaction: Transaction,
  tenant: Pick<TenantContext, 'companyId'>,
  entry: AccountingAuditEntry
): void {
  const ref = db.collection(COLLECTIONS.ACCOUNTING_AUDIT_LOG).doc(entry.auditId);
  transaction.set(ref, auditLogDocumentOf(tenant, entry));
}

/**
 * Append a single immutable audit entry
 *
 * Uses setDoc with enterprise ID (alog_ prefix).
 * NEVER updates or deletes — by design (Q3).
 */
export async function createAuditEntry(
  tenant: TenantContext,
  entry: AccountingAuditEntry
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db
      .collection(COLLECTIONS.ACCOUNTING_AUDIT_LOG)
      .doc(entry.auditId)
      .set(auditLogDocumentOf(tenant, entry));
  }, undefined);
}

// ============================================================================
// LIST / QUERY (read-only — leverages 3 composite indexes)
// ============================================================================

/**
 * Query audit entries with filters
 *
 * 🔴 ΔΕΙΚΤΕΣ — ΔΙΟΡΘΩΘΗΚΕ 2026-09-21 (ADR-870 · CHECK 3.91). Εδώ έγραφε:
 *     «1. entityType + entityId + timestamp DESC · 2. eventType + timestamp DESC
 *      3. userId + timestamp DESC»
 * και το `firestore.indexes.json` **συμφωνούσε με το σχόλιο** — αλλά **κανένα από τα δύο**
 * δεν είχε `companyId`, που η συνάρτηση προσθέτει **πάντα** (γρ. 95). Ζωντανά: κάθε κλήση
 * επέστρεφε `FAILED_PRECONDITION`, σε **32** συνδυασμούς φίλτρων. Δύο πηγές συμφωνούσαν
 * μεταξύ τους και **και οι δύο** διαφωνούσαν με ό,τι τρέχει.
 *
 * ⚠️ **ΜΗΝ γράψεις ξανά λίστα δεικτών εδώ.** Αυτή η λίστα ήταν η ρίζα: ήταν *δεύτερη
 * αυθεντία* που κανείς δεν επαλήθευε. Η αυθεντία είναι το `firestore.indexes.json`, και
 * το ερώτημα «καλύπτεται;» το απαντά **εκτελώντας** την πύλη:
 *     npm run firestore:admin-index
 *
 * 🔑 Η κάλυψη γίνεται με **συγχώνευση**: ένας δείκτης `(πεδίο, timestamp DESC)` ανά πεδίο
 * φίλτρου καλύπτει **και τους 32** συνδυασμούς — αντί για 32 σύνθετους (ADR-870 §3).
 */
export async function listAuditEntries(
  tenant: TenantContext,
  filters: AuditEntryFilters,
  maxResults: number = 100
): Promise<AccountingAuditEntry[]> {
  return safeFirestoreOperation(async (db) => {
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.ACCOUNTING_AUDIT_LOG);

    query = query.where('companyId', '==', tenant.companyId);

    // Index 1: entityType + entityId + timestamp
    if (filters.entityType) {
      query = query.where('entityType', '==', filters.entityType);
    }
    if (filters.entityId) {
      query = query.where('entityId', '==', filters.entityId);
    }

    // Index 2: eventType + timestamp
    if (filters.eventType) {
      query = query.where('eventType', '==', filters.eventType);
    }

    // Index 3: userId + timestamp
    if (filters.userId) {
      query = query.where('userId', '==', filters.userId);
    }

    // Date range filter on timestamp
    if (filters.startDate) {
      query = query.where('timestamp', '>=', filters.startDate);
    }
    if (filters.endDate) {
      query = query.where('timestamp', '<=', filters.endDate);
    }

    query = query.orderBy('timestamp', 'desc').limit(maxResults);

    const snap = await query.get();
    return snap.docs.map((d) => d.data() as AccountingAuditEntry);
  }, []);
}
