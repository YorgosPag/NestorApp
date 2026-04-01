// ============================================================================
// RELATIONSHIP HELPERS — Reciprocal mappings & hierarchy helpers
// ============================================================================
//
// Extracted from RelationshipCRUDService for SRP compliance (<500 lines).
//
// ============================================================================

import {
  ContactRelationship,
  RelationshipType
} from '@/types/contacts/relationships';
import { Contact } from '@/types/contacts';
import { ContactsService } from '@/services/contacts.service';
import { FirestoreRelationshipAdapter } from '../adapters/FirestoreRelationshipAdapter';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('RelationshipHelpers');

// ============================================================================
// RECIPROCAL MAPPINGS (Data / Config — no logic)
// ============================================================================

/**
 * Defines which relationship types create automatic reciprocal relationships.
 * null = symmetric (visible from both sides) or no reciprocal needed.
 */
export const RECIPROCAL_MAPPINGS: Record<RelationshipType, RelationshipType | null> = {
  'employee': null,
  'manager': null,
  'director': null,
  'executive': null,
  'shareholder': null,
  'client': 'vendor',
  'vendor': 'client',
  'partner': null,
  'colleague': null,
  'mentor': 'protege',
  'protege': 'mentor',
  'civil_servant': null,
  'elected_official': null,
  'appointed_official': null,
  'department_head': null,
  'ministry_official': null,
  'mayor': null,
  'deputy_mayor': null,
  'regional_governor': null,
  'board_member': null,
  'chairman': null,
  'ceo': null,
  'representative': null,
  'intern': null,
  'contractor': null,
  'consultant': null,
  'advisor': null,
  'supplier': 'customer',
  'customer': 'supplier',
  'competitor': null,
  'friend': null,
  'family': null,
  'property_buyer': null,
  'property_co_buyer': null,
  'property_landowner': null,
  'other': null
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get contact by ID (with error handling)
 */
export async function getContactById(contactId: string): Promise<Contact | null> {
  try {
    return await ContactsService.getContact(contactId);
  } catch (error) {
    logger.error('❌ Error fetching contact:', error);
    return null;
  }
}

/**
 * Create reciprocal relationship if mapping exists
 */
export async function createReciprocalRelationship(
  relationship: ContactRelationship,
  createFn: (data: Partial<ContactRelationship>, options?: { skipReciprocal?: boolean }) => Promise<ContactRelationship>
): Promise<void> {
  const reciprocalType = RECIPROCAL_MAPPINGS[relationship.relationshipType];
  if (!reciprocalType) return;

  try {
    const existing = await FirestoreRelationshipAdapter.getSpecificRelationship(
      relationship.targetContactId,
      relationship.sourceContactId,
      reciprocalType
    );

    if (!existing) {
      await createFn({
        sourceContactId: relationship.targetContactId,
        targetContactId: relationship.sourceContactId,
        relationshipType: reciprocalType,
        status: relationship.status,
        startDate: relationship.startDate,
        createdBy: relationship.createdBy,
        lastModifiedBy: relationship.lastModifiedBy
      }, { skipReciprocal: true });
    }
  } catch (error) {
    logger.warn('⚠️ Error creating reciprocal relationship:', error);
  }
}

/**
 * Update organizational hierarchy (placeholder)
 */
export async function updateOrganizationalHierarchy(relationship: ContactRelationship): Promise<void> {
  logger.info('📊 Starting organizational hierarchy update for relationship', relationship.id);

  return new Promise((resolve) => {
    setTimeout(() => {
      logger.info('✅ Organizational hierarchy update completed (placeholder)');
      resolve();
    }, 10);
  });
}
