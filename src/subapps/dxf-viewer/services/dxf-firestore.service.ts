import { getErrorMessage } from '@/lib/error-utils';
import { db, storage } from '../../../lib/firebase';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getBytes } from 'firebase/storage';
import { COLLECTIONS } from '../../../config/firestore-collections';
import { generateFileId as enterpriseGenerateFileId } from '@/services/enterprise-id.service';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { SceneModel } from '../types/scene';
import {
  DxfSecurityValidator,
  type SecurityValidationResult,
  SecuritySeverity
} from '../security/DxfSecurityValidator';
import { Logger, LogLevel, DevNullOutput } from '../settings/telemetry/Logger';

// =============================================================================
// 🏢 ENTERPRISE LOGGER CONFIGURATION
// =============================================================================

/**
 * DxfFirestore Logger - Enterprise-grade logging with configurable levels
 *
 * In PRODUCTION: Only ERROR level logs (clean console)
 * In DEVELOPMENT: DEBUG level logs (verbose for debugging)
 *
 * @enterprise ADR - Centralized Logging System
 */
const dxfLogger = new Logger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG,
  prefix: '[DxfFirestore]',
  // In production, use DevNullOutput for DEBUG/INFO to ensure zero noise
  output: process.env.NODE_ENV === 'production' ? new DevNullOutput() : undefined
});

/**
 * Error classification for intelligent logging
 * @enterprise Pattern: Error categorization for appropriate log levels
 */
const isExpectedError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  // These are expected scenarios (file doesn't exist, no permission for missing doc)
  return message.includes('not found') ||
         message.includes('404') ||
         message.includes('does not exist') ||
         (message.includes('permission') && message.includes('missing'));
};

/**
 * Optional entity context for dual-write to `files` collection.
 * Injected by callers that know the business context (building, floor, project).
 * When absent, the DXF save still works (cadFiles primary) but the `files`
 * record will use fallback values ('standalone', 'system').
 */
export interface DxfSaveContext {
  companyId?: string;
  projectId?: string;
  buildingId?: string;
  floorId?: string;
  createdBy?: string;
  /** 🏢 ENTERPRISE: Canonical scene path (derived from FileRecord storagePath) */
  canonicalScenePath?: string;
}

export interface DxfFileMetadata {
  id: string;
  fileName: string;
  storageUrl: string; // Firebase Storage download URL
  lastModified: Timestamp;
  version: number;
  checksum?: string;
  sizeBytes?: number;
  entityCount?: number;
  securityValidation?: {
    validatedAt: Timestamp;
    validationResults: SecurityValidationResult[];
    isSecure: boolean;
  };
}

export interface DxfFileRecord {
  id: string;
  fileName: string;
  scene: SceneModel; // For backward compatibility - will be removed later
  lastModified: Timestamp;
  version: number;
  checksum?: string;
}

export class DxfFirestoreService {
  private static readonly COLLECTION_NAME = COLLECTIONS.CAD_FILES;
  private static readonly STORAGE_FOLDER = 'dxf-scenes';
  
  /**
   * Auto-save scene to Firestore
   * @deprecated Use autoSaveV3 for enterprise security features
   */
  static async autoSave(fileId: string, fileName: string, scene: SceneModel): Promise<boolean> {
    try {
      // Get current version
      const currentDoc = await this.getFile(fileId);
      const newVersion = (currentDoc?.version || 0) + 1;

      const record: DxfFileRecord = {
        id: fileId,
        fileName,
        scene,
        lastModified: serverTimestamp() as Timestamp,
        version: newVersion,
        checksum: this.generateSceneChecksum(scene)
      };

      const docRef = doc(db, this.COLLECTION_NAME, fileId);
      await setDoc(docRef, record);

      dxfLogger.debug('Auto-save complete', { fileId, version: newVersion });
      return true;
    } catch (error) {
      dxfLogger.error('Auto-save failed', { fileId, error: getErrorMessage(error) });
      return false;
    }
  }

  /**
   * Load scene from Firestore
   * @deprecated Use loadFileV2 for intelligent routing
   */
  static async loadFile(fileId: string): Promise<DxfFileRecord | null> {
    try {
      return await this.getFile(fileId);
    } catch (error) {
      // 🏢 ENTERPRISE: Expected failures → silent
      if (error instanceof Error && isExpectedError(error)) {
        return null;
      }
      dxfLogger.error('Load failed', { fileId, error: getErrorMessage(error) });
      return null;
    }
  }

  // ==========================================================================
  // 🚀 NEW STORAGE-BASED METHODS (PHASE 4)
  // ==========================================================================

  // ==========================================================================
  // 🔒 ENTERPRISE SECURITY METHODS (PHASE 1)
  // ==========================================================================

  /**
   * Enterprise validation before save operations
   */
  static async validateForSave(fileName: string, scene: SceneModel): Promise<{
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
      scene
    });

    // Generate secure identifiers — enterprise ID (SOS N.6)
    const sanitizedFileName = DxfSecurityValidator.sanitizeFileName(fileName);
    const fileId = this.generateFileId(fileName);

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
      lowWarnings: summary.lowWarnings
    });

    if (!isValid) {
      // 🏢 ENTERPRISE: WARN level for validation failures (important but expected)
      dxfLogger.warn('Security validation FAILED', {
        fileName,
        fileId,
        blockingErrors: validationResults.filter(r =>
          !r.isValid && (r.severity === SecuritySeverity.HIGH || r.severity === SecuritySeverity.CRITICAL)
        ).map(r => r.message)
      });
    }

    return {
      isValid,
      fileId,
      sanitizedFileName,
      validationResults
    };
  }

  /**
   * Save scene to Firebase Storage + metadata to Firestore (Enterprise Edition)
   * Also dual-writes to `files` collection for cadFiles → files consolidation.
   */
  static async saveToStorage(fileId: string, fileName: string, scene: SceneModel, context?: DxfSaveContext): Promise<boolean> {
    try {
      dxfLogger.debug('Saving to Storage', { fileId, fileName });

      // 1. Create scene JSON for storage
      const sceneJson = JSON.stringify(scene, null, 0); // No formatting to save space
      const sceneBytes = new TextEncoder().encode(sceneJson);

      // 2. Upload to Firebase Storage
      // 🏢 ENTERPRISE: Use canonical path (next to DXF) if available, fallback to legacy dxf-scenes/
      const storagePath = context?.canonicalScenePath ?? `${this.STORAGE_FOLDER}/${fileId}/scene.json`;
      const storageRef = ref(storage, storagePath);

      const snapshot = await uploadBytes(storageRef, sceneBytes, {
        contentType: 'application/json',
        customMetadata: {
          fileName,
          version: Date.now().toString()
        }
      });

      // 3. Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);

      // 4. Get current version for incrementing
      const currentMetadata = await this.getFileMetadata(fileId);
      const newVersion = (currentMetadata?.version || 0) + 1;

      // 4.5. Run security validation for audit trail
      const validation = await this.validateForSave(fileName, scene);

      // 5. Save metadata to Firestore (NO SCENE DATA)
      const metadata: DxfFileMetadata = {
        id: fileId,
        fileName,
        storageUrl: downloadURL,
        lastModified: serverTimestamp() as Timestamp,
        version: newVersion,
        checksum: this.generateSceneChecksum(scene),
        sizeBytes: sceneBytes.length,
        entityCount: scene.entities.length,
        securityValidation: {
          validatedAt: serverTimestamp() as Timestamp,
          validationResults: validation.validationResults,
          isSecure: validation.isValid
        }
      };

      const docRef = doc(db, this.COLLECTION_NAME, fileId);
      await setDoc(docRef, metadata);

      // 🔄 DUAL-WRITE: Also save to files collection (enterprise FileRecord)
      // Non-blocking — cadFiles remains primary, files write failure is silent
      try {
        await this.writeToFilesCollection(
          fileId, fileName, downloadURL, sceneBytes.length,
          scene.entities.length, newVersion, context
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
        entities: scene.entities.length
      });

      return true;
    } catch (error: unknown) {
      // 🏢 ENTERPRISE: Structured error handling with appropriate log levels
      const errorDetails = {
        operation: 'saveToStorage',
        fileId,
        fileName,
        entityCount: scene.entities.length,
        error: getErrorMessage(error)
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
  static async loadFromStorage(fileId: string): Promise<DxfFileRecord | null> {
    try {
      // 🏢 ENTERPRISE: DEBUG level - only visible in development
      dxfLogger.debug('Loading from Storage', { fileId });

      // 1. Get metadata from Firestore
      const metadata = await this.getFileMetadata(fileId);
      if (!metadata) {
        // 🏢 ENTERPRISE: Silent return - "not found" is expected for files without DXF
        // No log output for expected missing files (reduces console noise)
        return null;
      }

      // 2. Download scene from Storage
      // 🏢 ENTERPRISE: Try canonical path first (from storageUrl metadata), fallback to legacy
      // The storageUrl may contain the canonical path if saved by the new enterprise flow
      const storagePath = metadata.storageUrl?.startsWith('companies/')
        ? this.deriveScenePath(metadata.storageUrl)
        : `dxf-scenes/${fileId}/scene.json`;
      const storageRef = ref(storage, storagePath);
      const sceneBytes = await getBytes(storageRef);
      const sceneJson = new TextDecoder().decode(sceneBytes);
      const scene = JSON.parse(sceneJson) as SceneModel;

      // 🏢 ENTERPRISE: DEBUG level - success info only in development
      dxfLogger.debug('Storage load complete', {
        fileId,
        sizeKB: Math.round(sceneBytes.byteLength / 1024),
        entities: scene.entities.length
      });

      // 3. Return in legacy format for backward compatibility
      return {
        id: metadata.id,
        fileName: metadata.fileName,
        scene,
        lastModified: metadata.lastModified,
        version: metadata.version,
        checksum: metadata.checksum
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
          dxfLogger.error('File corruption detected - JSON parse failed', { fileId, error: error.message });
          return null;
        }
      }

      // Unknown errors → ERROR level
      dxfLogger.error('Unexpected storage load error', {
        fileId,
        error: getErrorMessage(error)
      });

      return null;
    }
  }

  /**
   * Get file metadata only (without scene data)
   * 🏢 ADR-214 Phase 10: Migrated to firestoreQueryService.getById
   */
  static async getFileMetadata(fileId: string): Promise<DxfFileMetadata | null> {
    return firestoreQueryService.getById<DxfFileMetadata>('CAD_FILES', fileId);
  }

  /**
   * Check if file exists in Firestore
   * 🏢 ADR-214 Phase 10: Migrated to firestoreQueryService.getById
   * @enterprise Silent on expected failures, returns false gracefully
   */
  static async fileExists(fileId: string): Promise<boolean> {
    try {
      const result = await firestoreQueryService.getById<DxfFileMetadata>('CAD_FILES', fileId);
      return result !== null;
    } catch (error) {
      // 🏢 ENTERPRISE: Expected failures → silent, real errors → log
      if (error instanceof Error && isExpectedError(error)) {
        return false;
      }
      dxfLogger.warn('File existence check failed', { fileId, error: getErrorMessage(error) });
      return false;
    }
  }
  
  /**
   * 🔄 DUAL-WRITE: Write enterprise FileRecord to `files` collection.
   * Maps DxfFileMetadata → FileRecord schema for cadFiles → files consolidation.
   * Uses merge: true so repeated saves update rather than overwrite.
   *
   * @enterprise ADR-031 — File Storage Consolidation (cadFiles → files)
   */
  private static async writeToFilesCollection(
    fileId: string,
    fileName: string,
    downloadUrl: string,
    sizeBytes: number,
    entityCount: number,
    version: number,
    context?: DxfSaveContext
  ): Promise<void> {
    // 🏢 ENTERPRISE: Use canonical scene path if available
    const scenePath = context?.canonicalScenePath ?? `dxf-scenes/${fileId}/scene.json`;

    const fileRecord = {
      id: fileId,
      companyId: context?.companyId ?? null,
      projectId: context?.projectId ?? null,
      entityType: 'building' as const,
      entityId: context?.buildingId ?? 'standalone',
      domain: 'construction' as const,
      category: 'drawings' as const,
      storagePath: scenePath,
      displayName: fileName,
      originalFilename: fileName,
      ext: 'dxf',
      contentType: 'application/dxf',
      status: 'ready' as const,
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
   * Generate a simple checksum for change detection
   */
  private static generateSceneChecksum(scene: SceneModel): string {
    const data = {
      entityCount: scene.entities.length,
      layerCount: Object.keys(scene.layers).length,
      bounds: scene.bounds,
      units: scene.units
    };
    return btoa(JSON.stringify(data)).substring(0, 16);
  }
  
  /**
   * Internal method to get document
   * 🏢 ADR-214 Phase 10: Migrated to firestoreQueryService.getById
   */
  private static async getFile(fileId: string): Promise<DxfFileRecord | null> {
    return firestoreQueryService.getById<DxfFileRecord>('CAD_FILES', fileId);
  }

  // ==========================================================================
  // 🔄 BACKWARD COMPATIBILITY & MIGRATION HELPERS
  // ==========================================================================

  /**
   * 🔒 Enterprise Auto-save with Security Validation (V3)
   */
  static async autoSaveV3(fileName: string, scene: SceneModel, context?: DxfSaveContext): Promise<{
    success: boolean;
    fileId?: string;
    validationResults?: SecurityValidationResult[];
    errorMessage?: string;
  }> {
    try {
      dxfLogger.debug('Enterprise auto-save V3 starting', { fileName });

      // Step 1: Run security validation first
      const validation = await this.validateForSave(fileName, scene);

      if (!validation.isValid) {
        const summary = DxfSecurityValidator.getValidationSummary(validation.validationResults);
        return {
          success: false,
          validationResults: validation.validationResults,
          errorMessage: `Security validation failed: ${summary.criticalErrors + summary.highErrors} blocking errors found`
        };
      }

      // Step 2: Use validated file ID and sanitized name
      const success = await this.saveToStorage(validation.fileId, validation.sanitizedFileName, scene, context);

      if (success) {
        // 🏢 ENTERPRISE: INFO level for successful save operations
        dxfLogger.info('Enterprise auto-save V3 completed', { fileId: validation.fileId });
        return {
          success: true,
          fileId: validation.fileId,
          validationResults: validation.validationResults
        };
      } else {
        return {
          success: false,
          errorMessage: 'Storage operation failed'
        };
      }
    } catch (error: unknown) {
      dxfLogger.error('Enterprise auto-save V3 failed', {
        fileName,
        error: getErrorMessage(error)
      });
      return {
        success: false,
        errorMessage: getErrorMessage(error)
      };
    }
  }

  /**
   * Auto-save with intelligent routing (Storage for new files, Firestore for legacy)
   * @deprecated Use autoSaveV3 for enterprise security features
   */
  static async autoSaveV2(fileId: string, fileName: string, scene: SceneModel, context?: DxfSaveContext): Promise<boolean> {
    // Check if file already exists to determine save method
    const existingMetadata = await this.getFileMetadata(fileId);

    if (existingMetadata && existingMetadata.storageUrl) {
      // File already uses Storage - continue using Storage
      return this.saveToStorage(fileId, fileName, scene, context);
    } else {
      // New file or legacy file - use Storage for better performance
      return this.saveToStorage(fileId, fileName, scene, context);
    }
  }

  /**
   * Load with intelligent routing (try Storage first, fallback to Firestore)
   * @enterprise Silent on "file not found" - this is expected for buildings without floorplans
   */
  static async loadFileV2(fileId: string): Promise<DxfFileRecord | null> {
    try {
      // 1. Try Storage-based loading first
      const storageResult = await this.loadFromStorage(fileId);
      if (storageResult) {
        dxfLogger.debug('Loaded from Storage', { fileId });
        return storageResult;
      }

      // 2. Fallback to legacy Firestore loading
      dxfLogger.debug('Fallback to Firestore', { fileId });
      const firestoreResult = await this.getFile(fileId);

      if (firestoreResult) {
        dxfLogger.debug('Loaded from Firestore (legacy)', { fileId });
        return firestoreResult;
      }

      // 🏢 ENTERPRISE: No log for "not found" - this is expected behavior
      // Buildings without floorplans should not generate console noise
      return null;
    } catch (error) {
      // 🏢 ENTERPRISE: Intelligent error handling
      if (error instanceof Error && isExpectedError(error)) {
        // Expected "not found" or "permission denied on missing doc" → silent
        return null;
      }

      // Real errors → log at ERROR level
      dxfLogger.error('Load V2 failed', {
        fileId,
        error: getErrorMessage(error)
      });
      return null;
    }
  }

  /**
   * Migrate existing Firestore-based file to Storage
   * @enterprise INFO level logs for migration operations (important to track)
   */
  static async migrateToStorage(fileId: string, fileName: string, scene: SceneModel): Promise<boolean> {
    try {
      dxfLogger.info('Migrating to Storage', { fileId, fileName });

      // Save to Storage
      const success = await this.saveToStorage(fileId, fileName, scene);

      if (success) {
        dxfLogger.info('Migration complete', { fileId });
        // Note: We don't delete the old Firestore document for safety
        // It can be cleaned up later in a separate operation
      }

      return success;
    } catch (error) {
      dxfLogger.error('Migration failed', {
        fileId,
        error: getErrorMessage(error)
      });
      return false;
    }
  }

  /**
   * Generate file ID from filename
   * @deprecated Use enterprise generateFileId() from enterprise-id.service.ts (SOS N.6)
   * Kept for backward compatibility with legacy filename-based lookups
   */
  static generateLegacyFileId(fileName: string): string {
    // Remove extension and sanitize for Firestore document ID
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    return baseName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 100); // Firestore ID limit
  }

  /**
   * Generate enterprise file ID (SOS N.6 compliant)
   * Format: file_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  static generateFileId(_fileName?: string): string {
    return enterpriseGenerateFileId();
  }

  /**
   * 🏢 ENTERPRISE: Find existing FileRecord by originalFilename
   *
   * Checks if a FileRecord already exists in `files` collection for this filename.
   * Used by auto-save to:
   * 1. Reuse the wizard-created FileRecord ID for cadFiles (same document ID)
   * 2. Derive canonical scene path from the FileRecord's storagePath
   *
   * @returns { id, storagePath } or null if not found
   */
  static async findExistingFileRecord(fileName: string): Promise<{ id: string; storagePath: string | null } | null> {
    try {
      const { collection, query, where, limit, getDocs } = await import('firebase/firestore');
      const q = query(
        collection(db, COLLECTIONS.FILES),
        where('originalFilename', '==', fileName),
        where('category', '==', 'floorplans'),
        where('isDeleted', '==', false),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        const existingId = snapshot.docs[0].id;
        const storagePath = (docData.storagePath as string) ?? null;
        dxfLogger.info('Found existing FileRecord for auto-save reuse', { fileName, existingId, storagePath });
        return { id: existingId, storagePath };
      }
      return null;
    } catch (error) {
      dxfLogger.debug('Could not check for existing FileRecord', {
        fileName,
        error: getErrorMessage(error),
      });
      return null;
    }
  }

  /**
   * 🏢 ENTERPRISE: Derive scene JSON path from a FileRecord's storagePath
   *
   * Given `companies/.../files/file_xxx.dxf`
   * Returns `companies/.../files/file_xxx.scene.json`
   *
   * This ensures scene JSON lives next to the original DXF in the canonical path.
   */
  static deriveScenePath(fileRecordStoragePath: string): string {
    // Replace extension with .scene.json
    const withoutExt = fileRecordStoragePath.replace(/\.[^/.]+$/, '');
    return `${withoutExt}.scene.json`;
  }
}