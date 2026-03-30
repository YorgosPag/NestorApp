/**
 * @fileoverview Accounting Repository — Audit Log Domain (IMMUTABLE)
 * @description Create + List ONLY — zero update/delete (ΚΦΔ 5-year retention)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-1c.md Q2-Q3
 * @compliance SAP CDHDR append-only pattern, ΚΦΔ Ν.4987/2022
 */

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

import type { AccountingAuditEntry, AuditEntryFilters } from '../../types/accounting-audit';

import { sanitizeForFirestore } from './firestore-helpers';

// ============================================================================
// CREATE (append-only — the ONLY write operation)
// ============================================================================

/**
 * Append a single immutable audit entry
 *
 * Uses setDoc with enterprise ID (alog_ prefix).
 * NEVER updates or deletes — by design (Q3).
 */
export async function createAuditEntry(
  entry: AccountingAuditEntry
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    const doc = sanitizeForFirestore(entry as unknown as Record<string, unknown>);
    await db
      .collection(COLLECTIONS.ACCOUNTING_AUDIT_LOG)
      .doc(entry.auditId)
      .set(doc);
  }, undefined);
}

// ============================================================================
// LIST / QUERY (read-only — leverages 3 composite indexes)
// ============================================================================

/**
 * Query audit entries with filters
 *
 * Composite indexes:
 * 1. entityType + entityId + timestamp DESC — per-document history
 * 2. eventType + timestamp DESC — cross-entity analytics
 * 3. userId + timestamp DESC — user activity audit
 */
export async function listAuditEntries(
  filters: AuditEntryFilters,
  maxResults: number = 100
): Promise<AccountingAuditEntry[]> {
  return safeFirestoreOperation(async (db) => {
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.ACCOUNTING_AUDIT_LOG);

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
