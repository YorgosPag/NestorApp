/**
 * =============================================================================
 * PROFESSIONAL SNAPSHOT SERVICE (ADR-230: Contract Workflow)
 * =============================================================================
 *
 * Creates immutable snapshots of legal professionals linked to a unit.
 * Used during contract creation/signing.
 *
 * Reads live associations (contact_links) → fetches contact → persona → snapshot.
 *
 * @module services/professional-snapshot.service
 * @enterprise ADR-230 - Contract Workflow
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { listContactLinks } from './contact-link.service';
import type {
  ProfessionalSnapshot,
  LegalProfessionalRole,
  LawyerSnapshotData,
  NotarySnapshotData,
} from '@/types/legal-contracts';
import type { PersonaData } from '@/types/contacts/personas';
import {
  findActivePersona,
  isLawyerPersona,
  isNotaryPersona,
} from '@/types/contacts/personas';

const logger = createModuleLogger('ProfessionalSnapshotService');

/**
 * Creates immutable snapshots of legal professionals for a unit.
 *
 * @param propertyId - Property ID
 * @param roles - Which legal roles to snapshot (default: all legal roles)
 * @returns Array of ProfessionalSnapshot
 */
export async function snapshotProfessionals(
  propertyId: string,
  roles: LegalProfessionalRole[] = ['seller_lawyer', 'buyer_lawyer', 'notary']
): Promise<ProfessionalSnapshot[]> {
  try {
    // 1. Find active contact links for this unit with legal roles
    const links = await listContactLinks({
      targetEntityType: 'property',
      targetEntityId: propertyId,
      status: 'active',
    });

    const legalLinks = links.filter(
      (link) => link.role && (roles as string[]).includes(link.role)
    );

    if (legalLinks.length === 0) return [];

    // 2. Fetch contact data + create snapshot
    const snapshots: ProfessionalSnapshot[] = [];

    for (const link of legalLinks) {
      const contactRef = doc(db, COLLECTIONS.CONTACTS, link.sourceContactId);
      const contactSnap = await getDoc(contactRef);
      if (!contactSnap.exists()) continue;

      const contactData = contactSnap.data();
      const role = link.role as LegalProfessionalRole;
      const personas: PersonaData[] = contactData.personas ?? [];

      const roleSpecificData = buildRoleSpecificData(role, personas);

      snapshots.push({
        contactId: link.sourceContactId,
        displayName: [contactData.firstName, contactData.lastName].filter(Boolean).join(' ')
          || contactData.companyName || 'Unknown',
        role,
        phone: contactData.phone ?? null,
        email: contactData.email ?? null,
        taxId: contactData.taxId ?? null,
        roleSpecificData,
        snapshotAt: new Date().toISOString(),
      });
    }

    logger.info(`Snapshot ${snapshots.length} professionals for property ${propertyId}`);
    return snapshots;
  } catch (error) {
    logger.error('Failed to snapshot professionals:', error);
    return [];
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function buildRoleSpecificData(
  role: LegalProfessionalRole,
  personas: PersonaData[]
): LawyerSnapshotData | NotarySnapshotData {
  if (role === 'notary') {
    const notaryPersona = findActivePersona(personas, 'notary');
    return {
      type: 'notary',
      notaryRegistryNumber: (notaryPersona && isNotaryPersona(notaryPersona))
        ? notaryPersona.notaryRegistryNumber
        : null,
      notaryDistrict: (notaryPersona && isNotaryPersona(notaryPersona))
        ? notaryPersona.notaryDistrict
        : null,
    };
  }

  const lawyerPersona = findActivePersona(personas, 'lawyer');
  return {
    type: 'lawyer',
    barAssociationNumber: (lawyerPersona && isLawyerPersona(lawyerPersona))
      ? lawyerPersona.barAssociationNumber
      : null,
    barAssociation: (lawyerPersona && isLawyerPersona(lawyerPersona))
      ? lawyerPersona.barAssociation
      : null,
  };
}
