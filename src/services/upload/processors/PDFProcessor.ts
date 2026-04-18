/**
 * 🏢 ENTERPRISE PDF PROCESSOR
 *
 * Centralized PDF processing for floor plans and documents.
 * Migrated from scattered pdf-utils.ts to unified upload system.
 *
 * Features:
 * - PDF validation (type, size, filename)
 * - Fixed filename pattern (prevents duplicates)
 * - Automatic cleanup of existing files
 * - Firestore integration
 * - Progress tracking
 *
 * @module upload/processors/PDFProcessor
 * @version 1.0.0
 */

import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, getDoc } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type {
  FileProcessor,
  ValidationResult,
  ProcessedFile,
  ProcessorOptions,
  StoragePathOptions,
  PDFUploadResult,
  ProgressCallback,
} from '../types/upload.types';
import { UPLOAD_DEFAULTS } from '../types/upload.types';
import { PhotoUploadService } from '@/services/photo-upload.service';
// 🏢 ENTERPRISE: Canonical File Storage System imports
import { FileRecordService } from '@/services/file-record.service';
import {
  validateUploadAuth,
  createPendingFileRecordWithPolicy,
  finalizeFileRecordWithPolicy,
  markFileRecordFailedWithPolicy,
} from '@/services/filesystem/file-mutation-gateway';
import {
  FILE_DOMAINS,
  FILE_CATEGORIES,
  ENTITY_TYPES,
  type EntityType,
} from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';
import { buildStoragePath } from '@/services/upload/utils/storage-path';
import { Logger, LogLevel, ConsoleOutput } from '@/subapps/dxf-viewer/settings/telemetry';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';

const pdfLogger = createModuleLogger('PDFProcessor');

// ============================================================================
// MODULE LOGGER (for canonical flows only)
// ============================================================================

const canonicalLogger = new Logger({
  prefix: 'CANONICAL_FLOORPLAN',
  level: LogLevel.INFO,
  output: new ConsoleOutput(),
});

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Fixed filename to prevent duplicates (Fortune 500 standard)
 * Instead of timestamp-based names that create duplicates
 */
const FIXED_FLOORPLAN_FILENAME = 'floorplan.pdf';

/**
 * Valid PDF MIME types
 */
const VALID_PDF_MIME_TYPES = ['application/pdf'];

/**
 * Warning threshold for large files (10MB)
 */
const LARGE_FILE_WARNING_SIZE = 10 * 1024 * 1024;

// ============================================================================
// PDF PROCESSOR CLASS
// ============================================================================

export class PDFProcessor implements FileProcessor {
  /**
   * Check if this processor can handle the given file type
   */
  canProcess(mimeType: string, extension: string): boolean {
    return VALID_PDF_MIME_TYPES.includes(mimeType) || extension.toLowerCase() === '.pdf';
  }

  /**
   * Validate a PDF file before upload
   */
  validate(file: File): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      warnings: [],
      detectedType: 'pdf',
      mimeType: file.type,
    };

    // Check MIME type
    if (!VALID_PDF_MIME_TYPES.includes(file.type)) {
      return {
        isValid: false,
        error: 'Μόνο αρχεία PDF επιτρέπονται',
        detectedType: 'pdf',
        mimeType: file.type,
      };
    }

    // Check file size
    if (file.size > UPLOAD_DEFAULTS.MAX_PDF_SIZE) {
      return {
        isValid: false,
        error: `Το αρχείο είναι πολύ μεγάλο (μέγιστο ${Math.round(UPLOAD_DEFAULTS.MAX_PDF_SIZE / 1024 / 1024)}MB)`,
        detectedType: 'pdf',
        mimeType: file.type,
      };
    }

    // Warning for large files
    if (file.size > LARGE_FILE_WARNING_SIZE) {
      result.warnings?.push(
        'Το αρχείο είναι μεγάλο και μπορεί να χρειαστεί περισσότερος χρόνος για upload'
      );
    }

    // Warning for special characters in filename
    const validNamePattern = /^[a-zA-Z0-9._-]+\.pdf$/i;
    if (!validNamePattern.test(file.name)) {
      result.warnings?.push(
        'Το όνομα του αρχείου περιέχει ειδικούς χαρακτήρες που μπορεί να προκαλέσουν προβλήματα'
      );
    }

    return result;
  }

  /**
   * Process PDF file (no compression needed for PDFs)
   */
  async process(file: File, _options?: ProcessorOptions): Promise<ProcessedFile> {
    // PDFs don't need compression - return as-is
    return {
      file,
      metadata: {
        wasProcessed: false,
        originalSize: file.size,
        processedSize: file.size,
      },
    };
  }

  /**
   * 🏢 ADR-293: Get storage path for floor plan PDF via canonical buildStoragePath() SSoT.
   */
  getStoragePath(options: StoragePathOptions): string {
    const { buildingId, floorId, companyId } = options;

    if (!buildingId || !floorId) {
      throw new Error('buildingId and floorId are required for PDF storage path');
    }

    const { path } = buildStoragePath({
      companyId: companyId ?? 'unknown',
      entityType: ENTITY_TYPES.BUILDING,
      entityId: buildingId,
      domain: FILE_DOMAINS.CONSTRUCTION,
      category: FILE_CATEGORIES.FLOORPLANS,
      fileId: `${floorId}_${FIXED_FLOORPLAN_FILENAME.replace('.pdf', '')}`,
      ext: 'pdf',
    });
    return path;
  }

  /**
   * Get current PDF URL for a floor
   */
  async getFloorPDFUrl(floorId: string): Promise<string | null> {
    try {
      const floorDocRef = doc(db, COLLECTIONS.FLOORS, floorId);
      const floorDoc = await getDoc(floorDocRef);

      if (floorDoc.exists()) {
        const data = floorDoc.data();
        return data?.pdfUrl || null;
      }

      return null;
    } catch (error) {
      pdfLogger.error('❌ PDF_PROCESSOR: Error getting floor PDF URL:', error);
      return null;
    }
  }

  /**
   * Delete PDF from storage
   */
  async deletePDF(storagePath: string): Promise<boolean> {
    try {
      // 🏢 SSoT: Delegate to PhotoUploadService (handles object-not-found gracefully)
      await PhotoUploadService.deletePhoto(storagePath);
      pdfLogger.info('PDF deleted successfully', { storagePath });
      return true;
    } catch (error) {
      pdfLogger.error('Error deleting PDF', { storagePath, error });
      return false;
    }
  }

  // ==========================================================================
  // 🏢 ENTERPRISE: CANONICAL FILE STORAGE SYSTEM
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Get canonical storage path for floor plan PDF
   * Uses buildStoragePath() SSoT - no hardcoded paths
   */
  getCanonicalStoragePath(params: {
    companyId: string;
    entityType: EntityType;
    entityId: string;
    fileId: string;
    projectId?: string;
  }): string {
    const { path } = buildStoragePath({
      companyId: params.companyId,
      entityType: params.entityType,
      entityId: params.entityId,
      domain: FILE_DOMAINS.CONSTRUCTION,
      category: FILE_CATEGORIES.FLOORPLANS,
      fileId: params.fileId,
      ext: 'pdf',
      projectId: params.projectId,
    });
    return path;
  }

  /**
   * 🏢 ENTERPRISE: Canonical floorplan upload
   *
   * Uses the new FileRecord system:
   * 1. Creates pending FileRecord in Firestore
   * 2. Uploads PDF to canonical path (IDs only)
   * 3. Finalizes FileRecord with downloadUrl and sizeBytes
   *
   * @param file - PDF file to upload
   * @param options - Canonical upload options
   * @returns PDFUploadResult with FileRecord reference
   *
   * @example
   * ```typescript
   * const result = await pdfProcessor.uploadFloorplanCanonical(file, {
   *   entityType: 'floor',
   *   entityId: 'floor_123',
   *   displayName: 'Κάτοψη 1ου Ορόφου - Κτίριο Α',
   *   createdBy: 'user_abc',
   *   companyId: 'company_xyz',
   * });
   * ```
   */
  async uploadFloorplanCanonical(
    file: File,
    options: {
      /** Entity type (floor, building, unit, etc.) */
      entityType: EntityType;
      /** Entity ID this floorplan belongs to */
      entityId: string;
      /** User ID who is uploading */
      createdBy: string;
      /** Company ID for multi-tenant isolation (REQUIRED) */
      companyId: string;
      /** Project ID for project-scoped files (optional) */
      projectId?: string;

      // =========================================================================
      // NAMING CONTEXT (for centralized display name generation)
      // =========================================================================
      /** Human-readable entity label (e.g., "Κτίριο Α") */
      entityLabel?: string;
      /** Additional descriptors (e.g., ["1ος Όροφος"]) */
      descriptors?: string[];
      /** Revision number for versioned files */
      revision?: number;

      /** Progress callback */
      onProgress?: ProgressCallback;
    }
  ): Promise<PDFUploadResult & { fileRecord: FileRecord }> {
    canonicalLogger.info('Starting upload with centralized naming', {
      entityType: options.entityType,
      entityId: options.entityId,
      entityLabel: options.entityLabel,
      fileSize: file.size,
    });

    // Step 1: Validate
    const validation = this.validate(file);
    if (!validation.isValid) {
      canonicalLogger.error('Validation failed', { error: validation.error });
      throw new Error(validation.error || 'PDF validation failed');
    }
    canonicalLogger.info('Validation passed');

    options.onProgress?.({
      progress: 5,
      phase: 'validating',
      message: 'Επικύρωση αρχείου...',
    });

    // ADR-292: Canonical auth validation via gateway SSoT
    await validateUploadAuth(options.companyId);

    // Step A: Create pending FileRecord (via gateway — ADR-292)
    // 🏢 ENTERPRISE: Using naming context - displayName generated centrally
    const { fileId, storagePath, fileRecord } = await createPendingFileRecordWithPolicy({
      companyId: options.companyId,
      projectId: options.projectId,
      entityType: options.entityType,
      entityId: options.entityId,
      domain: FILE_DOMAINS.CONSTRUCTION,
      category: FILE_CATEGORIES.FLOORPLANS,
      // Naming context (centralized name generation)
      entityLabel: options.entityLabel,
      descriptors: options.descriptors,
      revision: options.revision,
      // File metadata
      originalFilename: file.name,
      ext: 'pdf',
      contentType: file.type,
      createdBy: options.createdBy,
    });

    canonicalLogger.info('Pending FileRecord created', {
      fileId,
      storagePath,
    });

    options.onProgress?.({
      progress: 10,
      phase: 'processing',
      message: 'Προετοιμασία αποστολής...',
    });

    try {
      // Step B: Upload binary to canonical path
      canonicalLogger.info('Uploading to canonical path', { storagePath });

      const uploadResult = await new Promise<{ url: string }>((resolve, reject) => {
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            const overallProgress = 10 + (progress * 0.8);

            options.onProgress?.({
              progress: Math.round(overallProgress),
              phase: 'upload',
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
              message: `Ανέβασμα... ${Math.round(progress)}%`,
            });
          },
          (error) => {
            canonicalLogger.error('Upload error', { error });
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({ url: downloadURL });
            } catch (error) {
              reject(error);
            }
          }
        );
      });

      canonicalLogger.info('Binary uploaded successfully');

      // Step C: Finalize FileRecord (via gateway — ADR-292)
      await finalizeFileRecordWithPolicy({
        fileId,
        sizeBytes: file.size,
        downloadUrl: uploadResult.url,
      });

      canonicalLogger.info('FileRecord finalized successfully');

      options.onProgress?.({
        progress: 100,
        phase: 'complete',
        message: 'Η κάτοψη ανέβηκε επιτυχώς!',
      });

      // Get updated FileRecord
      const finalFileRecord = await FileRecordService.getFileRecord(fileId);

      return {
        url: uploadResult.url,
        fileName: `${fileId}.pdf`,
        fileSize: file.size,
        mimeType: file.type,
        storagePath,
        pdfMetadata: {
          originalName: file.name,
          uploadedAt: nowISO(),
          floorId: options.entityId,
          buildingId: options.entityId, // For compatibility
        },
        fileRecord: finalFileRecord || fileRecord,
      };
    } catch (error) {
      // Mark FileRecord as failed
      canonicalLogger.error('Upload failed, marking FileRecord as failed');
      await markFileRecordFailedWithPolicy(
        fileId,
        getErrorMessage(error)
      );
      throw error;
    }
  }

  /**
   * 🏢 ENTERPRISE: Get floorplans for an entity from canonical storage
   */
  async getEntityFloorplans(
    entityType: EntityType,
    entityId: string
  ): Promise<FileRecord[]> {
    canonicalLogger.info('Getting floorplans', { entityType, entityId });

    const files = await FileRecordService.getFilesByEntity(
      entityType,
      entityId,
      {
        domain: FILE_DOMAINS.CONSTRUCTION,
        category: FILE_CATEGORIES.FLOORPLANS,
      }
    );

    canonicalLogger.info('Floorplans retrieved', { count: files.length });
    return files;
  }

}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton instance for the PDF processor
 */
export const pdfProcessor = new PDFProcessor();
