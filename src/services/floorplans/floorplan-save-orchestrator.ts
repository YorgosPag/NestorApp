/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floorplan Save Orchestrator
 * =============================================================================
 *
 * Centralizes the 4-step FileRecord save pattern that was duplicated across
 * FloorFloorplanService, UnitFloorplanService, and BuildingFloorplanService.
 *
 * The 4 steps:
 * 1. FileRecordService.createPendingFileRecord() → fileId, storagePath
 * 2. Upload binary to Firebase Storage (JSON / gzip / raw file)
 * 3. getDownloadURL() → downloadUrl
 * 4. FileRecordService.finalizeFileRecord() → status: ready
 *
 * Optional step 3b: Thumbnail generation (non-blocking)
 *
 * Each floorplan service delegates here instead of reimplementing the same
 * steps. Services retain their own validation, data transformation, legacy
 * fallback, and RealtimeService dispatch.
 *
 * @module services/floorplans/floorplan-save-orchestrator
 * @enterprise ADR-201 — Floorplan Save Orchestrator
 * @version 1.0.0
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import pako from 'pako';
import { storage } from '@/lib/firebase';
import { FileRecordService } from '@/services/file-record.service';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import { FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';
import type { SceneModel } from '@/subapps/dxf-viewer/types/scene';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

// =============================================================================
// LOGGER
// =============================================================================

const logger = createModuleLogger('FloorplanSaveOrchestrator');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Discriminated union for the file data to upload.
 *
 * - `json`:      Raw JSON (FloorFloorplanService scene data)
 * - `gzip-json`: Gzipped JSON (UnitFloorplanService / BuildingFloorplanService scene)
 * - `raw-file`:  Browser File object (DXF/PDF original files)
 */
export type FloorplanPayload =
  | { kind: 'json'; data: SceneModel }
  | { kind: 'gzip-json'; data: SceneModel | Record<string, unknown> }
  | { kind: 'raw-file'; file: File; compress?: boolean };

/**
 * Input for the orchestrator — everything needed to create + upload + finalize.
 */
export interface FloorplanSaveInput {
  /** Company ID (tenant isolation) */
  companyId: string;
  /** Project ID (optional, for storage path scoping) */
  projectId?: string;
  /** Entity type (floor, unit, building, etc.) */
  entityType: EntityType;
  /** Entity ID */
  entityId: string;
  /** Business domain (default: construction) */
  domain?: FileDomain;
  /** File category (default: floorplans) */
  category?: FileCategory;
  /** Purpose descriptor (e.g. 'floor-floorplan', 'unit-floorplan') */
  purpose: string;
  /** Human-readable entity label for display name generation */
  entityLabel: string;
  /** Additional descriptors for FileRecord */
  descriptors?: string[];
  /** File extension override */
  ext?: string;
  /** User ID who performed the upload */
  createdBy: string;
  /** Original filename */
  originalFilename: string;
  /** MIME type */
  contentType: string;

  /** File data — discriminated union */
  payload: FloorplanPayload;

  /** Whether to attempt thumbnail generation (default: false) */
  generateThumbnail?: boolean;
}

/**
 * Result of a successful orchestrator save.
 */
export interface FloorplanSaveResult {
  /** Whether the save succeeded */
  success: boolean;
  /** Generated FileRecord ID */
  fileId: string;
  /** Canonical storage path */
  storagePath: string;
  /** Download URL for the uploaded file */
  downloadUrl: string;
  /** Thumbnail URL (if generated) */
  thumbnailUrl?: string;
}

// =============================================================================
// ORCHESTRATOR
// =============================================================================

export class FloorplanSaveOrchestrator {
  /**
   * Execute the 4-step FileRecord save pattern.
   *
   * @throws Error on upload/finalization failure (caller should catch)
   */
  static async save(input: FloorplanSaveInput): Promise<FloorplanSaveResult> {
    const domain = input.domain ?? FILE_DOMAINS.CONSTRUCTION;
    const category = input.category ?? FILE_CATEGORIES.FLOORPLANS;

    // ─── Step 1: Create pending FileRecord ───
    const createResult = await FileRecordService.createPendingFileRecord({
      companyId: input.companyId,
      projectId: input.projectId,
      entityType: input.entityType,
      entityId: input.entityId,
      domain,
      category,
      originalFilename: input.originalFilename,
      contentType: input.contentType,
      createdBy: input.createdBy,
      entityLabel: input.entityLabel,
      purpose: input.purpose,
      ext: input.ext,
      descriptors: input.descriptors,
    });

    // ─── Step 2: Upload to Firebase Storage ───
    const storageRef = ref(storage, createResult.storagePath);
    let uploadSize: number;
    let downloadUrl: string;

    switch (input.payload.kind) {
      case 'json': {
        // Raw JSON (uncompressed) — used by FloorFloorplanService
        const jsonStr = JSON.stringify(input.payload.data);
        const bytes = new TextEncoder().encode(jsonStr);
        const uploadResult = await uploadBytes(storageRef, bytes, {
          contentType: 'application/json',
        });
        downloadUrl = await getDownloadURL(uploadResult.ref);
        uploadSize = bytes.length;
        break;
      }

      case 'gzip-json': {
        // Gzipped JSON — used by Unit/Building services for scene data
        const jsonStr = JSON.stringify(input.payload.data);
        const rawBytes = new TextEncoder().encode(jsonStr);
        const compressed = pako.gzip(rawBytes);
        const uploadResult = await uploadBytes(storageRef, compressed, {
          contentType: input.contentType,
          customMetadata: {
            compressed: 'gzip',
            originalSize: String(rawBytes.length),
          },
        });
        downloadUrl = await getDownloadURL(uploadResult.ref);
        uploadSize = rawBytes.length; // Report original size
        break;
      }

      case 'raw-file': {
        // Browser File object — DXF (optionally gzipped) or PDF (as-is)
        const file = input.payload.file;
        const shouldCompress = input.payload.compress ?? false;

        if (shouldCompress) {
          const arrayBuffer = await file.arrayBuffer();
          const compressed = pako.gzip(new Uint8Array(arrayBuffer));
          const uploadResult = await uploadBytes(storageRef, compressed, {
            contentType: input.contentType,
            customMetadata: {
              compressed: 'gzip',
              originalSize: String(file.size),
            },
          });
          downloadUrl = await getDownloadURL(uploadResult.ref);
        } else {
          const uploadResult = await uploadBytes(storageRef, file, {
            contentType: input.contentType,
          });
          downloadUrl = await getDownloadURL(uploadResult.ref);
        }
        uploadSize = file.size;
        break;
      }
    }

    // ─── Step 3 (optional): Thumbnail generation ───
    let thumbnailUrl: string | undefined;
    if (input.generateThumbnail) {
      thumbnailUrl = await this.tryGenerateThumbnail(
        input,
        createResult.storagePath
      );
    }

    // ─── Step 4: Finalize FileRecord ───
    await FileRecordService.finalizeFileRecord({
      fileId: createResult.fileId,
      sizeBytes: uploadSize,
      downloadUrl,
      thumbnailUrl,
    });

    logger.info('Floorplan save complete', {
      fileId: createResult.fileId,
      entityType: input.entityType,
      entityId: input.entityId,
      size: uploadSize,
    });

    return {
      success: true,
      fileId: createResult.fileId,
      storagePath: createResult.storagePath,
      downloadUrl,
      thumbnailUrl,
    };
  }

  // ===========================================================================
  // PRIVATE: Thumbnail generation (non-blocking)
  // ===========================================================================

  /**
   * Attempt thumbnail generation. Never throws — returns undefined on failure.
   */
  private static async tryGenerateThumbnail(
    input: FloorplanSaveInput,
    storagePath: string
  ): Promise<string | undefined> {
    try {
      const { generateDxfThumbnail, generatePdfThumbnail } = await import(
        '@/services/thumbnail-generator'
      );

      let thumbnailBlob: Blob | null = null;
      const ext = input.ext || input.originalFilename.split('.').pop()?.toLowerCase();

      if (input.payload.kind !== 'raw-file' && ext !== 'pdf') {
        // DXF scene thumbnail
        const scene = input.payload.kind === 'json'
          ? input.payload.data
          : input.payload.data;
        const sceneForThumb = scene as Parameters<typeof generateDxfThumbnail>[0];
        thumbnailBlob = await generateDxfThumbnail(sceneForThumb, 300, 200);
      } else if (input.payload.kind === 'raw-file' && ext === 'pdf') {
        // PDF thumbnail from page 1
        thumbnailBlob = await generatePdfThumbnail(input.payload.file, 300, 200);
      }

      if (thumbnailBlob) {
        const thumbPath = `${storagePath}_thumb.png`;
        const thumbRef = ref(storage, thumbPath);
        await uploadBytes(thumbRef, thumbnailBlob, { contentType: 'image/png' });
        return await getDownloadURL(thumbRef);
      }

      return undefined;
    } catch (thumbError) {
      logger.warn('Thumbnail generation skipped', {
        error: getErrorMessage(thumbError),
      });
      return undefined;
    }
  }
}
