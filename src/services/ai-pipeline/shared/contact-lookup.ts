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
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';

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

    // Check if any name field contains the search term
    const namesToCheck = [displayName, firstName, lastName, companyName, fullName];
    const matches = namesToCheck.some(name =>
      name.toLowerCase().includes(normalizedSearch)
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
