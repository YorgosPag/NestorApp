/**
 * =============================================================================
 * 🏢 ENTERPRISE: CENTRALIZED CONTACT LOOKUP
 * =============================================================================
 *
 * Shared utility for finding contacts by email across all UC modules.
 * Eliminates duplication between UC-001, UC-003, and future modules.
 *
 * @module services/ai-pipeline/shared/contact-lookup
 * @see UC-001 (Appointment Request)
 * @see UC-003 (Property Search)
 * @see ADR-080 (Pipeline Implementation)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { fuzzyGreekMatch } from './greek-text-utils';

const logger = createModuleLogger('PIPELINE_CONTACT_LOOKUP');

// ============================================================================
// TYPES
// ============================================================================

/** Result of a successful contact match */
export interface ContactMatch {
  contactId: string;
  name: string;
}

/** Result of a contact search by name (ADR-145) */
export interface ContactNameSearchResult {
  contactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  type: string | null;
}

// ============================================================================
// CONTACT LOOKUP
// ============================================================================

/**
 * Server-side contact lookup by email using Admin SDK.
 *
 * Searches the contacts collection for a matching email address.
 * Checks both the `emails` array field and the flat `email` field.
 *
 * MVP: Scans contacts per company (limited to 50 docs).
 * Phase 2: Use flat `primaryEmail` field for direct indexed query.
 *
 * @param email - Email address to search for
 * @param companyId - Tenant isolation (company ID)
 * @returns ContactMatch if found, null otherwise
 */
export async function findContactByEmail(
  email: string,
  companyId: string
): Promise<ContactMatch | null> {
  const adminDb = getAdminFirestore();

  const snapshot = await adminDb
    .collection(COLLECTIONS.CONTACTS)
    .where('companyId', '==', companyId)
    .limit(50)
    .get();

  const normalizedEmail = email.toLowerCase().trim();

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Check emails array (common pattern: [{ email: "...", label: "work" }])
    const emails = data.emails as Array<{ email?: string }> | undefined;
    if (emails?.some(e => e.email?.toLowerCase().trim() === normalizedEmail)) {
      return {
        contactId: doc.id,
        name: (data.displayName ?? data.firstName ?? data.companyName ?? 'Unknown') as string,
      };
    }

    // Check flat email field
    const flatEmail = data.email as string | undefined;
    if (flatEmail?.toLowerCase().trim() === normalizedEmail) {
      return {
        contactId: doc.id,
        name: (data.displayName ?? data.firstName ?? data.companyName ?? 'Unknown') as string,
      };
    }
  }

  logger.debug('Contact not found by email', { email: normalizedEmail, companyId });
  return null;
}

// ============================================================================
// CONTACT SEARCH BY NAME (ADR-145: Super Admin AI Assistant)
// ============================================================================

/**
 * Server-side contact search by name using Admin SDK.
 *
 * Searches the contacts collection for matches by display name, first name,
 * or last name. Client-side fuzzy matching against normalized search terms.
 *
 * @param searchTerm - Name to search for (partial match supported)
 * @param companyId - Tenant isolation (company ID)
 * @param limit - Maximum results to return (default: 10)
 * @returns Array of matching contacts with contact details
 */
export async function findContactByName(
  searchTerm: string,
  companyId: string,
  limit: number = 10
): Promise<ContactNameSearchResult[]> {
  const adminDb = getAdminFirestore();

  // Fetch contacts for this company (limited scan for MVP)
  const snapshot = await adminDb
    .collection(COLLECTIONS.CONTACTS)
    .where('companyId', '==', companyId)
    .limit(200)
    .get();

  if (snapshot.empty) return [];

  const normalizedSearch = searchTerm.toLowerCase().trim();
  const results: ContactNameSearchResult[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Build searchable name parts
    const displayName = (data.displayName as string) ?? '';
    const firstName = (data.firstName as string) ?? '';
    const lastName = (data.lastName as string) ?? '';
    const companyName = (data.companyName as string) ?? '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    // Check if any name field matches the search term (fuzzy: accents, declension, transliteration)
    const namesToCheck = [displayName, firstName, lastName, companyName, fullName];
    const matches = namesToCheck.some(name =>
      name.length > 0 && fuzzyGreekMatch(name, normalizedSearch)
    );

    if (!matches) continue;

    // Extract primary email
    let email: string | null = null;
    const emails = data.emails as Array<{ email?: string }> | undefined;
    if (emails && emails.length > 0) {
      email = (emails[0].email as string) ?? null;
    } else if (data.email) {
      email = data.email as string;
    }

    // Extract primary phone
    let phone: string | null = null;
    const phones = data.phones as Array<{ phone?: string; number?: string }> | undefined;
    if (phones && phones.length > 0) {
      phone = (phones[0].phone ?? phones[0].number ?? null) as string | null;
    } else if (data.phone) {
      phone = data.phone as string;
    }

    results.push({
      contactId: doc.id,
      name: displayName || fullName || companyName || 'Χωρίς όνομα',
      email,
      phone,
      company: companyName || null,
      type: (data.type as string) ?? (data.contactType as string) ?? null,
    });

    if (results.length >= limit) break;
  }

  logger.debug('Contact search by name', {
    searchTerm: normalizedSearch,
    companyId,
    resultsFound: results.length,
  });

  return results;
}

// ============================================================================
// LIST CONTACTS BY TYPE (ADR-145: Super Admin AI Assistant)
// ============================================================================

export type ContactTypeFilter = 'individual' | 'company' | 'all';

/**
 * List all contacts for a company, optionally filtered by type.
 *
 * Used when admin asks "ποιες είναι οι επαφές φυσικών προσώπων" (no specific name).
 *
 * @param companyId - Tenant isolation
 * @param typeFilter - 'individual' | 'company' | 'all'
 * @param limit - Maximum results (default: 20)
 */
export async function listContacts(
  companyId: string,
  typeFilter: ContactTypeFilter = 'all',
  limit: number = 20
): Promise<ContactNameSearchResult[]> {
  const adminDb = getAdminFirestore();

  const snapshot = await adminDb
    .collection(COLLECTIONS.CONTACTS)
    .where('companyId', '==', companyId)
    .limit(200)
    .get();

  if (snapshot.empty) return [];

  const results: ContactNameSearchResult[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const type = ((data.type ?? data.contactType ?? '') as string).toLowerCase();

    // Apply type filter
    if (typeFilter === 'individual') {
      if (type === 'company' || type === 'εταιρεία' || type === 'εταιρία') continue;
    } else if (typeFilter === 'company') {
      if (type !== 'company' && type !== 'εταιρεία' && type !== 'εταιρία') continue;
    }

    const displayName = (data.displayName as string) ?? '';
    const firstName = (data.firstName as string) ?? '';
    const lastName = (data.lastName as string) ?? '';
    const companyName = (data.companyName as string) ?? '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    // Extract primary email
    let email: string | null = null;
    const emails = data.emails as Array<{ email?: string }> | undefined;
    if (emails && emails.length > 0) {
      email = (emails[0].email as string) ?? null;
    } else if (data.email) {
      email = data.email as string;
    }

    // Extract primary phone
    let phone: string | null = null;
    const phones = data.phones as Array<{ phone?: string; number?: string }> | undefined;
    if (phones && phones.length > 0) {
      phone = (phones[0].phone ?? phones[0].number ?? null) as string | null;
    } else if (data.phone) {
      phone = data.phone as string;
    }

    results.push({
      contactId: doc.id,
      name: displayName || fullName || companyName || 'Χωρίς όνομα',
      email,
      phone,
      company: companyName || null,
      type: (data.type as string) ?? (data.contactType as string) ?? null,
    });

    if (results.length >= limit) break;
  }

  logger.debug('Contact list by type', {
    companyId,
    typeFilter,
    resultsFound: results.length,
  });

  return results;
}

// ============================================================================
// GET CONTACT BY ID (ADR-145: UC-016)
// ============================================================================

/**
 * Fetch a single contact by Firestore document ID.
 *
 * @param contactId - Firestore document ID
 * @returns ContactNameSearchResult or null if not found
 */
export async function getContactById(
  contactId: string
): Promise<ContactNameSearchResult | null> {
  const adminDb = getAdminFirestore();

  try {
    const docRef = adminDb.collection(COLLECTIONS.CONTACTS).doc(contactId);
    const snap = await docRef.get();

    if (!snap.exists) return null;

    const data = snap.data()!;

    const displayName = (data.displayName as string) ?? '';
    const firstName = (data.firstName as string) ?? '';
    const lastName = (data.lastName as string) ?? '';
    const companyName = (data.companyName as string) ?? '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    // Extract primary email
    let email: string | null = null;
    const emails = data.emails as Array<{ email?: string }> | undefined;
    if (emails && emails.length > 0) {
      email = (emails[0].email as string) ?? null;
    } else if (data.email) {
      email = data.email as string;
    }

    // Extract primary phone
    let phone: string | null = null;
    const phones = data.phones as Array<{ phone?: string; number?: string }> | undefined;
    if (phones && phones.length > 0) {
      phone = (phones[0].phone ?? phones[0].number ?? null) as string | null;
    } else if (data.phone) {
      phone = data.phone as string;
    }

    return {
      contactId: snap.id,
      name: displayName || fullName || companyName || 'Χωρίς όνομα',
      email,
      phone,
      company: companyName || null,
      type: (data.type as string) ?? (data.contactType as string) ?? null,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn('getContactById failed', { contactId, error: msg });
    return null;
  }
}

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
 *
 * @param contactId - Firestore document ID
 * @param field - Canonical field name (e.g., 'phone', 'vatNumber', 'profession')
 * @param value - The value to set/add
 * @param updatedBy - Admin display name for audit trail
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
    // Scalar field — direct set
    updateData[field] = value;
  }

  await docRef.update(updateData);

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
 *
 * @param contactId - Firestore document ID
 * @param field - Canonical field name (e.g., 'phone', 'email', 'vatNumber')
 * @param updatedBy - Admin display name for audit trail
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
    // Clear the array entirely
    if (field === 'phone') {
      updateData['phones'] = [];
    } else if (field === 'email') {
      updateData['emails'] = [];
    }
  } else {
    // Clear scalar field
    updateData[field] = null;
  }

  await docRef.update(updateData);

  logger.info('Contact field removed', {
    contactId,
    field,
    isArray,
    updatedBy,
  });
}

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
    // Company-specific fields
    if (!data.registrationNumber) missing.push('Αριθμός ΓΕΜΗ');
    if (!data.legalForm) missing.push('Νομική μορφή');
    if (!data.taxOffice) missing.push('ΔΟΥ');
  }

  return missing;
}

// ============================================================================
// CREATE CONTACT SERVER-SIDE (ADR-145: UC-015)
// ============================================================================

/** Parameters for creating a contact via Admin SDK */
export interface CreateContactParams {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  type: 'individual' | 'company';
  companyId: string;
  companyName?: string;
  createdBy: string; // admin display name
}

/** Result of a successful contact creation */
export interface CreateContactResult {
  contactId: string;
  displayName: string;
}

/**
 * Server-side contact creation using Admin SDK.
 *
 * Steps:
 * 1. Duplicate check by email (if provided)
 * 2. Build Firestore document following contact schema (contracts.ts)
 * 3. Write to Firestore contacts collection
 *
 * CRITICAL: Every optional field uses `?? null` — Firestore rejects undefined.
 *
 * @param params Contact creation parameters
 * @returns Created contact ID and display name
 * @throws Error if duplicate found or Firestore write fails
 *
 * @see ADR-145 (Super Admin AI Assistant — UC-015)
 */
export async function createContactServerSide(
  params: CreateContactParams
): Promise<CreateContactResult> {
  const adminDb = getAdminFirestore();

  // ── Step 1: Duplicate check by email ──
  if (params.email) {
    const existing = await findContactByEmail(params.email, params.companyId);
    if (existing) {
      throw new Error(
        `DUPLICATE_CONTACT: Υπάρχει ήδη επαφή "${existing.name}" με email ${params.email} (ID: ${existing.contactId})`
      );
    }
  }

  // ── Step 2: Build display name ──
  const displayName = params.type === 'company'
    ? params.companyName ?? `${params.firstName} ${params.lastName}`.trim()
    : `${params.firstName} ${params.lastName}`.trim();

  // ── Step 3: Build Firestore document ──
  const contactDoc: Record<string, unknown> = {
    // Core identity
    type: params.type,
    status: 'active',
    isFavorite: false,

    // Name fields
    displayName,
    firstName: params.firstName ?? null,
    lastName: params.lastName ?? null,
    ...(params.type === 'company' && params.companyName
      ? { companyName: params.companyName }
      : {}),

    // Contact arrays (enterprise pattern: arrays with typed entries)
    emails: params.email
      ? [{ email: params.email, type: 'work', isPrimary: true }]
      : [],
    phones: params.phone
      ? [{ number: params.phone, type: 'mobile', isPrimary: true }]
      : [],
    addresses: [],

    // Tenant isolation
    companyId: params.companyId,

    // Audit trail
    createdBy: params.createdBy,
    lastModifiedBy: params.createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),

    // Optional fields — explicit null (NOT undefined)
    tags: null,
    notes: null,
    customFields: null,
    photoURL: null,
    vatNumber: null,
    taxOffice: null,
    profession: null,
  };

  // ── Step 4: Write to Firestore ──
  const docRef = await adminDb
    .collection(COLLECTIONS.CONTACTS)
    .add(contactDoc);

  logger.info('Contact created via Admin SDK', {
    contactId: docRef.id,
    displayName,
    type: params.type,
    companyId: params.companyId,
    createdBy: params.createdBy,
  });

  return {
    contactId: docRef.id,
    displayName,
  };
}
