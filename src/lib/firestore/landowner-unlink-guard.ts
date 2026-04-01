/**
 * 🛡️ Landowner Unlink Guard — Server-side dependency check
 *
 * Checks if a landowner can be safely removed from a project's landowners[]
 * by querying downstream dependencies (properties, parking, storage, ownership tables).
 *
 * NOT the same as deletion-guard.ts (which handles Firestore document deletion).
 * This handles array-entry removal with compound scoping (projectId + contactId).
 *
 * @module lib/firestore/landowner-unlink-guard
 * @enterprise ADR-244 — Landowner Safety Guard
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry';
import type { UnlinkDependency, LandownerUnlinkResult } from './landowner-unlink-guard.types';

export type { UnlinkDependency, LandownerUnlinkResult } from './landowner-unlink-guard.types';

const logger = createModuleLogger('LandownerUnlinkGuard');

// ============================================================================
// MAIN CHECK FUNCTION
// ============================================================================

/**
 * Check if a landowner can be safely removed from a project.
 *
 * Runs 4 parallel queries scoped to the project:
 * - BLOCKING: properties, parking, storage where contactId is in commercial.ownerContactIds
 * - WARNING: ownership_tables where rows reference this contactId
 */
export async function checkLandownerUnlink(
  db: FirebaseFirestore.Firestore,
  projectId: string,
  contactId: string,
  companyId: string
): Promise<LandownerUnlinkResult> {
  logger.info('🛡️ Checking landowner unlink dependencies', { projectId, contactId });

  const [properties, parking, storage, ownershipTable] = await Promise.all([
    countBlockingDeps(db, COLLECTIONS.PROPERTIES, projectId, contactId, companyId),
    countBlockingDeps(db, COLLECTIONS.PARKING_SPACES, projectId, contactId, companyId),
    countBlockingDeps(db, COLLECTIONS.STORAGE, projectId, contactId, companyId),
    countOwnershipTableRefs(db, projectId, contactId, companyId),
  ]);

  const blockingDeps: UnlinkDependency[] = [];
  const warningDeps: UnlinkDependency[] = [];

  if (properties > 0) blockingDeps.push({ label: 'Ακίνητα', collection: COLLECTIONS.PROPERTIES, count: properties });
  if (parking > 0) blockingDeps.push({ label: 'Θέσεις Στάθμευσης', collection: COLLECTIONS.PARKING_SPACES, count: parking });
  if (storage > 0) blockingDeps.push({ label: 'Αποθήκες', collection: COLLECTIONS.STORAGE, count: storage });
  if (ownershipTable > 0) warningDeps.push({ label: 'Πίνακας Ποσοστών', collection: COLLECTIONS.OWNERSHIP_TABLES, count: ownershipTable });

  if (blockingDeps.length > 0) {
    const totalBlocking = blockingDeps.reduce((sum, d) => sum + d.count, 0);
    return {
      allowed: false,
      variant: 'blocked',
      blockingDeps,
      warningDeps,
      message: `Η αφαίρεση αποκλείεται. Ο οικοπεδούχος είναι ιδιοκτήτης σε ${totalBlocking} εγγραφές. Αφαιρέστε πρώτα τις ιδιοκτησίες.`,
    };
  }

  if (warningDeps.length > 0) {
    return {
      allowed: true,
      variant: 'warning',
      blockingDeps,
      warningDeps,
      message: 'Ο οικοπεδούχος αναφέρεται στον πίνακα ποσοστών. Θα χρειαστεί χειροκίνητη ενημέρωση.',
    };
  }

  return {
    allowed: true,
    variant: 'confirm',
    blockingDeps: [],
    warningDeps: [],
    message: 'Δεν υπάρχουν εξαρτήσεις. Η αφαίρεση επιτρέπεται.',
  };
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Count properties/parking/storage where this contact is in commercial.ownerContactIds
 * AND belongs to this project.
 */
async function countBlockingDeps(
  db: FirebaseFirestore.Firestore,
  collection: string,
  projectId: string,
  contactId: string,
  companyId: string
): Promise<number> {
  try {
    const snapshot = await db.collection(collection)
      .where(FIELDS.COMPANY_ID, '==', companyId)
      .where(FIELDS.PROJECT_ID, '==', projectId)
      .where('commercial.ownerContactIds', 'array-contains', contactId)
      .select()
      .get();

    return snapshot.size;
  } catch (error) {
    logger.warn(`⚠️ Blocking dep check failed for ${collection}:`, error);
    return 0; // Safe default: don't block on query errors
  }
}

/**
 * Check ownership_tables for references to this contactId in landowner entries.
 * Returns count of tables referencing this landowner.
 */
async function countOwnershipTableRefs(
  db: FirebaseFirestore.Firestore,
  projectId: string,
  contactId: string,
  companyId: string
): Promise<number> {
  try {
    // Ownership tables don't have a denormalized ownerContactIds array,
    // so we fetch by projectId and check landowner entries client-side
    const snapshot = await db.collection(COLLECTIONS.OWNERSHIP_TABLES)
      .where(FIELDS.COMPANY_ID, '==', companyId)
      .where(FIELDS.PROJECT_ID, '==', projectId)
      .select('bartex.landowners')
      .get();

    let count = 0;
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const landowners = data?.bartex?.landowners as Array<{ contactId?: string }> | undefined;
      if (landowners?.some(lo => lo.contactId === contactId)) {
        count++;
      }
    }
    return count;
  } catch (error) {
    logger.warn('⚠️ Ownership table check failed:', error);
    return 0;
  }
}
