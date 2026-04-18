/**
 * =============================================================================
 * 🏢 ENTERPRISE: CONTACT SEARCH & LOOKUP
 * =============================================================================
 *
 * Search functions for finding contacts by email, phone, name.
 * Multi-criteria duplicate detection. Listing with type filtering.
 *
 * @module services/ai-pipeline/shared/contact-lookup-search
 * @see contact-lookup.ts (barrel re-exports)
 * @see ADR-080, ADR-145
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { fuzzyGreekMatch } from './greek-text-utils';
import { getErrorMessage } from '@/lib/error-utils';

import type {
  ContactMatch,
  ContactNameSearchResult,
  DuplicateMatch,
  DuplicateCheckResult,
  ContactTypeFilter,
} from './contact-lookup-types';

const logger = createModuleLogger('PIPELINE_CONTACT_LOOKUP');

// ============================================================================
// PHONE NORMALIZATION
// ============================================================================

/**
 * Normalize phone number for comparison.
 * Strips whitespace, dashes, dots, parentheses, and Greek country code (+30 / 0030).
 */
function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[\s\-.()]/g, '');
  if (normalized.startsWith('+30')) normalized = normalized.slice(3);
  if (normalized.startsWith('0030')) normalized = normalized.slice(4);
  return normalized;
}

// ============================================================================
// HELPER: Extract contact display fields from Firestore doc data
// ============================================================================

function extractContactFields(data: FirebaseFirestore.DocumentData, docId: string): ContactNameSearchResult {
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
    contactId: docId,
    name: displayName || fullName || companyName || 'Χωρίς όνομα',
    email,
    phone,
    company: companyName || null,
    type: (data.type as string) ?? (data.contactType as string) ?? null,
  };
}

// ============================================================================
// CONTACT LOOKUP BY EMAIL
// ============================================================================

/**
 * Server-side contact lookup by email using Admin SDK.
 *
 * Searches the contacts collection for a matching email address.
 * Checks both the `emails` array field and the flat `email` field.
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
    .where(FIELDS.COMPANY_ID, '==', companyId)
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
// CONTACT LOOKUP BY PHONE
// ============================================================================

/**
 * Server-side contact lookup by phone number using Admin SDK.
 *
 * @param phone - Phone number to search for
 * @param companyId - Tenant isolation (company ID)
 * @returns ContactNameSearchResult if found, null otherwise
 */
export async function findContactByPhone(
  phone: string,
  companyId: string
): Promise<ContactNameSearchResult | null> {
  const adminDb = getAdminFirestore();

  const snapshot = await adminDb
    .collection(COLLECTIONS.CONTACTS)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .limit(50)
    .get();

  const normalizedTarget = normalizePhone(phone);

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Check phones array (pattern: [{ number: "...", type: "mobile" }])
    const phones = data.phones as Array<{ phone?: string; number?: string }> | undefined;
    const phoneMatch = phones?.some(p => {
      const val = p.number ?? p.phone ?? '';
      return normalizePhone(val) === normalizedTarget;
    });

    // Check flat phone field
    const flatPhone = data.phone as string | undefined;
    const flatMatch = flatPhone ? normalizePhone(flatPhone) === normalizedTarget : false;

    if (phoneMatch || flatMatch) {
      return extractContactFields(data, doc.id);
    }
  }

  logger.debug('Contact not found by phone', { phone: normalizedTarget, companyId });
  return null;
}

// ============================================================================
// CONTACT SEARCH BY NAME (ADR-145)
// ============================================================================

/**
 * Server-side contact search by name using Admin SDK.
 * Fuzzy matching with Greek text support.
 *
 * @param searchTerm - Name to search for (partial match supported)
 * @param companyId - Tenant isolation (company ID)
 * @param limit - Maximum results to return (default: 10)
 */
export async function findContactByName(
  searchTerm: string,
  companyId: string,
  limit: number = 10
): Promise<ContactNameSearchResult[]> {
  const adminDb = getAdminFirestore();

  const snapshot = await adminDb
    .collection(COLLECTIONS.CONTACTS)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .limit(200)
    .get();

  if (snapshot.empty) return [];

  const normalizedSearch = searchTerm.toLowerCase().trim();
  const results: ContactNameSearchResult[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();

    const displayName = (data.displayName as string) ?? '';
    const firstName = (data.firstName as string) ?? '';
    const lastName = (data.lastName as string) ?? '';
    const companyName = (data.companyName as string) ?? '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    const namesToCheck = [displayName, firstName, lastName, companyName, fullName];
    const matches = namesToCheck.some(name =>
      name.length > 0 && fuzzyGreekMatch(name, normalizedSearch)
    );

    if (!matches) continue;

    results.push(extractContactFields(data, doc.id));
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
// LIST CONTACTS BY TYPE (ADR-145)
// ============================================================================

/**
 * List all contacts for a company, optionally filtered by type.
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
    .where(FIELDS.COMPANY_ID, '==', companyId)
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

    results.push(extractContactFields(data, doc.id));
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
 */
export async function getContactById(
  contactId: string
): Promise<ContactNameSearchResult | null> {
  const adminDb = getAdminFirestore();

  try {
    const docRef = adminDb.collection(COLLECTIONS.CONTACTS).doc(contactId);
    const snap = await docRef.get();

    if (!snap.exists) return null;

    return extractContactFields(snap.data()!, snap.id);
  } catch (error) {
    const msg = getErrorMessage(error);
    logger.warn('getContactById failed', { contactId, error: msg });
    return null;
  }
}

// ============================================================================
// MULTI-CRITERIA DUPLICATE CHECK (Google-level detection)
// ============================================================================

/**
 * Check for duplicate contacts across 3 criteria: email, phone, name.
 *
 * Priority order:
 * 1. Email exact match → 100% duplicate
 * 2. Phone exact match → high confidence duplicate
 * 3. Name fuzzy match → possible duplicate (asks user)
 */
export async function checkContactDuplicates(
  params: { email: string | null; phone: string | null; firstName: string; lastName: string; companyName?: string },
  companyId: string
): Promise<DuplicateCheckResult> {
  const matches: DuplicateMatch[] = [];

  // ── Check 1: Email exact match ──
  if (params.email) {
    const emailMatch = await findContactByEmail(params.email, companyId);
    if (emailMatch) {
      matches.push({
        type: 'email',
        confidence: 'exact',
        contactId: emailMatch.contactId,
        name: emailMatch.name,
        email: params.email,
        phone: null,
      });
    }
  }

  // ── Check 2: Phone exact match ──
  if (params.phone) {
    const phoneMatch = await findContactByPhone(params.phone, companyId);
    if (phoneMatch) {
      const alreadyMatched = matches.some(m => m.contactId === phoneMatch.contactId);
      if (!alreadyMatched) {
        matches.push({
          type: 'phone',
          confidence: 'exact',
          contactId: phoneMatch.contactId,
          name: phoneMatch.name,
          email: phoneMatch.email,
          phone: phoneMatch.phone,
        });
      }
    }
  }

  // ── Check 3: Name fuzzy match (only when no email/phone match found) ──
  if (matches.length === 0) {
    const displayName = params.companyName
      ?? [params.firstName, params.lastName].filter(Boolean).join(' ');

    if (displayName.trim()) {
      const nameMatches = await findContactByName(displayName, companyId, 5);
      for (const nm of nameMatches) {
        matches.push({
          type: 'name',
          confidence: 'fuzzy',
          contactId: nm.contactId,
          name: nm.name,
          email: nm.email,
          phone: nm.phone,
        });
      }
    }
  }

  return {
    hasDuplicate: matches.length > 0,
    matches,
  };
}
