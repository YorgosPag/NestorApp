/**
 * 🛡️ UNIT COVERAGE RECALCULATOR — Ready-to-Integrate Utility (ADR-249 P2-1)
 *
 * Recalculates unit boolean coverage flags (hasPhotos, hasFloorplans, hasDocuments)
 * after a file/photo/document is deleted from a storage collection.
 *
 * NOT integrated yet — will be activated when photo/floorplan/document DELETE
 * endpoints are created. Currently exists as a utility for future use.
 *
 * @module lib/firestore/unit-coverage-recalculator
 * @enterprise ADR-249 SPEC-249C — Defense in Depth
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FieldValue } from 'firebase-admin/firestore';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('UnitCoverageRecalculator');

// ============================================================================
// TYPES
// ============================================================================

/** Supported coverage flags on a unit document */
type CoverageFlag = 'hasPhotos' | 'hasFloorplans' | 'hasDocuments';

/** Maps a coverage flag to its corresponding storage collection */
const FLAG_TO_COLLECTION: Record<CoverageFlag, string> = {
  hasPhotos: 'unit_photos',
  hasFloorplans: 'unit_floorplans',
  hasDocuments: 'unit_documents',
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Recalculates a unit's boolean coverage flag after a file deletion.
 *
 * Queries the corresponding storage collection to check if any remaining
 * files reference this unit. Updates the unit's flag accordingly.
 *
 * @param unitId - The unit document ID
 * @param flag - Which coverage flag to recalculate
 * @param storageCollection - Optional override for the storage collection name.
 *   If not provided, uses the default mapping from FLAG_TO_COLLECTION.
 *
 * @example
 * ```typescript
 * // After deleting a photo from unit_photos:
 * await recalculateUnitCoverageFlag('unit_abc123', 'hasPhotos');
 * ```
 */
export async function recalculateUnitCoverageFlag(
  unitId: string,
  flag: CoverageFlag,
  storageCollection?: string
): Promise<void> {
  const db = getAdminFirestore();
  const collection = storageCollection ?? FLAG_TO_COLLECTION[flag];

  try {
    // Check if any files still reference this unit
    const snapshot = await db
      .collection(collection)
      .where('unitId', '==', unitId)
      .select() // Only need existence check, not data
      .limit(1)
      .get();

    const hasFiles = !snapshot.empty;

    // Update the unit's coverage flag
    await db.collection(COLLECTIONS.UNITS).doc(unitId).update({
      [flag]: hasFiles,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Unit coverage flag recalculated', {
      unitId,
      flag,
      newValue: hasFiles,
      storageCollection: collection,
    });
  } catch (error) {
    logger.error('Failed to recalculate unit coverage flag', {
      unitId,
      flag,
      error: getErrorMessage(error),
    });
    // Non-blocking — caller should catch
    throw error;
  }
}
