/**
 * 🏢 UNIFIED UPLOAD SERVICE
 *
 * Central gateway for all file uploads in the application.
 * Implements the Gateway + Strategy Pattern used by Fortune 500 companies.
 *
 * Architecture:
 * ┌─────────────────────────────────────────┐
 * │         UnifiedUploadService            │ ← Single Entry Point
 * │         (This file)                     │
 * └───────────────┬─────────────────────────┘
 *                 │
 *     ┌───────────┼───────────┐
 *     ▼           ▼           ▼
 * ┌───────┐ ┌─────────┐ ┌───────────┐
 * │ Image │ │   PDF   │ │    CAD    │ ← Strategy Processors
 * │ Proc. │ │  Proc.  │ │   Proc.   │
 * └───────┘ └─────────┘ └───────────┘
 *
 * @module upload/UnifiedUploadService
 * @version 1.0.0
 */

import {
  type FileType,
  type UnifiedUploadOptions,
  type UnifiedUploadResult,
  type ImageUploadOptions,
  type PDFUploadOptions,
  type DXFUploadOptions,
  type ProgressCallback,
  type ValidationResult,
  UploadError,
  isImageMimeType,
  isPDFMimeType,
  isDXFFile,
} from './types/upload.types';
import { imageProcessor, ImageProcessor } from './processors/ImageProcessor';
import { pdfProcessor, PDFProcessor } from './processors/PDFProcessor';
import { cadProcessor, CADProcessor } from './processors/CADProcessor';
import { PhotoUploadService } from '@/services/photo-upload.service';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('UnifiedUploadService');

// ============================================================================
// FILE TYPE ROUTER
// ============================================================================

/**
 * Routes files to appropriate processors based on type
 */
class FileTypeRouter {
  /**
   * Detect file type from file metadata
   */
  static detectFileType(file: File): FileType {
    const mimeType = file.type;
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (isImageMimeType(mimeType)) {
      return 'image';
    }

    if (isPDFMimeType(mimeType)) {
      return 'pdf';
    }

    if (isDXFFile(file.name)) {
      return 'dxf';
    }

    // CSV check
    if (mimeType === 'text/csv' || extension === '.csv') {
      return 'csv';
    }

    // Default to auto (will need explicit type)
    return 'auto';
  }

  /**
   * Get the appropriate processor for a file type
   */
  static getProcessor(fileType: FileType): ImageProcessor | PDFProcessor | CADProcessor | null {
    switch (fileType) {
      case 'image':
        return imageProcessor;
      case 'pdf':
        return pdfProcessor;
      case 'dxf':
        return cadProcessor;
      default:
        return null;
    }
  }

  /**
   * Validate that we can process the file
   */
  static canProcess(file: File, requestedType?: FileType): boolean {
    const detectedType = this.detectFileType(file);
    const typeToCheck = requestedType === 'auto' ? detectedType : (requestedType || detectedType);

    const processor = this.getProcessor(typeToCheck);
    if (!processor) {
      return false;
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    return processor.canProcess(file.type, extension);
  }
}

// ============================================================================
// UNIFIED UPLOAD SERVICE
// ============================================================================

/**
 * 🏢 ENTERPRISE: Unified Upload Service
 *
 * Single entry point for ALL file uploads in the application.
 * Automatically routes to appropriate processor based on file type.
 *
 * @example
 * ```typescript
 * // Auto-detect file type
 * const result = await UnifiedUploadService.upload(file, {
 *   fileType: 'auto',
 *   folderPath: 'uploads',
 * });
 *
 * // Explicit image upload
 * const imageResult = await UnifiedUploadService.uploadImage(file, {
 *   companyId: 'company_xyz',
 *   enableCompression: true,
 * });
 *
 * // PDF floor plan upload
 * const pdfResult = await UnifiedUploadService.uploadPDF(file, {
 *   buildingId: 'building-1',
 *   floorId: 'floor-1',
 * });
 * ```
 */
export class UnifiedUploadService {
  // ==========================================================================
  // MAIN ENTRY POINT
  // ==========================================================================

  /**
   * Upload any file type with automatic detection
   */
  static async upload(
    file: File,
    options: UnifiedUploadOptions
  ): Promise<UnifiedUploadResult> {
    const startTime = Date.now();

    logger.info('Starting upload', {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      requestedType: options.fileType,
    });

    // Detect or use provided file type
    const fileType = options.fileType === 'auto'
      ? FileTypeRouter.detectFileType(file)
      : options.fileType;

    if (fileType === 'auto' || fileType === 'csv') {
      throw new UploadError(
        'Δεν είναι δυνατή η αυτόματη ανίχνευση του τύπου αρχείου',
        'VALIDATION_FAILED'
      );
    }

    // Route to appropriate processor
    switch (fileType) {
      case 'image':
        return this.handleImageUpload(file, options, startTime);

      case 'pdf':
        return this.handlePDFUpload(file, options, startTime);

      case 'dxf':
        return this.handleDXFUpload(file, options, startTime);

      default:
        throw new UploadError(
          `Μη υποστηριζόμενος τύπος αρχείου: ${fileType}`,
          'VALIDATION_FAILED'
        );
    }
  }

  // ==========================================================================
  // SPECIALIZED UPLOAD METHODS
  // ==========================================================================

  /**
   * Upload an image file with compression
   */
  static async uploadImage(
    file: File,
    options: ImageUploadOptions
  ): Promise<UnifiedUploadResult> {
    const startTime = Date.now();

    // Validate
    const validation = imageProcessor.validate(file);
    if (!validation.isValid) {
      throw new UploadError(
        validation.error || 'Image validation failed',
        'VALIDATION_FAILED'
      );
    }

    // Upload
    const result = await imageProcessor.uploadImage(file, options, options.onProgress);

    return {
      url: result.url,
      fileName: result.fileName,
      fileSize: result.fileSize,
      mimeType: result.mimeType,
      storagePath: result.storagePath,
      processorUsed: 'image',
      processingInfo: {
        wasCompressed: result.compressionInfo?.wasCompressed,
        compressionRatio: result.compressionInfo?.compressionRatio,
        validationPassed: true,
        processingTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Upload a PDF floor plan.
   *
   * @deprecated Legacy flow removed. Use `pdfProcessor.uploadFloorplanCanonical()` directly
   * for enterprise FileRecord-based uploads with proper companyId isolation.
   */
  static async uploadPDF(
    _file: File,
    _options: PDFUploadOptions
  ): Promise<UnifiedUploadResult> {
    throw new UploadError(
      'Legacy uploadPDF() removed. Use pdfProcessor.uploadFloorplanCanonical() for canonical FileRecord-based uploads.',
      'VALIDATION_FAILED'
    );
  }

  /**
   * Upload a DXF/CAD file
   */
  static async uploadDXF(
    file: File,
    options: DXFUploadOptions
  ): Promise<UnifiedUploadResult> {
    const startTime = Date.now();

    // Validate
    const validation = cadProcessor.validate(file);
    if (!validation.isValid) {
      throw new UploadError(
        validation.error || 'DXF validation failed',
        'VALIDATION_FAILED'
      );
    }

    // Upload
    const result = await cadProcessor.uploadDXF(file, options, options.onProgress);

    return {
      url: result.url,
      fileName: result.fileName,
      fileSize: result.fileSize,
      mimeType: result.mimeType,
      storagePath: result.storagePath,
      processorUsed: 'dxf',
      processingInfo: {
        validationPassed: true,
        processingTime: Date.now() - startTime,
      },
    };
  }

  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================

  // ==========================================================================
  // CLEANUP METHODS
  // ==========================================================================

  /**
   * Delete file by storage path
   */
  static async deleteFile(storagePath: string): Promise<void> {
    await PhotoUploadService.deletePhoto(storagePath);
  }

  /**
   * Delete file by URL
   */
  static async deleteFileByURL(url: string): Promise<void> {
    await PhotoUploadService.deletePhotoByURL(url);
  }

  /**
   * Batch delete multiple files
   */
  static async deleteMultipleFiles(urls: string[]): Promise<void> {
    await PhotoUploadService.cleanupMultiplePhotos(urls);
  }

  // ==========================================================================
  // VALIDATION METHODS
  // ==========================================================================

  /**
   * Validate a file without uploading
   */
  static validate(file: File, fileType?: FileType): ValidationResult {
    const detectedType = fileType || FileTypeRouter.detectFileType(file);
    const processor = FileTypeRouter.getProcessor(detectedType);

    if (!processor) {
      return {
        isValid: false,
        error: 'Μη υποστηριζόμενος τύπος αρχείου',
        detectedType,
        mimeType: file.type,
      };
    }

    return processor.validate(file);
  }

  /**
   * Check if we can process a file type
   */
  static canProcess(file: File): boolean {
    return FileTypeRouter.canProcess(file);
  }

  /**
   * Detect file type
   */
  static detectFileType(file: File): FileType {
    return FileTypeRouter.detectFileType(file);
  }

  // ==========================================================================
  // PRIVATE HANDLERS
  // ==========================================================================

  private static async handleImageUpload(
    file: File,
    options: UnifiedUploadOptions,
    startTime: number
  ): Promise<UnifiedUploadResult> {
    const imageOptions: ImageUploadOptions = {
      folderPath: options.folderPath,
      fileName: options.fileName,
      onProgress: options.onProgress,
      metadata: options.metadata,
      ...options.imageOptions,
    };

    return this.uploadImage(file, imageOptions);
  }

  /**
   * @deprecated Legacy PDF upload flow removed.
   * Use pdfProcessor.uploadFloorplanCanonical() directly for FileRecord-based uploads.
   */
  private static async handlePDFUpload(
    _file: File,
    _options: UnifiedUploadOptions,
    _startTime: number
  ): Promise<UnifiedUploadResult> {
    throw new UploadError(
      'Legacy PDF upload removed. Use pdfProcessor.uploadFloorplanCanonical() for canonical FileRecord-based uploads.',
      'VALIDATION_FAILED'
    );
  }

  private static async handleDXFUpload(
    file: File,
    options: UnifiedUploadOptions,
    startTime: number
  ): Promise<UnifiedUploadResult> {
    const dxfOptions: DXFUploadOptions = {
      folderPath: options.folderPath,
      fileName: options.fileName,
      onProgress: options.onProgress,
      metadata: options.metadata,
      ...options.dxfOptions,
    };

    return this.uploadDXF(file, dxfOptions);
  }
}
