/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floorplan Processor Service
 * =============================================================================
 *
 * Processes floorplan files (DXF, PDF) after upload and caches the result
 * in FileRecord.processedData for efficient rendering.
 *
 * @module services/floorplans/FloorplanProcessor
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 *
 * Architecture:
 * - Original file stored in Firebase Storage (SSoT)
 * - Processed/cached data stored in FileRecord.processedData
 * - Uses existing dxfImportService for DXF parsing
 * - PDF processing generates preview image
 *
 * Pattern: Google Docs (file + cached render), Autodesk Viewer (DWG + preview)
 */

'use client';

import { doc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/lib/firebase';
import type {
  FileRecord,
  FloorplanProcessedData,
  DxfSceneData,
  DxfSceneEntity,
  FloorplanFileType,
} from '@/types/file-record';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FloorplanProcessor');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of floorplan processing
 */
export interface FloorplanProcessResult {
  success: boolean;
  processedData?: FloorplanProcessedData;
  error?: string;
}

/**
 * Processing options
 */
export interface FloorplanProcessOptions {
  /** Skip processing if already processed */
  skipIfProcessed?: boolean;
  /** Force re-processing even if cached */
  forceReprocess?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Firestore collection for file records */
const FILES_COLLECTION = 'files';

/** Supported DXF MIME types */
const DXF_MIME_TYPES = [
  'application/dxf',
  'application/x-dxf',
  'image/vnd.dxf',
  'image/x-dxf',
];

/** Supported PDF MIME types */
const PDF_MIME_TYPES = ['application/pdf'];

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Determine floorplan file type from MIME type or extension
 */
function detectFloorplanType(
  contentType: string,
  ext: string
): FloorplanFileType | null {
  // Check MIME type first
  if (DXF_MIME_TYPES.includes(contentType.toLowerCase())) {
    return 'dxf';
  }
  if (PDF_MIME_TYPES.includes(contentType.toLowerCase())) {
    return 'pdf';
  }

  // Fallback to extension
  const normalizedExt = ext.toLowerCase().replace('.', '');
  if (normalizedExt === 'dxf') {
    return 'dxf';
  }
  if (normalizedExt === 'pdf') {
    return 'pdf';
  }

  return null;
}

/**
 * Check if file is a floorplan type
 */
export function isFloorplanFile(contentType: string, ext: string): boolean {
  return detectFloorplanType(contentType, ext) !== null;
}

// ============================================================================
// FLOORPLAN PROCESSOR SERVICE
// ============================================================================

/**
 * 🏢 ENTERPRISE: Floorplan Processor Service
 *
 * Processes uploaded floorplan files and caches render-ready data.
 * Uses existing centralized services (dxfImportService) - NO duplicates.
 */
export class FloorplanProcessor {
  /**
   * 🏢 ENTERPRISE: Process a floorplan file via Server API
   *
   * V2 Architecture: Delegates processing to server-side API route
   * to bypass CORS restrictions and use Firebase Admin SDK.
   *
   * @param fileRecord - The FileRecord to process
   * @param _downloadUrl - URL to download the file (unused in V2 - server handles download)
   * @param options - Processing options
   */
  static async processFloorplan(
    fileRecord: FileRecord,
    _downloadUrl: string,
    options: FloorplanProcessOptions = {}
  ): Promise<FloorplanProcessResult> {
    const { skipIfProcessed = true, forceReprocess = false } = options;

    logger.info('Starting processing via Server API', {
      fileId: fileRecord.id,
      contentType: fileRecord.contentType,
      ext: fileRecord.ext,
      displayName: fileRecord.displayName,
    });

    // Check if already processed
    if (skipIfProcessed && !forceReprocess && fileRecord.processedData) {
      logger.info('Already processed, skipping');
      return {
        success: true,
        processedData: fileRecord.processedData,
      };
    }

    // Detect file type for validation
    const fileType = detectFloorplanType(
      fileRecord.contentType,
      fileRecord.ext
    );

    if (!fileType) {
      logger.error('Unsupported file type', {
        contentType: fileRecord.contentType,
        ext: fileRecord.ext,
      });
      return {
        success: false,
        error: `Unsupported floorplan file type: ${fileRecord.contentType}`,
      };
    }

    try {
      // 🏢 ENTERPRISE V2: Call server-side API route (bypasses CORS!)
      logger.info('Calling server API');

      // 🔒 Get ID token for API authentication (same pattern as useFloorplanFiles)
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error('User not authenticated');
      }

      const idToken = await user.getIdToken();

      const response = await fetch('/api/floorplans/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          fileId: fileRecord.id,
          forceReprocess,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.details || `Server returned ${response.status}`);
      }

      logger.info('Server processing complete', {
        fileId: result.fileId,
        fileType: result.fileType,
        stats: result.stats,
      });

      // Return success - the server has already saved processedData to Firestore
      // The caller should re-fetch the FileRecord to get the updated processedData
      return {
        success: true,
        processedData: {
          fileType: result.fileType,
          processedAt: new Date(result.processedAt).getTime(),
          sceneStats: result.stats,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown processing error';
      logger.error('Processing failed', { error: errorMessage });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 🏢 ENTERPRISE: Process DXF file
   *
   * Uses existing dxfImportService - NO duplicate parsing logic!
   */
  private static async processDxfFile(
    file: File
  ): Promise<FloorplanProcessedData> {
    logger.info('Processing DXF file', { fileName: file.name });

    // Dynamic import to avoid loading DXF module on initial page load
    const { dxfImportService } = await import(
      '@/subapps/dxf-viewer/io/dxf-import'
    );

    // Parse DXF using centralized service
    const result = await dxfImportService.importDxfFile(file);

    if (!result.success || !result.scene) {
      throw new Error(result.error || 'DXF parsing failed');
    }

    logger.info('DXF parsed', {
      entities: result.scene.entities.length,
      layers: Object.keys(result.scene.layers).length,
    });

    // Convert to our DxfSceneData type
    const scene: DxfSceneData = {
      entities: result.scene.entities.map((entity) => {
        // Extract type and layer first, spread rest
        const { type, layer, ...rest } = entity;
        return {
          type,
          layer: layer || '0', // Default layer if undefined
          ...rest,
        } as DxfSceneEntity;
      }),
      layers: result.scene.layers,
      bounds: result.scene.bounds,
    };

    // Calculate sizes for stats
    const sceneJson = JSON.stringify(scene);
    const originalSize = new TextEncoder().encode(sceneJson).length;

    return {
      fileType: 'dxf',
      scene,
      processedAt: Date.now(),
      originalSize,
    };
  }

  /**
   * 🏢 ENTERPRISE: Process PDF file
   *
   * Uses existing PdfRenderer service - NO duplicate rendering logic!
   * Renders PDF first page to image for preview display.
   */
  private static async processPdfFile(
    file: File
  ): Promise<FloorplanProcessedData> {
    logger.info('Processing PDF file', { fileName: file.name });

    // Dynamic import existing PdfRenderer service
    const { PdfRenderer } = await import(
      '@/subapps/dxf-viewer/pdf-background/services/PdfRenderer'
    );

    // Load PDF document
    const loadResult = await PdfRenderer.loadDocument(file);
    if (!loadResult.success) {
      throw new Error(loadResult.error || 'Failed to load PDF');
    }

    // Render first page at high quality for floorplans
    const renderResult = await PdfRenderer.renderPage(1, { scale: 2.0 });

    // Cleanup - unload document after rendering
    await PdfRenderer.unloadDocument();

    if (!renderResult.success || !renderResult.imageUrl) {
      throw new Error(renderResult.error || 'Failed to render PDF page');
    }

    logger.info('PDF rendered', {
      width: renderResult.dimensions?.width,
      height: renderResult.dimensions?.height,
      previewSize: renderResult.imageUrl.length,
    });

    return {
      fileType: 'pdf',
      pdfPreviewUrl: renderResult.imageUrl,
      pdfDimensions: renderResult.dimensions ? {
        width: renderResult.dimensions.width,
        height: renderResult.dimensions.height,
      } : undefined,
      processedAt: Date.now(),
      originalSize: file.size,
    };
  }

  /**
   * 🏢 ENTERPRISE: Save processed data to FileRecord
   */
  private static async saveProcessedData(
    fileId: string,
    processedData: FloorplanProcessedData
  ): Promise<void> {
    logger.info('Saving processed data to Firestore');

    const docRef = doc(db, FILES_COLLECTION, fileId);

    await updateDoc(docRef, {
      processedData,
      updatedAt: new Date().toISOString(),
    });

    logger.info('Processed data saved');
  }

  /**
   * 🏢 ENTERPRISE: Get processed data from FileRecord
   *
   * If not processed yet, triggers processing.
   */
  static async getProcessedData(
    fileRecord: FileRecord
  ): Promise<FloorplanProcessedData | null> {
    // Return cached if available
    if (fileRecord.processedData) {
      return fileRecord.processedData;
    }

    // Need to process - requires downloadUrl
    if (!fileRecord.downloadUrl) {
      logger.warn('No downloadUrl, cannot process');
      return null;
    }

    const result = await this.processFloorplan(fileRecord, fileRecord.downloadUrl);
    return result.success ? result.processedData ?? null : null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { detectFloorplanType };
export type { FloorplanFileType };
