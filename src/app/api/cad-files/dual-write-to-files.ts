/**
 * 📐 CAD FILES → `files` collection dual-write (server-side, ADR-288)
 *
 * Ported from the browser-side `writeToFilesCollection` helper in
 * `dxf-firestore-storage.impl.ts`. Produces an enterprise FileRecord in the
 * `files` collection so CAD uploads appear in the shared Files UI
 * (EntityFilesManager / BuildingFloorplanTab / FloorFloorplanService).
 *
 * Non-blocking: failures here never fail the cadFiles upsert — they are logged
 * and swallowed so the primary metadata write remains authoritative.
 *
 * @see ADR-031 — File Storage Consolidation (cadFiles → files)
 * @see ADR-240 — Wizard dual-write entityType/floorId/purpose propagation
 */

import 'server-only';

import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  LEGACY_STORAGE_PATHS,
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
  entityType?: 'building' | 'floor' | 'property';
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
  entityType: 'building' | 'floor' | 'property',
  context: DualWriteContext | undefined
): string {
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
 */
export async function dualWriteToFilesCollection(params: DualWriteParams): Promise<void> {
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
    const scenePath =
      context?.canonicalScenePath ?? `${LEGACY_STORAGE_PATHS.DXF_SCENES}/${fileId}/scene.json`;

    const resolvedEntityType = (context?.entityType ?? 'building') as
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

    logger.debug('Dual-write to files collection succeeded', { fileId });
  } catch (error) {
    logger.warn('Dual-write to files collection failed (non-blocking)', {
      fileId: params.fileId,
      error: getErrorMessage(error),
    });
  }
}
