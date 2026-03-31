/**
 * Property-level contact link helpers (SPEC-257A)
 *
 * Handles creation, reactivation, and deactivation of contact_links
 * documents when a property is reserved, sold, or the transaction is cancelled.
 *
 * @module api/properties/[id]/property-contact-links
 * @see ADR-244 (owners[] SSoT)
 * @see ADR-032 (Contact Links)
 */

import { FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { generateContactLinkId } from '@/lib/contact-link-id';
import { createDefaultPersonaData, findActivePersona } from '@/types/contacts/personas';
import type { PersonaData, ClientPersona } from '@/types/contacts/personas';
import type { PropertyOwnerRole } from '@/types/ownership-table';

const logger = createModuleLogger('PropertyContactLinks');

// ============================================================================
// mapOwnerRoleToLinkRole
// ============================================================================

/**
 * Map PropertyOwnerRole (ADR-244) to contact_link role (ADR-032).
 */
export function mapOwnerRoleToLinkRole(ownerRole: PropertyOwnerRole): string {
  switch (ownerRole) {
    case 'buyer':
    case 'co_buyer':
      return 'buyer';
    case 'landowner':
      return 'owner';
    default:
      return 'buyer';
  }
}

// ============================================================================
// upsertPropertyContactLink
// ============================================================================

/**
 * Upsert a single property-level contact link.
 * Idempotent: active link → skip, inactive → reactivate, missing → create.
 */
export async function upsertPropertyContactLink(
  db: FirebaseFirestore.Firestore,
  contactId: string,
  propertyId: string,
  role: string,
  companyId: string,
  userId: string,
): Promise<void> {
  const linkId = generateContactLinkId(contactId, 'property', propertyId, role);
  const linkRef = db.collection(COLLECTIONS.CONTACT_LINKS).doc(linkId);
  const existing = await linkRef.get();

  if (existing.exists) {
    const data = existing.data();
    if (data?.status === 'active') return; // idempotent — already linked
    // Reactivate inactive link
    await linkRef.update({
      status: 'active',
      updatedBy: userId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info('Reactivated property contact link', { linkId });
    return;
  }

  // Create new link
  await linkRef.set({
    id: linkId,
    sourceWorkspaceId: companyId,
    sourceContactId: contactId,
    targetEntityType: 'property',
    targetEntityId: propertyId,
    role,
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    createdBy: userId,
    reason: 'Auto-created on reservation/sale',
  });
  logger.info('Created property contact link', { linkId, contactId, propertyId, role });
}

// ============================================================================
// autoCreatePropertyContactLinks
// ============================================================================

/**
 * Auto-create property-level contact links for buyer + co-buyers.
 * Fire-and-forget — called after successful reservation/sale.
 */
export async function autoCreatePropertyContactLinks(
  db: FirebaseFirestore.Firestore,
  propertyId: string,
  owners: ReadonlyArray<{ contactId: string; role: PropertyOwnerRole }>,
  companyId: string,
  userId: string,
): Promise<void> {
  // ADR-244: Iterate all owners — roles mapped to link roles
  for (const owner of owners) {
    const linkRole = mapOwnerRoleToLinkRole(owner.role);
    await upsertPropertyContactLink(db, owner.contactId, propertyId, linkRole, companyId, userId);
  }
}

// ============================================================================
// deactivatePropertyContactLinks
// ============================================================================

/**
 * Deactivate all active property-level contact links for a property.
 * Called when a reservation/sale is cancelled (soft delete — audit trail).
 */
export async function deactivatePropertyContactLinks(
  db: FirebaseFirestore.Firestore,
  propertyId: string,
  userId: string,
): Promise<void> {
  const linksSnap = await db.collection(COLLECTIONS.CONTACT_LINKS)
    .where('targetEntityType', '==', 'unit')
    .where('targetEntityId', '==', propertyId)
    .where('status', '==', 'active')
    .get();

  if (linksSnap.empty) return;

  const batch = db.batch();
  for (const linkDoc of linksSnap.docs) {
    batch.update(linkDoc.ref, {
      status: 'inactive',
      updatedBy: userId,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  logger.info('Deactivated property contact links on cancellation', {
    propertyId,
    count: linksSnap.size,
  });
}

// ============================================================================
// activateClientPersona
// ============================================================================

/**
 * Activate "client" persona on a contact if not already active.
 * Fire-and-forget — errors are logged but never block the response.
 */
export async function activateClientPersona(
  db: FirebaseFirestore.Firestore,
  contactId: string,
): Promise<void> {
  const contactRef = db.collection(COLLECTIONS.CONTACTS).doc(contactId);
  const contactDoc = await contactRef.get();

  if (!contactDoc.exists) {
    logger.warn('activateClientPersona: contact not found', { contactId });
    return;
  }

  const contactData = contactDoc.data() as { personas?: PersonaData[] };
  const personas = contactData.personas ?? [];

  // Already has active client persona — skip
  const existingClient = findActivePersona<ClientPersona>(personas, 'client');
  if (existingClient) return;

  // Create new client persona with clientSince = today
  const newPersona = createDefaultPersonaData('client') as ClientPersona;
  newPersona.clientSince = new Date().toISOString();

  await contactRef.update({
    personas: [...personas, newPersona],
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info('Client persona auto-activated', { contactId });
}
