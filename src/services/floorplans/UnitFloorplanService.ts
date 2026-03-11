'use client';

/**
 * 🏢 ENTERPRISE Unit Floorplan Service
 *
 * Manages unit floorplan DXF data using Firebase Storage + FileRecord pattern.
 * Migrated from legacy `unit_floorplans` collection to enterprise `files` system.
 *
 * Architecture:
 * - Scene data → Firebase Storage (unlimited size, gzip compressed)
 * - Metadata → Firestore `files` collection (FileRecord SSoT)
 * - Legacy collection kept for backward-compatible reads
 *
 * @module services/floorplans/UnitFloorplanService
 * @version 2.0.0 - Enterprise Migration (same pattern as BuildingFloorplanService)
 */

import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import pako from 'pako';
import toast from 'react-hot-toast';
import { db, storage } from '@/lib/firebase';
import { FileRecordService } from '@/services/file-record.service';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('UnitFloorplanService');

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
}

/**
 * 🏢 ENTERPRISE: Options for FileRecord creation
 * When provided, saveFloorplan() creates a FileRecord so the floorplan
 * appears in the unit's FloorPlanTab via EntityFilesManager.
 */
export interface UnitFloorplanSaveOptions {
  companyId: string;
  projectId?: string;
  buildingId?: string;
  createdBy: string;
  originalFile?: File;
}

// ============================================================================
// SERVICE
// ============================================================================

export class UnitFloorplanService {
  /** @deprecated Legacy collection — kept for backward-compatible reads */
  private static readonly LEGACY_COLLECTION = 'unit_floorplans';

  /**
   * 🏢 ENTERPRISE: Save unit floorplan
   *
   * 1. Saves scene to legacy collection (backward compat)
   * 2. If options provided → creates FileRecord (enterprise `files` system)
   *    Following 3-step canonical upload pattern (ADR-031):
   *    a. createPendingFileRecord()
   *    b. Upload to Firebase Storage (gzip compressed)
   *    c. finalizeFileRecord() → status: ready + downloadUrl
   */
  static async saveFloorplan(
    unitId: string,
    data: UnitFloorplanData,
    options?: UnitFloorplanSaveOptions
  ): Promise<boolean> {
    try {
      const docId = `${unitId}_unit`;

      // Legacy metadata save (backward compat) — NO scene data!
      // 🏢 FIX: Scene data MUST go to Firebase Storage only (via createFileRecord),
      // NOT embedded in Firestore document. A full DXF scene can be 200K+ lines / 1MB+
      // which exceeds Firestore's 1MB document limit and wastes read bandwidth.
      await setDoc(doc(db, this.LEGACY_COLLECTION, docId), {
        unitId,
        type: 'unit',
        fileName: data.fileName,
        timestamp: data.timestamp,
        updatedAt: new Date().toISOString(),
        // Marker: scene is stored in Firebase Storage via FileRecord pattern
        sceneStoredInStorage: true,
        ...(options?.companyId ? { companyId: options.companyId } : {}),
        ...(options?.createdBy ? { createdBy: options.createdBy } : {}),
      });

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('FLOORPLAN_CREATED', {
        floorplanId: docId,
        floorplan: {
          entityType: ENTITY_TYPES.UNIT,
          entityId: unitId,
          name: data.fileName,
        },
        timestamp: Date.now(),
      });

      // 🏢 ENTERPRISE: Create FileRecord → visible in FloorPlanTab
      if (options?.companyId && options?.createdBy) {
        try {
          await this.createFileRecord(unitId, data, options);
          toast.success('FileRecord δημιουργήθηκε — η κάτοψη θα εμφανιστεί στην καρτέλα');
        } catch (fileRecordError) {
          const errMsg = fileRecordError instanceof Error ? fileRecordError.message : String(fileRecordError);
          toast.error(`FileRecord αποτυχία: ${errMsg}`);
          logger.error('FileRecord creation failed (non-blocking)', { unitId, error: errMsg });
        }
      } else {
        logger.warn('No FileRecord options — skipping enterprise file creation', {
          hasOptions: !!options,
          hasCompanyId: !!options?.companyId,
          hasCreatedBy: !!options?.createdBy,
        });
      }

      return true;
    } catch (error) {
      logger.error('Error saving unit floorplan', {
        unitId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Load unit floorplan data
   *
   * Strategy:
   * 1. Check legacy collection for metadata
   * 2. If scene is embedded (old data) → return directly
   * 3. If sceneStoredInStorage (new data) → load from FileRecord/Storage
   */
  static async loadFloorplan(unitId: string, companyId?: string): Promise<UnitFloorplanData | null> {
    try {
      const docId = `${unitId}_unit`;
      const docSnap = await getDoc(doc(db, this.LEGACY_COLLECTION, docId));

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();

      // Legacy format: scene embedded in Firestore document
      if (data.scene && !data.sceneStoredInStorage) {
        return data as UnitFloorplanData;
      }

      // New format: scene in Firebase Storage — load via FileRecord
      if (data.sceneStoredInStorage && companyId) {
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
            const fileRecord = fileRecords[0];
            if (fileRecord.storagePath) {
              const storageRef = ref(storage, fileRecord.storagePath);
              const { getBytes } = await import('firebase/storage');
              const compressedBytes = await getBytes(storageRef);

              // Try to decompress (gzip) first, fallback to raw JSON
              let sceneJson: string;
              try {
                const decompressed = pako.ungzip(new Uint8Array(compressedBytes));
                sceneJson = new TextDecoder().decode(decompressed);
              } catch {
                // Not compressed, try raw
                sceneJson = new TextDecoder().decode(compressedBytes);
              }

              const scene = JSON.parse(sceneJson) as DxfSceneData;
              return {
                unitId,
                type: 'unit',
                scene,
                fileName: data.fileName,
                timestamp: data.timestamp,
              };
            }
          }
        } catch (storageError) {
          logger.error('Failed to load scene from Storage, falling back', {
            unitId, error: storageError instanceof Error ? storageError.message : String(storageError),
          });
        }
      }

      // Fallback: return metadata without scene
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if unit floorplan exists
   */
  static async hasFloorplan(unitId: string): Promise<boolean> {
    try {
      const docId = `${unitId}_unit`;
      const docSnap = await getDoc(doc(db, this.LEGACY_COLLECTION, docId));
      return docSnap.exists();
    } catch {
      return false;
    }
  }

  /**
   * Delete unit floorplan
   */
  static async deleteFloorplan(unitId: string): Promise<boolean> {
    try {
      const docId = `${unitId}_unit`;
      await setDoc(doc(db, this.LEGACY_COLLECTION, docId), {
        deleted: true,
        deletedAt: new Date().toISOString()
      });

      RealtimeService.dispatch('FLOORPLAN_DELETED', {
        floorplanId: docId,
        timestamp: Date.now(),
      });

      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // PRIVATE: FileRecord creation (enterprise pattern)
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Create FileRecord for unit floorplan
   *
   * 3-step canonical upload (same as BuildingFloorplanService):
   * 1. createPendingFileRecord() → Firestore `files` collection
   * 2. Upload file to Firebase Storage (gzip compressed for DXF)
   * 3. finalizeFileRecord() → status: ready + downloadUrl
   */
  private static async createFileRecord(
    unitId: string,
    data: UnitFloorplanData,
    options: UnitFloorplanSaveOptions
  ): Promise<void> {
    try {
      const fileName = data.fileName || `${unitId}_unit_floorplan.dxf`;
      const hasOriginalFile = !!options.originalFile;
      const fileExtension = hasOriginalFile
        ? (options.originalFile!.name.split('.').pop()?.toLowerCase() || 'dxf')
        : 'json';
      const contentType = hasOriginalFile
        ? (options.originalFile!.type || (fileExtension === 'pdf' ? 'application/pdf' : 'application/dxf'))
        : 'application/json';

      // Step 1: Create pending FileRecord
      const createResult = await FileRecordService.createPendingFileRecord({
        companyId: options.companyId,
        projectId: options.projectId,
        entityType: ENTITY_TYPES.UNIT,
        entityId: unitId,
        domain: FILE_DOMAINS.CONSTRUCTION,
        category: FILE_CATEGORIES.FLOORPLANS,
        originalFilename: fileName,
        contentType,
        createdBy: options.createdBy,
        entityLabel: `Unit ${unitId}`,
        purpose: 'unit-floorplan',
        ext: fileExtension,
        descriptors: [unitId, options.buildingId || '', 'unit-floorplan'].filter(Boolean),
      });

      // Step 2: Upload to Firebase Storage
      const storageRef = ref(storage, createResult.storagePath);
      let uploadSize: number;
      let downloadUrl: string;

      if (hasOriginalFile) {
        const originalSize = options.originalFile!.size;

        if (fileExtension === 'dxf') {
          // DXF: gzip compress (text files compress 80-90%)
          const arrayBuffer = await options.originalFile!.arrayBuffer();
          const compressed = pako.gzip(new Uint8Array(arrayBuffer));
          const uploadResult = await uploadBytes(storageRef, compressed, {
            contentType,
            customMetadata: { compressed: 'gzip', originalSize: String(originalSize) },
          });
          downloadUrl = await getDownloadURL(uploadResult.ref);
        } else {
          // PDF/other: upload as-is
          const uploadResult = await uploadBytes(storageRef, options.originalFile!, {
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

      // Step 3: Generate thumbnail (non-blocking)
      let thumbnailUrl: string | undefined;
      try {
        const { generateDxfThumbnail, generatePdfThumbnail } = await import('@/services/thumbnail-generator');
        let thumbnailBlob: Blob | null = null;

        if (data.scene && fileExtension !== 'pdf') {
          thumbnailBlob = await generateDxfThumbnail(data.scene, 300, 200);
        } else if (hasOriginalFile && fileExtension === 'pdf') {
          thumbnailBlob = await generatePdfThumbnail(options.originalFile!, 300, 200);
        }

        if (thumbnailBlob) {
          const thumbPath = `${createResult.storagePath}_thumb.png`;
          const thumbRef = ref(storage, thumbPath);
          await uploadBytes(thumbRef, thumbnailBlob, { contentType: 'image/png' });
          thumbnailUrl = await getDownloadURL(thumbRef);
        }
      } catch (thumbError) {
        // Thumbnail failure is non-blocking
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

      logger.info('FileRecord created for unit floorplan', {
        fileId: createResult.fileId,
        unitId,
        ext: fileExtension,
        sizeBytes: uploadSize,
      });
    } catch (error) {
      // Re-throw so caller can show toast with specific error
      logger.error('Failed to create FileRecord for unit floorplan', {
        unitId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
