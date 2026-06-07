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
 *   3. dxf_viewer_levels — CONTENT cleared (sceneFileId/sceneFileName → null),
 *      structure preserved so the active editing session keeps a valid
 *      `currentLevelId` and the next wizard re-import re-binds the same doc.
 *   4. floorplan_backgrounds docs (ADR-340)
 *   5. files/{fileId} docs (canonical FILES collection, ADR-292)
 *   6. Storage objects (Firebase Storage binaries)
 *
 * @module services/floorplan-background/floorplan-floor-wipe.service
 * @enterprise ADR-340 Phase 4 reborn — unified replace pre-flight
 */

import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import {
  getAdminFirestore,
  getAdminStorage,
  type Firestore,
} from '@/lib/firebaseAdmin';
import { FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';
import { buildStoragePath } from '@/services/upload/utils/storage-path';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { FloorplanCascadeDeleteService } from './floorplan-cascade-delete.service';
import { deleteRefsInChunks, BATCH_DELETE_CHUNK } from './firestore-batch-delete';
import {
  wipeBimForFloor,
  countBimForFloor,
  type BimWipeAuditContext,
} from './bim-floor-wipe.service';
import {
  listBackgrounds,
  listDxfLevels,
  loadFileRows,
  listAllFloorFileRows,
  loadFloorProjectId,
  collectFileIds,
  type BackgroundRow,
  type DxfLevelRow,
  type FileRow,
} from './floor-wipe-queries';

const logger = createModuleLogger('FloorplanFloorWipeService');

// ============================================================================
// TYPES
// ============================================================================

export interface WipeAllForFloorResult {
  floorplanOverlaysDeleted: number;
  /**
   * Number of `dxf_viewer_levels` docs whose scene binding was cleared
   * (`sceneFileId` / `sceneFileName` set to `null`). The docs themselves are
   * NOT deleted — they remain alive so the active DXF viewer session keeps a
   * valid `currentLevelId` across the wipe → re-import cycle.
   */
  dxfLevelsCleared: number;
  floorplanBackgroundsDeleted: number;
  fileRecordsDeleted: number;
  storageObjectsDeleted: number;
  storageObjectsFailed: number;
  /** Extra storage objects removed by canonical floor-category prefix sweep
   * (orphans not tracked by FileRecord rows; e.g. derivations from earlier
   * wipes that had already lost their parent FileRecord). */
  categoryPathSweptCount: number;
  /** BIM entities deleted (only when `wipeBim` requested; 0 otherwise). */
  bimEntitiesDeleted: number;
  /** Auto-BOQ items deleted (only when `wipeBim` requested; 0 otherwise). */
  boqItemsDeleted: number;
}

export interface FloorWipePreview {
  floorplanOverlayCount: number;
  floorplanBackgroundCount: number;
  fileRecordCount: number;
  totalPolygons: number;
  /** BIM entity docs across the 20 floor-scoped collections (ADR-420). */
  bimEntityCount: number;
  /** Auto-generated BOQ items linked to the floor. */
  boqItemCount: number;
}

/** Options for {@link FloorplanFloorWipeService.wipeAllForFloor}. */
export interface WipeAllForFloorOptions {
  /**
   * When true, ALSO hard-delete every BIM entity (walls/columns/openings/…) and
   * their auto-BOQ for the floor. Default false: BIM survives a plain replace
   * (ADR-420 — re-import keeps your model). The wizard sets this only when the
   * user explicitly chooses "full replace".
   */
  wipeBim?: boolean;
  /** Performer for the BIM-delete audit trail (best-effort). */
  audit?: BimWipeAuditContext;
}

// Re-export row types so callers that previously imported them from here keep
// working (backward-compatible public surface).
export type { BackgroundRow, DxfLevelRow, FileRow };

// ============================================================================
// HELPERS
// ============================================================================

function getDb(): Firestore {
  return getAdminFirestore();
}

/**
 * Clear scene binding on `dxf_viewer_levels` docs WITHOUT deleting them.
 *
 * Rationale (ADR-340 Phase 9 follow-up, 2026-05-17): the wizard re-import flow
 * runs this wipe BEFORE the new upload. If the docs were hard-deleted, the
 * active DXF viewer session's `currentLevelId` becomes orphan — the in-memory
 * scene set by `useSceneState.handleFileImport` lands on a `levelId` that no
 * longer exists in Firestore, so `linkSceneToLevel` 404s and the canvas
 * appears empty. Preserving the doc keeps `currentLevelId` valid; the next
 * `linkSceneToLevel` simply re-binds `sceneFileId` on the same doc.
 *
 * Skips docs that already have `sceneFileId === null` to avoid no-op writes.
 */
async function clearDxfLevelsInChunks(
  db: Firestore,
  rows: DxfLevelRow[],
): Promise<number> {
  const dirty = rows.filter((r) => r.sceneFileId !== null);
  let cleared = 0;
  for (let i = 0; i < dirty.length; i += BATCH_DELETE_CHUNK) {
    const chunk = dirty.slice(i, i + BATCH_DELETE_CHUNK);
    const batch = db.batch();
    for (const row of chunk) {
      batch.update(row.ref, {
        sceneFileId: null,
        sceneFileName: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    cleared += chunk.length;
  }
  return cleared;
}

async function sweepFloorCategoryPath(
  companyId: string,
  projectId: string,
  floorId: string,
): Promise<{ deleted: number; failed: number }> {
  const canonicalPath = buildStoragePath({
    companyId, projectId, entityType: 'floor', entityId: floorId,
    domain: FILE_DOMAINS.CONSTRUCTION, category: FILE_CATEGORIES.FLOORPLANS,
    fileId: '_sweep_', ext: 'bin',
  }).path;
  // Strip `_sweep_.bin` to get the `files/` directory prefix.
  const prefix = canonicalPath.slice(0, canonicalPath.lastIndexOf('/') + 1);
  const bucket = getAdminStorage().bucket();
  let deleted = 0;
  let failed = 0;
  try {
    const [matches] = await bucket.getFiles({ prefix });
    if (matches.length === 0) return { deleted, failed };
    await Promise.all(
      matches.map(async (f) => {
        try {
          await f.delete({ ignoreNotFound: true });
          deleted += 1;
        } catch (innerErr) {
          failed += 1;
          logger.warn('Floor-category sweep delete failed (non-blocking)', {
            path: f.name,
            error: getErrorMessage(innerErr),
          });
        }
      }),
    );
  } catch (err) {
    failed += 1;
    logger.warn('Floor-category sweep prefix-list failed (non-blocking)', {
      prefix,
      error: getErrorMessage(err),
    });
  }
  return { deleted, failed };
}

async function deleteStorageObjects(
  storagePaths: string[],
): Promise<{ deleted: number; failed: number }> {
  if (storagePaths.length === 0) return { deleted: 0, failed: 0 };
  const bucket = getAdminStorage().bucket();
  let deleted = 0;
  let failed = 0;
  // Prefix-list per canonical storagePath to also catch FloorplanProcessService
  // derivations: `{storagePath}.processed.json`, `{storagePath}.thumbnail.png`,
  // and any future derivation appended to the canonical path.
  await Promise.all(
    storagePaths.map(async (path) => {
      try {
        const [matches] = await bucket.getFiles({ prefix: path });
        if (matches.length === 0) {
          await bucket.file(path).delete({ ignoreNotFound: true });
          return;
        }
        await Promise.all(
          matches.map(async (f) => {
            try {
              await f.delete({ ignoreNotFound: true });
              deleted += 1;
            } catch (innerErr) {
              failed += 1;
              logger.warn('Storage delete failed (derivation, non-blocking)', {
                path: f.name,
                error: getErrorMessage(innerErr),
              });
            }
          }),
        );
      } catch (err) {
        failed += 1;
        logger.warn('Storage prefix-list failed (non-blocking)', {
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
    const [polygonState, backgrounds, dxfLevels, allFloorFiles, bimCounts] =
      await Promise.all([
        FloorplanCascadeDeleteService.getFloorPolygonState(companyId, floorId),
        listBackgrounds(db, companyId, floorId),
        listDxfLevels(db, companyId, floorId),
        listAllFloorFileRows(db, companyId, floorId),
        countBimForFloor(companyId, floorId),
      ]);

    // ADR-351: union referenced + orphan FileRecord ids so the preview count
    // matches what executeWipe actually deletes (no surprise "ghost" leftovers).
    const referencedIds = new Set(collectFileIds(backgrounds, dxfLevels));
    for (const row of allFloorFiles) referencedIds.add(row.ref.id);

    return {
      floorplanOverlayCount: polygonState.floorplanOverlayCount,
      floorplanBackgroundCount: backgrounds.length,
      fileRecordCount: referencedIds.size,
      totalPolygons: polygonState.total,
      bimEntityCount: bimCounts.bimEntityCount,
      boqItemCount: bimCounts.boqItemCount,
    };
  }

  /**
   * HARD-wipe everything tied to a floor. Idempotent: zero-state input
   * returns success no-op. Best-effort on Storage (failures logged).
   */
  static async wipeAllForFloor(
    companyId: string,
    floorId: string,
    opts: WipeAllForFloorOptions = {},
  ): Promise<WipeAllForFloorResult> {
    try {
      const result = await executeWipe(companyId, floorId, opts);
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
  opts: WipeAllForFloorOptions,
): Promise<WipeAllForFloorResult> {
  const db = getDb();
  const [backgrounds, dxfLevels, projectId] = await Promise.all([
    listBackgrounds(db, companyId, floorId),
    listDxfLevels(db, companyId, floorId),
    loadFloorProjectId(db, companyId, floorId),
  ]);

  // Opt-in BIM + auto-BOQ purge (full replace). Runs first so a failure aborts
  // before we delete the file/scene the user may still want to keep.
  const bim = opts.wipeBim
    ? await wipeBimForFloor(companyId, floorId, opts.audit)
    : { bimEntitiesDeleted: 0, boqItemsDeleted: 0 };

  const fileIds = collectFileIds(backgrounds, dxfLevels);
  const referencedFileRows = await loadFileRows(db, companyId, fileIds);

  // ADR-351: union the referenced rows with EVERY FileRecord pointing at this
  // floor — catches orphan FileRecords (created but never linked from a
  // background/level doc) that previous wipes ignored.
  const allFloorFileRows = await listAllFloorFileRows(db, companyId, floorId);
  const fileRowsById = new Map<string, FileRow>();
  for (const row of referencedFileRows) fileRowsById.set(row.ref.id, row);
  for (const row of allFloorFileRows) fileRowsById.set(row.ref.id, row);
  const fileRows = Array.from(fileRowsById.values());

  // Polygons FIRST — cascade reads dxf_viewer_levels (still alive here).
  const cascade = await FloorplanCascadeDeleteService.cascadeAllPolygonsForFloor(
    companyId,
    floorId,
  );

  const [dxfLevelsCleared, floorplanBackgroundsDeleted, fileRecordsDeleted] =
    await Promise.all([
      clearDxfLevelsInChunks(db, dxfLevels),
      deleteRefsInChunks(db, backgrounds.map((b) => b.ref)),
      deleteRefsInChunks(db, fileRows.map((f) => f.ref)),
    ]);

  const storagePaths = fileRows
    .map((f) => f.storagePath)
    .filter((p): p is string => typeof p === 'string' && p.length > 0);
  const storage = await deleteStorageObjects(storagePaths);

  // Extra sweep: catch orphan binaries left under the canonical floor-category
  // prefix (derivations whose parent FileRecord was already deleted by an
  // earlier wipe that lacked prefix-list logic). Skipped silently for legacy
  // floors without a Firestore floor doc / projectId.
  const sweep = projectId
    ? await sweepFloorCategoryPath(companyId, projectId, floorId)
    : { deleted: 0, failed: 0 };

  return {
    floorplanOverlaysDeleted: cascade.floorplanOverlaysDeleted,
    dxfLevelsCleared,
    floorplanBackgroundsDeleted,
    fileRecordsDeleted,
    storageObjectsDeleted: storage.deleted + sweep.deleted,
    storageObjectsFailed: storage.failed + sweep.failed,
    categoryPathSweptCount: sweep.deleted,
    bimEntitiesDeleted: bim.bimEntitiesDeleted,
    boqItemsDeleted: bim.boqItemsDeleted,
  };
}
