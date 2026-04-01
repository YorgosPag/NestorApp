import type { ContactRelationship } from '@/types/contacts/relationships';
import { FirestoreRelationshipAdapter } from '../adapters/FirestoreRelationshipAdapter';
import { RECIPROCAL_MAPPINGS } from './relationship-helpers';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('RelationshipReciprocalOps');

/**
 * Delete the reciprocal relationship (cascade on hard-delete).
 */
export async function deleteReciprocalRelationship(relationship: ContactRelationship): Promise<void> {
  const reciprocalType = RECIPROCAL_MAPPINGS[relationship.relationshipType];
  if (!reciprocalType) return;

  try {
    const reciprocal = await FirestoreRelationshipAdapter.getSpecificRelationship(
      relationship.targetContactId,
      relationship.sourceContactId,
      reciprocalType
    );

    if (reciprocal) {
      await FirestoreRelationshipAdapter.deleteRelationship(reciprocal.id);
      logger.info('Reciprocal relationship cascade-deleted:', reciprocal.id);
    }
  } catch (error) {
    logger.warn('Could not find/delete reciprocal:', error);
  }
}

/**
 * Terminate the reciprocal relationship (cascade on terminate).
 */
export async function terminateReciprocalRelationship(
  relationship: ContactRelationship,
  terminatedBy: string,
  terminationDate: string
): Promise<void> {
  const reciprocalType = RECIPROCAL_MAPPINGS[relationship.relationshipType];
  if (!reciprocalType) return;

  const reciprocal = await FirestoreRelationshipAdapter.getSpecificRelationship(
    relationship.targetContactId,
    relationship.sourceContactId,
    reciprocalType
  );

  if (!reciprocal || reciprocal.status === 'terminated') {
    return;
  }

  const reciprocalChangeEntry = {
    changeDate: new Date().toISOString(),
    changeType: 'status_change' as const,
    changedBy: terminatedBy,
    notes: 'Reciprocal relationship terminated automatically'
  };

  const reciprocalUpdates: Partial<ContactRelationship> = {
    status: 'terminated',
    endDate: reciprocal.endDate || terminationDate,
    updatedAt: new Date(),
    lastModifiedBy: terminatedBy,
    changeHistory: [...(reciprocal.changeHistory || []), reciprocalChangeEntry]
  };

  if (reciprocal.employmentStatus && reciprocal.employmentStatus !== 'terminated') {
    reciprocalUpdates.employmentStatus = 'terminated';
  }

  await FirestoreRelationshipAdapter.updateRelationship(reciprocal.id, reciprocalUpdates);
}
