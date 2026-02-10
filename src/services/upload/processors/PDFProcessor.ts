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

import { ref, uploadBytesResumable, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type {
  FileProcessor,
  ValidationResult,
  ProcessedFile,
  ProcessorOptions,
  StoragePathOptions,
  PDFUploadOptions,
  PDFUploadResult,
  ProgressCallback,
} from '../types/upload.types';
import { UPLOAD_DEFAULTS, isFirebaseStorageError } from '../types/upload.types';
// 🏢 ENTERPRISE: Canonical File Storage System imports
import { FileRecordService } from '@/services/file-record.service';
import {
  FILE_DOMAINS,
  FILE_CATEGORIES,
  type EntityType,
} from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';
import { Logger, LogLevel, ConsoleOutput } from '@/subapps/dxf-viewer/settings/telemetry';

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
   * Get storage path for floor plan PDF
   * 🏢 ENTERPRISE: Uses fixed filename to prevent duplicates
   */
  getStoragePath(options: StoragePathOptions): string {
    const { buildingId, floorId } = options;

    if (!buildingId || !floorId) {
      throw new Error('buildingId and floorId are required for PDF storage path');
    }

    return `floor-plans/${buildingId}/${floorId}/${FIXED_FLOORPLAN_FILENAME}`;
  }

  /**
   * 🏢 ENTERPRISE: Upload floor plan PDF with full workflow
   */
  async uploadFloorPlan(
    file: File,
    options: PDFUploadOptions,
    onProgress?: ProgressCallback
  ): Promise<PDFUploadResult> {
    console.log('📄 PDF_PROCESSOR: Starting floor plan upload', {
      fileName: file.name,
      fileSize: file.size,
      buildingId: options.buildingId,
      floorId: options.floorId,
    });

    // Step 1: Validate
    const validation = this.validate(file);
    if (!validation.isValid) {
      console.error('❌ PDF_PROCESSOR: Validation failed:', validation.error);
      throw new Error(validation.error || 'PDF validation failed');
    }
    console.log('✅ PDF_PROCESSOR: Validation passed');

    // Report progress
    onProgress?.({
      progress: 5,
      phase: 'validating',
      message: 'Επικύρωση αρχείου...',
    });

    // Step 2: Cleanup existing files (if enabled)
    if (options.cleanupExisting !== false) {
      await this.cleanupExistingFiles(options.buildingId, options.floorId);
    }

    onProgress?.({
      progress: 10,
      phase: 'processing',
      message: 'Προετοιμασία αποστολής...',
    });

    // Step 3: Upload to Firebase Storage
    const storagePath = this.getStoragePath({
      folderPath: `floor-plans/${options.buildingId}/${options.floorId}`,
      buildingId: options.buildingId,
      floorId: options.floorId,
    });

    const uploadResult = await this.uploadToStorage(file, storagePath, onProgress);

    // Step 4: Update Firestore (if enabled)
    if (options.updateFirestore !== false) {
      await this.updateFirestoreFloor(options.floorId, {
        url: uploadResult.url,
        path: storagePath,
        originalName: file.name,
        size: file.size,
        buildingId: options.buildingId,
      });
    }

    onProgress?.({
      progress: 100,
      phase: 'complete',
      message: 'Η κάτοψη ανέβηκε επιτυχώς!',
    });

    console.log('✅ PDF_PROCESSOR: Upload completed successfully');

    return {
      url: uploadResult.url,
      fileName: FIXED_FLOORPLAN_FILENAME,
      fileSize: file.size,
      mimeType: file.type,
      storagePath,
      pdfMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        floorId: options.floorId,
        buildingId: options.buildingId,
      },
    };
  }

  /**
   * 🏢 ENTERPRISE: Cleanup existing files in folder before upload
   * Prevents duplicate accumulation (the original bug)
   */
  private async cleanupExistingFiles(buildingId: string, floorId: string): Promise<void> {
    const folderPath = `floor-plans/${buildingId}/${floorId}`;

    console.log('🗑️ PDF_PROCESSOR: Cleaning up existing files in:', folderPath);

    try {
      const folderRef = ref(storage, folderPath);
      const existingFiles = await listAll(folderRef);

      if (existingFiles.items.length > 0) {
        console.log(`🗑️ PDF_PROCESSOR: Found ${existingFiles.items.length} existing file(s) - deleting...`);

        const deletePromises = existingFiles.items.map(async (fileRef) => {
          try {
            await deleteObject(fileRef);
            console.log(`✅ PDF_PROCESSOR: Deleted: ${fileRef.name}`);
          } catch (deleteError) {
            console.warn(`⚠️ PDF_PROCESSOR: Could not delete ${fileRef.name}:`, deleteError);
          }
        });

        await Promise.all(deletePromises);
        console.log('✅ PDF_PROCESSOR: Folder cleanup completed');
      } else {
        console.log('✅ PDF_PROCESSOR: Folder is empty - no cleanup needed');
      }
    } catch (cleanupError) {
      // Folder might not exist yet - that's OK
      console.log('ℹ️ PDF_PROCESSOR: Folder may not exist yet - proceeding with upload');
    }
  }

  /**
   * Upload file to Firebase Storage with progress tracking
   */
  private async uploadToStorage(
    file: File,
    storagePath: string,
    onProgress?: ProgressCallback
  ): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          // Map 0-100% upload to 10-90% overall
          const overallProgress = 10 + (progress * 0.8);

          onProgress?.({
            progress: Math.round(overallProgress),
            phase: 'upload',
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            message: `Ανέβασμα... ${Math.round(progress)}%`,
          });
        },
        (error) => {
          console.error('❌ PDF_PROCESSOR: Upload error:', error);

          let errorMessage = 'Σφάλμα κατά την αποστολή του αρχείου';

          if (isFirebaseStorageError(error)) {
            switch (error.code) {
              case 'storage/unauthorized':
                errorMessage = 'Δεν έχετε δικαίωμα να ανεβάσετε αρχεία';
                break;
              case 'storage/canceled':
                errorMessage = 'Η αποστολή ακυρώθηκε';
                break;
              case 'storage/quota-exceeded':
                errorMessage = 'Δεν υπάρχει αρκετός χώρος αποθήκευσης';
                break;
            }
          }

          reject(new Error(errorMessage));
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('✅ PDF_PROCESSOR: Download URL obtained');
            resolve({ url: downloadURL });
          } catch (error) {
            console.error('❌ PDF_PROCESSOR: Failed to get download URL:', error);
            reject(new Error('Σφάλμα κατά τη λήψη URL αρχείου'));
          }
        }
      );
    });
  }

  /**
   * Update floor document in Firestore with PDF data
   */
  private async updateFirestoreFloor(
    floorId: string,
    pdfData: {
      url: string;
      path: string;
      originalName: string;
      size: number;
      buildingId: string;
    }
  ): Promise<void> {
    console.log('📝 PDF_PROCESSOR: Updating Firestore floor document:', floorId);

    try {
      const floorDocRef = doc(db, COLLECTIONS.FLOORS, floorId);

      await updateDoc(floorDocRef, {
        pdfUrl: pdfData.url,
        pdfPath: pdfData.path,
        pdfMetadata: {
          originalName: pdfData.originalName,
          size: pdfData.size,
          uploadedAt: new Date().toISOString(),
          floorId,
          buildingId: pdfData.buildingId,
        },
        pdfUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      console.log('✅ PDF_PROCESSOR: Firestore updated successfully');
    } catch (error) {
      console.error('❌ PDF_PROCESSOR: Firestore update failed:', error);
      throw new Error('Σφάλμα κατά την ενημέρωση βάσης δεδομένων');
    }
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
      console.error('❌ PDF_PROCESSOR: Error getting floor PDF URL:', error);
      return null;
    }
  }

  /**
   * Delete PDF from storage
   */
  async deletePDF(storagePath: string): Promise<boolean> {
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
      console.log('✅ PDF_PROCESSOR: PDF deleted successfully:', storagePath);
      return true;
    } catch (error) {
      if (isFirebaseStorageError(error) && error.code === 'storage/object-not-found') {
        console.log('⚠️ PDF_PROCESSOR: PDF not found (already deleted)');
        return false;
      }
      console.error('❌ PDF_PROCESSOR: Error deleting PDF:', error);
      return false;
    }
  }

  // ==========================================================================
  // 🏢 ENTERPRISE: CANONICAL FILE STORAGE SYSTEM
  // ==========================================================================

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

    // Step A: Create pending FileRecord
    // 🏢 ENTERPRISE: Using naming context - displayName generated centrally
    const { fileId, storagePath, fileRecord } = await FileRecordService.createPendingFileRecord({
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

      // Step C: Finalize FileRecord
      await FileRecordService.finalizeFileRecord({
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
          uploadedAt: new Date().toISOString(),
          floorId: options.entityId,
          buildingId: options.entityId, // For compatibility
        },
        fileRecord: finalFileRecord || fileRecord,
      };
    } catch (error) {
      // Mark FileRecord as failed
      canonicalLogger.error('Upload failed, marking FileRecord as failed');
      await FileRecordService.markFileRecordFailed(
        fileId,
        error instanceof Error ? error.message : 'Unknown error'
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

  /**
   * 🏢 ENTERPRISE: Check if path is legacy floorplan path
   */
  isLegacyFloorplanPath(path: string): boolean {
    return path.startsWith('floor-plans/') || path.includes('/floor-plans/');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton instance for the PDF processor
 */
export const pdfProcessor = new PDFProcessor();
