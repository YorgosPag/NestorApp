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
  version: number;
  companyId: string;
  createdBy: string;
  context?: DualWriteContext;
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
    version,
    companyId,
    createdBy,
    context,
  } = params;

  try {
    // 🏢 ADR-293: canonicalScenePath is REQUIRED — no legacy dxf-scenes/ fallback
    if (!context?.canonicalScenePath) {
      logger.error('canonicalScenePath missing in dual-write — skipping FileRecord creation (ADR-293)', { fileId });
      return;
    }
    const scenePath = context.canonicalScenePath;

    const resolvedEntityType = (context?.entityType ?? 'building') as
      | 'project'
      | 'building'
      | 'floor'
      | 'property';
    const resolvedEntityId = resolveEntityId(resolvedEntityType, context);
    const resolvedCategory = context?.filesCategory ?? 'drawings';

    const cleanedFileName = fileName.replace(/\.dxf$/i, '').trim();
    const { displayName: generatedDisplayName } = buildFileDisplayName({
      entityType: resolvedEntityType as EntityType,
      entityId: resolvedEntityId,
      domain: 'construction' as FileDomain,
      category: resolvedCategory as FileCategory,
      entityLabel: context?.entityLabel || cleanedFileName,
      purpose: context?.purpose,
      ext: 'dxf',
      originalFilename: fileName,
    });

    const fileRecord = {
      id: fileId,
      companyId,
      projectId: context?.projectId ?? null,
      entityType: resolvedEntityType,
      entityId: resolvedEntityId,
      domain: 'construction' as const,
      category: resolvedCategory,
      ...(context?.purpose ? { purpose: context.purpose } : {}),
      storagePath: scenePath,
      displayName: generatedDisplayName,
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
      createdBy,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      processedData: {
        fileType: 'dxf' as const,
        sceneStats: { entityCount, layerCount: 0, parseTimeMs: 0 },
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
