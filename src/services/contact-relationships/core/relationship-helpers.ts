// ============================================================================
// RELATIONSHIP HELPERS — contact lookup & hierarchy helpers
// ============================================================================
//
// Extracted from RelationshipCRUDService for SRP compliance (<500 lines).
//
// ============================================================================

import type { ContactRelationship } from '@/types/contacts/relationships';
import { Contact } from '@/types/contacts';
import { ContactsService } from '@/services/contacts.service';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('RelationshipHelpers');

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
