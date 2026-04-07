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

import { FileRecordService } from '@/services/file-record.service';
import { FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';
import { DxfFirestoreService } from '@/subapps/dxf-viewer/services/dxf-firestore.service';
import { FloorplanSaveOrchestrator } from '@/services/floorplans/floorplan-save-orchestrator';
import type { SceneModel } from '@/subapps/dxf-viewer/types/scene';
import { Logger, LogLevel, DevNullOutput } from '@/subapps/dxf-viewer/settings/telemetry/Logger';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { ENTITY_TYPES, FLOORPLAN_PURPOSES } from '@/config/domain-constants';
import { getErrorMessage } from '@/lib/error-utils';

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
  /** Original DXF file — stored as FileRecord for FloorplanGallery rendering */
  originalFile?: File;
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
        // 🏢 ADR-292 Phase 4: PDF floorplans write ONLY to files collection
        // Legacy building_floorplans write eliminated
        floorplanLogger.debug(`Saving PDF ${type} floorplan via enterprise FileRecord`, { fileId, buildingId });

        if (!options?.companyId || !options?.createdBy) {
          floorplanLogger.error('Cannot save PDF floorplan without companyId + createdBy', { buildingId, type });
          return false;
        }

        await this.createFileRecord(buildingId, type, data, options);

        floorplanLogger.info(`PDF save complete for ${type}`, { buildingId });

        // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
        RealtimeService.dispatch('FLOORPLAN_CREATED', {
          floorplanId: fileId,
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
        error: getErrorMessage(error)
      });
      return false;
    }
  }

  /**
   * 🏢 ENTERPRISE: Create FileRecord for building floorplan
   *
   * Delegates to centralized FloorplanSaveOrchestrator (ADR-201).
   * This makes the floorplan visible in BuildingFloorplanTab → EntityFilesManager.
   */
  private static async createFileRecord(
    buildingId: string,
    type: 'building' | 'storage',
    data: BuildingFloorplanData,
    options: BuildingFloorplanSaveOptions
  ): Promise<void> {
    try {
      const fileName = data.fileName || `${buildingId}_${type}_floorplan.dxf`;
      const hasOriginalFile = !!options.originalFile;
      const fileExtension = hasOriginalFile
        ? (options.originalFile!.name.split('.').pop()?.toLowerCase() || 'dxf')
        : 'json';
      const contentType = hasOriginalFile
        ? (options.originalFile!.type || (fileExtension === 'pdf' ? 'application/pdf' : 'application/dxf'))
        : 'application/json';

      const purpose = type === 'building' ? FLOORPLAN_PURPOSES.BUILDING : FLOORPLAN_PURPOSES.STORAGE;
      const entityLabel = type === 'building' ? `Building ${buildingId}` : `Storage ${buildingId}`;

      // Determine payload
      let payload: import('@/services/floorplans/floorplan-save-orchestrator').FloorplanPayload;
      if (hasOriginalFile) {
        payload = { kind: 'raw-file', file: options.originalFile!, compress: fileExtension === 'dxf' };
      } else if (data.scene) {
        payload = { kind: 'gzip-json', data: data.scene };
      } else {
        floorplanLogger.warn('No file or scene data for FileRecord creation', { buildingId, type });
        return;
      }

      const result = await FloorplanSaveOrchestrator.save({
        companyId: options.companyId,
        projectId: options.projectId,
        entityType: ENTITY_TYPES.BUILDING,
        entityId: buildingId,
        purpose,
        entityLabel,
        ext: fileExtension,
        descriptors: [buildingId, `general-${type}`],
        createdBy: options.createdBy,
        originalFilename: fileName,
        contentType,
        payload,
        generateThumbnail: true,
      });

      floorplanLogger.info(`FileRecord created: ${result.fileId}`, {
        ext: fileExtension,
        thumb: !!result.thumbnailUrl,
      });
    } catch (error) {
      floorplanLogger.error(`FileRecord creation FAILED for building ${buildingId}`,
        { error: getErrorMessage(error) }
      );
    }
  }

  /**
   * 🏢 ENTERPRISE: Load building floorplan
   *
   * 🏢 ADR-292 Phase 4: Legacy building_floorplans fallback eliminated.
   * Loads DXF via DxfFirestoreService (reads from files collection).
   * PDFs also come from files collection via FileRecordService.
   */
  static async loadFloorplan(
    buildingId: string,
    type: 'building' | 'storage'
  ): Promise<BuildingFloorplanData | null> {
    try {
      const fileId = this.generateFileId(buildingId, type);
      floorplanLogger.debug(`Loading ${type} floorplan`, { fileId, buildingId });

      // 1. Try enterprise Storage-based loading for DXF
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

      // 2. Check files collection for PDF FileRecords
      const pdfRecords = await FileRecordService.getFilesByEntity(
        ENTITY_TYPES.BUILDING,
        buildingId,
        {
          domain: FILE_DOMAINS.CONSTRUCTION,
          category: FILE_CATEGORIES.FLOORPLANS,
          purpose: type === 'building' ? FLOORPLAN_PURPOSES.BUILDING : FLOORPLAN_PURPOSES.STORAGE,
        }
      );

      if (pdfRecords.length > 0) {
        const pdfRecord = pdfRecords[0];
        if (pdfRecord.downloadUrl) {
          floorplanLogger.debug(`Loaded PDF from files collection`, { buildingId, fileId: pdfRecord.id });
          return {
            buildingId,
            type,
            fileType: 'pdf',
            fileName: pdfRecord.originalFilename || pdfRecord.displayName,
            pdfImageUrl: pdfRecord.downloadUrl,
            pdfDimensions: pdfRecord.processedData?.pdfDimensions ?? null,
            timestamp: Date.now(),
          };
        }
      }

      return null;
    } catch (error) {
      if (error instanceof Error && isExpectedError(error)) {
        return null;
      }
      floorplanLogger.error(`Error loading ${type} floorplan`, {
        buildingId,
        error: getErrorMessage(error)
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

      // 🏢 ADR-292 Phase 4: Check enterprise storage only (legacy eliminated)
      return await DxfFirestoreService.fileExists(fileId);
    } catch (error) {
      // 🏢 ENTERPRISE: Expected errors → silent false, real errors → logged
      if (error instanceof Error && isExpectedError(error)) {
        return false;
      }
      floorplanLogger.warn(`Error checking ${type} floorplan`, {
        buildingId,
        error: getErrorMessage(error)
      });
      return false;
    }
  }

  /**
   * Delete building floorplan (soft delete via FileRecord lifecycle)
   *
   * 🏢 ADR-292 Phase 4: Uses FileRecordService.moveToTrash (enterprise pattern).
   * Legacy building_floorplans soft delete eliminated.
   */
  static async deleteFloorplan(buildingId: string, type: 'building' | 'storage'): Promise<boolean> {
    try {
      const fileId = this.generateFileId(buildingId, type);
      await FileRecordService.moveToTrash(fileId, 'system');

      floorplanLogger.info(`Deleted ${type} floorplan`, { buildingId });

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('FLOORPLAN_DELETED', {
        floorplanId: fileId,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      floorplanLogger.error(`Error deleting ${type} floorplan`, {
        buildingId,
        error: getErrorMessage(error)
      });
      return false;
    }
  }

}
