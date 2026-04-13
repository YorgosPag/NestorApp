/**
 * 🛡️ PROPERTY COVERAGE RECALCULATOR — Ready-to-Integrate Utility (ADR-249 P2-1)
 *
 * Recalculates property boolean coverage flags (hasPhotos, hasFloorplans, hasDocuments)
 * after a file/photo/document is deleted from a storage collection.
 *
 * NOT integrated yet — will be activated when photo/floorplan/document DELETE
 * endpoints are created. Currently exists as a utility for future use.
 *
 * @module lib/firestore/property-coverage-recalculator
 * @enterprise ADR-249 SPEC-249C — Defense in Depth
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FieldValue } from 'firebase-admin/firestore';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('PropertyCoverageRecalculator');

// ============================================================================
// TYPES
// ============================================================================

/** Supported coverage flags on a property document */
type CoverageFlag = 'hasPhotos' | 'hasFloorplans' | 'hasDocuments';

/**
 * Maps a coverage flag to its corresponding storage collection.
 * ADR-292 Phase 4: hasFloorplans now checks `files` collection
 * (was `unit_floorplans` — legacy collection eliminated).
 */
const FLAG_TO_COLLECTION: Record<CoverageFlag, string> = {
  hasPhotos: 'unit_photos',
  hasFloorplans: 'files',
  hasDocuments: 'unit_documents',
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Recalculates a property's boolean coverage flag after a file deletion.
 *
 * Queries the corresponding storage collection to check if any remaining
 * files reference this property. Updates the property's flag accordingly.
 *
 * @param propertyId - The property document ID
 * @param flag - Which coverage flag to recalculate
 * @param storageCollection - Optional override for the storage collection name.
 *   If not provided, uses the default mapping from FLAG_TO_COLLECTION.
 *
 * @example
 * ```typescript
 * // After deleting a photo from unit_photos:
 * await recalculatePropertyCoverageFlag('prop_abc123', 'hasPhotos');
 * ```
 */
export async function recalculatePropertyCoverageFlag(
  propertyId: string,
  flag: CoverageFlag,
  storageCollection?: string
): Promise<void> {
  const db = getAdminFirestore();
  const collection = storageCollection ?? FLAG_TO_COLLECTION[flag];

  try {
    // Check if any files still reference this property
    const snapshot = await db
      .collection(collection)
      .where('propertyId', '==', propertyId)
      .select() // Only need existence check, not data
      .limit(1)
      .get();

    const hasFiles = !snapshot.empty;

    // Update the property's coverage flag
    await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).update({
      [flag]: hasFiles,
      updatedAt: FieldValue.serverTimestamp(),
    });
    EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.PROPERTY as 'property',
      entityId: propertyId,
      entityName: null,
      action: 'updated',
      changes: [{ field: flag, oldValue: null, newValue: hasFiles }],
      performedBy: 'property-coverage-recalculator',
      performedByName: null,
      companyId: 'system',
    }).catch(() => {});

    logger.info('Property coverage flag recalculated', {
      propertyId,
      flag,
      newValue: hasFiles,
      storageCollection: collection,
    });
  } catch (error) {
    logger.error('Failed to recalculate property coverage flag', {
      propertyId,
      flag,
      error: getErrorMessage(error),
    });
    // Non-blocking — caller should catch
    throw error;
  }
}
