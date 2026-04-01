/**
 * 🏢 COMPANY IDENTITY IMPACT PREVIEW — Read-only dependency check
 *
 * Counts downstream records that reference a contact, to warn users
 * before they change company identity fields (companyName, vatNumber,
 * gemiNumber, taxOffice, legalForm, tradeName, gemiStatus).
 *
 * Checks:
 * - Projects linked to this company (live reference)
 * - Properties where contact is an owner (live reference)
 * - Obligations referencing this contact (live reference)
 * - Accounting invoices with this customer (snapshot — informational)
 * - APY certificates with this customer (snapshot — informational)
 *
 * @module lib/firestore/company-identity-impact-preview
 * @enterprise ADR-278 — Company Identity Field Guard
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CompanyIdentityImpactPreview');

// ============================================================================
// TYPES
// ============================================================================

export interface CompanyIdentityImpactPreview {
  /** Live references only (projects + properties + obligations) — drives dialog visibility */
  readonly totalAffected: number;
  /** Projects linked to this company contact */
  readonly projects: number;
  /** Properties where contact is owner */
  readonly properties: number;
  /** Obligations referencing this contact */
  readonly obligations: number;
  /** Invoices with customer snapshot (informational — frozen at creation) */
  readonly invoices: number;
  /** APY certificates with customer snapshot (informational — frozen at creation) */
  readonly apyCertificates: number;
}

// ============================================================================
// PREVIEW (DRY-RUN) — Counts only, no writes
// ============================================================================

/**
 * Preview how many records reference this contact (for identity field change warning).
 * Read-only — no Firestore writes.
 */
export async function previewCompanyIdentityImpact(
  contactId: string
): Promise<CompanyIdentityImpactPreview> {
  const db = getAdminFirestore();

  try {
    // Run all 5 queries in parallel for performance
    const [
      projectsSnapshot,
      propertiesSnapshot,
      obligationsSnapshot,
      invoicesSnapshot,
      apyCertificatesSnapshot,
    ] = await Promise.all([
      // --- Live references ---
      db.collection(COLLECTIONS.PROJECTS)
        .where('linkedCompanyId', '==', contactId)
        .select()
        .get(),

      db.collection(COLLECTIONS.PROPERTIES)
        .where('commercial.ownerContactIds', 'array-contains', contactId)
        .select()
        .get(),

      db.collection(COLLECTIONS.OBLIGATIONS)
        .where('companyId', '==', contactId)
        .select()
        .get(),

      // --- Snapshot references (informational) ---
      db.collection(COLLECTIONS.ACCOUNTING_INVOICES)
        .where('customer.contactId', '==', contactId)
        .select()
        .get(),

      db.collection(COLLECTIONS.ACCOUNTING_APY_CERTIFICATES)
        .where('customerId', '==', contactId)
        .select()
        .get(),
    ]);

    const projects = projectsSnapshot.size;
    const properties = propertiesSnapshot.size;
    const obligations = obligationsSnapshot.size;
    const invoices = invoicesSnapshot.size;
    const apyCertificates = apyCertificatesSnapshot.size;

    return {
      totalAffected: projects + properties + obligations,
      projects,
      properties,
      obligations,
      invoices,
      apyCertificates,
    };
  } catch (error) {
    logger.warn('Company identity impact preview failed:', error);
    return {
      totalAffected: 0,
      projects: 0,
      properties: 0,
      obligations: 0,
      invoices: 0,
      apyCertificates: 0,
    };
  }
}
