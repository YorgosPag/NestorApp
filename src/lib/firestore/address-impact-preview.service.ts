/**
 * 📍 ADDRESS IMPACT PREVIEW — Read-only dependency check
 *
 * Counts downstream records that reference a contact, to warn users
 * before they change a company headquarters address.
 *
 * Checks:
 * - Properties where contact is an owner (live reference)
 * - Payment plans linked to the contact (live reference)
 * - Accounting invoices with this customer (snapshot — informational)
 * - APY certificates with this customer (snapshot — informational)
 *
 * @module lib/firestore/address-impact-preview
 * @enterprise ADR-277 — Address Impact Guard
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('AddressImpactPreview');

// ============================================================================
// TYPES
// ============================================================================

export interface AddressImpactPreview {
  /** Live references only (properties + paymentPlans) — drives dialog visibility */
  readonly totalAffected: number;
  /** Properties where contact is owner */
  readonly properties: number;
  /** Payment plans linked to contact */
  readonly paymentPlans: number;
  /** Invoices with customer snapshot (informational — frozen at creation) */
  readonly invoices: number;
  /** APY certificates with customer snapshot (informational — frozen at creation) */
  readonly apyCertificates: number;
}

// ============================================================================
// PREVIEW (DRY-RUN) — Counts only, no writes
// ============================================================================

/**
 * Preview how many records reference this contact (for address change warning).
 * Read-only — no Firestore writes.
 */
export async function previewAddressImpact(
  contactId: string
): Promise<AddressImpactPreview> {
  const db = getAdminFirestore();

  try {
    // --- Live references ---
    const propertiesSnapshot = await db
      .collection(COLLECTIONS.PROPERTIES)
      .where('commercial.ownerContactIds', 'array-contains', contactId)
      .select()
      .get();

    const properties = propertiesSnapshot.size;
    let paymentPlans = 0;

    for (const unitDoc of propertiesSnapshot.docs) {
      const plansSnapshot = await db
        .collection(COLLECTIONS.PROPERTIES)
        .doc(unitDoc.id)
        .collection('payment_plans')
        .where('ownerContactId', '==', contactId)
        .select()
        .get();

      paymentPlans += plansSnapshot.size;
    }

    // --- Snapshot references (informational) ---
    const invoicesSnapshot = await db
      .collection(COLLECTIONS.ACCOUNTING_INVOICES)
      .where('customer.contactId', '==', contactId)
      .select()
      .get();

    const apyCertificatesSnapshot = await db
      .collection(COLLECTIONS.ACCOUNTING_APY_CERTIFICATES)
      .where('customerId', '==', contactId)
      .select()
      .get();

    const invoices = invoicesSnapshot.size;
    const apyCertificates = apyCertificatesSnapshot.size;

    return {
      totalAffected: properties + paymentPlans,
      properties,
      paymentPlans,
      invoices,
      apyCertificates,
    };
  } catch (error) {
    logger.warn('Address impact preview failed:', error);
    return { totalAffected: 0, properties: 0, paymentPlans: 0, invoices: 0, apyCertificates: 0 };
  }
}
