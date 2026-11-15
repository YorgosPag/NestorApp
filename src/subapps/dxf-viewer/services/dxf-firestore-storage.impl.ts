import { getErrorMessage } from '@/lib/error-utils';
import { serializedByteLength } from '@/lib/serialized-size';
import { storage } from '../../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { SceneModel } from '../types/scene';
import {
  DxfSecurityValidator,
  type SecurityValidationResult,
  SecuritySeverity,
} from '../security/DxfSecurityValidator';
import { generateFileId as enterpriseGenerateFileId } from '@/services/enterprise-id.service';
import { upsertCadFileWithPolicy } from '@/services/cad-file-mutation-gateway';
import { dxfLogger } from './dxf-firestore-logger';
import type { DxfSaveContext, DxfFileMetadata, DxfFileRecord } from './dxf-firestore.types';
import { mapFileRecordToDxfMetadata } from './dxf-firestore.types';
import type { FileRecord } from '@/types/file-record';
import { countSceneLayers } from '../utils/scene-entity-count';

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
    layerCount: countSceneLayers(scene),
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
    storagePath: metadata.storagePath,
  };
}

/**
 * Enterprise validation before save operations
 */
export async function validateForSaveImpl(
  fileName: string,
  scene: SceneModel,
  // 🚀 PERF (2026-06-11): callers that already serialised the scene (saveToStorageImpl
  // encodes the same bytes for upload) pass the byte length here to avoid a second
  // ~950KB JSON.stringify per save. Omitted → serialise as before (standalone call).
  precomputedSizeBytes?: number
): Promise<{
  isValid: boolean;
  fileId: string;
  sanitizedFileName: string;
  validationResults: SecurityValidationResult[];
}> {
  dxfLogger.debug('Running enterprise security validation', { fileName });

  // Μέγεθος σκηνής **σε bytes UTF-8** — το ίδιο νούμερο που ανεβαίνει στο δίκτυο.
  // 🔴 ADR-833 Φ5Α: εδώ ήταν `JSON.stringify(scene, null, 0).length`, δηλαδή **μονάδες
  // UTF-16**. Στα ελληνικά η διαφορά είναι ×1,45 (μετρημένο, CHECK 3.34 §8.43: 163.749
  // αντί για 240.521) και πάντα **προς τα κάτω** — δηλαδή το όριο των 25 MB δεν
  // μπλόκαρε ποτέ όταν έπρεπε· άφηνε το ανέβασμα να αποτύχει στο δίκτυο, όπου το μήνυμα
  // δεν λέει τι να κόψεις. Το ίδιο αρχείο μετρούσε ήδη σωστά για το ανέβασμα (γρ. 170),
  // άρα η **ίδια** σκηνή έβγαζε δύο μεγέθη ανάλογα με το ποιος ρώτησε.
  const estimatedFileSize = precomputedSizeBytes ?? serializedByteLength(scene);

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

    // 4. Run security validation for audit trail.
    //    🚀 PERF (2026-06-11): reuse the bytes already encoded above (step 1) so the
    //    validator does not re-stringify the full ~950KB scene a second time per save.
    const validation = await validateForSaveImpl(fileName, scene, sceneBytes.length);

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
      layerCount: countSceneLayers(scene),
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
            propertyId: context.propertyId,
            levelFloorId: context.levelFloorId,
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

// ADR-358 Phase 9E-6f — `parseAndValidateScene` lives in `./dxf-scene-json.ts`
// as a Firebase-free pure helper so it can be unit-tested without the auth
// harness; re-exported here for call-site stability.
export { parseAndValidateScene } from './dxf-scene-json';

// ADR-913 §2 — η φόρτωση σκηνής (με τον ΛΟΓΟ της απουσίας της) ζει στο `./dxf-scene-storage-load.ts`
// (N.7.1 extract)· re-export εδώ για σταθερά call-sites (`DxfFirestoreService.loadFileV2`).
export { loadFromStorageImpl } from './dxf-scene-storage-load';
