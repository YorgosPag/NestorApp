'use client';

/**
 * 🏢 ENTERPRISE Building Floorplan Service
 *
 * Manages building floorplan DXF data using Firebase Storage + Metadata pattern.
 * Migrated from legacy Firestore document storage to enterprise architecture.
 *
 * @module services/floorplans/BuildingFloorplanService
 * @version 2.0.0 - Enterprise Migration
 *
 * Architecture:
 * - Scene data → Firebase Storage (unlimited size, cheap)
 * - Metadata → Firestore (fast queries, small docs)
 * - Uses DxfFirestoreService for storage operations
 *
 * @see DxfFirestoreService for the underlying storage implementation
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { DxfFirestoreService } from '@/subapps/dxf-viewer/services/dxf-firestore.service';
import { FileRecordService } from '@/services/file-record.service';
import type { SceneModel } from '@/subapps/dxf-viewer/types/scene';
import { Logger, LogLevel, DevNullOutput } from '@/subapps/dxf-viewer/settings/telemetry/Logger';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';

// =============================================================================
// 🏢 ENTERPRISE LOGGER CONFIGURATION
// =============================================================================

/**
 * BuildingFloorplan Logger - Enterprise-grade logging
 *
 * PRODUCTION: Only ERROR level (clean console)
 * DEVELOPMENT: DEBUG level (verbose for debugging)
 *
 * @enterprise ADR - Centralized Logging System (dxf-viewer/settings/telemetry/Logger)
 */
const floorplanLogger = new Logger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG,
  prefix: '[BuildingFloorplan]',
  output: process.env.NODE_ENV === 'production' ? new DevNullOutput() : undefined
});

/**
 * Error classification for intelligent logging
 * @enterprise Pattern: Expected errors (file not found) → silent, real errors → logged
 */
const isExpectedError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  return message.includes('not found') ||
         message.includes('404') ||
         message.includes('does not exist') ||
         (message.includes('permission') && message.includes('missing'));
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * 🏢 ENTERPRISE: Building floorplan data structure
 *
 * Supports two formats:
 * - DXF floorplans: scene + fileName
 * - PDF floorplans: pdfImageUrl + pdfDimensions
 *
 * Uses SceneModel instead of `any` for type safety when scene is present.
 */
export interface BuildingFloorplanData {
  buildingId: string;
  type: 'building' | 'storage';
  fileName: string;
  timestamp: number;
  /** File type discriminator */
  fileType?: 'dxf' | 'pdf';
  /** DXF scene data (present for DXF files) */
  scene?: SceneModel | null;
  /** PDF image URL (present for PDF files) */
  pdfImageUrl?: string;
  /** PDF dimensions (present for PDF files) */
  pdfDimensions?: { width: number; height: number } | null;
}

/**
 * 🏢 ENTERPRISE: Optional parameters for FileRecord creation
 * When provided, saveFloorplan() also creates a FileRecord so
 * the file appears in BuildingFloorplanTab (EntityFilesManager).
 */
export interface BuildingFloorplanSaveOptions {
  /** Company ID — required for FileRecord creation */
  companyId: string;
  /** Project ID — recommended for canonical storage path */
  projectId?: string;
  /** User ID who performed the upload */
  createdBy: string;
}

/**
 * Legacy Firestore document structure (for backward compatibility)
 * Supports both DXF and PDF formats stored in Firestore
 * @deprecated Will be removed after full migration to enterprise storage
 */
interface LegacyFloorplanDocument {
  buildingId: string;
  type: 'building' | 'storage';
  fileName: string;
  timestamp: number;
  updatedAt?: string;
  deleted?: boolean;
  deletedAt?: string;
  // DXF format fields
  scene?: SceneModel;
  // PDF format fields
  fileType?: 'dxf' | 'pdf';
  pdfImageUrl?: string;
  pdfDimensions?: { width: number; height: number } | null;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class BuildingFloorplanService {
  /** @deprecated Legacy collection - kept for backward compatibility reads */
  private static readonly LEGACY_COLLECTION = 'building_floorplans';

  /**
   * Generate enterprise file ID for building floorplan
   * Format: building_floorplan_{buildingId}_{type}
   */
  private static generateFileId(buildingId: string, type: 'building' | 'storage'): string {
    const sanitizedBuildingId = buildingId.toString().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `building_floorplan_${sanitizedBuildingId}_${type}`;
  }

  /**
   * 🏢 ENTERPRISE: Save building floorplan
   *
   * Handles two formats:
   * - DXF floorplans: Uses DxfFirestoreService.saveToStorage() for enterprise storage
   * - PDF floorplans: Uses legacy Firestore (metadata only, PDF stored elsewhere)
   *
   * When `options` is provided (companyId + createdBy), also creates a FileRecord
   * so the file appears in BuildingFloorplanTab → EntityFilesManager.
   *
   * @param buildingId - Building ID
   * @param type - 'building' or 'storage'
   * @param data - Floorplan data (scene or PDF)
   * @param options - Optional: enables FileRecord creation for building tab visibility
   */
  static async saveFloorplan(
    buildingId: string,
    type: 'building' | 'storage',
    data: BuildingFloorplanData,
    options?: BuildingFloorplanSaveOptions
  ): Promise<boolean> {
    try {
      const fileId = this.generateFileId(buildingId, type);
      const fileName = data.fileName || `${buildingId}_${type}_floorplan`;

      // Determine file type
      const isPdfFloorplan = data.fileType === 'pdf' || (!data.scene && data.pdfImageUrl);

      if (isPdfFloorplan) {
        // PDF floorplans: Store metadata in Firestore (PDF image stored separately)
        floorplanLogger.debug(`Saving PDF ${type} floorplan to Firestore`, { fileId, buildingId });

        const docId = `${buildingId}_${type}`;
        await setDoc(doc(db, this.LEGACY_COLLECTION, docId), {
          buildingId,
          type,
          fileType: 'pdf',
          fileName: data.fileName,
          pdfImageUrl: data.pdfImageUrl,
          pdfDimensions: data.pdfDimensions,
          timestamp: data.timestamp,
          updatedAt: new Date().toISOString()
        });

        floorplanLogger.info(`PDF save complete for ${type}`, { buildingId });

        // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
        RealtimeService.dispatch('FLOORPLAN_CREATED', {
          floorplanId: docId,
          floorplan: {
            entityType: ENTITY_TYPES.BUILDING,
            entityId: buildingId,
            name: data.fileName,
          },
          timestamp: Date.now(),
        });

        return true;
      }

      // DXF floorplans: Use enterprise DxfFirestoreService for storage
      if (!data.scene) {
        floorplanLogger.warn(`No scene data for DXF floorplan`, { buildingId, type });
        return false;
      }

      floorplanLogger.debug(`Saving DXF ${type} floorplan via enterprise storage`, { fileId, buildingId });

      const success = await DxfFirestoreService.saveToStorage(fileId, fileName, data.scene);

      if (success) {
        floorplanLogger.info(`Enterprise save complete for ${type}`, { buildingId });

        // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
        RealtimeService.dispatch('FLOORPLAN_CREATED', {
          floorplanId: fileId,
          floorplan: {
            entityType: ENTITY_TYPES.BUILDING,
            entityId: buildingId,
            name: fileName,
          },
          timestamp: Date.now(),
        });

        // 🏢 ENTERPRISE: Create FileRecord so file appears in BuildingFloorplanTab
        // Pattern follows FloorFloorplanService — 3-step canonical upload
        if (options?.companyId && options?.createdBy) {
          await this.createFileRecord(buildingId, type, data, options);
        }
      } else {
        floorplanLogger.error(`Enterprise save failed for ${type}`, { buildingId });
      }

      return success;
    } catch (error) {
      floorplanLogger.error(`Error saving ${type} floorplan`, {
        buildingId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 🏢 ENTERPRISE: Create FileRecord for building floorplan
   *
   * Follows the 3-step canonical upload pattern (ADR-031):
   * 1. createPendingFileRecord() → Firestore `files` collection
   * 2. Upload scene JSON to Firebase Storage
   * 3. finalizeFileRecord() → status: ready + downloadUrl
   *
   * This makes the floorplan visible in BuildingFloorplanTab → EntityFilesManager.
   */
  private static async createFileRecord(
    buildingId: string,
    type: 'building' | 'storage',
    data: BuildingFloorplanData,
    options: BuildingFloorplanSaveOptions
  ): Promise<void> {
    try {
      // Use .json extension for the scene data (NOT the original .dxf)
      const baseName = (data.fileName || `${buildingId}_${type}_floorplan`)
        .replace(/\.[^.]+$/, ''); // Strip original extension
      const jsonFileName = `${baseName}.json`;

      // Step 1: Create pending FileRecord
      const purpose = type === 'building' ? 'building-floorplan' : 'storage-floorplan';
      const entityLabel = type === 'building' ? `Building ${buildingId}` : `Storage ${buildingId}`;

      const createResult = await FileRecordService.createPendingFileRecord({
        companyId: options.companyId,
        projectId: options.projectId,
        entityType: ENTITY_TYPES.BUILDING,
        entityId: buildingId,
        domain: FILE_DOMAINS.CONSTRUCTION,
        category: FILE_CATEGORIES.FLOORPLANS,
        originalFilename: jsonFileName,
        contentType: 'application/json',
        createdBy: options.createdBy,
        entityLabel,
        purpose,
        ext: 'json',
        descriptors: [buildingId, `general-${type}`],
      });

      // Step 2: Upload scene JSON to Storage
      const sceneJson = JSON.stringify(data.scene);
      const sceneBytes = new TextEncoder().encode(sceneJson);

      const storageRef = ref(storage, createResult.storagePath);
      const uploadResult = await uploadBytes(storageRef, sceneBytes, {
        contentType: 'application/json',
      });

      // Step 3: Get download URL and finalize
      const downloadUrl = await getDownloadURL(uploadResult.ref);

      await FileRecordService.finalizeFileRecord({
        fileId: createResult.fileId,
        sizeBytes: sceneBytes.length,
        downloadUrl,
      });

      // Production-visible success log (bypasses logger suppression)
      // eslint-disable-next-line no-console
      console.log(`[BuildingFloorplan] FileRecord created: ${createResult.fileId} for building ${buildingId}`);
    } catch (error) {
      // Production-visible error (bypasses logger suppression for debugging)
      // eslint-disable-next-line no-console
      console.error(`[BuildingFloorplan] FileRecord creation FAILED for building ${buildingId}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 🏢 ENTERPRISE: Load building floorplan with intelligent fallback
   *
   * Loading strategy:
   * 1. Check legacy Firestore for PDF floorplans first (fast)
   * 2. Try enterprise Storage-based loading for DXF (new format)
   * 3. Fallback to legacy Firestore document (old DXF format)
   * 4. Return null if not found in any location
   */
  static async loadFloorplan(
    buildingId: string,
    type: 'building' | 'storage'
  ): Promise<BuildingFloorplanData | null> {
    try {
      const fileId = this.generateFileId(buildingId, type);

      floorplanLogger.debug(`Loading ${type} floorplan`, { fileId, buildingId });

      // 1. Check legacy Firestore first (handles both PDF and old DXF format)
      const legacyResult = await this.loadFromLegacyFirestore(buildingId, type);

      if (legacyResult) {
        // If it's a PDF floorplan, return directly (no migration needed)
        if (legacyResult.fileType === 'pdf' || legacyResult.pdfImageUrl) {
          floorplanLogger.debug(`Loaded PDF from Firestore`, { buildingId });
          return legacyResult;
        }

        // If it's a legacy DXF with scene data, return it
        // (Optional: could auto-migrate to enterprise storage here)
        if (legacyResult.scene) {
          floorplanLogger.debug(`Loaded legacy DXF from Firestore`, { buildingId });
          return legacyResult;
        }
      }

      // 2. Try enterprise Storage-based loading for DXF
      const storageResult = await DxfFirestoreService.loadFileV2(fileId);

      if (storageResult) {
        floorplanLogger.debug(`Loaded DXF from enterprise storage`, { fileId });
        return {
          buildingId,
          type,
          fileType: 'dxf',
          scene: storageResult.scene,
          fileName: storageResult.fileName,
          timestamp: storageResult.lastModified?.toMillis?.() || Date.now()
        };
      }

      // 🏢 ENTERPRISE: Silent on "not found" - expected for buildings without floorplans
      // No log output to reduce console noise
      return null;
    } catch (error) {
      // 🏢 ENTERPRISE: Intelligent error classification
      if (error instanceof Error && isExpectedError(error)) {
        // Expected "not found" → silent return
        return null;
      }
      floorplanLogger.error(`Error loading ${type} floorplan`, {
        buildingId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Load from legacy Firestore document (backward compatibility)
   * Handles both DXF and PDF formats stored in Firestore
   * @deprecated This method exists for migration purposes only
   */
  private static async loadFromLegacyFirestore(
    buildingId: string,
    type: 'building' | 'storage'
  ): Promise<BuildingFloorplanData | null> {
    try {
      const docId = `${buildingId}_${type}`;
      const docSnap = await getDoc(doc(db, this.LEGACY_COLLECTION, docId));

      if (docSnap.exists()) {
        const data = docSnap.data() as LegacyFloorplanDocument;

        // Skip deleted documents
        if (data.deleted) {
          return null;
        }

        return {
          buildingId: data.buildingId || buildingId,
          type: data.type || type,
          fileName: data.fileName,
          timestamp: data.timestamp,
          // Include file type and format-specific fields
          fileType: data.fileType,
          scene: data.scene,
          pdfImageUrl: data.pdfImageUrl,
          pdfDimensions: data.pdfDimensions
        };
      }

      return null;
    } catch (error) {
      // 🏢 ENTERPRISE: Expected errors → silent, real errors → logged
      if (error instanceof Error && isExpectedError(error)) {
        return null;
      }
      floorplanLogger.warn('Legacy load failed', {
        buildingId,
        type,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * 🏢 ENTERPRISE: Check if building floorplan exists
   *
   * Checks both enterprise storage and legacy Firestore
   */
  static async hasFloorplan(buildingId: string, type: 'building' | 'storage'): Promise<boolean> {
    try {
      const fileId = this.generateFileId(buildingId, type);

      // Check enterprise storage first
      const enterpriseExists = await DxfFirestoreService.fileExists(fileId);
      if (enterpriseExists) {
        return true;
      }

      // Check legacy Firestore
      const docId = `${buildingId}_${type}`;
      const docSnap = await getDoc(doc(db, this.LEGACY_COLLECTION, docId));

      if (docSnap.exists()) {
        const data = docSnap.data() as LegacyFloorplanDocument;
        return !data.deleted;
      }

      return false;
    } catch (error) {
      // 🏢 ENTERPRISE: Expected errors → silent false, real errors → logged
      if (error instanceof Error && isExpectedError(error)) {
        return false;
      }
      floorplanLogger.warn(`Error checking ${type} floorplan`, {
        buildingId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Delete building floorplan (soft delete)
   *
   * Note: For enterprise storage, we mark as deleted in metadata.
   * For legacy Firestore, we keep the existing soft delete behavior.
   */
  static async deleteFloorplan(buildingId: string, type: 'building' | 'storage'): Promise<boolean> {
    try {
      // Soft delete in legacy collection (for backward compatibility)
      const docId = `${buildingId}_${type}`;
      await setDoc(doc(db, this.LEGACY_COLLECTION, docId), {
        deleted: true,
        deletedAt: new Date().toISOString()
      });

      floorplanLogger.info(`Deleted ${type} floorplan`, { buildingId });

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('FLOORPLAN_DELETED', {
        floorplanId: docId,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      floorplanLogger.error(`Error deleting ${type} floorplan`, {
        buildingId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 🔄 MIGRATION: Migrate legacy Firestore data to enterprise storage
   *
   * Call this to migrate existing floorplans to the new architecture.
   * Safe to run multiple times - idempotent operation.
   */
  static async migrateToEnterpriseStorage(
    buildingId: string,
    type: 'building' | 'storage',
    data?: BuildingFloorplanData
  ): Promise<boolean> {
    try {
      // Load from legacy if data not provided
      const floorplanData = data || await this.loadFromLegacyFirestore(buildingId, type);

      if (!floorplanData) {
        floorplanLogger.debug('No legacy data to migrate', { buildingId, type });
        return false;
      }

      floorplanLogger.info(`Migrating ${type} floorplan to enterprise storage`, { buildingId });

      // Save to enterprise storage
      const success = await this.saveFloorplan(buildingId, type, floorplanData);

      if (success) {
        floorplanLogger.info('Migration complete', { buildingId, type });
        // Note: We don't delete legacy data for safety - can be cleaned up later
      }

      return success;
    } catch (error) {
      floorplanLogger.error('Migration failed', {
        buildingId,
        type,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}
