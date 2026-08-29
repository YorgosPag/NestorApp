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
import { generateContactId } from '@/services/enterprise-id.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditFieldChange } from '@/types/audit-trail';
import type { EntitySyncAction, SyncEntityType } from '@/services/realtime/types';
import { SYNC_SOURCE_AI_AGENT } from '@/services/realtime/types';

import { buildContactDocument, parsePhoneForStorage } from './contact-document-builder';
import type { CreateContactParams, CreateContactResult } from './contact-lookup-types';
import { checkContactDuplicates } from './contact-lookup-search';

const logger = createModuleLogger('PIPELINE_CONTACT_CRUD');

// ============================================================================
// UPDATE / REMOVE CONTACT FIELD (ADR-145: UC-016)
// ============================================================================

/** Fields that are stored as arrays in Firestore (support arrayUnion) */
const ARRAY_FIELDS: ReadonlySet<string> = new Set(['phone', 'email']);

/**
 * Το ίχνος ADR-195 μιας μετάλλαξης πεδίου — **σιωπηλό χωρίς `companyId`**.
 *
 * Η σιωπή είναι η προϋπάρχουσα συμπεριφορά και δεν αλλάζει εδώ: επαφή χωρίς
 * εταιρεία δεν έχει **σε ποιανού** το ιστορικό να γραφτεί.
 */
async function recordContactFieldChange(args: {
  readonly contactId: string;
  readonly existingData: Record<string, unknown>;
  readonly change: AuditFieldChange;
  readonly updatedBy: string;
}): Promise<void> {
  const companyId = String(args.existingData.companyId ?? '');
  if (!companyId) return;

  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.CONTACT,
    entityId: args.contactId,
    entityName: String(args.existingData.displayName ?? null) || null,
    action: 'updated',
    changes: [args.change],
    performedBy: args.updatedBy,
    performedByName: args.updatedBy,
    companyId,
  });
}

/**
 * ΜΙΑ γραφή πεδίου επαφής — ο κοινός σκελετός των δύο μεταλλάξεων.
 *
 * -----------------------------------------------------------------------------
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗ (CHECK 3.28 / ADR-583 · N.0.2)
 * -----------------------------------------------------------------------------
 *
 * Το `updateContactField` και το `removeContactField` ήταν **δίδυμα στα δύο άκρα**:
 * ίδιος πρόλογος (`docRef` + `updatedAt`/`lastModifiedBy`) και ίδιος επίλογος
 * (ανάγνωση για `companyId`, `update`, ίχνος ADR-195). Διέφεραν **μόνο στη μέση** —
 * τι γράφεται στο πεδίο, και τι λέει η γραμμή του ιστορικού.
 *
 * ⚠️ Ο σκελετός **διαβάζει πάντα** την προηγούμενη τιμή, ακόμη κι όταν ο καλών τη
 * ρίχνει: η ανάγνωση γινόταν ήδη **και στις δύο** διαδρομές (για το `companyId`),
 * άρα δεν προστίθεται ταξίδι — και ο καλών παραμένει ο **μόνος** που αποφασίζει τι
 * καταγράφεται.
 */
async function applyContactFieldMutation(params: {
  readonly contactId: string;
  readonly field: string;
  readonly updatedBy: string;
  readonly fieldUpdates: Record<string, unknown>;
  readonly toChange: (oldValue: AuditFieldChange['oldValue']) => AuditFieldChange;
  readonly logMessage: string;
}): Promise<void> {
  const { contactId, field, updatedBy, fieldUpdates, toChange, logMessage } = params;

  const adminDb = getAdminFirestore();
  const docRef = adminDb.collection(COLLECTIONS.CONTACTS).doc(contactId);

  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    lastModifiedBy: updatedBy,
    ...fieldUpdates,
  };

  // ADR-195: canonical entity audit trail (SSoT) — fetch existing for companyId + displayName + oldValue
  const existingSnap = await docRef.get();
  const existingData: Record<string, unknown> = existingSnap.exists
    ? (existingSnap.data() ?? {})
    : {};
  const previous = existingData[field];
  const oldValue =
    typeof previous === 'string' || typeof previous === 'number' || typeof previous === 'boolean'
      ? previous
      : null;

  await docRef.update(updateData);

  await recordContactFieldChange({
    contactId,
    existingData,
    change: toChange(oldValue),
    updatedBy,
  });

  logger.info(logMessage, {
    contactId,
    field,
    isArray: ARRAY_FIELDS.has(field),
    updatedBy,
  });
}

/** Τι γράφεται στο πεδίο όταν **προστίθεται** τιμή (arrayUnion για τα πολλαπλά). */
function buildFieldAddition(field: string, value: string): Record<string, unknown> {
  if (!ARRAY_FIELDS.has(field)) return { [field]: value };

  if (field === 'phone') {
    const parsed = parsePhoneForStorage(value);
    return {
      phones: FieldValue.arrayUnion({
        number: parsed.number,
        ...(parsed.countryCode ? { countryCode: parsed.countryCode } : {}),
        type: 'mobile',
        isPrimary: false,
      }),
    };
  }

  if (field === 'email') {
    return {
      emails: FieldValue.arrayUnion({
        email: value.toLowerCase().trim(),
        type: 'work',
        isPrimary: false,
      }),
    };
  }

  return {};
}

/** Τι γράφεται στο πεδίο όταν **καθαρίζεται** (άδειος πίνακας για τα πολλαπλά). */
function buildFieldClearing(field: string): Record<string, unknown> {
  if (!ARRAY_FIELDS.has(field)) return { [field]: null };
  if (field === 'phone') return { phones: [] };
  if (field === 'email') return { emails: [] };
  return {};
}

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
  await applyContactFieldMutation({
    contactId,
    field,
    updatedBy,
    fieldUpdates: buildFieldAddition(field, value),
    toChange: (oldValue) => ({ field, oldValue, newValue: value, label: field }),
    logMessage: 'Contact field updated',
  });
}

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
  await applyContactFieldMutation({
    contactId,
    field,
    updatedBy,
    fieldUpdates: buildFieldClearing(field),
    toChange: () => ({ field, oldValue: null, newValue: null, label: `Διαγραφή ${field}` }),
    logMessage: 'Contact field removed',
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

  // ── Step 2-3: Build display name + Firestore document ──
  //
  // The shape lives in `contact-document-builder` because the ADR-827 Σ3 acceptance
  // transaction needs the *same* document and cannot call this function (it writes on
  // its own). One builder, two writers — never two builders (ADR-749).
  const { displayName, doc: contactDoc } = buildContactDocument(params);

  // ── Step 4: Generate enterprise ID ──
  const contactId = generateContactId();

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
