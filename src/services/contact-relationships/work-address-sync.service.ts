'use client';

import { ContactsService } from '@/services/contacts.service';
import {
  EMPLOYMENT_RELATIONSHIP_TYPES,
  OWNERSHIP_RELATIONSHIP_TYPES,
} from '@/types/contacts/relationships/core/relationship-types';
import type { RelationshipType, ContactRelationship } from '@/types/contacts/relationships';
import type { AddressInfo, Contact } from '@/types/contacts';
import type { IndividualAddress } from '@/types/ContactFormTypes';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('WorkAddressSyncService');

const WORK_ADDRESS_SYNC_TYPES = new Set<RelationshipType>([
  ...EMPLOYMENT_RELATIONSHIP_TYPES,
  ...OWNERSHIP_RELATIONSHIP_TYPES,
]);

function createEmptyHome(): IndividualAddress {
  return { type: 'home', street: '', number: '', postalCode: '', city: '' };
}

function mapAddressInfoToIndividualAddress(addr: AddressInfo): IndividualAddress {
  return {
    type: 'home',
    street: addr.street ?? '',
    number: addr.number ?? '',
    postalCode: addr.postalCode ?? '',
    city: addr.city ?? '',
    region: addr.region,
  };
}

function buildHomeEntry(indivContact: Contact): IndividualAddress {
  const homeAddr = indivContact.addresses?.find(a => a.type === 'home');
  return homeAddr ? mapAddressInfoToIndividualAddress(homeAddr) : createEmptyHome();
}

/**
 * After an employment/ownership relationship is saved, copies the company's
 * primary address into the individual contact's individualAddresses as type:'work'.
 * Upserts — existing work address is replaced, not duplicated.
 * Fire-and-forget safe: caller should .catch() errors independently.
 */
export async function syncWorkAddressOnRelationship(
  relationship: Partial<ContactRelationship>,
): Promise<void> {
  logger.info('SYNC START', { data: relationship });

  const { sourceContactId, targetContactId, relationshipType } = relationship;
  if (!sourceContactId || !targetContactId || !relationshipType) {
    logger.warn('SYNC ABORT: missing ids or type', { data: { sourceContactId, targetContactId, relationshipType } });
    return;
  }
  if (!WORK_ADDRESS_SYNC_TYPES.has(relationshipType as RelationshipType)) {
    logger.warn('SYNC ABORT: relationshipType not in sync set', { data: { relationshipType } });
    return;
  }

  const [source, target] = await Promise.all([
    ContactsService.getContact(sourceContactId),
    ContactsService.getContact(targetContactId),
  ]);
  if (!source || !target) {
    logger.warn('SYNC ABORT: contact not found', { data: { hasSource: !!source, hasTarget: !!target } });
    return;
  }

  let individualId: string;
  let companyAddresses: typeof source.addresses;

  if (source.type === 'individual' && (target.type === 'company' || target.type === 'service')) {
    individualId = sourceContactId;
    companyAddresses = target.addresses;
  } else if (target.type === 'individual' && (source.type === 'company' || source.type === 'service')) {
    individualId = targetContactId;
    companyAddresses = source.addresses;
  } else {
    logger.warn('SYNC ABORT: not individual+company/service pair', { data: { sourceType: source.type, targetType: target.type } });
    return;
  }

  logger.info('SYNC MATCHED pair', { data: { individualId, companyAddressesCount: companyAddresses?.length ?? 0, companyAddresses } });

  const primaryAddr = companyAddresses?.[0];
  if (!primaryAddr?.street && !primaryAddr?.city) {
    logger.warn('SYNC ABORT: company has no populated address[0]', { data: { primaryAddr } });
    return;
  }

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

  // Preserve [home, work, ...residue] invariant (ADR-318)
  const homeEntry = existing[0]?.type === 'home' ? existing[0] : buildHomeEntry(indivContact);
  const residue = existing.filter((a, i) => {
    if (i === 0 && a.type === 'home') return false;
    if (a.type === 'work') return false;
    return true;
  });
  const updated: IndividualAddress[] = [homeEntry, workAddress, ...residue];

  logger.info('SYNC WRITING', { data: { individualId, updatedCount: updated.length, updated } });

  await ContactsService.updateContact(
    individualId,
    { individualAddresses: updated } as unknown as Parameters<typeof ContactsService.updateContact>[1],
  );

  logger.info('SYNC SUCCESS: work address written to Firestore', {
    data: { individualId, companyId: source.type !== 'individual' ? sourceContactId : targetContactId },
  });
}
