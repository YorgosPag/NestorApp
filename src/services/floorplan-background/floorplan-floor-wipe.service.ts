/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floorplan Floor Wipe Service (ADR-340 Phase 4 reborn)
 * =============================================================================
 *
 * Single source of truth for "wipe ALL floor state before new upload".
 * Replace flow guarantees: every new floorplan upload (DXF, PDF, Image)
 * starts from a CLEAN floor — no orphan backgrounds, no stale polygons,
 * no dangling files, no leaked Storage objects.
 *
 * HARD delete only. No trash, no soft-delete, no recovery.
 *
 * Wipes (per floor + tenant):
 *   1. floorplan_overlays  (ADR-340 polygons)
 *   2. dxf_overlay_levels/{levelId}/items (legacy DXF polygons)
 *   3. dxf_viewer_levels parent docs (legacy)
 *   4. floorplan_backgrounds docs (ADR-340)
 *   5. files/{fileId} docs (canonical FILES collection, ADR-292)
 *   6. Storage objects (Firebase Storage binaries)
 *
 * @module services/floorplan-background/floorplan-floor-wipe.service
 * @enterprise ADR-340 Phase 4 reborn — unified replace pre-flight
 */

import 'server-only';

import {
  getAdminFirestore,
  getAdminStorage,
  type Firestore,
} from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { FloorplanCascadeDeleteService } from './floorplan-cascade-delete.service';

const logger = createModuleLogger('FloorplanFloorWipeService');

// ============================================================================
// TYPES
// ============================================================================

export interface WipeAllForFloorResult {
  floorplanOverlaysDeleted: number;
  dxfOverlayItemsDeleted: number;
  dxfLevelsDeleted: number;
  floorplanBackgroundsDeleted: number;
  fileRecordsDeleted: number;
  storageObjectsDeleted: number;
  storageObjectsFailed: number;
}

export interface FloorWipePreview {
  floorplanOverlayCount: number;
  dxfOverlayCount: number;
  floorplanBackgroundCount: number;
  dxfLevelCount: number;
  fileRecordCount: number;
  totalPolygons: number;
}

interface BackgroundRow {
  ref: FirebaseFirestore.DocumentReference;
  fileId: string;
}

interface DxfLevelRow {
  ref: FirebaseFirestore.DocumentReference;
  sceneFileId: string | null;
}

interface FileRow {
  ref: FirebaseFirestore.DocumentReference;
  storagePath: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

const CHUNK = 450;

function getDb(): Firestore {
  return getAdminFirestore();
}

async function deleteRefsInChunks(
  db: Firestore,
  refs: FirebaseFirestore.DocumentReference[],
): Promise<number> {
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

async function listBackgrounds(
  db: Firestore,
  companyId: string,
  floorId: string,
): Promise<BackgroundRow[]> {
  const snap = await db
    .collection(COLLECTIONS.FLOORPLAN_BACKGROUNDS)
    .where('companyId', '==', companyId)
    .where('floorId', '==', floorId)
    .get();
  return snap.docs.map((d) => ({
    ref: d.ref,
    fileId: String((d.data() as { fileId?: string }).fileId ?? ''),
  }));
}

async function listDxfLevels(
  db: Firestore,
  companyId: string,
  floorId: string,
): Promise<DxfLevelRow[]> {
  const snap = await db
    .collection(COLLECTIONS.DXF_VIEWER_LEVELS)
    .where('companyId', '==', companyId)
    .where('floorId', '==', floorId)
    .get();
  return snap.docs.map((d) => {
    const data = d.data() as { sceneFileId?: string | null };
    return {
      ref: d.ref,
      sceneFileId: typeof data.sceneFileId === 'string' && data.sceneFileId.length > 0
        ? data.sceneFileId
        : null,
    };
  });
}

async function loadFileRows(
  db: Firestore,
  companyId: string,
  fileIds: string[],
): Promise<FileRow[]> {
  if (fileIds.length === 0) return [];
  const rows = await Promise.all(
    fileIds.map(async (id) => {
      const snap = await db.collection(COLLECTIONS.FILES).doc(id).get();
      if (!snap.exists) return null;
      const data = snap.data() as { companyId?: string; storagePath?: string };
      if (data.companyId !== companyId) {
        logger.warn('Cross-tenant file skipped during wipe', { fileId: id });
        return null;
      }
      return {
        ref: snap.ref,
        storagePath: typeof data.storagePath === 'string' ? data.storagePath : null,
      } satisfies FileRow;
    }),
  );
  return rows.filter((r): r is FileRow => r !== null);
}

async function deleteStorageObjects(
  storagePaths: string[],
): Promise<{ deleted: number; failed: number }> {
  if (storagePaths.length === 0) return { deleted: 0, failed: 0 };
  const bucket = getAdminStorage().bucket();
  let deleted = 0;
  let failed = 0;
  await Promise.all(
    storagePaths.map(async (path) => {
      try {
        await bucket.file(path).delete({ ignoreNotFound: true });
        deleted += 1;
      } catch (err) {
        failed += 1;
        logger.warn('Storage delete failed (non-blocking)', {
          path,
          error: getErrorMessage(err),
        });
      }
    }),
  );
  return { deleted, failed };
}

// ============================================================================
// SERVICE
// ============================================================================

export class FloorplanFloorWipeService {
  /**
   * Preview what would be wiped without mutating anything.
   * Used by UI confirm dialog. Cheap (count() aggregations + 2 list queries).
   */
  static async preview(
    companyId: string,
    floorId: string,
  ): Promise<FloorWipePreview> {
    const db = getDb();
    const [polygonState, backgrounds, dxfLevels] = await Promise.all([
      FloorplanCascadeDeleteService.getFloorPolygonState(companyId, floorId),
      listBackgrounds(db, companyId, floorId),
      listDxfLevels(db, companyId, floorId),
    ]);

    const fileIds = collectFileIds(backgrounds, dxfLevels);

    return {
      floorplanOverlayCount: polygonState.floorplanOverlayCount,
      dxfOverlayCount: polygonState.dxfOverlayCount,
      floorplanBackgroundCount: backgrounds.length,
      dxfLevelCount: dxfLevels.length,
      fileRecordCount: fileIds.length,
      totalPolygons: polygonState.total,
    };
  }

  /**
   * HARD-wipe everything tied to a floor. Idempotent: zero-state input
   * returns success no-op. Best-effort on Storage (failures logged).
   */
  static async wipeAllForFloor(
    companyId: string,
    floorId: string,
  ): Promise<WipeAllForFloorResult> {
    try {
      const result = await executeWipe(companyId, floorId);
      logger.info('Floor wipe complete', { companyId, floorId, ...result });
      return result;
    } catch (err) {
      logger.error('Floor wipe failed', {
        companyId,
        floorId,
        error: getErrorMessage(err),
      });
      throw err;
    }
  }
}

async function executeWipe(
  companyId: string,
  floorId: string,
): Promise<WipeAllForFloorResult> {
  const db = getDb();
  const [backgrounds, dxfLevels] = await Promise.all([
    listBackgrounds(db, companyId, floorId),
    listDxfLevels(db, companyId, floorId),
  ]);

  const fileIds = collectFileIds(backgrounds, dxfLevels);
  const fileRows = await loadFileRows(db, companyId, fileIds);

  // Polygons FIRST — cascade reads dxf_viewer_levels (still alive here).
  const cascade = await FloorplanCascadeDeleteService.cascadeAllPolygonsForFloor(
    companyId,
    floorId,
  );

  const [dxfLevelsDeleted, floorplanBackgroundsDeleted, fileRecordsDeleted] =
    await Promise.all([
      deleteRefsInChunks(db, dxfLevels.map((l) => l.ref)),
      deleteRefsInChunks(db, backgrounds.map((b) => b.ref)),
      deleteRefsInChunks(db, fileRows.map((f) => f.ref)),
    ]);

  const storagePaths = fileRows
    .map((f) => f.storagePath)
    .filter((p): p is string => typeof p === 'string' && p.length > 0);
  const storage = await deleteStorageObjects(storagePaths);

  return {
    floorplanOverlaysDeleted: cascade.floorplanOverlaysDeleted,
    dxfOverlayItemsDeleted: cascade.dxfOverlayItemsDeleted,
    dxfLevelsDeleted,
    floorplanBackgroundsDeleted,
    fileRecordsDeleted,
    storageObjectsDeleted: storage.deleted,
    storageObjectsFailed: storage.failed,
  };
}

function collectFileIds(
  backgrounds: BackgroundRow[],
  dxfLevels: DxfLevelRow[],
): string[] {
  const ids = new Set<string>();
  for (const b of backgrounds) {
    if (b.fileId) ids.add(b.fileId);
  }
  for (const l of dxfLevels) {
    if (l.sceneFileId) ids.add(l.sceneFileId);
  }
  return [...ids];
}
