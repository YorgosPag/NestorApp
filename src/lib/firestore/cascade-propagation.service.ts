/**
 * 🔗 CASCADE PROPAGATION SERVICE — Hierarchy Inheritance Engine
 *
 * Propagates parent IDs down the entity hierarchy when links change:
 *   Company → Project → Building → { Floor, Unit, Parking, Storage }
 *
 * Uses Firestore batched writes (atomic per batch, max 450 ops).
 * Cascade failure does NOT rollback the parent update — partial success is reported.
 *
 * @module lib/firestore/cascade-propagation
 * @enterprise ADR-231 — Cascade Entity Linking
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FieldValue } from 'firebase-admin/firestore';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CascadePropagation');

/** Safe batch size (headroom under Firestore's 500 limit) */
const BATCH_CHUNK_SIZE = 450;

/** Result of a cascade propagation */
export interface CascadeResult {
  success: boolean;
  /** Total documents updated across all child collections */
  totalUpdated: number;
  /** Breakdown per collection */
  collections: Record<string, number>;
  /** Error message if partial failure */
  error?: string;
}

// ============================================================================
// CHILD COLLECTION DEFINITIONS
// ============================================================================

/** Collections that are direct children of a building */
const BUILDING_CHILD_COLLECTIONS = [
  COLLECTIONS.UNITS,
  COLLECTIONS.FLOORS,
  COLLECTIONS.PARKING_SPACES,
  COLLECTIONS.STORAGE,
] as const;

// ============================================================================
// RULE 1: Building → Project Link
// ============================================================================

/**
 * When a building gains/changes its projectId:
 * - Resolve project.companyId
 * - Update ALL children (units, floors, parking, storage) with projectId + companyId
 *
 * When projectId is null (unlink):
 * - Children lose projectId and companyId (set to null)
 */
export async function propagateBuildingProjectLink(
  buildingId: string,
  newProjectId: string | null
): Promise<CascadeResult> {
  const db = getAdminFirestore();
  const collections: Record<string, number> = {};
  let totalUpdated = 0;

  try {
    // 🏢 ADR-232: Resolve linkedCompanyId from project (NOT companyId — that's tenant-only)
    let resolvedLinkedCompanyId: string | null = null;

    if (newProjectId) {
      const projectDoc = await db.collection(COLLECTIONS.PROJECTS).doc(newProjectId).get();
      if (projectDoc.exists) {
        resolvedLinkedCompanyId = (projectDoc.data()?.linkedCompanyId as string) ?? null;
      }
    }

    // Build the update payload — propagate linkedCompanyId (business link)
    const cascadeData: Record<string, string | null | FieldValue> = {
      projectId: newProjectId,
      linkedCompanyId: resolvedLinkedCompanyId,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // 🏢 ADR-232: Update the building itself with linkedCompanyId
    await db.collection(COLLECTIONS.BUILDINGS).doc(buildingId).update({
      linkedCompanyId: resolvedLinkedCompanyId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    collections[COLLECTIONS.BUILDINGS] = 1;
    totalUpdated += 1;

    // Query and update all child collections
    for (const collectionName of BUILDING_CHILD_COLLECTIONS) {
      const snapshot = await db
        .collection(collectionName)
        .where('buildingId', '==', buildingId)
        .select() // Only need doc refs, not data
        .get();

      if (snapshot.empty) {
        collections[collectionName] = 0;
        continue;
      }

      const docs = snapshot.docs;
      const updated = await batchUpdate(db, docs, cascadeData);
      collections[collectionName] = updated;
      totalUpdated += updated;
    }

    logger.info('Building→Project cascade completed', {
      buildingId,
      newProjectId,
      resolvedLinkedCompanyId,
      totalUpdated,
      collections,
    });

    return { success: true, totalUpdated, collections };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Building→Project cascade failed', { buildingId, newProjectId, error: message });
    return { success: false, totalUpdated, collections, error: message };
  }
}

// ============================================================================
// RULE 2: Project → Company Link
// ============================================================================

/**
 * 🏢 ADR-232: When a project gains/changes its linkedCompanyId (business link):
 * - Update ALL buildings of the project with linkedCompanyId
 * - For each building → update ALL children with linkedCompanyId
 *
 * When linkedCompanyId is null (unlink):
 * - Buildings and their children lose linkedCompanyId (set to null)
 *
 * NOTE: companyId (tenant key) is NEVER changed by cascade — it's immutable.
 */
export async function propagateProjectCompanyLink(
  projectId: string,
  newCompanyId: string | null
): Promise<CascadeResult> {
  const db = getAdminFirestore();
  const collections: Record<string, number> = {};
  let totalUpdated = 0;

  try {
    // 🏢 ADR-232: Propagate linkedCompanyId (business link), NOT companyId (tenant key)
    const companyUpdate: Record<string, string | null | FieldValue> = {
      linkedCompanyId: newCompanyId,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // 1. Find all buildings belonging to this project
    const buildingsSnap = await db
      .collection(COLLECTIONS.BUILDINGS)
      .where('projectId', '==', projectId)
      .get();

    if (!buildingsSnap.empty) {
      // Update buildings themselves
      const buildingUpdated = await batchUpdate(db, buildingsSnap.docs, companyUpdate);
      collections[COLLECTIONS.BUILDINGS] = buildingUpdated;
      totalUpdated += buildingUpdated;

      // 2. For each building, update all child collections
      const buildingIds = buildingsSnap.docs.map((doc) => doc.id);

      for (const collectionName of BUILDING_CHILD_COLLECTIONS) {
        let collectionCount = 0;

        // Query children in chunks (Firestore IN query limit = 10)
        for (let i = 0; i < buildingIds.length; i += 10) {
          const chunk = buildingIds.slice(i, i + 10);
          const childSnap = await db
            .collection(collectionName)
            .where('buildingId', 'in', chunk)
            .select()
            .get();

          if (!childSnap.empty) {
            const updated = await batchUpdate(db, childSnap.docs, companyUpdate);
            collectionCount += updated;
          }
        }

        if (collectionCount > 0) {
          collections[collectionName] = (collections[collectionName] ?? 0) + collectionCount;
          totalUpdated += collectionCount;
        }
      }
    } else {
      collections[COLLECTIONS.BUILDINGS] = 0;
    }

    logger.info('Project→Company cascade completed', {
      projectId,
      newCompanyId,
      totalUpdated,
      collections,
    });

    return { success: true, totalUpdated, collections };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Project→Company cascade failed', { projectId, newCompanyId, error: message });
    return { success: false, totalUpdated, collections, error: message };
  }
}

// ============================================================================
// RULE 3: Unit → Building Link
// ============================================================================

/**
 * When a unit gains/changes its buildingId:
 * - Resolve building.projectId → project.companyId
 * - Update unit with projectId + companyId
 *
 * When buildingId is null (unlink):
 * - Unit loses projectId and companyId (set to null)
 */
export async function propagateUnitBuildingLink(
  unitId: string,
  newBuildingId: string | null
): Promise<CascadeResult> {
  const db = getAdminFirestore();

  try {
    let resolvedProjectId: string | null = null;
    let resolvedCompanyId: string | null = null;

    if (newBuildingId) {
      // Resolve building → projectId + companyId
      const buildingDoc = await db.collection(COLLECTIONS.BUILDINGS).doc(newBuildingId).get();
      if (buildingDoc.exists) {
        const buildingData = buildingDoc.data();
        resolvedProjectId = (buildingData?.projectId as string) ?? null;
        // 🏢 ENTERPRISE: Inherit companyId from building (Google-level ownership)
        resolvedCompanyId = (buildingData?.companyId as string) ?? null;

        // Resolve linkedCompanyId from project (business entity link)
        let resolvedLinkedCompanyId: string | null = null;
        if (resolvedProjectId) {
          const projectDoc = await db.collection(COLLECTIONS.PROJECTS).doc(resolvedProjectId).get();
          if (projectDoc.exists) {
            resolvedLinkedCompanyId = (projectDoc.data()?.linkedCompanyId as string) ?? null;
          }
        }

        // 🏢 ENTERPRISE: Update BOTH companyId AND linkedCompanyId
        await db.collection(COLLECTIONS.UNITS).doc(unitId).update({
          projectId: resolvedProjectId,
          companyId: resolvedCompanyId,
          linkedCompanyId: resolvedLinkedCompanyId,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } else {
      // Unlink: clear project/company references
      await db.collection(COLLECTIONS.UNITS).doc(unitId).update({
        projectId: null,
        linkedCompanyId: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    logger.info('Unit→Building cascade completed', {
      unitId,
      newBuildingId,
      resolvedProjectId,
      resolvedCompanyId,
    });

    return {
      success: true,
      totalUpdated: 1,
      collections: { [COLLECTIONS.UNITS]: 1 },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Unit→Building cascade failed', { unitId, newBuildingId, error: message });
    return { success: false, totalUpdated: 0, collections: {}, error: message };
  }
}

// ============================================================================
// BATCH UTILITY
// ============================================================================

/**
 * Batch-update an array of document snapshots with the given data.
 * Chunks at BATCH_CHUNK_SIZE to stay under Firestore's 500 limit.
 *
 * @returns Number of documents updated
 */
async function batchUpdate(
  db: FirebaseFirestore.Firestore,
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  updateData: Record<string, unknown>
): Promise<number> {
  let updated = 0;

  for (let i = 0; i < docs.length; i += BATCH_CHUNK_SIZE) {
    const chunk = docs.slice(i, i + BATCH_CHUNK_SIZE);
    const batch = db.batch();

    for (const doc of chunk) {
      batch.update(doc.ref, updateData);
    }

    await batch.commit();
    updated += chunk.length;
  }

  return updated;
}
