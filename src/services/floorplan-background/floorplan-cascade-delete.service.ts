/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floorplan Cascade Delete Service (ADR-340 Phase 9 STEP L)
 * =============================================================================
 *
 * Single source of truth for "delete all polygons of floor" semantics.
 * Operates exclusively on `floorplan_overlays` (ADR-340 polygons).
 * Legacy DXF subcollection arm removed post-WIPE (ADR-340 Phase 9 STEP L).
 *
 * Used by:
 * - Replace flow (cross-type DXF↔PDF/Image): wipes overlays before new upload
 * - Background DELETE API: wipes overlays linked to the deleted background
 *
 * Uses chunked Firestore BulkWriter (500-op safe). Idempotent: zero-state
 * input returns success no-op.
 *
 * @module services/floorplan-background/floorplan-cascade-delete.service
 * @enterprise ADR-340 Phase 7 — Q8 cascade / Phase 9 STEP L cleanup
 */

import 'server-only';

import { getAdminFirestore, type Firestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('FloorplanCascadeDeleteService');

// ============================================================================
// TYPES
// ============================================================================

export interface CascadeDeleteResult {
  floorplanOverlaysDeleted: number;
}

export interface FloorPolygonState {
  floorplanOverlayCount: number;
  total: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function getDb(): Firestore {
  return getAdminFirestore();
}

/**
 * Bulk delete a list of refs in 500-op batches (Firestore hard limit).
 */
async function deleteRefsInChunks(
  db: Firestore,
  refs: FirebaseFirestore.DocumentReference[],
): Promise<number> {
  const CHUNK = 450;
  let deleted = 0;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const chunk = refs.slice(i, i + CHUNK);
    const batch = db.batch();
    for (const ref of chunk) batch.delete(ref);
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

/**
 * Query all floorplan_overlays for a floor + company.
 */
async function collectFloorplanOverlayRefs(
  db: Firestore,
  companyId: string,
  floorId: string,
): Promise<FirebaseFirestore.DocumentReference[]> {
  const q = await db
    .collection(COLLECTIONS.FLOORPLAN_OVERLAYS)
    .where('companyId', '==', companyId)
    .where('floorId', '==', floorId)
    .get();
  return q.docs.map((d) => d.ref);
}

/**
 * Query floorplan_overlays linked to a specific backgroundId (used by background DELETE).
 */
async function collectFloorplanOverlayRefsByBackground(
  db: Firestore,
  companyId: string,
  backgroundId: string,
): Promise<FirebaseFirestore.DocumentReference[]> {
  const q = await db
    .collection(COLLECTIONS.FLOORPLAN_OVERLAYS)
    .where('companyId', '==', companyId)
    .where('backgroundId', '==', backgroundId)
    .get();
  return q.docs.map((d) => d.ref);
}

// ============================================================================
// SERVICE
// ============================================================================

export class FloorplanCascadeDeleteService {
  /**
   * Cascade wipe — deletes all floorplan_overlays for a floor.
   * Used by replace flow (cross-type) and floor-level cleanup.
   */
  static async cascadeAllPolygonsForFloor(
    companyId: string,
    floorId: string,
  ): Promise<CascadeDeleteResult> {
    const db = getDb();
    try {
      const floorplanOverlayRefs = await collectFloorplanOverlayRefs(db, companyId, floorId);
      const floorplanOverlaysDeleted = await deleteRefsInChunks(db, floorplanOverlayRefs);
      const result: CascadeDeleteResult = { floorplanOverlaysDeleted };
      logger.info('Cascade delete complete', { companyId, floorId, ...result });
      return result;
    } catch (err) {
      logger.error('Cascade delete failed', {
        companyId,
        floorId,
        error: getErrorMessage(err),
      });
      throw err;
    }
  }

  /**
   * Delete only floorplan_overlays linked to a single backgroundId.
   * Used when removing one background WITHOUT touching other overlays
   * (same-type replace or explicit Remove button).
   */
  static async cascadeOverlaysForBackground(
    companyId: string,
    backgroundId: string,
  ): Promise<number> {
    const db = getDb();
    const refs = await collectFloorplanOverlayRefsByBackground(db, companyId, backgroundId);
    const deleted = await deleteRefsInChunks(db, refs);
    logger.info('Background overlays cascade complete', { companyId, backgroundId, deleted });
    return deleted;
  }

  /**
   * Count floorplan_overlays for a floor — used by replace-confirm
   * dialog ("ο όροφος έχει N polygons").
   */
  static async getFloorPolygonState(
    companyId: string,
    floorId: string,
  ): Promise<FloorPolygonState> {
    const db = getDb();
    const snap = await db
      .collection(COLLECTIONS.FLOORPLAN_OVERLAYS)
      .where('companyId', '==', companyId)
      .where('floorId', '==', floorId)
      .count()
      .get();
    const floorplanOverlayCount = snap.data().count;
    return { floorplanOverlayCount, total: floorplanOverlayCount };
  }
}
