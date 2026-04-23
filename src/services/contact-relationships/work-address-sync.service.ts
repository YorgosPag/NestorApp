'use client';

import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { ContactsService } from '@/services/contacts.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import {
  EMPLOYMENT_RELATIONSHIP_TYPES,
  OWNERSHIP_RELATIONSHIP_TYPES,
} from '@/types/contacts/relationships/core/relationship-types';
import type { RelationshipType, ContactRelationship } from '@/types/contacts/relationships';
import type { IndividualAddress } from '@/types/ContactFormTypes';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('WorkAddressSyncService');

const WORK_ADDRESS_SYNC_TYPES = new Set<RelationshipType>([
  ...EMPLOYMENT_RELATIONSHIP_TYPES,
  ...OWNERSHIP_RELATIONSHIP_TYPES,
]);

/**
 * After an employment/ownership relationship is saved, copies the company's
 * primary address into the individual contact's individualAddresses as type:'work'.
 * Upserts — existing work address is replaced, not duplicated.
 * Fire-and-forget safe: caller should .catch() errors independently.
 */
export async function syncWorkAddressOnRelationship(
  relationship: Partial<ContactRelationship>,
): Promise<void> {
  const { sourceContactId, targetContactId, relationshipType } = relationship;
  if (!sourceContactId || !targetContactId || !relationshipType) return;
  if (!WORK_ADDRESS_SYNC_TYPES.has(relationshipType as RelationshipType)) return;

  const [source, target] = await Promise.all([
    ContactsService.getContact(sourceContactId),
    ContactsService.getContact(targetContactId),
  ]);
  if (!source || !target) return;

  let individualId: string;
  let companyAddresses: typeof source.addresses;

  if (source.type === 'individual' && (target.type === 'company' || target.type === 'service')) {
    individualId = sourceContactId;
    companyAddresses = target.addresses;
  } else if (target.type === 'individual' && (source.type === 'company' || source.type === 'service')) {
    individualId = targetContactId;
    companyAddresses = source.addresses;
  } else {
    return;
  }

  const primaryAddr = companyAddresses?.[0];
  if (!primaryAddr?.street && !primaryAddr?.city) return;

  const workAddress: IndividualAddress = {
    type: 'work',
    street: primaryAddr.street ?? '',
    number: primaryAddr.number ?? '',
    postalCode: primaryAddr.postalCode ?? '',
    city: primaryAddr.city ?? '',
    region: primaryAddr.region,
  };

  const indivContact = source.type === 'individual' ? source : target;
  const existing = ((indivContact as unknown as Record<string, unknown>).individualAddresses as IndividualAddress[] | undefined) ?? [];

  const workIdx = existing.findIndex(a => a.type === 'work');
  const updated: IndividualAddress[] = workIdx >= 0
    ? existing.map((a, i) => (i === workIdx ? workAddress : a))
    : [...existing, workAddress];

  await updateDoc(
    doc(db, COLLECTIONS.CONTACTS, individualId),
    { individualAddresses: updated },
  );

  const companyId = (indivContact as unknown as Record<string, unknown>).companyId as string | undefined;
  const currentUser = auth.currentUser;

  EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.CONTACT,
    entityId: individualId,
    entityName: null,
    action: 'update',
    changes: [{ field: 'individualAddresses', oldValue: null, newValue: 'work address synced from relationship' }],
    performedBy: currentUser?.uid ?? 'system',
    performedByName: currentUser?.displayName ?? currentUser?.email ?? null,
    companyId: companyId ?? '',
  }).catch(err => logger.warn('Audit record failed (non-critical)', { error: err }));

  logger.info('Work address synced from company to individual', {
    data: { individualId, companyId: source.type !== 'individual' ? sourceContactId : targetContactId },
  });
}
