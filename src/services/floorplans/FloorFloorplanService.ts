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

import { safeJsonParse } from '@/lib/json-utils';
import { ref, getDownloadURL, getBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';
import { FileRecordService } from '@/services/file-record.service';
import { FloorplanSaveOrchestrator } from '@/services/floorplans/floorplan-save-orchestrator';
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
  fileType?: 'dxf' | 'pdf' | 'image';
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

      const fileName = data.fileName || `floor_${floorId}_floorplan.json`;

      // 🏢 ENTERPRISE: Delegate to centralized FloorplanSaveOrchestrator (ADR-201)
      const result = await FloorplanSaveOrchestrator.save({
        companyId,
        projectId,
        entityType: ENTITY_TYPES.FLOOR,
        entityId: floorId,
        purpose: 'floor-floorplan',
        entityLabel: `Floor ${data.floorNumber || floorId}`,
        descriptors: [buildingId, `floor-${data.floorNumber || 0}`],
        createdBy,
        originalFilename: fileName,
        contentType: 'application/json',
        payload: { kind: 'json', data: data.scene },
      });

      floorplanLogger.info(`Enterprise save complete for floor`, {
        floorId,
        buildingId,
        fileId: result.fileId,
        storagePath: result.storagePath,
      });

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('FLOORPLAN_CREATED', {
        floorplanId: result.fileId,
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
      floorplanLogger.debug(`loadFloorplan START floorId="${floorId}" companyId="${companyId}"`);

      // Query files collection for this floor's floorplans
      // 🏢 ENTERPRISE: Using positional args as per FileRecordService API
      // 🏢 FIX: Include domain to match the existing Firestore composite index
      // Index: entityType + entityId + status + companyId + domain + category + purpose + isDeleted
      let fileRecords = await FileRecordService.getFilesByEntity(
        ENTITY_TYPES.FLOOR,
        floorId,
        {
          companyId,
          domain: FILE_DOMAINS.CONSTRUCTION,
          category: FILE_CATEGORIES.FLOORPLANS,
          purpose: 'floor-floorplan',
        }
      );

      // 🏢 ENTERPRISE: Fallback — files uploaded via EntityFilesManager before ADR-202
      // may not have purpose set. Query without purpose filter to catch them.
      if (!fileRecords || fileRecords.length === 0) {
        floorplanLogger.info('No records with purpose=floor-floorplan, trying without purpose filter');
        fileRecords = await FileRecordService.getFilesByEntity(
          ENTITY_TYPES.FLOOR,
          floorId,
          {
            companyId,
            domain: FILE_DOMAINS.CONSTRUCTION,
            category: FILE_CATEGORIES.FLOORPLANS,
          }
        );
      }

      floorplanLogger.debug('Query result', { count: fileRecords?.length ?? 0 });

      if (!fileRecords || fileRecords.length === 0) {
        floorplanLogger.info(`No FileRecord found for floor floorId="${floorId}" companyId="${companyId}"`);
        return null;
      }

      // Get the most recent floorplan
      const fileRecord = fileRecords[0];

      // Check file type from extension or contentType
      const ext = fileRecord.ext?.toLowerCase() || '';
      const contentType = fileRecord.contentType?.toLowerCase() || '';
      const isPdf = ext === 'pdf' || contentType.includes('pdf');
      const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext)
                   || contentType.startsWith('image/');
      // DXF scene JSON = not PDF and not image (saved by DXF wizard as application/json)
      const isDxfScene = !isPdf && !isImage;

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

      // Helper: build timestamp from FileRecord
      const getTimestamp = (): number => {
        if (typeof fileRecord.createdAt === 'string') return new Date(fileRecord.createdAt).getTime();
        if (fileRecord.createdAt instanceof Date) return fileRecord.createdAt.getTime();
        return Date.now();
      };

      // 🏢 ENTERPRISE: PDF and image floorplans — return downloadUrl directly
      if (isPdf || isImage) {
        floorplanLogger.debug(`Loaded ${isPdf ? 'PDF' : 'image'} floorplan`, { floorId, fileId: fileRecord.id, ext });
        return {
          buildingId,
          floorId,
          floorNumber,
          type: 'floor',
          fileName: fileRecord.originalFilename,
          timestamp: getTimestamp(),
          fileType: isPdf ? 'pdf' : 'image',
          pdfImageUrl: fileRecord.downloadUrl,
          fileRecordId: fileRecord.id,
        };
      }

      // DXF scene JSON — download and parse
      if (!fileRecord.downloadUrl) {
        floorplanLogger.warn(`No download URL for DXF floorplan`, { floorId, fileId: fileRecord.id });
        return null;
      }

      floorplanLogger.debug('Downloading DXF scene via downloadUrl', { fileId: fileRecord.id });
      const response = await fetch(fileRecord.downloadUrl);
      if (!response.ok) {
        floorplanLogger.warn(`Download failed: ${response.status}`, { floorId, fileId: fileRecord.id });
        return null;
      }
      const sceneJson = await response.text();
      floorplanLogger.debug('Downloaded + parsing', { bytes: sceneJson.length });
      const scene = safeJsonParse<SceneModel>(sceneJson, null as unknown as SceneModel);
      if (scene === null) {
        floorplanLogger.error('Failed to parse floor floorplan JSON', { floorId });
        return null;
      }

      return {
        buildingId,
        floorId,
        floorNumber,
        type: 'floor',
        fileName: fileRecord.originalFilename,
        timestamp: getTimestamp(),
        fileType: 'dxf',
        scene,
        fileRecordId: fileRecord.id,
      };
    } catch (error) {
      floorplanLogger.error('EXCEPTION in loadFloorplan', error);
      return null;
    }
  }

  /**
   * 🏢 ENTERPRISE: Check if floor floorplan exists
   */
  static async hasFloorplan(companyId: string, floorId: string): Promise<boolean> {
    try {
      // 🏢 FIX: Include domain to match the existing Firestore composite index
      // Index: entityType + entityId + status + companyId + domain + category + purpose + isDeleted
      const fileRecords = await FileRecordService.getFilesByEntity(
        ENTITY_TYPES.FLOOR,
        floorId,
        {
          companyId,
          domain: FILE_DOMAINS.CONSTRUCTION,
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
      // 🏢 FIX: Include domain to match the existing Firestore composite index
      // Index: entityType + entityId + status + companyId + domain + category + purpose + isDeleted
      const fileRecords = await FileRecordService.getFilesByEntity(
        ENTITY_TYPES.FLOOR,
        floorId,
        {
          companyId,
          domain: FILE_DOMAINS.CONSTRUCTION,
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
      RealtimeService.dispatch('FLOORPLAN_DELETED', {
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
