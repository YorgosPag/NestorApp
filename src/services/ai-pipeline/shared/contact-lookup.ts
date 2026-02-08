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
