import { getErrorMessage } from '@/lib/error-utils';
import { db, storage } from '../../../lib/firebase';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getBytes } from 'firebase/storage';
import { COLLECTIONS } from '../../../config/firestore-collections';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { buildFileDisplayName } from '@/services/upload/utils/file-display-name';
import {
  LEGACY_STORAGE_PATHS,
  type EntityType,
  type FileDomain,
  type FileCategory,
} from '@/config/domain-constants';
import type { SceneModel } from '../types/scene';
import {
  DxfSecurityValidator,
  type SecurityValidationResult,
  SecuritySeverity,
} from '../security/DxfSecurityValidator';
import { generateFileId as enterpriseGenerateFileId } from '@/services/enterprise-id.service';
import { dxfLogger, isExpectedError } from './dxf-firestore-logger';
import type { DxfSaveContext, DxfFileMetadata, DxfFileRecord } from './dxf-firestore.types';

// =============================================================================
// 🏢 ENTERPRISE STORAGE IMPLEMENTATION MODULE
// =============================================================================
// Contains the heavy lifting for DXF scene persistence:
//  - Save/load scenes to Firebase Storage + Firestore metadata
//  - Security validation pipeline
//  - Dual-write to `files` collection (cadFiles → files consolidation)
//
// The public-facing `DxfFirestoreService` class delegates to these functions,
// keeping its surface area thin and enabling testability of each concern.
// =============================================================================

const COLLECTION_NAME = COLLECTIONS.CAD_FILES;
const STORAGE_FOLDER = LEGACY_STORAGE_PATHS.DXF_SCENES;

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
 * 🏢 ADR-214 Phase 10: Migrated to firestoreQueryService.getById
 */
export async function getFileMetadataImpl(fileId: string): Promise<DxfFileMetadata | null> {
  return firestoreQueryService.getById<DxfFileMetadata>('CAD_FILES', fileId);
}

/**
 * Internal method to get document
 * 🏢 ADR-214 Phase 10: Migrated to firestoreQueryService.getById
 */
export async function getFileImpl(fileId: string): Promise<DxfFileRecord | null> {
  return firestoreQueryService.getById<DxfFileRecord>('CAD_FILES', fileId);
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
 * 🔄 DUAL-WRITE: Write enterprise FileRecord to `files` collection.
 * Maps DxfFileMetadata → FileRecord schema for cadFiles → files consolidation.
 * Uses merge: true so repeated saves update rather than overwrite.
 *
 * @enterprise ADR-031 — File Storage Consolidation (cadFiles → files)
 */
async function writeToFilesCollection(
  fileId: string,
  fileName: string,
  downloadUrl: string,
  sizeBytes: number,
  entityCount: number,
  version: number,
  context?: DxfSaveContext
): Promise<void> {
  // 🏢 ENTERPRISE: Use canonical scene path if available
  const scenePath = context?.canonicalScenePath ?? `${STORAGE_FOLDER}/${fileId}/scene.json`;
  if (!context?.canonicalScenePath) {
    dxfLogger.warn(
      'Using legacy dxf-scenes/ path in files collection — provide canonicalScenePath in DxfSaveContext',
      { fileId }
    );
  }

  // 🏢 ADR-240: Resolve entityType + entityId from context (fix hardcoded 'building')
  const resolvedEntityType = context?.entityType ?? 'building';
  const resolvedEntityId = (() => {
    if (resolvedEntityType === 'floor') return context?.floorId ?? 'standalone';
    if (resolvedEntityType === 'property')
      return context?.floorId ?? context?.buildingId ?? 'standalone';
    return context?.buildingId ?? 'standalone';
  })();
  const resolvedCategory = context?.filesCategory ?? 'drawings';

  // 🏢 ENTERPRISE: Generate proper displayName via centralized buildFileDisplayName
  // instead of using the raw filename (fixes ΕΚΚΡ.2 — floorplan display names)
  // When no entityLabel from wizard context, use cleaned filename as fallback
  // to avoid generic-only names like "Σχέδια" for direct DXF saves
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
    companyId: context?.companyId ?? null,
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
    createdBy: context?.createdBy ?? 'system',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    processedData: {
      fileType: 'dxf' as const,
      sceneStats: { entityCount, layerCount: 0, parseTimeMs: 0 },
      processedDataPath: scenePath,
      processedDataUrl: downloadUrl,
      processedAt: Date.now(),
    },
  };

  const filesDocRef = doc(db, COLLECTIONS.FILES, fileId);
  await setDoc(filesDocRef, fileRecord, { merge: true });

  dxfLogger.debug('Dual-write to files collection succeeded', { fileId });
}

/**
 * Save scene to Firebase Storage + metadata to Firestore (Enterprise Edition)
 * Also dual-writes to `files` collection for cadFiles → files consolidation.
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
    // 🏢 ENTERPRISE: Canonical path required — legacy dxf-scenes/ fallback eliminated
    const storagePath = context?.canonicalScenePath ?? `${STORAGE_FOLDER}/${fileId}/scene.json`;
    if (!context?.canonicalScenePath) {
      dxfLogger.warn(
        'No canonicalScenePath provided — using legacy path as fallback. New saves should always provide canonicalScenePath via DxfSaveContext.',
        { fileId }
      );
    }
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

    // 4. Get current version for incrementing
    const currentMetadata = await getFileMetadataImpl(fileId);
    const newVersion = (currentMetadata?.version || 0) + 1;

    // 4.5. Run security validation for audit trail
    const validation = await validateForSaveImpl(fileName, scene);

    // 5. Save metadata to Firestore (NO SCENE DATA)
    const metadata: DxfFileMetadata = {
      id: fileId,
      fileName,
      storageUrl: downloadURL,
      storagePath, // 🏢 ENTERPRISE: Persist actual storage path for reliable loading
      lastModified: serverTimestamp() as Timestamp,
      version: newVersion,
      checksum: generateSceneChecksum(scene),
      sizeBytes: sceneBytes.length,
      entityCount: scene.entities.length,
      securityValidation: {
        validatedAt: serverTimestamp() as Timestamp,
        validationResults: validation.validationResults,
        isSecure: validation.isValid,
      },
    };

    const docRef = doc(db, COLLECTION_NAME, fileId);
    await setDoc(docRef, metadata);

    // 🔄 DUAL-WRITE: Also save to files collection (enterprise FileRecord)
    // Non-blocking — cadFiles remains primary, files write failure is silent
    try {
      await writeToFilesCollection(
        fileId,
        fileName,
        downloadURL,
        sceneBytes.length,
        scene.entities.length,
        newVersion,
        context
      );
    } catch (dualWriteError) {
      dxfLogger.warn('Dual-write to files collection failed (non-blocking)', {
        fileId,
        error: getErrorMessage(dualWriteError),
      });
    }

    // 🏢 ENTERPRISE: INFO level for successful saves (important operation)
    dxfLogger.info('Storage save complete', {
      fileId,
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
 * Load scene from Firebase Storage + metadata from Firestore
 * @enterprise Silent on expected failures (missing files), loud on real errors
 */
export async function loadFromStorageImpl(fileId: string): Promise<DxfFileRecord | null> {
  try {
    // 🏢 ENTERPRISE: DEBUG level - only visible in development
    dxfLogger.debug('Loading from Storage', { fileId });

    // 1. Get metadata from Firestore
    const metadata = await getFileMetadataImpl(fileId);
    if (!metadata) {
      // 🏢 ENTERPRISE: Silent return - "not found" is expected for files without DXF
      // No log output for expected missing files (reduces console noise)
      return null;
    }

    // 2. Download scene from Storage
    // 🏢 ENTERPRISE: Use persisted storagePath (reliable), fallback to legacy for old records
    const storagePath = metadata.storagePath ?? `${STORAGE_FOLDER}/${fileId}/scene.json`;
    const storageRef = ref(storage, storagePath);
    const sceneBytes = await getBytes(storageRef);
    const sceneJson = new TextDecoder().decode(sceneBytes);
    const scene = JSON.parse(sceneJson) as SceneModel;

    // 🏢 ENTERPRISE: DEBUG level - success info only in development
    dxfLogger.debug('Storage load complete', {
      fileId,
      sizeKB: Math.round(sceneBytes.byteLength / 1024),
      entities: scene.entities.length,
    });

    // 3. Return in legacy format for backward compatibility
    return {
      id: metadata.id,
      fileName: metadata.fileName,
      scene,
      lastModified: metadata.lastModified,
      version: metadata.version,
      checksum: metadata.checksum,
    };
  } catch (error: unknown) {
    // 🏢 ENTERPRISE: Intelligent error classification
    if (error instanceof Error) {
      // Expected errors (file not found) → silent return
      if (isExpectedError(error)) {
        dxfLogger.debug('File not found in Storage (expected)', { fileId });
        return null;
      }

      // Network errors → WARN level (may be transient)
      if (error.message.includes('network') || error.message.includes('fetch')) {
        dxfLogger.warn('Network error during load - retry may help', { fileId });
        return null;
      }

      // Corruption errors → ERROR level (needs attention)
      if (error.message.includes('JSON') || error.message.includes('parse')) {
        dxfLogger.error('File corruption detected - JSON parse failed', {
          fileId,
          error: error.message,
        });
        return null;
      }
    }

    // Unknown errors → ERROR level
    dxfLogger.error('Unexpected storage load error', {
      fileId,
      error: getErrorMessage(error),
    });

    return null;
  }
}
