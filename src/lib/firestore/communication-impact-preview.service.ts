/**
 * 📧 COMMUNICATION IMPACT PREVIEW — Read-only dependency check
 *
 * Counts downstream records that reference a contact, to warn users
 * before they change primary communication fields (email, phone, website).
 *
 * Checks:
 * - Properties where contact is an owner (live reference)
 * - Payment plans referencing this contact (live reference)
 * - Projects linked to this company (live reference)
 * - Accounting invoices with this customer (snapshot — informational)
 * - APY certificates with this customer (snapshot — informational)
 *
 * @module lib/firestore/communication-impact-preview
 * @enterprise ADR-280 — Communication Field Impact Detection
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CommunicationImpactPreview');

// ============================================================================
// TYPES
// ============================================================================

export interface CommunicationImpactPreview {
  /** Live references only (properties + paymentPlans + projects) — drives dialog visibility */
  readonly totalAffected: number;
  /** Properties where contact is owner */
  readonly properties: number;
  /** Payment plans referencing this contact (subcollection aggregation) */
  readonly paymentPlans: number;
  /** Projects linked to this company contact */
  readonly projects: number;
  /** Invoices with customer snapshot (informational — frozen at creation) */
  readonly invoices: number;
  /** APY certificates with customer snapshot (informational — frozen at creation) */
  readonly apyCertificates: number;
}

// ============================================================================
// PREVIEW (DRY-RUN) — Counts only, no writes
// ============================================================================

/**
 * Preview how many records reference this contact (for communication change warning).
 * Read-only — no Firestore writes.
 */
export async function previewCommunicationImpact(
  contactId: string
): Promise<CommunicationImpactPreview> {
  const db = getAdminFirestore();

  try {
    // --- Step 1: Run top-level queries in parallel ---
    const [
      propertiesSnapshot,
      projectsSnapshot,
      invoicesSnapshot,
      apyCertificatesSnapshot,
    ] = await Promise.all([
      db.collection(COLLECTIONS.PROPERTIES)
        .where('commercial.ownerContactIds', 'array-contains', contactId)
        .select()
        .get(),

      db.collection(COLLECTIONS.PROJECTS)
        .where('linkedCompanyId', '==', contactId)
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

    const properties = propertiesSnapshot.size;
    const projects = projectsSnapshot.size;
    const invoices = invoicesSnapshot.size;
    const apyCertificates = apyCertificatesSnapshot.size;

    // --- Step 2: Count payment plans in property subcollections ---
    let paymentPlans = 0;
    if (properties > 0) {
      const ppQueries = propertiesSnapshot.docs.map((propDoc) =>
        db.collection(COLLECTIONS.PROPERTIES)
          .doc(propDoc.id)
          .collection(COLLECTIONS.PROPERTY_PAYMENT_PLANS)
          .where('ownerContactId', '==', contactId)
          .select()
          .get()
      );
      const ppSnapshots = await Promise.all(ppQueries);
      paymentPlans = ppSnapshots.reduce((sum, snap) => sum + snap.size, 0);
    }

    return {
      totalAffected: properties + paymentPlans + projects,
      properties,
      paymentPlans,
      projects,
      invoices,
      apyCertificates,
    };
  } catch (error) {
    logger.warn('Communication impact preview failed:', error);
    return {
      totalAffected: 0,
      properties: 0,
      paymentPlans: 0,
      projects: 0,
      invoices: 0,
      apyCertificates: 0,
    };
  }
}
