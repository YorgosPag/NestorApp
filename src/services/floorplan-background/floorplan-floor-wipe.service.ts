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
 * 🔴 ADR-914 §2.17 — SCOPE = THE STOREY VIEW, not "everything sharing floorId".
 * A floor has many views: its storey level and one floorplan per property on it
 * (ADR-914 §2.13). They all carry the same `floorId` (BIM scope key, ADR-420).
 * Property views — their level binding, FileRecord and bytes — are never
 * touched here: replacing one view must not delete another.
 *
 * HARD delete of the floor's own docs (polygons, backgrounds). FILES are different (ADR-899 §2.2.1):
 * the wipe is one more door of the ONE purge pipeline — it never deletes a FileRecord or its bytes itself.
 *
 * Wipes (per floor + tenant):
 *   1. floorplan_overlays  (ADR-340 polygons)
 *   2. dxf_overlay_levels/{levelId}/items (legacy DXF polygons)
 *   3. dxf_viewer_levels (storey levels only) — CONTENT cleared (sceneFileId/sceneFileName → null),
 *      structure preserved so the active editing session keeps a valid
 *      `currentLevelId` and the next wizard re-import re-binds the same doc.
 *   4. files/{fileId} (canonical FILES collection, ADR-292) — per `floorFileFate`: free ones are
 *      handed to the purge queue (`fileTrashFields`, `purgeAt = now`, one activity row each); HELD ones
 *      (hold · preservation · record — `isFileHeld`) stay exactly as they are and are counted.
 *      The cron then purges through `purgeFileRecord`: hold judge again · original + every companion ·
 *      refusal ⇒ retried · tombstone. Runs BEFORE step 5.
 *   5. floorplan_backgrounds docs (ADR-340) — detached (`fileId: null`) in a commit of its own, then deleted,
 *      so `onDeleteFloorplanBackground` never re-decides a file this wipe already judged.
 *   6. Storage objects WITHOUT any record (ADR-709 orphan net) — never an object a record claims.
 *
 * 🔴 Until 2026-11-02: `files` docs were hard-deleted BEFORE their bytes (best-effort), with no hold
 *    judge, no tombstone and no activity row; the folder sweep deleted held bytes too.
 *
 * @module services/floorplan-background/floorplan-floor-wipe.service
 * @enterprise ADR-340 Phase 4 reborn — unified replace pre-flight
 */

import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import {
  getAdminFirestore,
  type Firestore,
} from '@/lib/firebaseAdmin';
import { claimedByFileRows, sumTallies, sweepFloorCategoryPath } from './floor-wipe-storage';
import { FILE_DOMAINS, FILE_CATEGORIES, FILE_LIFECYCLE_STATES } from '@/config/domain-constants';
import { fileTrashFields } from '@/lib/files/file-trash-fields';
import { nowISO } from '@/lib/date-local';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import { partitionFloorFiles } from './floor-wipe-file-fate';
import {
  buildCategoryStoragePrefix,
  buildLegacyProjectScopedPrefix,
} from '@/services/upload/utils/storage-path';
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
  listStoreyDxfLevels,
  gatherFloorFileRows,
  loadFloorProjectId,
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
  /** FileRecords handed to the ONE purge pipeline (trash, `purgeAt = now`) — the cron deletes their bytes. */
  fileRecordsTrashed: number;
  /** FileRecords left exactly as they were because `isFileHeld` (hold · preservation · record). */
  fileRecordsHeld: number;
  /** Orphan objects (claimed by NO record) removed by the floor-category prefix sweep (ADR-709). */
  storageObjectsDeleted: number;
  storageObjectsFailed: number;
  /** Objects under the prefix that belong to a record (held, or queued for purge) — left alone. */
  storageObjectsSpared: number;
  /** BIM entities deleted (only when `wipeBim` requested; 0 otherwise). */
  bimEntitiesDeleted: number;
  /** Auto-BOQ items deleted (only when `wipeBim` requested; 0 otherwise). */
  boqItemsDeleted: number;
}

export interface FloorWipePreview {
  floorplanOverlayCount: number;
  floorplanBackgroundCount: number;
  /** FileRecords the wipe will hand to the purge pipeline — exactly `fileRecordsTrashed` of the wipe. */
  fileRecordCount: number;
  /** FileRecords that will STAY (hold · preservation · record) — the person must learn what won't be deleted. */
  heldFileCount: number;
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
  /**
   * 🔑 Who wiped — `trashedBy` of every FileRecord sent to the purge queue and `performedBy` of its activity row
   * (ADR-866 §2.6.11). Required: the wipe never writes an anonymous trace.
   */
  performedBy: string;
}

/** The activity row's reason — the floor-wipe door, distinct from a person's own trash. */
export const FLOOR_WIPE_TRASH_REASON = 'floor_wipe';

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

/**
 * 🔗 Detach, THEN delete the floor's backgrounds — two commits, never one batch.
 *
 * The wipe has already decided every file's fate (`floorFileFate`). `onDeleteFloorplanBackground` would decide AGAIN
 * from the deleted doc's `fileId`, without the hold judge: the version still deployed hard-deletes `storagePath` and
 * `files/{fileId}` (ADR-899 §2.2.1 — before the redeploy), the current source trashes even a held file. A doc that
 * dies with `fileId: null` makes the trigger stop at its own guard («no fileId on deleted doc»). Two commits because the
 * trigger reads the state committed BEFORE the delete — an update in the same atomic batch would be invisible to it.
 */
async function detachThenDeleteBackgrounds(db: Firestore, backgrounds: readonly BackgroundRow[]): Promise<number> {
  const bound = backgrounds.filter((b) => b.fileId.length > 0);
  for (let i = 0; i < bound.length; i += BATCH_DELETE_CHUNK) {
    const batch = db.batch();
    for (const row of bound.slice(i, i + BATCH_DELETE_CHUNK)) {
      batch.update(row.ref, { fileId: null, updatedAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();
  }
  return deleteRefsInChunks(db, backgrounds.map((b) => b.ref));
}

/**
 * Hand the free FileRecords to the ONE purge pipeline — the same trash fields as every other door (`fileTrashFields`),
 * `purgeAt = now` (like `onDeleteFloorplanBackground`), then one activity row each in the owner's book.
 * The rows were already filtered by tenant (`gatherFloorFileRows`) and by `floorFileFate`.
 */
async function trashFileRowsInChunks(
  db: Firestore,
  companyId: string,
  floorId: string,
  rows: readonly FileRow[],
  performedBy: string,
): Promise<number> {
  const fields = fileTrashFields({
    trashedState: FILE_LIFECYCLE_STATES.TRASHED,
    by: performedBy,
    purgeAt: nowISO(),
    now: FieldValue.serverTimestamp(),
  });
  for (let i = 0; i < rows.length; i += BATCH_DELETE_CHUNK) {
    const batch = db.batch();
    for (const row of rows.slice(i, i + BATCH_DELETE_CHUNK)) batch.update(row.ref, fields);
    await batch.commit();
  }
  // Ίχνος ΜΕΤΑ τη γραφή — ο γραφέας δεν πετά ποτέ· αποτυχία του δεν ακυρώνει πράξη που έγινε (ADR-862 §5.7).
  await Promise.all(rows.map((row) => recordFileAudit({
    fileId: row.ref.id,
    action: 'delete',
    performedBy,
    companyId,
    metadata: { reason: FLOOR_WIPE_TRASH_REASON, floorId },
  })));
  return rows.length;
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
    const [polygonState, backgrounds, dxfLevels, bimCounts] =
      await Promise.all([
        FloorplanCascadeDeleteService.getFloorPolygonState(companyId, floorId),
        listBackgrounds(db, companyId, floorId),
        listStoreyDxfLevels(db, companyId, floorId),
        countBimForFloor(companyId, floorId),
      ]);

    // ADR-351 + ADR-899 §2.2.1: the SAME gathering and the SAME partition as executeWipe, so the
    // dialog says exactly what will happen — including what will NOT be deleted.
    const files = partitionFloorFiles(await gatherFloorFileRows(db, companyId, floorId, backgrounds, dxfLevels));

    return {
      floorplanOverlayCount: polygonState.floorplanOverlayCount,
      floorplanBackgroundCount: backgrounds.length,
      fileRecordCount: files.trash.length,
      heldFileCount: files.held.length,
      totalPolygons: polygonState.total,
      bimEntityCount: bimCounts.bimEntityCount,
      boqItemCount: bimCounts.boqItemCount,
    };
  }

  /**
   * Wipe everything tied to a floor (files through the purge pipeline — see the module header).
   * Idempotent: zero-state input returns success no-op. Best-effort on the orphan sweep (failures logged).
   */
  static async wipeAllForFloor(
    companyId: string,
    floorId: string,
    opts: WipeAllForFloorOptions,
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
    listStoreyDxfLevels(db, companyId, floorId),
    loadFloorProjectId(db, companyId, floorId),
  ]);

  // Opt-in BIM + auto-BOQ purge (full replace). Runs first so a failure aborts
  // before we delete the file/scene the user may still want to keep.
  const bim = opts.wipeBim
    ? await wipeBimForFloor(companyId, floorId, opts.audit)
    : { bimEntitiesDeleted: 0, boqItemsDeleted: 0 };

  // ADR-351: referenced rows ∪ EVERY FileRecord of this floor (catches never-linked orphans).
  const fileRows = await gatherFloorFileRows(db, companyId, floorId, backgrounds, dxfLevels);
  const files = partitionFloorFiles(fileRows);
  if (files.held.length > 0) {
    // «Κρατημένο μένει, με ίχνος» (ίδιο μοτίβο με το `CASCADE_PRESERVATION` του deletion-guard).
    logger.info('Floor wipe: held files stay', {
      companyId, floorId, held: files.held.map((row) => row.ref.id),
    });
  }

  // Polygons FIRST — cascade reads dxf_viewer_levels (still alive here).
  const cascade = await FloorplanCascadeDeleteService.cascadeAllPolygonsForFloor(
    companyId,
    floorId,
  );

  // Files to the purge queue BEFORE the backgrounds go, and the backgrounds die DETACHED: their `onDelete`
  // trigger must never re-decide a file the wipe already judged (held ⇒ stays; free ⇒ already queued).
  const [dxfLevelsCleared, fileRecordsTrashed] = await Promise.all([
    clearDxfLevelsInChunks(db, dxfLevels),
    trashFileRowsInChunks(db, companyId, floorId, files.trash, opts.performedBy),
  ]);
  const floorplanBackgroundsDeleted = await detachThenDeleteBackgrounds(db, backgrounds);

  // Orphan net: binaries under the floor-category prefix that NO record claims (derivations whose parent
  // FileRecord was hard-deleted by a pre-2026-11-02 wipe). Every record of the floor — held, queued, or a
  // tombstone — claims its original and companions (`claimedByFileRows`), so this never deletes their bytes.
  //
  // ADR-709: the canonical prefix is ALWAYS swept — it no longer depends on the
  // floor's project being resolvable, which is what previously made this sweep
  // skip itself silently. The legacy project-scoped prefix is swept in addition
  // whenever the project IS known, so pre-ADR-709 objects are not stranded.
  const sweepPrefixes = [
    buildCategoryStoragePrefix({
      companyId, entityType: 'floor', entityId: floorId,
      domain: FILE_DOMAINS.CONSTRUCTION, category: FILE_CATEGORIES.FLOORPLANS,
    }),
    ...(projectId
      ? [buildLegacyProjectScopedPrefix(projectId, {
          companyId, entityType: 'floor', entityId: floorId,
          domain: FILE_DOMAINS.CONSTRUCTION, category: FILE_CATEGORIES.FLOORPLANS,
        })]
      : []),
  ];
  const isClaimed = claimedByFileRows(fileRows);
  const sweep = sumTallies(await Promise.all(sweepPrefixes.map((prefix) => sweepFloorCategoryPath(prefix, isClaimed))));

  return {
    floorplanOverlaysDeleted: cascade.floorplanOverlaysDeleted,
    dxfLevelsCleared,
    floorplanBackgroundsDeleted,
    fileRecordsTrashed,
    fileRecordsHeld: files.held.length,
    storageObjectsDeleted: sweep.deleted,
    storageObjectsFailed: sweep.failed,
    storageObjectsSpared: sweep.spared,
    bimEntitiesDeleted: bim.bimEntitiesDeleted,
    boqItemsDeleted: bim.boqItemsDeleted,
  };
}
