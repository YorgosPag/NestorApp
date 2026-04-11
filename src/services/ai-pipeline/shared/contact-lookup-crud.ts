/**
 * =============================================================================
 * 🏢 ENTERPRISE: CONTACT CRUD & SYNC SIGNALS
 * =============================================================================
 *
 * Server-side contact mutations: create, update field, remove field.
 * Missing-fields check for smart checklist. UI sync signal emitter.
 *
 * @module services/ai-pipeline/shared/contact-lookup-crud
 * @see contact-lookup.ts (barrel re-exports)
 * @see ADR-080, ADR-145, ADR-227
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { generateContactId, generateCompanyId } from '@/services/enterprise-id.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditFieldChange } from '@/types/audit-trail';
import type { EntitySyncAction, SyncEntityType } from '@/services/realtime/types';
import { SYNC_SOURCE_AI_AGENT } from '@/services/realtime/types';

import type { CreateContactParams, CreateContactResult } from './contact-lookup-types';
import { checkContactDuplicates } from './contact-lookup-search';

const logger = createModuleLogger('PIPELINE_CONTACT_CRUD');

// ============================================================================
// UPDATE CONTACT FIELD (ADR-145: UC-016)
// ============================================================================

/** Fields that are stored as arrays in Firestore (support arrayUnion) */
const ARRAY_FIELDS: ReadonlySet<string> = new Set(['phone', 'email']);

/**
 * Update a single field on a contact document.
 *
 * - Array fields (phone, email): uses `FieldValue.arrayUnion()` — adds without overwrite
 * - Scalar fields (vatNumber, profession, etc.): direct `.update({ [field]: value })`
 *
 * Always updates `updatedAt` and `lastModifiedBy`.
 */
export async function updateContactField(
  contactId: string,
  field: string,
  value: string,
  updatedBy: string
): Promise<void> {
  const adminDb = getAdminFirestore();
  const docRef = adminDb.collection(COLLECTIONS.CONTACTS).doc(contactId);

  const isArray = ARRAY_FIELDS.has(field);

  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    lastModifiedBy: updatedBy,
  };

  if (isArray) {
    if (field === 'phone') {
      updateData['phones'] = FieldValue.arrayUnion({
        number: value,
        type: 'mobile',
        isPrimary: false,
      });
    } else if (field === 'email') {
      updateData['emails'] = FieldValue.arrayUnion({
        email: value.toLowerCase().trim(),
        type: 'work',
        isPrimary: false,
      });
    }
  } else {
    updateData[field] = value;
  }

  // ADR-195: canonical entity audit trail (SSoT) — fetch existing for companyId + displayName + oldValue
  const existingSnap = await docRef.get();
  const existingData = existingSnap.exists ? (existingSnap.data() ?? {}) : {};
  const oldValue = typeof existingData[field] === 'string'
    || typeof existingData[field] === 'number'
    || typeof existingData[field] === 'boolean'
    ? existingData[field] as string | number | boolean
    : null;
  const companyId = String(existingData.companyId ?? '');

  await docRef.update(updateData);

  if (companyId) {
    await EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.CONTACT,
      entityId: contactId,
      entityName: String(existingData.displayName ?? null) || null,
      action: 'updated',
      changes: [{ field, oldValue, newValue: value, label: field }],
      performedBy: updatedBy,
      performedByName: updatedBy,
      companyId,
    });
  }

  logger.info('Contact field updated', {
    contactId,
    field,
    isArray,
    updatedBy,
  });
}

// ============================================================================
// REMOVE CONTACT FIELD (ADR-145: UC-016 REMOVE mode)
// ============================================================================

/**
 * Remove array entries (phone/email) or clear scalar fields on a contact.
 *
 * - Array fields (phone, email): removes ALL entries (clear the array)
 * - Scalar fields: sets to null
 */
export async function removeContactField(
  contactId: string,
  field: string,
  updatedBy: string
): Promise<void> {
  const adminDb = getAdminFirestore();
  const docRef = adminDb.collection(COLLECTIONS.CONTACTS).doc(contactId);

  const isArray = ARRAY_FIELDS.has(field);

  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    lastModifiedBy: updatedBy,
  };

  if (isArray) {
    if (field === 'phone') {
      updateData['phones'] = [];
    } else if (field === 'email') {
      updateData['emails'] = [];
    }
  } else {
    updateData[field] = null;
  }

  // ADR-195: canonical entity audit trail (SSoT) — fetch existing for companyId
  const existingSnap = await docRef.get();
  const existingData = existingSnap.exists ? (existingSnap.data() ?? {}) : {};
  const companyId = String(existingData.companyId ?? '');

  await docRef.update(updateData);

  if (companyId) {
    await EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.CONTACT,
      entityId: contactId,
      entityName: String(existingData.displayName ?? null) || null,
      action: 'updated',
      changes: [{ field, oldValue: null, newValue: null, label: `Διαγραφή ${field}` }],
      performedBy: updatedBy,
      performedByName: updatedBy,
      companyId,
    });
  }

  logger.info('Contact field removed', {
    contactId,
    field,
    isArray,
    updatedBy,
  });
}

// ============================================================================
// GET MISSING FIELDS (Smart confirmation checklist)
// ============================================================================

/**
 * Get a contact's missing fields for the smart confirmation checklist.
 *
 * @param contactId - Firestore document ID
 * @param contactType - 'individual' | 'company'
 * @returns Array of field labels that are missing/empty
 */
export async function getContactMissingFields(
  contactId: string,
  contactType: 'individual' | 'company'
): Promise<string[]> {
  const adminDb = getAdminFirestore();
  const docRef = adminDb.collection(COLLECTIONS.CONTACTS).doc(contactId);
  const snap = await docRef.get();

  if (!snap.exists) return [];

  const data = snap.data()!;
  const missing: string[] = [];

  // Common fields
  const phones = data.phones as Array<Record<string, unknown>> | undefined;
  if (!phones || phones.length === 0) missing.push('Τηλέφωνο');

  const emails = data.emails as Array<Record<string, unknown>> | undefined;
  if (!emails || emails.length === 0) missing.push('Email');

  if (!data.vatNumber) missing.push('ΑΦΜ');

  if (!data.address && (!data.addresses || (data.addresses as Array<unknown>).length === 0)) {
    missing.push('Διεύθυνση');
  }

  if (contactType === 'individual') {
    if (!data.profession) missing.push('Επάγγελμα');
    if (!data.fatherName) missing.push('Πατρώνυμο');
    if (!data.birthDate) missing.push('Ημερομηνία γέννησης');
    if (!data.taxOffice) missing.push('ΔΟΥ');
  } else {
    if (!data.registrationNumber) missing.push('Αριθμός ΓΕΜΗ');
    if (!data.legalForm) missing.push('Νομική μορφή');
    if (!data.taxOffice) missing.push('ΔΟΥ');
  }

  return missing;
}

// ============================================================================
// CREATE CONTACT SERVER-SIDE (ADR-145: UC-015)
// ============================================================================

/**
 * Server-side contact creation using Admin SDK.
 *
 * Steps:
 * 1. Multi-criteria duplicate check (email + phone + name)
 * 2. Build Firestore document following contact schema
 * 3. Write to Firestore contacts collection
 *
 * CRITICAL: Every optional field uses `?? null` — Firestore rejects undefined.
 *
 * @throws Error with DUPLICATE_CONTACT prefix if duplicates found
 */
export async function createContactServerSide(
  params: CreateContactParams
): Promise<CreateContactResult> {
  const adminDb = getAdminFirestore();

  // ── Step 1: Multi-criteria duplicate check ──
  if (!params.skipDuplicateCheck) {
    const duplicateResult = await checkContactDuplicates(
      {
        email: params.email,
        phone: params.phone,
        firstName: params.firstName,
        lastName: params.lastName,
        companyName: params.companyName,
      },
      params.companyId
    );

    if (duplicateResult.hasDuplicate) {
      const matchSummary = duplicateResult.matches
        .map(m => `${m.type}:${m.confidence} → "${m.name}" (${m.contactId})`)
        .join('; ');
      throw new Error(
        `DUPLICATE_CONTACT: ${matchSummary}|||${JSON.stringify(duplicateResult.matches)}`
      );
    }
  }

  // ── Step 2: Build display name ──
  const displayName = params.type === 'company'
    ? params.companyName ?? `${params.firstName} ${params.lastName}`.trim()
    : `${params.firstName} ${params.lastName}`.trim();

  // ── Step 3: Build Firestore document ──
  const contactDoc: Record<string, unknown> = {
    type: params.type,
    status: 'active',
    isFavorite: false,
    displayName,
    firstName: params.firstName ?? null,
    lastName: params.lastName ?? null,
    ...(params.type === 'company' && params.companyName
      ? { companyName: params.companyName }
      : {}),
    emails: params.email
      ? [{ email: params.email, type: 'work', isPrimary: true }]
      : [],
    phones: params.phone
      ? [{ number: params.phone, type: 'mobile', isPrimary: true }]
      : [],
    addresses: [],
    companyId: params.companyId,
    createdBy: params.createdBy,
    lastModifiedBy: params.createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    tags: null,
    notes: null,
    customFields: null,
    photoURL: null,
    vatNumber: null,
    taxOffice: null,
    profession: null,
  };

  // ── Step 4: Generate enterprise ID ──
  const contactId = params.type === 'company'
    ? generateCompanyId()
    : generateContactId();

  // ── Step 5: Write to Firestore ──
  await adminDb
    .collection(COLLECTIONS.CONTACTS)
    .doc(contactId)
    .set(contactDoc);

  // ADR-195: canonical entity audit trail (SSoT)
  const creationChanges: AuditFieldChange[] = [
    { field: 'displayName', oldValue: null, newValue: displayName, label: 'Όνομα' },
    { field: 'type', oldValue: null, newValue: params.type, label: 'Τύπος' },
  ];
  if (params.phone) creationChanges.push({ field: 'phones', oldValue: null, newValue: params.phone, label: 'Τηλέφωνο' });
  if (params.email) creationChanges.push({ field: 'emails', oldValue: null, newValue: params.email, label: 'Email' });
  if (params.companyName) creationChanges.push({ field: 'companyName', oldValue: null, newValue: params.companyName, label: 'Επωνυμία' });
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.CONTACT,
    entityId: contactId,
    entityName: displayName,
    action: 'created',
    changes: creationChanges,
    performedBy: params.createdBy,
    performedByName: params.createdBy,
    companyId: params.companyId,
  });

  logger.info('Contact created via Admin SDK', {
    contactId,
    displayName,
    type: params.type,
    companyId: params.companyId,
    createdBy: params.createdBy,
  });

  emitEntitySyncSignal('contacts', 'CREATED', contactId, params.companyId);

  return { contactId, displayName };
}

// ============================================================================
// UI SYNC SIGNAL — SERVER→CLIENT BRIDGE (ADR-227 Extension)
// ============================================================================

/**
 * Generic entity sync signal emitter.
 *
 * Write a sync signal to `config/{SYSTEM_DOCS.UI_SYNC_SIGNAL}` so the
 * client's `useAISyncBridge(entityType)` hook picks up server-side mutations.
 *
 * Fire-and-forget — failure is non-blocking.
 */
export function emitEntitySyncSignal(
  entityType: SyncEntityType,
  action: EntitySyncAction,
  entityId: string,
  companyId: string
): void {
  try {
    const db = getAdminFirestore();
    void db.collection(COLLECTIONS.CONFIG).doc(SYSTEM_DOCS.UI_SYNC_SIGNAL).set({
      entityType,
      action,
      entityId,
      companyId,
      timestamp: FieldValue.serverTimestamp(),
      source: SYNC_SOURCE_AI_AGENT,
    }).catch(err => {
      logger.warn('Failed to emit entity sync signal', {
        entityType,
        action,
        error: getErrorMessage(err),
      });
    });
  } catch {
    // Non-blocking — if Admin SDK isn't available, skip silently
  }
}

/** @deprecated Use emitEntitySyncSignal — kept for backward compatibility */
export function emitContactSyncSignal(
  action: 'CONTACT_CREATED' | 'CONTACT_UPDATED' | 'CONTACT_DELETED',
  entityId: string,
  companyId: string
): void {
  const actionMap: Record<string, EntitySyncAction> = {
    CONTACT_CREATED: 'CREATED',
    CONTACT_UPDATED: 'UPDATED',
    CONTACT_DELETED: 'DELETED',
  };
  emitEntitySyncSignal('contacts', actionMap[action], entityId, companyId);
}
