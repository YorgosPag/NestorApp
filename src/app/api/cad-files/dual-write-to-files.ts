/**
 * 📐 DXF FileRecord writer — canonical `files` collection (server-side)
 *
 * 🏢 ADR-292 Phase 3: This is now the PRIMARY and ONLY write target for DXF
 * metadata. The `cadFiles` collection is fully deprecated — no reads or writes.
 *
 * Produces an enterprise FileRecord in the `files` collection so DXF uploads
 * appear in the shared Files UI (EntityFilesManager / BuildingFloorplanTab /
 * FloorFloorplanService / DXF Viewer).
 *
 * Errors PROPAGATE to the caller (was non-blocking when cadFiles was primary).
 *
 * @see ADR-292 — Floorplan Upload Consolidation Map
 * @see ADR-240 — Wizard dual-write entityType/floorId/purpose propagation
 */

import 'server-only';

import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  type EntityType,
  type FileDomain,
  type FileCategory,
} from '@/config/domain-constants';
import { buildFileDisplayName } from '@/services/upload/utils/file-display-name';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('CadFilesDualWrite');

export interface DualWriteContext {
  projectId?: string;
  buildingId?: string;
  floorId?: string;
  entityType?: 'project' | 'building' | 'floor' | 'property';
  filesCategory?: 'drawings' | 'floorplans';
  purpose?: string;
  entityLabel?: string;
  canonicalScenePath?: string;
}

export interface DualWriteParams {
  fileId: string;
  fileName: string;
  downloadUrl: string;
  sizeBytes: number;
  entityCount: number;
  /**
   * Number of layers in the scene. Threaded from the save call site
   * (`Object.keys(scene.layersById).length`) so auto-saves record the REAL
   * count instead of the old hardcoded `0`. Omit → the field is not written and
   * `merge: true` preserves the wizard's value.
   */
  layerCount?: number;
  version: number;
  companyId: string;
  createdBy: string;
  context?: DualWriteContext;
  /**
   * 🛡️ ADR-420 / ADR-399 data-integrity fix (incident 2026-06-16 — cross-floor
   * `entityId` drift): `true` only on the FIRST write of this fileId. The
   * entity-linking identity fields (`entityType`/`entityId`/`projectId`) are
   * creation-time identity and MUST be write-once — never re-derived from the
   * volatile per-save `context.floorId` on a later merge-update. A stale
   * `saveContext.floorId` (sticky across level switches) otherwise overwrote a
   * floor file's `entityId` with ANOTHER floor's id while `storagePath` (the
   * immutable canonical location, never re-written on merge — see below) stayed
   * correct → `isCrossFloorSceneLink` false-positived → the level's save target
   * was nulled → every BIM entity on that floor silently failed to persist.
   * When omitted/`false` the identity fields are preserved by `merge: true`.
   */
  isCreate?: boolean;
}

/**
 * Resolve the entityId used for the FileRecord, matching legacy behaviour
 * (floor → floorId; property → floorId/buildingId; building → buildingId).
 */
function resolveEntityId(
  entityType: 'project' | 'building' | 'floor' | 'property',
  context: DualWriteContext | undefined
): string {
  if (entityType === 'project') {
    return context?.projectId ?? 'standalone';
  }
  if (entityType === 'floor') {
    return context?.floorId ?? 'standalone';
  }
  if (entityType === 'property') {
    return context?.floorId ?? context?.buildingId ?? 'standalone';
  }
  return context?.buildingId ?? 'standalone';
}

/**
 * Write the enterprise FileRecord to the `files` collection.
 * Always uses `merge: true` so repeated auto-saves update rather than overwrite.
 *
 * 🏢 ADR-292 Phase 3: This is the PRIMARY write (was dual-write). Errors propagate.
 *
 * @deprecated alias — use `writeToFilesCollection` directly
 */
export const dualWriteToFilesCollection = writeToFilesCollection;

/**
 * Write the enterprise FileRecord to the `files` collection (PRIMARY).
 * Always uses `merge: true` so repeated auto-saves update rather than overwrite.
 */
export async function writeToFilesCollection(params: DualWriteParams): Promise<void> {
  const {
    fileId,
    fileName,
    downloadUrl,
    sizeBytes,
    entityCount,
    layerCount,
    version,
    companyId,
    createdBy,
    context,
    isCreate,
  } = params;

  try {
    // 🏢 ADR-293: canonicalScenePath is REQUIRED — no legacy dxf-scenes/ fallback.
    // 🛡️ ROOT-CAUSE FIX (incident 2026-06-08 — phantom sceneFileId): THROW, do NOT
    // silently return. A silent return let the upsert resolve 200 OK → autoSaveV2
    // reported success → onSceneSaved fired → the level was linked to a fileId whose
    // `files` doc was never written → on reload loadFromStorageImpl returned null →
    // empty canvas. Throwing makes the save fail loudly so the level is never linked
    // to a non-existent FileRecord.
    if (!context?.canonicalScenePath) {
      logger.error('canonicalScenePath missing in dual-write — refusing FileRecord write (ADR-293)', { fileId });
      throw new Error('canonicalScenePath missing — cannot write FileRecord (ADR-293)');
    }
    const scenePath = context.canonicalScenePath;

    // Use provided entity context OR fall back to defaults for display-name generation only.
    // CRITICAL: entity-linking fields (entityType/entityId/category/storagePath) are only
    // written when explicitly provided — merge: true preserves wizard-set values on auto-save.
    const resolvedEntityType = (context?.entityType ?? 'building') as
      | 'project'
      | 'building'
      | 'floor'
      | 'property';
    const resolvedEntityId = resolveEntityId(resolvedEntityType, context);
    const resolvedCategory = context?.filesCategory ?? 'drawings';

    const cleanedFileName = fileName.replace(/\.dxf$/i, '').trim();
    // 🛡️ displayName is WRITE-ONCE (only generated/written on create). On a
    // merge-update the auto-save context falls back to category 'drawings' +
    // entityLabel=fileName, which regenerated "drawings - <file>" and clobbered
    // the wizard's "Κατόψεις Ορόφου - <label>" (and any user rename). Generate it
    // only on create; later saves omit the field so `merge: true` preserves it.
    const generatedDisplayName = isCreate
      ? buildFileDisplayName({
          entityType: resolvedEntityType as EntityType,
          entityId: resolvedEntityId,
          domain: 'construction' as FileDomain,
          category: resolvedCategory as FileCategory,
          entityLabel: context?.entityLabel || cleanedFileName,
          purpose: context?.purpose,
          ext: 'dxf',
          originalFilename: fileName,
        }).displayName
      : undefined;

    const fileRecord = {
      id: fileId,
      companyId,
      // 🛡️ ADR-420 — entity-linking identity is WRITE-ONCE (only on the create write).
      // On a merge-update `isCreate` is false → these are omitted so `merge: true`
      // preserves the creation-time values. Re-deriving them from the volatile
      // per-save `context.floorId`/`projectId` on every auto-save is exactly how a
      // stale `saveContext.floorId` drifted a floor file's `entityId` to ANOTHER
      // floor (storagePath stayed correct → cross-floor false-positive → BIM never
      // persisted). The wizard create carries the correct context; later saves keep it.
      ...(isCreate && context?.projectId ? { projectId: context.projectId } : {}),
      ...(isCreate && context?.entityType ? {
        entityType: resolvedEntityType,
        entityId: resolvedEntityId,
      } : {}),
      domain: 'construction' as const,
      // category: only write if explicitly provided — prevents overwriting 'floorplans' with
      // 'drawings' default on DXF Viewer auto-save (would hide file from FloorplanGallery query)
      ...(context?.filesCategory ? { category: context.filesCategory } : {}),
      ...(context?.purpose ? { purpose: context.purpose } : {}),
      // storagePath: intentionally NOT included — merge: true preserves original DXF file path.
      // Auto-save writes the scene JSON path to processedData.processedDataPath only.
      // Overwriting storagePath with .scene.json breaks deriveScenePath on the next session reload.
      // 🛡️ displayName WRITE-ONCE (see above): omitted on update → merge preserves it.
      ...(isCreate ? { displayName: generatedDisplayName } : {}),
      originalFilename: fileName,
      ext: 'dxf',
      contentType: 'application/dxf',
      status: 'ready' as const,
      lifecycleState: 'active' as const,
      isDeleted: false,
      sizeBytes,
      downloadUrl,
      revision: version,
      hash: null,
      // 🛡️ createdAt is WRITE-ONCE — with `merge: true` an unconditional
      // serverTimestamp() overwrote the creation time on EVERY auto-save. Write
      // it only on create; `updatedAt` always tracks the latest save.
      createdBy,
      ...(isCreate ? { createdAt: FieldValue.serverTimestamp() } : {}),
      updatedAt: FieldValue.serverTimestamp(),
      processedData: {
        fileType: 'dxf' as const,
        // Real layerCount threaded from the scene (was hardcoded 0). parseTimeMs
        // is intentionally omitted on auto-save (no parse happens) so `merge: true`
        // preserves the wizard's original value instead of zeroing it.
        sceneStats: {
          entityCount,
          ...(typeof layerCount === 'number' ? { layerCount } : {}),
        },
        processedDataPath: scenePath,
        processedDataUrl: downloadUrl,
        processedAt: Date.now(),
      },
    };

    const adminDb = getAdminFirestore();
    await adminDb.collection(COLLECTIONS.FILES).doc(fileId).set(fileRecord, { merge: true });

    logger.debug('FileRecord written to files collection', { fileId });
  } catch (error) {
    // 🏢 ADR-292 Phase 3: Errors propagate (this is the primary write now)
    logger.error('Failed to write FileRecord to files collection', {
      fileId: params.fileId,
      error: getErrorMessage(error),
    });
    throw error;
  }
}
