/**
 * 🏢 UNIFIED UPLOAD SERVICE - PUBLIC API
 *
 * Central export point for all upload functionality.
 * Import everything from this file for consistent access.
 *
 * @example
 * ```typescript
 * import { UnifiedUploadService, type ImageUploadOptions } from '@/services/upload';
 *
 * const result = await UnifiedUploadService.uploadImage(file, {
 *   folderPath: 'contacts/photos',
 *   enableCompression: true,
 * });
 * ```
 *
 * @module upload
 * @version 1.0.0
 */

// ============================================================================
// MAIN SERVICE
// ============================================================================

export { UnifiedUploadService } from './UnifiedUploadService';

// ============================================================================
// PROCESSORS (for advanced usage)
// ============================================================================

export { imageProcessor, ImageProcessor } from './processors/ImageProcessor';
export { pdfProcessor, PDFProcessor } from './processors/PDFProcessor';
export { cadProcessor, CADProcessor } from './processors/CADProcessor';

// ============================================================================
// TYPES
// ============================================================================

export type {
  // Common types
  FileType,
  UploadPhase,
  FileUploadProgress,
  ProgressCallback,

  // Validation
  ValidationResult,

  // Processor interface
  FileProcessor,
  ProcessorOptions,
  ProcessedFile,
  StoragePathOptions,

  // Upload options
  BaseUploadOptions,
  ImageUploadOptions,
  PDFUploadOptions,
  DXFUploadOptions,
  UnifiedUploadOptions,

  // Upload results
  BaseUploadResult,
  ImageUploadResult,
  PDFUploadResult,
  DXFUploadResult,
  UnifiedUploadResult,

  // Error types
  UploadErrorCode,
} from './types/upload.types';

// ============================================================================
// UTILITIES & CONSTANTS
// ============================================================================

export {
  // Error class
  UploadError,

  // Type guards
  isFirebaseStorageError,
  isImageMimeType,
  isPDFMimeType,
  isDXFFile,

  // Constants
  UPLOAD_DEFAULTS,
  ALLOWED_MIME_TYPES,
} from './types/upload.types';

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

/**
 * @deprecated Use UnifiedUploadService.uploadPDF() instead
 * Re-exported for backward compatibility with pdf-utils.ts consumers
 */
export { uploadFloorPDF } from '@/lib/pdf-utils';

/**
 * @deprecated Use UnifiedUploadService.uploadImage() instead
 * Re-exported for backward compatibility with PhotoUploadService consumers
 */
export { PhotoUploadService } from '@/services/photo-upload.service';
