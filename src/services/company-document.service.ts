/**
 * @fileoverview Company Document Service — Server-Only
 * @version 1.0.0
 * @since 2026-03-13
 *
 * Manages materialized company documents in the `companies` collection.
 * Previously, companies/{id} were phantom documents — they existed only
 * because subcollections (audit_logs, RBAC grants) were written under them.
 *
 * This service ensures every company has a real document with proper fields.
 *
 * @see ADR-210 Phase 3: Company Document Materialization
 */

import 'server-only';

import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateCompanyId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type { AuditFieldChange } from '@/types/audit-trail';

import type { CompanyDocument, CompanySettings, CompanyStatus, CompanyPlan } from '@/types/company';
import { resolveCompanyDisplayName } from '@/services/company/company-name-resolver';

const logger = createModuleLogger('CompanyDocumentService');

// =============================================================================
// CACHE — Avoid Firestore reads on every audit event
// =============================================================================

/** Cache entry: companyId → { exists, expiresAt } */
const companyExistsCache = new Map<string, { exists: boolean; expiresAt: number }>();

/** Cache TTL: 5 minutes */
const CACHE_TTL_MS = 5 * 60 * 1000;

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Check if a company document exists (cached, 5-min TTL).
 *
 * Used by the audit system to prevent phantom document creation.
 * The cache avoids a Firestore read on every single audit event.
 */
export async function validateCompanyExists(companyId: string): Promise<boolean> {
  // Check cache first
  const cached = companyExistsCache.get(companyId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.exists;
  }

  try {
    const db = getAdminFirestore();
    const docRef = db.collection(COLLECTIONS.COMPANIES).doc(companyId);
    const docSnap = await docRef.get();
    const exists = docSnap.exists;

    // Cache result
    companyExistsCache.set(companyId, {
      exists,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return exists;
  } catch (error) {
    logger.error('[CompanyDocument] validateCompanyExists failed', {
      companyId,
      error: getErrorMessage(error),
    });
    // On error, assume exists to avoid blocking audit writes
    return true;
  }
}

// =============================================================================
// READ
// =============================================================================

/**
 * Get a company document by ID.
 *
 * @returns The company document or null if not found
 */
export async function getCompanyDocument(companyId: string): Promise<CompanyDocument | null> {
  try {
    const db = getAdminFirestore();
    const docRef = db.collection(COLLECTIONS.COMPANIES).doc(companyId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return null;
    }

    const data = docSnap.data();
    if (!data) return null;

    return {
      id: docSnap.id,
      name: data.name ?? '',
      contactId: data.contactId ?? '',
      status: data.status ?? 'active',
      plan: data.plan ?? 'free',
      settings: data.settings ?? getDefaultSettings(),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      createdBy: data.createdBy ?? 'system',
    } as CompanyDocument;
  } catch (error) {
    logger.error('[CompanyDocument] getCompanyDocument failed', {
      companyId,
      error: getErrorMessage(error),
    });
    return null;
  }
}

// =============================================================================
// WRITE
// =============================================================================

/**
 * Ensure a company document exists. If not, create a basic one.
 *
 * This is the "materialize phantom → real" operation.
 * It reads company data from the contacts collection to populate the document.
 *
 * @param companyId - The company document ID
 * @param contactData - Optional contact data to populate from
 * @param createdBy - UID of the user performing the operation
 * @returns The company document (existing or newly created)
 */
export async function ensureCompanyDocument(
  companyId: string,
  contactData?: { name: string; contactId: string },
  createdBy: string = 'system'
): Promise<CompanyDocument> {
  const db = getAdminFirestore();
  const docRef = db.collection(COLLECTIONS.COMPANIES).doc(companyId);

  // Resolve name before the transaction (read-only, no side effects)
  let resolvedName = contactData?.name ?? '';
  if (!resolvedName && createdBy && createdBy !== 'system') {
    try {
      const userDoc = await db.collection(COLLECTIONS.USERS).doc(createdBy).get();
      if (userDoc.exists) {
        resolvedName = userDoc.data()?.displayName || '';
        logger.info('[CompanyDocument] Auto-resolved workspace name from user', {
          companyId,
          createdBy,
          name: resolvedName,
        });
      }
    } catch (lookupError) {
      logger.warn('[CompanyDocument] User lookup failed, using ID-based fallback', {
        companyId,
        error: getErrorMessage(lookupError),
      });
    }
  }

  const now = FieldValue.serverTimestamp();
  const docData = {
    name: resolveCompanyDisplayName({ id: companyId, name: resolvedName }),
    contactId: contactData?.contactId ?? null,
    status: 'active' as CompanyStatus,
    plan: 'free' as CompanyPlan,
    settings: getDefaultSettings(),
    createdAt: now,
    updatedAt: now,
    createdBy,
  };

  // Atomic create-if-not-exists — eliminates race condition on concurrent logins
  let wasCreated: boolean;
  try {
    wasCreated = await db.runTransaction(async (t) => {
      const snap = await t.get(docRef);
      if (snap.exists) return false;
      t.set(docRef, docData);
      return true;
    });
  } catch (error) {
    logger.error('[CompanyDocument] ensureCompanyDocument transaction failed', {
      companyId,
      error: getErrorMessage(error),
    });
    throw error;
  }

  if (!wasCreated) {
    // Another concurrent caller already created the doc — return it
    const existing = await getCompanyDocument(companyId);
    if (!existing) throw new Error(`Company ${companyId} exists in transaction but not readable`);
    return existing;
  }

  // Side effects outside transaction: cache + audit
  companyExistsCache.delete(companyId);

  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.COMPANY,
    entityId: companyId,
    entityName: docData.name,
    action: 'created',
    changes: buildCreationChanges(docData),
    performedBy: createdBy,
    performedByName: null,
    companyId,
  });

  logger.info('[CompanyDocument] Materialized phantom → real document', {
    companyId,
    name: docData.name,
  });

  // Re-read to get server timestamps
  const created = await getCompanyDocument(companyId);
  if (!created) throw new Error('Document created but could not be read back');
  return created;
}

/**
 * Create a brand-new company document with an enterprise ID (comp_xxx).
 *
 * @param data - Company data (name, contactId, etc.)
 * @returns The created company document
 */
export async function createCompanyDocument(
  data: {
    name: string;
    contactId: string;
    status?: CompanyStatus;
    plan?: CompanyPlan;
    settings?: CompanySettings;
    createdBy: string;
  }
): Promise<CompanyDocument> {
  const companyId = generateCompanyId();
  const now = FieldValue.serverTimestamp();

  const docData = {
    name: data.name,
    contactId: data.contactId,
    status: data.status ?? 'active',
    plan: data.plan ?? 'free',
    settings: data.settings ?? getDefaultSettings(),
    createdAt: now,
    updatedAt: now,
    createdBy: data.createdBy,
  };

  try {
    const db = getAdminFirestore();
    await db.collection(COLLECTIONS.COMPANIES).doc(companyId).set(docData);

    // ADR-195 — Entity audit trail (company creation)
    await EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.COMPANY,
      entityId: companyId,
      entityName: data.name,
      action: 'created',
      changes: buildCreationChanges(docData),
      performedBy: data.createdBy,
      performedByName: null,
      companyId,
    });

    logger.info('[CompanyDocument] Created new company', {
      companyId,
      name: data.name,
    });

    const created = await getCompanyDocument(companyId);
    if (!created) {
      throw new Error('Document created but could not be read back');
    }
    return created;
  } catch (error) {
    logger.error('[CompanyDocument] createCompanyDocument failed', {
      error: getErrorMessage(error),
    });
    throw error;
  }
}

// =============================================================================
// REPAIR
// =============================================================================

/**
 * Repair a company document whose `name` or `contactId` are stale/incorrect.
 *
 * Looks up the matching contact in the `contacts` collection (type=company,
 * companyId==companyId) and patches the document with the correct values.
 *
 * @returns Object describing what was changed
 */
export async function repairCompanyDocument(
  companyId: string,
  repairedBy: string
): Promise<{ name: string; wasRepaired: boolean }> {
  const db = getAdminFirestore();

  // Resolve workspace name from the earliest admin user of this company
  const usersSnap = await db
    .collection(COLLECTIONS.USERS)
    .where('companyId', '==', companyId)
    .orderBy('createdAt', 'asc')
    .limit(1)
    .get();

  if (usersSnap.empty) {
    logger.warn('[CompanyDocument] repairCompanyDocument: no users found for company', { companyId });
    return { name: '', wasRepaired: false };
  }

  const userData = usersSnap.docs[0].data();
  const correctName = userData.displayName || '';

  if (!correctName) {
    logger.warn('[CompanyDocument] repairCompanyDocument: user has no displayName', { companyId });
    return { name: '', wasRepaired: false };
  }

  await db.collection(COLLECTIONS.COMPANIES).doc(companyId).update({
    name: correctName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  companyExistsCache.delete(companyId);

  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.COMPANY,
    entityId: companyId,
    entityName: correctName,
    action: 'updated',
    changes: [
      { field: 'name', oldValue: null, newValue: correctName, label: 'name' },
    ],
    performedBy: repairedBy,
    performedByName: null,
    companyId,
  });

  logger.info('[CompanyDocument] Repaired company document name', {
    companyId,
    name: correctName,
  });

  return { name: correctName, wasRepaired: true };
}

// =============================================================================
// HELPERS
// =============================================================================

function getDefaultSettings(): CompanySettings {
  return {
    defaultLocale: 'el',
    timezone: 'Europe/Athens',
    features: {},
  };
}

/**
 * Build an `AuditFieldChange[]` for a newly-created company document.
 *
 * Creation audit entries carry `oldValue: null` for every tracked field
 * and `newValue` as the created field. Firestore `FieldValue.serverTimestamp()`
 * sentinels are serialised via `String()` because they are not primitive at
 * write time — they only become a real Timestamp on the server.
 */
function buildCreationChanges(docData: Record<string, unknown>): AuditFieldChange[] {
  const tracked: Array<keyof typeof docData> = [
    'name',
    'contactId',
    'status',
    'plan',
    'createdBy',
  ];
  return tracked.map((field) => {
    const raw = docData[field];
    const value =
      raw === undefined || raw === null
        ? null
        : typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean'
          ? raw
          : String(raw);
    return {
      field: String(field),
      oldValue: null,
      newValue: value,
      label: String(field),
    };
  });
}
