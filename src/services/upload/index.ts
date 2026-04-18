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
 *   companyId: 'company_xyz',
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
// CANONICAL STORAGE PATH BUILDER
// ============================================================================

export {
  buildStoragePath,
  generateFileId,
  getFileExtension,
  parseStoragePath,
  validateStoragePathParams,
} from './utils/storage-path';

export type {
  StoragePathParams,
  StoragePathResult,
  StoragePathValidationError,
} from './utils/storage-path';

// ============================================================================
// FILE DISPLAY NAME BUILDER
// ============================================================================

export {
  buildFileDisplayName,
  buildContactPhotoDisplayName,
  buildFloorplanDisplayName,
  buildContractDisplayName,
  getDomainLabel,
  getFileCategoryLabel,
  getEntityTypeLabel,
  formatDateForFilename,
  sanitizeForFilename,
  normalizeForSearch,
} from './utils/file-display-name';

export type {
  FileDisplayNameInput,
  FileDisplayNameResult,
} from './utils/file-display-name';

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

/**
 * @deprecated uploadFloorPDF has been removed. Use UnifiedUploadService.uploadPDF()
 * or pdfProcessor.uploadFloorplanCanonical() instead.
 * See ADR-054 for migration guide.
 */

/**
 * @deprecated Use UnifiedUploadService.uploadImage() instead
 * Re-exported for backward compatibility with PhotoUploadService consumers
 */
export { PhotoUploadService } from '@/services/photo-upload.service';
