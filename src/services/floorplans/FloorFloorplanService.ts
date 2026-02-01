'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE Floor Floorplan Service (V2)
 * =============================================================================
 *
 * Manages floor-level floorplan files using the Enterprise File Storage pattern.
 * Uses FileRecordService for metadata and canonical storage paths.
 *
 * @module services/floorplans/FloorFloorplanService
 * @version 2.0.0
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Storage Pattern:
 * - Firestore: `files` collection (FileRecord documents)
 * - Storage: `companies/{companyId}/projects/{projectId}/entities/floor/{floorId}/domains/construction/categories/floorplans/files/{fileId}.json`
 *
 * @see FileRecordService for the core file operations
 */

import { ref, uploadBytes, getDownloadURL, getBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';
import { FileRecordService } from '@/services/file-record.service';
import { generateFileId } from '@/services/upload/utils/storage-path';
import type { SceneModel } from '@/subapps/dxf-viewer/types/scene';
import type { FileRecord } from '@/types/file-record';
import { Logger, LogLevel, DevNullOutput } from '@/subapps/dxf-viewer/settings/telemetry/Logger';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';

// =============================================================================
// 🏢 ENTERPRISE LOGGER CONFIGURATION
// =============================================================================

const floorplanLogger = new Logger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG,
  prefix: '[FloorFloorplan]',
  output: process.env.NODE_ENV === 'production' ? new DevNullOutput() : undefined
});

// ============================================================================
// TYPES
// ============================================================================

/**
 * 🏢 ENTERPRISE: Floor floorplan data structure
 */
export interface FloorFloorplanData {
  /** Building ID that contains this floor */
  buildingId: string;
  /** Floor ID */
  floorId: string;
  /** Floor number for display */
  floorNumber: number;
  /** Floorplan type */
  type: 'floor';
  /** Original filename */
  fileName: string;
  /** Upload timestamp */
  timestamp: number;
  /** File type discriminator */
  fileType?: 'dxf' | 'pdf';
  /** DXF scene data (present for DXF files) */
  scene?: SceneModel | null;
  /** PDF image URL (present for PDF files) */
  pdfImageUrl?: string;
  /** PDF dimensions (present for PDF files) */
  pdfDimensions?: { width: number; height: number } | null;
  /** FileRecord ID (for Enterprise pattern) */
  fileRecordId?: string;
}

/**
 * Parameters for saving a floor floorplan
 */
export interface SaveFloorplanParams {
  /** Company ID (REQUIRED for Enterprise pattern) */
  companyId: string;
  /** Project ID (optional but recommended) */
  projectId?: string;
  /** Building ID */
  buildingId: string;
  /** Floor ID */
  floorId: string;
  /** Floor number for display */
  floorNumber?: number;
  /** Floorplan data */
  data: FloorFloorplanData;
  /** User ID who created this */
  createdBy: string;
}

/**
 * Parameters for loading a floor floorplan
 */
export interface LoadFloorplanParams {
  /** Company ID (REQUIRED) */
  companyId: string;
  /** Floor ID */
  floorId: string;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class FloorFloorplanService {
  /**
   * 🏢 ENTERPRISE: Save floor floorplan using FileRecordService
   *
   * Flow:
   * 1. Create FileRecord with status: pending
   * 2. Upload scene JSON to Storage at canonical path
   * 3. Finalize FileRecord with downloadUrl
   */
  static async saveFloorplan(params: SaveFloorplanParams): Promise<boolean> {
    const { companyId, projectId, buildingId, floorId, data, createdBy } = params;

    try {
      // Determine file type
      const isPdfFloorplan = data.fileType === 'pdf' || (!data.scene && data.pdfImageUrl);

      if (isPdfFloorplan) {
        // PDF floorplans: Use FileRecordService for the PDF file itself
        floorplanLogger.debug(`Saving PDF floor floorplan`, { floorId, buildingId });

        // For PDF, we assume the PDF is already uploaded and we just need to create/update the FileRecord
        // This would typically be handled by the upload flow, not here
        floorplanLogger.warn(`PDF floorplan save not implemented in V2 - use FileRecordService directly`);
        return false;
      }

      // DXF floorplans: Save scene JSON using Enterprise pattern
      if (!data.scene) {
        floorplanLogger.warn(`No scene data for DXF floorplan`, { buildingId, floorId });
        return false;
      }

      floorplanLogger.debug(`Saving DXF floor floorplan via Enterprise storage`, { floorId, buildingId });

      // Step 1: Create pending FileRecord
      const fileName = data.fileName || `floor_${floorId}_floorplan.json`;

      const createResult = await FileRecordService.createPendingFileRecord({
        companyId,
        projectId,
        entityType: ENTITY_TYPES.FLOOR,
        entityId: floorId,
        domain: FILE_DOMAINS.CONSTRUCTION,
        category: FILE_CATEGORIES.FLOORPLANS,
        originalFilename: fileName,
        contentType: 'application/json',
        createdBy,
        // 🏢 ENTERPRISE: Naming context for display name generation
        entityLabel: `Floor ${data.floorNumber || floorId}`,
        purpose: 'floor-floorplan',
        // Store buildingId in descriptors for retrieval
        descriptors: [buildingId, `floor-${data.floorNumber || 0}`],
      });

      // Step 2: Upload scene JSON to Storage
      const sceneJson = JSON.stringify(data.scene);
      const sceneBytes = new TextEncoder().encode(sceneJson);

      const storageRef = ref(storage, createResult.storagePath);
      const uploadResult = await uploadBytes(storageRef, sceneBytes, {
        contentType: 'application/json',
      });

      // Step 3: Get download URL
      const downloadUrl = await getDownloadURL(uploadResult.ref);

      // Step 4: Finalize FileRecord
      await FileRecordService.finalizeFileRecord({
        fileId: createResult.fileId,
        sizeBytes: sceneBytes.length,
        downloadUrl,
      });

      floorplanLogger.info(`Enterprise save complete for floor`, {
        floorId,
        buildingId,
        fileId: createResult.fileId,
        storagePath: createResult.storagePath,
      });

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatchFloorplanCreated({
        floorplanId: createResult.fileId,
        floorplan: {
          name: fileName,
          entityType: ENTITY_TYPES.FLOOR,
          entityId: floorId,
        },
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      floorplanLogger.error(`Error saving floor floorplan`, {
        buildingId,
        floorId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 🏢 ENTERPRISE: Load floor floorplan from FileRecordService
   *
   * Strategy:
   * 1. Query `files` collection for floor floorplans
   * 2. Download scene JSON from Storage
   * 3. Return FloorFloorplanData
   */
  static async loadFloorplan(params: LoadFloorplanParams): Promise<FloorFloorplanData | null> {
    const { companyId, floorId } = params;

    try {
      floorplanLogger.debug(`Loading floor floorplan`, { floorId, companyId });

      // Query files collection for this floor's floorplans
      // 🏢 ENTERPRISE: Using positional args as per FileRecordService API
      const fileRecords = await FileRecordService.getFilesByEntity(
        ENTITY_TYPES.FLOOR,
        floorId,
        {
          companyId,
          category: FILE_CATEGORIES.FLOORPLANS,
          purpose: 'floor-floorplan',
        }
      );

      if (!fileRecords || fileRecords.length === 0) {
        floorplanLogger.debug(`No floorplan found for floor`, { floorId });
        return null;
      }

      // Get the most recent floorplan
      const fileRecord = fileRecords[0];

      // Check file type from extension or contentType
      const isPdf = fileRecord.ext?.toLowerCase() === 'pdf' ||
                    fileRecord.contentType?.includes('pdf');

      // Extract buildingId from descriptors (first element)
      const buildingId = fileRecord.purpose === 'floor-floorplan' &&
                         Array.isArray((fileRecord as FileRecord & { descriptors?: string[] }).descriptors)
                           ? (fileRecord as FileRecord & { descriptors?: string[] }).descriptors?.[0] || ''
                           : '';

      // Extract floorNumber from descriptors (second element, format: "floor-N")
      const floorNumberDescriptor = Array.isArray((fileRecord as FileRecord & { descriptors?: string[] }).descriptors)
        ? (fileRecord as FileRecord & { descriptors?: string[] }).descriptors?.[1] || ''
        : '';
      const floorNumber = parseInt(floorNumberDescriptor.replace('floor-', ''), 10) || 0;

      if (isPdf) {
        // PDF floorplan - return URL directly
        floorplanLogger.debug(`Loaded PDF floorplan`, { floorId, fileId: fileRecord.id });
        return {
          buildingId,
          floorId,
          floorNumber,
          type: 'floor',
          fileName: fileRecord.originalFilename,
          timestamp: typeof fileRecord.createdAt === 'string'
            ? new Date(fileRecord.createdAt).getTime()
            : fileRecord.createdAt instanceof Date
              ? fileRecord.createdAt.getTime()
              : Date.now(),
          fileType: 'pdf',
          pdfImageUrl: fileRecord.downloadUrl,
          fileRecordId: fileRecord.id,
        };
      }

      // DXF floorplan - download scene JSON
      if (!fileRecord.downloadUrl) {
        floorplanLogger.warn(`No download URL for DXF floorplan`, { floorId, fileId: fileRecord.id });
        return null;
      }

      // Download scene JSON from Storage
      const storageRef = ref(storage, fileRecord.storagePath);
      const sceneBytes = await getBytes(storageRef);
      const sceneJson = new TextDecoder().decode(sceneBytes);
      const scene = JSON.parse(sceneJson) as SceneModel;

      floorplanLogger.debug(`Loaded DXF floorplan`, {
        floorId,
        fileId: fileRecord.id,
        entityCount: scene.entities?.length || 0,
      });

      return {
        buildingId,
        floorId,
        floorNumber,
        type: 'floor',
        fileName: fileRecord.originalFilename,
        timestamp: typeof fileRecord.createdAt === 'string'
          ? new Date(fileRecord.createdAt).getTime()
          : fileRecord.createdAt instanceof Date
            ? fileRecord.createdAt.getTime()
            : Date.now(),
        fileType: 'dxf',
        scene,
        fileRecordId: fileRecord.id,
      };
    } catch (error) {
      floorplanLogger.error(`Error loading floor floorplan`, {
        floorId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * 🏢 ENTERPRISE: Check if floor floorplan exists
   */
  static async hasFloorplan(companyId: string, floorId: string): Promise<boolean> {
    try {
      const fileRecords = await FileRecordService.getFilesByEntity(
        ENTITY_TYPES.FLOOR,
        floorId,
        {
          companyId,
          category: FILE_CATEGORIES.FLOORPLANS,
          purpose: 'floor-floorplan',
        }
      );

      return fileRecords && fileRecords.length > 0;
    } catch (error) {
      floorplanLogger.warn(`Error checking floor floorplan`, {
        floorId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 🏢 ENTERPRISE: Delete floor floorplan (soft delete via FileRecordService)
   * @param companyId - Company ID
   * @param floorId - Floor ID
   * @param deletedBy - User ID who is deleting (REQUIRED for trash audit)
   */
  static async deleteFloorplan(companyId: string, floorId: string, deletedBy: string): Promise<boolean> {
    try {
      const fileRecords = await FileRecordService.getFilesByEntity(
        ENTITY_TYPES.FLOOR,
        floorId,
        {
          companyId,
          category: FILE_CATEGORIES.FLOORPLANS,
          purpose: 'floor-floorplan',
        }
      );

      if (!fileRecords || fileRecords.length === 0) {
        return true; // Nothing to delete
      }

      // Move to trash all floorplans for this floor
      for (const fileRecord of fileRecords) {
        await FileRecordService.moveToTrash(fileRecord.id, deletedBy);
      }

      floorplanLogger.info(`Deleted floor floorplan(s)`, { floorId, count: fileRecords.length });

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatchFloorplanDeleted({
        floorplanId: floorId,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      floorplanLogger.error(`Error deleting floor floorplan`, {
        floorId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  // ============================================================================
  // 🏢 LEGACY COMPATIBILITY: Old signature support
  // ============================================================================

  /**
   * @deprecated Use loadFloorplan({ companyId, floorId }) instead
   * Legacy signature for backward compatibility with existing code
   */
  static async loadFloorplanLegacy(buildingId: string, floorId: string): Promise<FloorFloorplanData | null> {
    floorplanLogger.warn(`Using deprecated loadFloorplanLegacy - migrate to new API with companyId`);
    // Cannot load without companyId - return null
    // This is a breaking change but necessary for Enterprise pattern
    return null;
  }
}
