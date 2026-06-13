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
import { resolveCompanyName, resolveCompanyDisplayName } from '@/services/company/company-name-resolver';
import { readCompanyLegalIdentity } from '@/services/company/company-legal-identity';

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
      _lastModifiedBy: data._lastModifiedBy,
      _lastModifiedByName: data._lastModifiedByName ?? null,
      _lastModifiedAt: data._lastModifiedAt,
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
 * This is the "materialize phantom → real" operation. The display name is
 * derived from the per-tenant company profile (legal-identity SSoT, ADR-439)
 * via {@link readCompanyLegalIdentity}; a user's displayName is only a
 * last-resort fallback.
 *
 * @param companyId - The company document ID
 * @param contactData - Optional explicit name/contactId override (highest priority)
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

  // Resolve display name before the transaction (read-only, no side effects).
  // SSoT (ADR-439): the per-tenant company profile (businessName / tradeName)
  // is the legal identity. A user's displayName is only the LAST resort before
  // the identifier fallback — this is what fixes the "Georgios Pagonis" bug.
  const identity = await readCompanyLegalIdentity(companyId);

  // Resolve the performer's display name once — used both as the company-name
  // last-resort fallback AND for the audit stamp (`_lastModifiedByName`).
  const actorName = await resolveActorDisplayName(db, createdBy);

  // Priority (resolver-enforced): explicit contact name → profile trade name →
  // profile legal name → user displayName → identifier fallback.
  const resolvedName = resolveCompanyDisplayName({
    id: companyId,
    companyName: contactData?.name || undefined,
    tradeName: identity?.tradeName,
    legalName: identity?.businessName,
    displayName: actorName ?? undefined,
  });

  const now = FieldValue.serverTimestamp();
  const docData = {
    name: resolvedName,
    contactId: contactData?.contactId ?? null,
    status: 'active' as CompanyStatus,
    plan: 'free' as CompanyPlan,
    settings: getDefaultSettings(),
    createdAt: now,
    updatedAt: now,
    createdBy,
    // Entity-audit convention (ADR-210) — mirror buildCommonFields so the
    // company doc carries the same _lastModified* stamps as entity docs.
    _lastModifiedBy: createdBy,
    _lastModifiedByName: actorName,
    _lastModifiedAt: now,
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
    performedByName: actorName,
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


// =============================================================================
// REPAIR
// =============================================================================

/**
 * Repair a company document whose `name` is stale/incorrect.
 *
 * Re-derives the display name from the per-tenant company profile
 * (legal-identity SSoT, ADR-439) and patches the document. A user's
 * displayName is only a last-resort fallback. No-ops when the name is already
 * correct or when no real name can be resolved.
 *
 * @returns Object describing what was changed
 */
export async function repairCompanyDocument(
  companyId: string,
  repairedBy: string
): Promise<{ name: string; wasRepaired: boolean }> {
  const db = getAdminFirestore();

  // Legal-identity SSoT: per-tenant company profile (businessName / tradeName).
  const identity = await readCompanyLegalIdentity(companyId);

  // Last-resort fallback: earliest admin user's displayName.
  let userDisplayName = '';
  try {
    const usersSnap = await db
      .collection(COLLECTIONS.USERS)
      .where('companyId', '==', companyId)
      .orderBy('createdAt', 'asc')
      .limit(1)
      .get();
    if (!usersSnap.empty) {
      userDisplayName = usersSnap.docs[0].data().displayName || '';
    }
  } catch (lookupError) {
    logger.warn('[CompanyDocument] repairCompanyDocument: user lookup failed', {
      companyId,
      error: getErrorMessage(lookupError),
    });
  }

  const resolution = resolveCompanyName({
    id: companyId,
    tradeName: identity?.tradeName,
    legalName: identity?.businessName,
    displayName: userDisplayName || undefined,
  });

  if (!resolution.hasRealName) {
    logger.warn('[CompanyDocument] repairCompanyDocument: no legal identity or user name found', { companyId });
    return { name: '', wasRepaired: false };
  }

  const correctName = resolution.displayName;
  const existing = await getCompanyDocument(companyId);
  const previousName = existing?.name ?? null;

  if (previousName === correctName) {
    return { name: correctName, wasRepaired: false };
  }

  const repairActorName = await resolveActorDisplayName(db, repairedBy);
  const repairNow = FieldValue.serverTimestamp();
  await db.collection(COLLECTIONS.COMPANIES).doc(companyId).update({
    name: correctName,
    updatedAt: repairNow,
    // Entity-audit convention (ADR-210) — stamp the modifier on every update.
    _lastModifiedBy: repairedBy,
    _lastModifiedByName: repairActorName,
    _lastModifiedAt: repairNow,
  });

  companyExistsCache.delete(companyId);

  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.COMPANY,
    entityId: companyId,
    entityName: correctName,
    action: 'updated',
    changes: [
      { field: 'name', oldValue: previousName, newValue: correctName, label: 'name' },
    ],
    performedBy: repairedBy,
    performedByName: repairActorName,
    companyId,
  });

  logger.info('[CompanyDocument] Repaired company document name', {
    companyId,
    name: correctName,
    source: resolution.source,
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
 * Resolve a performer's display name for audit stamping (`_lastModifiedByName`
 * + audit-trail `performedByName`). Returns null for `system`/unknown actors so
 * the company document follows the same audit convention as entity documents
 * ({@link buildCommonFields} in `entity-creation.service`).
 */
async function resolveActorDisplayName(
  db: ReturnType<typeof getAdminFirestore>,
  uid: string,
): Promise<string | null> {
  if (!uid || uid === 'system') return null;
  try {
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
    return userDoc.exists ? (userDoc.data()?.displayName || null) : null;
  } catch (lookupError) {
    logger.warn('[CompanyDocument] actor name lookup failed', {
      uid,
      error: getErrorMessage(lookupError),
    });
    return null;
  }
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
