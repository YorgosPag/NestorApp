import { getErrorMessage } from '@/lib/error-utils';
import { db } from '../../../lib/firebase';
import { COLLECTIONS } from '../../../config/firestore-collections';
import { generateFileId as enterpriseGenerateFileId } from '@/services/enterprise-id.service';
import type { SceneModel } from '../types/scene';
import {
  DxfSecurityValidator,
  type SecurityValidationResult,
} from '../security/DxfSecurityValidator';
import { dxfLogger, isExpectedError } from './dxf-firestore-logger';
import type { DxfSaveContext, DxfFileMetadata, DxfFileRecord } from './dxf-firestore.types';
import {
  saveToStorageImpl,
  loadFromStorageImpl,
  validateForSaveImpl,
  getFileMetadataImpl,
  getFileImpl,
} from './dxf-firestore-storage.impl';

// Re-export types for backward compatibility with existing callers.
export type { DxfSaveContext, DxfFileMetadata, DxfFileRecord };

/**
 * 🏢 ENTERPRISE: Facade for DXF scene persistence.
 *
 * Exposes a stable static-method API that delegates to focused implementation
 * modules (storage impl, logger, types). Keeps the public surface small while
 * the heavy lifting lives in testable, single-responsibility modules.
 */
export class DxfFirestoreService {
  /** @deprecated ADR-292 Phase 3: All reads/writes now go through `files` collection */
  private static readonly COLLECTION_NAME = COLLECTIONS.FILES;

  /**
   * Auto-save scene.
   *
   * 🏢 ADR-288: Delegates to saveToStorageImpl (centralized /api/cad-files
   * upsert pipeline). No direct client-side Firestore writes. The scene bytes
   * are uploaded to Firebase Storage and metadata is written server-side.
   *
   * @deprecated Use autoSaveV3 for enterprise security features
   */
  static async autoSave(fileId: string, fileName: string, scene: SceneModel): Promise<boolean> {
    try {
      const success = await saveToStorageImpl(fileId, fileName, scene);
      if (success) {
        dxfLogger.debug('Auto-save complete (delegated to SSOT)', { fileId });
      }
      return success;
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
      return await getFileImpl(fileId);
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
  // 🔒 ENTERPRISE SECURITY METHODS (PHASE 1)
  // ==========================================================================

  /**
   * Enterprise validation before save operations
   */
  static async validateForSave(
    fileName: string,
    scene: SceneModel
  ): Promise<{
    isValid: boolean;
    fileId: string;
    sanitizedFileName: string;
    validationResults: SecurityValidationResult[];
  }> {
    return validateForSaveImpl(fileName, scene);
  }

  // ==========================================================================
  // 🚀 STORAGE-BASED METHODS (PHASE 4)
  // ==========================================================================

  /**
   * Save scene to Firebase Storage + metadata to Firestore (Enterprise Edition)
   * Also dual-writes to `files` collection for cadFiles → files consolidation.
   */
  static async saveToStorage(
    fileId: string,
    fileName: string,
    scene: SceneModel,
    context?: DxfSaveContext
  ): Promise<boolean> {
    return saveToStorageImpl(fileId, fileName, scene, context);
  }

  /**
   * Load scene from Firebase Storage + metadata from Firestore
   * @enterprise Silent on expected failures (missing files), loud on real errors
   */
  static async loadFromStorage(fileId: string): Promise<DxfFileRecord | null> {
    return loadFromStorageImpl(fileId);
  }

  /**
   * Get file metadata only (without scene data)
   * 🏢 ADR-214 Phase 10: Migrated to firestoreQueryService.getById
   */
  static async getFileMetadata(fileId: string): Promise<DxfFileMetadata | null> {
    return getFileMetadataImpl(fileId);
  }

  /**
   * Check if file exists in Firestore
   * 🏢 ADR-214 Phase 10: Migrated to firestoreQueryService.getById
   * @enterprise Silent on expected failures, returns false gracefully
   */
  static async fileExists(fileId: string): Promise<boolean> {
    try {
      const result = await getFileMetadataImpl(fileId);
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

  // ==========================================================================
  // 🔄 BACKWARD COMPATIBILITY & MIGRATION HELPERS
  // ==========================================================================

  /**
   * 🔒 Enterprise Auto-save with Security Validation (V3)
   */
  static async autoSaveV3(
    fileName: string,
    scene: SceneModel,
    context?: DxfSaveContext
  ): Promise<{
    success: boolean;
    fileId?: string;
    validationResults?: SecurityValidationResult[];
    errorMessage?: string;
  }> {
    try {
      dxfLogger.debug('Enterprise auto-save V3 starting', { fileName });

      // Step 1: Run security validation first
      const validation = await validateForSaveImpl(fileName, scene);

      if (!validation.isValid) {
        const summary = DxfSecurityValidator.getValidationSummary(validation.validationResults);
        return {
          success: false,
          validationResults: validation.validationResults,
          errorMessage: `Security validation failed: ${summary.criticalErrors + summary.highErrors} blocking errors found`,
        };
      }

      // Step 2: Use validated file ID and sanitized name
      const success = await saveToStorageImpl(
        validation.fileId,
        validation.sanitizedFileName,
        scene,
        context
      );

      if (success) {
        // 🏢 ENTERPRISE: INFO level for successful save operations
        dxfLogger.info('Enterprise auto-save V3 completed', { fileId: validation.fileId });
        return {
          success: true,
          fileId: validation.fileId,
          validationResults: validation.validationResults,
        };
      } else {
        return {
          success: false,
          errorMessage: 'Storage operation failed',
        };
      }
    } catch (error: unknown) {
      dxfLogger.error('Enterprise auto-save V3 failed', {
        fileName,
        error: getErrorMessage(error),
      });
      return {
        success: false,
        errorMessage: getErrorMessage(error),
      };
    }
  }

  /**
   * Auto-save with intelligent routing (Storage for new files, Firestore for legacy)
   * @deprecated Use autoSaveV3 for enterprise security features
   */
  static async autoSaveV2(
    fileId: string,
    fileName: string,
    scene: SceneModel,
    context?: DxfSaveContext
  ): Promise<boolean> {
    // Check if file already exists to determine save method
    const existingMetadata = await getFileMetadataImpl(fileId);

    if (existingMetadata && existingMetadata.storageUrl) {
      // File already uses Storage - continue using Storage
      return saveToStorageImpl(fileId, fileName, scene, context);
    } else {
      // New file or legacy file - use Storage for better performance
      return saveToStorageImpl(fileId, fileName, scene, context);
    }
  }

  /**
   * Load with intelligent routing (try Storage first, fallback to Firestore)
   * @enterprise Silent on "file not found" - this is expected for buildings without floorplans
   */
  static async loadFileV2(fileId: string): Promise<DxfFileRecord | null> {
    try {
      // 1. Try Storage-based loading first
      const storageResult = await loadFromStorageImpl(fileId);
      if (storageResult) {
        dxfLogger.debug('Loaded from Storage', { fileId });
        return storageResult;
      }

      // 2. Fallback to legacy Firestore loading
      dxfLogger.debug('Fallback to Firestore', { fileId });
      const firestoreResult = await getFileImpl(fileId);

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
        error: getErrorMessage(error),
      });
      return null;
    }
  }

  /**
   * Migrate existing Firestore-based file to Storage
   * @enterprise INFO level logs for migration operations (important to track)
   */
  static async migrateToStorage(
    fileId: string,
    fileName: string,
    scene: SceneModel
  ): Promise<boolean> {
    try {
      dxfLogger.info('Migrating to Storage', { fileId, fileName });

      // Save to Storage
      const success = await saveToStorageImpl(fileId, fileName, scene);

      if (success) {
        dxfLogger.info('Migration complete', { fileId });
        // Note: We don't delete the old Firestore document for safety
        // It can be cleaned up later in a separate operation
      }

      return success;
    } catch (error) {
      dxfLogger.error('Migration failed', {
        fileId,
        error: getErrorMessage(error),
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
  static async findExistingFileRecord(
    fileName: string
  ): Promise<{ id: string; storagePath: string | null } | null> {
    try {
      const { collection, query, where, limit, getDocs } = await import('firebase/firestore');
      // 🏢 ENTERPRISE: Simple query on originalFilename only — avoids composite index requirement
      const q = query(
        collection(db, COLLECTIONS.FILES),
        where('originalFilename', '==', fileName),
        limit(5)
      );
      const snapshot = await getDocs(q);

      // Filter in code: floorplans category + not deleted
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.category === 'floorplans' && data.isDeleted !== true) {
          const existingId = docSnap.id;
          const storagePath = (data.storagePath as string) ?? null;
          dxfLogger.info('Found existing FileRecord for auto-save reuse', {
            fileName,
            existingId,
            storagePath,
          });
          return { id: existingId, storagePath };
        }
      }

      dxfLogger.debug('No existing FileRecord found', { fileName });
      return null;
    } catch (error) {
      dxfLogger.warn('Could not check for existing FileRecord', {
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
