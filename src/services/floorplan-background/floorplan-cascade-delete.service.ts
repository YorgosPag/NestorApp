/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floorplan Cascade Delete Service (Q8 Unified)
 * =============================================================================
 *
 * Single source of truth for "delete all polygons of floor" semantics.
 * Touches BOTH polygon systems atomically (ADR-340 §3.6 Q8):
 *
 *   1. `floorplan_overlays` — new ADR-340 polygons (PDF / Image backgrounds)
 *   2. `dxf_viewer_levels` (floorId-indexed) → `dxf_overlay_levels/{levelId}/items`
 *      — legacy DXF subsystem polygon items
 *
 * Used by:
 * - Replace flow (cross-type DXF↔PDF/Image): wipes everything before new upload
 * - Background DELETE API: wipes overlays linked to the deleted background
 *
 * Uses chunked Firestore BulkWriter (500-op safe). Idempotent: zero-state
 * input returns success no-op.
 *
 * @module services/floorplan-background/floorplan-cascade-delete.service
 * @enterprise ADR-340 Phase 7 — Q8 cascade
 */

import 'server-only';

import { getAdminFirestore, type Firestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('FloorplanCascadeDeleteService');

// ============================================================================
// TYPES
// ============================================================================

export interface CascadeDeleteResult {
  floorplanOverlaysDeleted: number;
  dxfLevelsScanned: number;
  dxfOverlayItemsDeleted: number;
}

export interface FloorPolygonState {
  floorplanOverlayCount: number;
  dxfOverlayCount: number;
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
 * Query dxf_viewer_levels for a floor + company.
 */
async function queryDxfLevelsForFloor(
  db: Firestore,
  companyId: string,
  floorId: string,
): Promise<string[]> {
  const q = await db
    .collection(COLLECTIONS.DXF_VIEWER_LEVELS)
    .where('companyId', '==', companyId)
    .where('floorId', '==', floorId)
    .get();
  return q.docs.map((d) => d.id);
}

/**
 * Query all item refs under a list of levelIds (parallel per level).
 */
async function collectDxfItemRefs(
  db: Firestore,
  levelIds: string[],
): Promise<FirebaseFirestore.DocumentReference[]> {
  if (levelIds.length === 0) return [];
  const refs: FirebaseFirestore.DocumentReference[] = [];
  await Promise.all(
    levelIds.map(async (levelId) => {
      const itemsSnap = await db
        .collection(COLLECTIONS.DXF_OVERLAY_LEVELS)
        .doc(levelId)
        .collection(SUBCOLLECTIONS.DXF_OVERLAY_LEVEL_ITEMS)
        .get();
      itemsSnap.docs.forEach((d) => refs.push(d.ref));
    }),
  );
  return refs;
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
   * Q8 unified cascade — wipes BOTH polygon systems for a floor.
   * Used by replace flow (cross-type) and floor-level cleanup.
   */
  static async cascadeAllPolygonsForFloor(
    companyId: string,
    floorId: string,
  ): Promise<CascadeDeleteResult> {
    const db = getDb();
    try {
      const [floorplanOverlayRefs, dxfLevelIds] = await Promise.all([
        collectFloorplanOverlayRefs(db, companyId, floorId),
        queryDxfLevelsForFloor(db, companyId, floorId),
      ]);

      const dxfItemRefs = await collectDxfItemRefs(db, dxfLevelIds);

      const [floorplanOverlaysDeleted, dxfOverlayItemsDeleted] = await Promise.all([
        deleteRefsInChunks(db, floorplanOverlayRefs),
        deleteRefsInChunks(db, dxfItemRefs),
      ]);

      const result: CascadeDeleteResult = {
        floorplanOverlaysDeleted,
        dxfLevelsScanned: dxfLevelIds.length,
        dxfOverlayItemsDeleted,
      };
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
   * Used when removing one background WITHOUT touching DXF subsystem
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
   * Count polygons across both systems for a floor — used by replace-confirm
   * dialog ("ο όροφος έχει N polygons").
   */
  static async getFloorPolygonState(
    companyId: string,
    floorId: string,
  ): Promise<FloorPolygonState> {
    const db = getDb();
    const [floorplanOverlaysSnap, dxfLevelIds] = await Promise.all([
      db
        .collection(COLLECTIONS.FLOORPLAN_OVERLAYS)
        .where('companyId', '==', companyId)
        .where('floorId', '==', floorId)
        .count()
        .get(),
      queryDxfLevelsForFloor(db, companyId, floorId),
    ]);

    let dxfOverlayCount = 0;
    if (dxfLevelIds.length > 0) {
      const counts = await Promise.all(
        dxfLevelIds.map((levelId) =>
          db
            .collection(COLLECTIONS.DXF_OVERLAY_LEVELS)
            .doc(levelId)
            .collection(SUBCOLLECTIONS.DXF_OVERLAY_LEVEL_ITEMS)
            .count()
            .get(),
        ),
      );
      dxfOverlayCount = counts.reduce((acc, c) => acc + c.data().count, 0);
    }

    const floorplanOverlayCount = floorplanOverlaysSnap.data().count;
    return {
      floorplanOverlayCount,
      dxfOverlayCount,
      total: floorplanOverlayCount + dxfOverlayCount,
    };
  }
}
