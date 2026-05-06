import { getErrorMessage } from '@/lib/error-utils';
import { storage } from '../../../lib/firebase';
import { ref, uploadBytes, getDownloadURL, getBytes } from 'firebase/storage';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import pako from 'pako';
import type { SceneModel } from '../types/scene';
import {
  DxfSecurityValidator,
  type SecurityValidationResult,
  SecuritySeverity,
} from '../security/DxfSecurityValidator';
import { generateFileId as enterpriseGenerateFileId } from '@/services/enterprise-id.service';
import { upsertCadFileWithPolicy } from '@/services/cad-file-mutation-gateway';
import { dxfLogger, isExpectedError } from './dxf-firestore-logger';
import type { DxfSaveContext, DxfFileMetadata, DxfFileRecord } from './dxf-firestore.types';
import { mapFileRecordToDxfMetadata } from './dxf-firestore.types';
import type { FileRecord } from '@/types/file-record';

// =============================================================================
// 🏢 ENTERPRISE STORAGE IMPLEMENTATION MODULE
// =============================================================================
// Contains the heavy lifting for DXF scene persistence:
//  - Upload/download scene JSON to Firebase Storage (client-side)
//  - Security validation pipeline
//  - Delegates cadFiles metadata writes + dual-write to the centralized
//    /api/cad-files SSOT endpoint (ADR-288). No direct client-side Firestore
//    writes on cadFiles/files collections live here anymore.
//
// The public-facing `DxfFirestoreService` class delegates to these functions,
// keeping its surface area thin and enabling testability of each concern.
// =============================================================================


/**
 * Generate a simple checksum for change detection
 */
export function generateSceneChecksum(scene: SceneModel): string {
  const data = {
    entityCount: scene.entities.length,
    layerCount: Object.keys(scene.layers).length,
    bounds: scene.bounds,
    units: scene.units,
  };
  return btoa(JSON.stringify(data)).substring(0, 16);
}

/**
 * Get file metadata only (without scene data)
 * 🏢 ADR-292 Phase 3: Reads from canonical `files` collection (was cadFiles)
 */
export async function getFileMetadataImpl(fileId: string): Promise<DxfFileMetadata | null> {
  const record = await firestoreQueryService.getById<FileRecord>('FILES', fileId);
  if (!record) return null;
  return mapFileRecordToDxfMetadata(record);
}

/**
 * Internal method to get document (metadata only — scene loaded from Storage)
 * 🏢 ADR-292 Phase 3: Reads from canonical `files` collection (was cadFiles)
 */
export async function getFileImpl(fileId: string): Promise<DxfFileRecord | null> {
  const metadata = await getFileMetadataImpl(fileId);
  if (!metadata) return null;
  // DxfFileRecord.scene is loaded separately by loadFromStorageImpl
  return {
    id: metadata.id,
    fileName: metadata.fileName,
    scene: {} as SceneModel, // Placeholder — real scene loaded from Storage
    lastModified: metadata.lastModified,
    version: metadata.version,
    checksum: metadata.checksum,
  };
}

/**
 * Enterprise validation before save operations
 */
export async function validateForSaveImpl(
  fileName: string,
  scene: SceneModel
): Promise<{
  isValid: boolean;
  fileId: string;
  sanitizedFileName: string;
  validationResults: SecurityValidationResult[];
}> {
  dxfLogger.debug('Running enterprise security validation', { fileName });

  // Estimate file size from scene JSON
  const sceneJson = JSON.stringify(scene, null, 0);
  const estimatedFileSize = sceneJson.length;

  // Run complete validation workflow
  const validationResults = DxfSecurityValidator.validateDxfUpload({
    fileName,
    fileSize: estimatedFileSize,
    scene,
  });

  // Generate secure identifiers — enterprise ID (SOS N.6)
  const sanitizedFileName = DxfSecurityValidator.sanitizeFileName(fileName);
  const fileId = enterpriseGenerateFileId();

  // Check if validation passed
  const isValid = !DxfSecurityValidator.hasBlockingErrors(validationResults);

  const summary = DxfSecurityValidator.getValidationSummary(validationResults);

  // 🏢 ENTERPRISE: DEBUG level for validation summary (dev only)
  dxfLogger.debug('Security validation summary', {
    isValid,
    fileId,
    sanitizedFileName,
    criticalErrors: summary.criticalErrors,
    highErrors: summary.highErrors,
    mediumErrors: summary.mediumErrors,
    lowWarnings: summary.lowWarnings,
  });

  if (!isValid) {
    // 🏢 ENTERPRISE: WARN level for validation failures (important but expected)
    dxfLogger.warn('Security validation FAILED', {
      fileName,
      fileId,
      blockingErrors: validationResults
        .filter(
          r =>
            !r.isValid &&
            (r.severity === SecuritySeverity.HIGH || r.severity === SecuritySeverity.CRITICAL)
        )
        .map(r => r.message),
    });
  }

  return {
    isValid,
    fileId,
    sanitizedFileName,
    validationResults,
  };
}

/**
 * Save scene to Firebase Storage + metadata to Firestore (Enterprise Edition).
 *
 * 🏢 ADR-288: Metadata writes go through the centralized /api/cad-files
 * endpoint via `upsertCadFileWithPolicy`. This function only performs the
 * client-side Firebase Storage upload (scene JSON bytes) and then delegates
 * the cadFiles + files dual-write to the server-side SSOT pipeline.
 *
 * @see ADR-288 — CAD File Metadata Centralization
 * @see ADR-031 — File Storage Consolidation (cadFiles → files)
 */
export async function saveToStorageImpl(
  fileId: string,
  fileName: string,
  scene: SceneModel,
  context?: DxfSaveContext
): Promise<boolean> {
  try {
    dxfLogger.debug('Saving to Storage', { fileId, fileName });

    // 1. Create scene JSON for storage
    const sceneJson = JSON.stringify(scene, null, 0); // No formatting to save space
    const sceneBytes = new TextEncoder().encode(sceneJson);

    // 2. Upload to Firebase Storage
    // 🏢 ADR-293: canonicalScenePath is REQUIRED — no legacy dxf-scenes/ fallback
    if (!context?.canonicalScenePath) {
      dxfLogger.error('canonicalScenePath is required for DXF scene saves (ADR-293). Pass it via DxfSaveContext.', { fileId });
      throw new Error('canonicalScenePath is required for DXF scene saves (ADR-293)');
    }
    const storagePath = context.canonicalScenePath;
    const storageRef = ref(storage, storagePath);

    const snapshot = await uploadBytes(storageRef, sceneBytes, {
      contentType: 'application/json',
      customMetadata: {
        fileName,
        version: Date.now().toString(),
      },
    });

    // 3. Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    // 4. Run security validation for audit trail
    const validation = await validateForSaveImpl(fileName, scene);

    // 5. 🏢 ADR-288: Upsert cadFiles metadata via centralized server endpoint.
    //    Server computes the next version, writes cadFiles, dual-writes `files`,
    //    and records an audit log entry. companyId/createdBy come from auth ctx.
    //    Throws on HTTP/contract failure — handled by the outer try/catch.
    const upsertResult = await upsertCadFileWithPolicy({
      fileId,
      fileName,
      storageUrl: downloadURL,
      storagePath,
      sizeBytes: sceneBytes.length,
      entityCount: scene.entities.length,
      checksum: generateSceneChecksum(scene),
      securityValidation: {
        validationResults: validation.validationResults as unknown as Array<{
          isValid: boolean;
          [key: string]: unknown;
        }>,
        isSecure: validation.isValid,
      },
      context: context
        ? {
            projectId: context.projectId,
            buildingId: context.buildingId,
            floorId: context.floorId,
            entityType: context.entityType,
            filesCategory: context.filesCategory,
            purpose: context.purpose,
            entityLabel: context.entityLabel,
            canonicalScenePath: context.canonicalScenePath,
          }
        : undefined,
    });

    // 🏢 ENTERPRISE: INFO level for successful saves (important operation)
    dxfLogger.info('Storage save complete', {
      fileId,
      version: upsertResult.version,
      created: upsertResult.created,
      sizeKB: Math.round(sceneBytes.length / 1024),
      entities: scene.entities.length,
    });

    return true;
  } catch (error: unknown) {
    // 🏢 ENTERPRISE: Structured error handling with appropriate log levels
    const errorDetails = {
      operation: 'saveToStorage',
      fileId,
      fileName,
      entityCount: scene.entities.length,
      error: getErrorMessage(error),
    };

    // Classify error and use appropriate log level
    if (error instanceof Error) {
      // Quota exceeded → WARN (recoverable with cleanup)
      if (error.message.includes('quota') || error.message.includes('QUOTA_EXCEEDED')) {
        dxfLogger.warn('Storage quota exceeded - consider cleanup', errorDetails);
        return false;
      }

      // Network errors → WARN (transient, may recover on retry)
      if (error.message.includes('network') || error.message.includes('fetch')) {
        dxfLogger.warn('Network error during save - retry may help', errorDetails);
        return false;
      }

      // Permission denied → ERROR (configuration issue)
      if (error.message.includes('permission') || error.message.includes('PERMISSION_DENIED')) {
        dxfLogger.error('Permission denied - check Firebase rules', errorDetails);
        return false;
      }
    }

    // Unknown/unexpected errors → ERROR
    dxfLogger.error('Storage save failed', errorDetails);
    return false;
  }
}

/**
 * Try downloading bytes from a Storage path. Returns null on any error.
 */
async function tryGetBytes(path: string): Promise<ArrayBuffer | null> {
  try {
    return await getBytes(ref(storage, path));
  } catch {
    return null;
  }
}

/**
 * Parse scene JSON text into a validated SceneModel.
 * Returns null if JSON is invalid or scene is empty (placeholder `{}`).
 */
function parseAndValidateScene(text: string): SceneModel | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const entities = parsed.entities;
    if (!Array.isArray(entities) || entities.length === 0) return null;
    return {
      entities: entities as SceneModel['entities'],
      layers: (parsed.layers ?? {}) as SceneModel['layers'],
      bounds: (parsed.bounds ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 }) as SceneModel['bounds'],
      units: (parsed.units ?? 'mm') as SceneModel['units'],
    };
  } catch {
    return null;
  }
}

/**
 * Load scene from Firebase Storage + metadata from Firestore.
 *
 * 3-tier fallback:
 *  1. `.scene.json`      — client auto-save (plain JSON)
 *  2. `.processed.json`  — server wizard processing (gzip, ADR-033)
 *  3. raw storagePath     — legacy fallback (plain JSON)
 *
 * @enterprise Silent on expected failures (missing files), loud on real errors
 */
export async function loadFromStorageImpl(fileId: string): Promise<DxfFileRecord | null> {
  try {
    dxfLogger.debug('Loading from Storage', { fileId });

    // 1. Get FULL record from Firestore (need processedData.processedDataPath)
    const record = await firestoreQueryService.getById<FileRecord>('FILES', fileId);
    if (!record) return null;

    const metadata = mapFileRecordToDxfMetadata(record);

    if (!metadata.storagePath) {
      dxfLogger.error('DXF document missing storagePath (ADR-293)', { fileId });
      return null;
    }

    const rawPath = metadata.storagePath;
    const scenePath = rawPath.endsWith('.scene.json')
      ? rawPath
      : rawPath.replace(/\.[^/.]+$/, '.scene.json');
    const processedPath = record.processedData?.processedDataPath;

    let scene: SceneModel | null = null;
    let source = '';

    // ── Tier 1: .scene.json (client auto-save) ──
    const sceneBytes = await tryGetBytes(scenePath);
    if (sceneBytes) {
      const text = new TextDecoder().decode(sceneBytes);
      scene = parseAndValidateScene(text);
      if (scene) source = 'scene.json';
    }

    // ── Tier 2: .processed.json (server wizard — gzip compressed) ──
    if (!scene && processedPath) {
      const compressedBytes = await tryGetBytes(processedPath);
      if (compressedBytes) {
        try {
          const text = pako.ungzip(new Uint8Array(compressedBytes), { to: 'string' }) as unknown as string;
          scene = parseAndValidateScene(text);
          if (scene) source = 'processed.json';
        } catch {
          dxfLogger.warn('Failed to decompress processed scene', { fileId, processedPath });
        }
      }
    }

    // ── Tier 3: raw storagePath (legacy — if it happens to be scene JSON) ──
    if (!scene && scenePath !== rawPath) {
      const rawBytes = await tryGetBytes(rawPath);
      if (rawBytes) {
        const text = new TextDecoder().decode(rawBytes);
        scene = parseAndValidateScene(text);
        if (scene) source = 'raw-path';
      }
    }

    if (!scene) {
      const isNonDxfFile = /\.(pdf|png|jpg|jpeg|webp|gif|bmp|svg)$/i.test(rawPath);
      if (isNonDxfFile) {
        dxfLogger.debug('File is PDF/image, not a DXF scene — skipping', { fileId });
      } else {
        dxfLogger.error('No valid scene found in any Storage path', {
          fileId, scenePath, processedPath: processedPath ?? 'none', rawPath,
        });
      }
      return null;
    }

    dxfLogger.debug('Storage load complete', {
      fileId, source, entities: scene.entities.length,
    });

    return {
      id: metadata.id,
      fileName: metadata.fileName,
      scene,
      lastModified: metadata.lastModified,
      version: metadata.version,
      checksum: metadata.checksum,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (isExpectedError(error)) {
        dxfLogger.debug('File not found in Storage (expected)', { fileId });
        return null;
      }
      if (error.message.includes('network') || error.message.includes('fetch')) {
        dxfLogger.warn('Network error during load - retry may help', { fileId });
        return null;
      }
    }

    dxfLogger.error('Unexpected storage load error', {
      fileId, error: getErrorMessage(error),
    });
    return null;
  }
}
