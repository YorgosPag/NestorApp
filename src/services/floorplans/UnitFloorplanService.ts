'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE Unit Floorplan Service (V2)
 * =============================================================================
 *
 * Manages unit floorplan files using the Enterprise File Storage pattern.
 * Uses FileRecordService for metadata and canonical storage paths.
 *
 * @module services/floorplans/UnitFloorplanService
 * @version 2.0.0
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Storage Pattern:
 * - Firestore: `files` collection (FileRecord documents)
 * - Storage: `companies/{companyId}/.../entities/unit/{unitId}/domains/construction/categories/floorplans/files/{fileId}.*`
 *
 * Legacy Fallback:
 * - Reads from `unit_floorplans/{unitId}_unit` for backward compatibility with old data
 *
 * @see FloorFloorplanService for the gold-standard reference implementation
 * @see FileRecordService for the core file operations
 */

import { doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getBytes } from 'firebase/storage';
import pako from 'pako';
import { db, storage } from '@/lib/firebase';
import { FileRecordService } from '@/services/file-record.service';
import { RealtimeService } from '@/services/realtime';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';
import { Logger, LogLevel, DevNullOutput } from '@/subapps/dxf-viewer/settings/telemetry/Logger';

// =============================================================================
// 🏢 ENTERPRISE LOGGER CONFIGURATION
// =============================================================================

const logger = new Logger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG,
  prefix: '[UnitFloorplan]',
  output: process.env.NODE_ENV === 'production' ? new DevNullOutput() : undefined,
});

// ============================================================================
// TYPES
// ============================================================================

/** DXF scene data structure */
interface DxfSceneData {
  entities?: unknown[];
  layers?: Record<string, unknown>;
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
  [key: string]: unknown;
}

export interface UnitFloorplanData {
  unitId: string;
  type: 'unit';
  scene: DxfSceneData;
  fileName: string;
  timestamp: number;
  /** FileRecord ID (for Enterprise pattern) */
  fileRecordId?: string;
}

/**
 * 🏢 ENTERPRISE: Parameters for saving a unit floorplan
 */
export interface SaveUnitFloorplanParams {
  /** Company ID (REQUIRED) */
  companyId: string;
  /** Project ID (optional but recommended) */
  projectId?: string;
  /** Building ID (optional) */
  buildingId?: string;
  /** Unit ID (REQUIRED) */
  unitId: string;
  /** Floorplan data */
  data: UnitFloorplanData;
  /** User ID who created this */
  createdBy: string;
  /** Original file for direct upload (DXF/PDF) */
  originalFile?: File;
}

/**
 * 🏢 ENTERPRISE: Parameters for loading a unit floorplan
 */
export interface LoadUnitFloorplanParams {
  /** Company ID (REQUIRED) */
  companyId: string;
  /** Unit ID */
  unitId: string;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class UnitFloorplanService {
  /** @deprecated Legacy collection — kept for backward-compatible reads only */
  private static readonly LEGACY_COLLECTION = 'unit_floorplans';

  /**
   * 🏢 ENTERPRISE: Save unit floorplan using FileRecordService
   *
   * Flow (same pattern as FloorFloorplanService):
   * 1. createPendingFileRecord() → `files` collection
   * 2. Upload to Firebase Storage (gzip DXF, raw PDF, gzip JSON fallback)
   * 3. Thumbnail generation (non-blocking)
   * 4. finalizeFileRecord() → status: ready + downloadUrl
   * 5. RealtimeService.dispatch('FLOORPLAN_CREATED')
   *
   * NOTE: Does NOT write to legacy `unit_floorplans` collection.
   */
  static async saveFloorplan(params: SaveUnitFloorplanParams): Promise<boolean> {
    const { companyId, projectId, buildingId, unitId, data, createdBy, originalFile } = params;

    try {
      logger.debug('Saving unit floorplan via Enterprise storage', { unitId, companyId });

      const fileName = data.fileName || `${unitId}_unit_floorplan.dxf`;
      const hasOriginalFile = !!originalFile;
      const fileExtension = hasOriginalFile
        ? (originalFile.name.split('.').pop()?.toLowerCase() || 'dxf')
        : 'json';
      const contentType = hasOriginalFile
        ? (originalFile.type || (fileExtension === 'pdf' ? 'application/pdf' : 'application/dxf'))
        : 'application/json';

      // Step 1: Create pending FileRecord
      const createResult = await FileRecordService.createPendingFileRecord({
        companyId,
        projectId,
        entityType: ENTITY_TYPES.UNIT,
        entityId: unitId,
        domain: FILE_DOMAINS.CONSTRUCTION,
        category: FILE_CATEGORIES.FLOORPLANS,
        originalFilename: fileName,
        contentType,
        createdBy,
        entityLabel: `Unit ${unitId}`,
        purpose: 'unit-floorplan',
        ext: fileExtension,
        descriptors: [unitId, buildingId || '', 'unit-floorplan'].filter(Boolean),
      });

      // Step 2: Upload to Firebase Storage
      const storageRef = ref(storage, createResult.storagePath);
      let uploadSize: number;
      let downloadUrl: string;

      if (hasOriginalFile) {
        const originalSize = originalFile.size;

        if (fileExtension === 'dxf') {
          // DXF: gzip compress (text files compress 80-90%)
          const arrayBuffer = await originalFile.arrayBuffer();
          const compressed = pako.gzip(new Uint8Array(arrayBuffer));
          const uploadResult = await uploadBytes(storageRef, compressed, {
            contentType,
            customMetadata: { compressed: 'gzip', originalSize: String(originalSize) },
          });
          downloadUrl = await getDownloadURL(uploadResult.ref);
        } else {
          // PDF/other: upload as-is
          const uploadResult = await uploadBytes(storageRef, originalFile, {
            contentType,
          });
          downloadUrl = await getDownloadURL(uploadResult.ref);
        }
        uploadSize = originalSize;
      } else {
        // Fallback: scene JSON (gzip compressed)
        const sceneJson = JSON.stringify(data.scene);
        const sceneBytes = new TextEncoder().encode(sceneJson);
        const compressed = pako.gzip(sceneBytes);
        const uploadResult = await uploadBytes(storageRef, compressed, {
          contentType: 'application/json',
          customMetadata: { compressed: 'gzip', originalSize: String(sceneBytes.length) },
        });
        uploadSize = sceneBytes.length;
        downloadUrl = await getDownloadURL(uploadResult.ref);
      }

      // Step 3: Thumbnail generation (non-blocking)
      let thumbnailUrl: string | undefined;
      try {
        const { generateDxfThumbnail, generatePdfThumbnail } = await import('@/services/thumbnail-generator');
        let thumbnailBlob: Blob | null = null;

        if (data.scene && fileExtension !== 'pdf') {
          // Scene entities are typed as unknown[] but contain {type, layer} objects at runtime
          const sceneForThumb = data.scene as Parameters<typeof generateDxfThumbnail>[0];
          thumbnailBlob = await generateDxfThumbnail(sceneForThumb, 300, 200);
        } else if (hasOriginalFile && fileExtension === 'pdf') {
          thumbnailBlob = await generatePdfThumbnail(originalFile, 300, 200);
        }

        if (thumbnailBlob) {
          const thumbPath = `${createResult.storagePath}_thumb.png`;
          const thumbRef = ref(storage, thumbPath);
          await uploadBytes(thumbRef, thumbnailBlob, { contentType: 'image/png' });
          thumbnailUrl = await getDownloadURL(thumbRef);
        }
      } catch (thumbError) {
        logger.warn('Thumbnail generation skipped', {
          error: thumbError instanceof Error ? thumbError.message : String(thumbError),
        });
      }

      // Step 4: Finalize FileRecord
      await FileRecordService.finalizeFileRecord({
        fileId: createResult.fileId,
        sizeBytes: uploadSize,
        downloadUrl,
        thumbnailUrl,
      });

      logger.info('Enterprise save complete for unit', {
        unitId,
        fileId: createResult.fileId,
        ext: fileExtension,
        sizeBytes: uploadSize,
      });

      // Step 5: Real-time notification
      RealtimeService.dispatch('FLOORPLAN_CREATED', {
        floorplanId: createResult.fileId,
        floorplan: {
          entityType: ENTITY_TYPES.UNIT,
          entityId: unitId,
          name: fileName,
        },
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      logger.error('Error saving unit floorplan', {
        unitId,
        companyId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 🏢 ENTERPRISE: Load unit floorplan from FileRecordService
   *
   * Strategy:
   * 1. Primary: Query `files` collection via FileRecordService
   * 2. Fallback: Check legacy `unit_floorplans/{unitId}_unit` for embedded scene (old data)
   * 3. If neither → return null
   */
  static async loadFloorplan(params: LoadUnitFloorplanParams): Promise<UnitFloorplanData | null> {
    const { companyId, unitId } = params;

    try {
      logger.debug('Loading unit floorplan', { unitId, companyId });

      // ── Primary: FileRecord-based lookup ──
      const fileRecords = await FileRecordService.getFilesByEntity(
        ENTITY_TYPES.UNIT,
        unitId,
        {
          companyId,
          domain: FILE_DOMAINS.CONSTRUCTION,
          category: FILE_CATEGORIES.FLOORPLANS,
          purpose: 'unit-floorplan',
        }
      );

      if (fileRecords.length > 0) {
        const fileRecord = fileRecords[0];

        if (!fileRecord.storagePath) {
          logger.warn('FileRecord has no storagePath', { unitId, fileId: fileRecord.id });
          return null;
        }

        const storageRef = ref(storage, fileRecord.storagePath);
        const compressedBytes = await getBytes(storageRef);

        // Try gzip decompress first, fallback to raw JSON
        let sceneJson: string;
        try {
          const decompressed = pako.ungzip(new Uint8Array(compressedBytes));
          sceneJson = new TextDecoder().decode(decompressed);
        } catch {
          sceneJson = new TextDecoder().decode(compressedBytes);
        }

        const scene = JSON.parse(sceneJson) as DxfSceneData;

        logger.debug('Loaded unit floorplan from FileRecord', {
          unitId,
          fileId: fileRecord.id,
          entityCount: scene.entities?.length || 0,
        });

        return {
          unitId,
          type: 'unit',
          scene,
          fileName: fileRecord.originalFilename,
          timestamp: typeof fileRecord.createdAt === 'string'
            ? new Date(fileRecord.createdAt).getTime()
            : fileRecord.createdAt instanceof Date
              ? fileRecord.createdAt.getTime()
              : Date.now(),
          fileRecordId: fileRecord.id,
        };
      }

      // ── Fallback: Legacy collection (backward compat for old data) ──
      const docId = `${unitId}_unit`;
      const docSnap = await getDoc(doc(db, this.LEGACY_COLLECTION, docId));

      if (docSnap.exists()) {
        const data = docSnap.data();

        // Only return if scene is embedded (truly old data)
        if (data.scene && !data.sceneStoredInStorage) {
          logger.warn('Loaded unit floorplan from LEGACY collection (embedded scene)', { unitId });
          return data as UnitFloorplanData;
        }
      }

      logger.debug('No floorplan found for unit', { unitId });
      return null;
    } catch (error) {
      logger.error('Error loading unit floorplan', {
        unitId,
        companyId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 🏢 ENTERPRISE: Check if unit floorplan exists
   */
  static async hasFloorplan(companyId: string, unitId: string): Promise<boolean> {
    try {
      const fileRecords = await FileRecordService.getFilesByEntity(
        ENTITY_TYPES.UNIT,
        unitId,
        {
          companyId,
          domain: FILE_DOMAINS.CONSTRUCTION,
          category: FILE_CATEGORIES.FLOORPLANS,
          purpose: 'unit-floorplan',
        }
      );

      if (fileRecords.length > 0) {
        return true;
      }

      // Fallback: check legacy collection
      const docId = `${unitId}_unit`;
      const docSnap = await getDoc(doc(db, this.LEGACY_COLLECTION, docId));
      return docSnap.exists() && !docSnap.data()?.deleted;
    } catch (error) {
      logger.warn('Error checking unit floorplan', {
        unitId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 🏢 ENTERPRISE: Delete unit floorplan (soft delete via FileRecordService)
   */
  static async deleteFloorplan(companyId: string, unitId: string, deletedBy: string): Promise<boolean> {
    try {
      const fileRecords = await FileRecordService.getFilesByEntity(
        ENTITY_TYPES.UNIT,
        unitId,
        {
          companyId,
          domain: FILE_DOMAINS.CONSTRUCTION,
          category: FILE_CATEGORIES.FLOORPLANS,
          purpose: 'unit-floorplan',
        }
      );

      if (!fileRecords || fileRecords.length === 0) {
        return true; // Nothing to delete
      }

      for (const fileRecord of fileRecords) {
        await FileRecordService.moveToTrash(fileRecord.id, deletedBy);
      }

      logger.info('Deleted unit floorplan(s)', { unitId, count: fileRecords.length });

      RealtimeService.dispatch('FLOORPLAN_DELETED', {
        floorplanId: unitId,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      logger.error('Error deleting unit floorplan', {
        unitId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
