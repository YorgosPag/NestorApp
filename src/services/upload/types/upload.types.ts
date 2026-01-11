/**
 * 🏢 ENTERPRISE UPLOAD SERVICE - TYPE DEFINITIONS
 *
 * Unified type system for all upload operations across the application.
 * Following Fortune 500 standards (Google, Microsoft, Autodesk, SAP).
 *
 * @module upload/types
 * @version 1.0.0
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

/**
 * Supported file types for upload
 */
export type FileType = 'image' | 'pdf' | 'dxf' | 'csv' | 'auto';

/**
 * Upload progress phases
 */
export type UploadPhase = 'validating' | 'compressing' | 'upload' | 'processing' | 'complete' | 'error';

/**
 * Progress callback for tracking upload status
 */
export interface FileUploadProgress {
  /** Percentage complete (0-100) */
  progress: number;
  /** Current phase of upload */
  phase: UploadPhase;
  /** Bytes transferred (optional) */
  bytesTransferred?: number;
  /** Total bytes to transfer (optional) */
  totalBytes?: number;
  /** Human-readable status message */
  message?: string;
}

export type ProgressCallback = (progress: FileUploadProgress) => void;

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Result of file validation
 */
export interface ValidationResult {
  /** Whether the file passed validation */
  isValid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Non-fatal warnings */
  warnings?: string[];
  /** Detected file type */
  detectedType?: FileType;
  /** Detected MIME type */
  mimeType?: string;
}

// ============================================================================
// PROCESSOR INTERFACE
// ============================================================================

/**
 * Interface that all file processors must implement
 * Following Strategy Pattern for type-specific processing
 */
export interface FileProcessor {
  /** Check if this processor can handle the file type */
  canProcess(mimeType: string, extension: string): boolean;

  /** Validate the file */
  validate(file: File): ValidationResult;

  /** Process the file (compression, conversion, etc.) */
  process(file: File, options?: ProcessorOptions): Promise<ProcessedFile>;

  /** Get the storage path for the file */
  getStoragePath(options: StoragePathOptions): string;
}

export interface ProcessorOptions {
  /** Enable compression (if applicable) */
  enableCompression?: boolean;
  /** Compression quality (0-100) */
  compressionQuality?: number;
  /** Max file size in bytes */
  maxSize?: number;
  /** Additional processor-specific options */
  extra?: Record<string, unknown>;
}

export interface ProcessedFile {
  /** The processed file (may be compressed/converted) */
  file: File;
  /** Processing metadata */
  metadata: {
    wasProcessed: boolean;
    originalSize: number;
    processedSize: number;
    processingStrategy?: string;
  };
}

export interface StoragePathOptions {
  /** Base folder path */
  folderPath: string;
  /** Optional custom filename */
  fileName?: string;
  /** Building ID (for floor plans) */
  buildingId?: string;
  /** Floor ID (for floor plans) */
  floorId?: string;
  /** File ID (for DXF) */
  fileId?: string;
}

// ============================================================================
// UPLOAD OPTIONS
// ============================================================================

/**
 * Base options for all upload types
 */
export interface BaseUploadOptions {
  /** Folder path in Firebase Storage */
  folderPath: string;
  /** Optional custom filename */
  fileName?: string;
  /** Progress callback */
  onProgress?: ProgressCallback;
  /** Additional metadata to store */
  metadata?: Record<string, unknown>;
}

/**
 * Compression usage context - matches photo-compression-config.ts UsageContext
 */
export type CompressionUsageContext =
  | 'avatar'
  | 'list-item'
  | 'profile-modal'
  | 'company-logo'
  | 'business-card'
  | 'document-scan'
  | 'technical-drawing'
  | 'print'
  | 'archive';

/**
 * Options specific to image uploads
 */
export interface ImageUploadOptions extends BaseUploadOptions {
  /** Enable automatic compression (default: true) */
  enableCompression?: boolean;
  /** Compression usage context */
  compressionUsage?: CompressionUsageContext;
  /** Maximum file size before compression (KB) */
  maxSizeKB?: number;
  /** Contact data for FileNamingService */
  contactData?: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    type?: string;
  };
  /** Upload purpose */
  purpose?: 'logo' | 'photo' | 'representative' | 'avatar';
  /** Photo index for batch uploads */
  photoIndex?: number;
}

/**
 * Options specific to PDF uploads
 */
export interface PDFUploadOptions extends BaseUploadOptions {
  /** Building ID for floor plans */
  buildingId: string;
  /** Floor ID for floor plans */
  floorId: string;
  /** Whether to delete existing PDF before upload (default: true) */
  cleanupExisting?: boolean;
  /** Whether to update Firestore (default: true) */
  updateFirestore?: boolean;
}

/**
 * Options specific to DXF/CAD uploads
 */
export interface DXFUploadOptions extends BaseUploadOptions {
  /** Scene ID */
  sceneId?: string;
  /** Scene data to store */
  sceneData?: unknown;
}

/**
 * Unified options type for the main upload method
 */
export interface UnifiedUploadOptions extends BaseUploadOptions {
  /** File type (auto-detected if 'auto') */
  fileType: FileType;
  /** Type-specific options */
  imageOptions?: Omit<ImageUploadOptions, keyof BaseUploadOptions>;
  pdfOptions?: Omit<PDFUploadOptions, keyof BaseUploadOptions>;
  dxfOptions?: Omit<DXFUploadOptions, keyof BaseUploadOptions>;
}

// ============================================================================
// UPLOAD RESULTS
// ============================================================================

/**
 * Base result for all upload operations
 */
export interface BaseUploadResult {
  /** Download URL for the uploaded file */
  url: string;
  /** Final filename in storage */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** MIME type of the file */
  mimeType: string;
  /** Full storage path in Firebase */
  storagePath: string;
}

/**
 * Result for image uploads
 */
export interface ImageUploadResult extends BaseUploadResult {
  /** Compression information */
  compressionInfo?: {
    wasCompressed: boolean;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    strategy?: string;
  };
}

/**
 * Result for PDF uploads
 */
export interface PDFUploadResult extends BaseUploadResult {
  /** PDF-specific metadata */
  pdfMetadata: {
    originalName: string;
    uploadedAt: string;
    floorId: string;
    buildingId: string;
  };
}

/**
 * Result for DXF uploads
 */
export interface DXFUploadResult extends BaseUploadResult {
  /** DXF-specific metadata */
  dxfMetadata?: {
    sceneId?: string;
    layerCount?: number;
    entityCount?: number;
  };
}

/**
 * Unified result type for the main upload method
 */
export interface UnifiedUploadResult extends BaseUploadResult {
  /** Which processor handled this file */
  processorUsed: 'image' | 'pdf' | 'dxf';
  /** Processing information */
  processingInfo?: {
    wasCompressed?: boolean;
    compressionRatio?: number;
    validationPassed: boolean;
    processingTime?: number;
  };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Upload error codes
 */
export type UploadErrorCode =
  | 'VALIDATION_FAILED'
  | 'UPLOAD_FAILED'
  | 'UNAUTHORIZED'
  | 'QUOTA_EXCEEDED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'PROCESSING_FAILED'
  | 'UNKNOWN';

/**
 * Structured upload error
 */
export class UploadError extends Error {
  constructor(
    message: string,
    public readonly code: UploadErrorCode,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for Firebase Storage errors
 */
export function isFirebaseStorageError(error: unknown): error is { code: string; message: string } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

/**
 * Type guard for image MIME types
 */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Type guard for PDF MIME type
 */
export function isPDFMimeType(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

/**
 * Type guard for DXF file (by extension since no standard MIME type)
 */
export function isDXFFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.dxf');
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default upload configuration
 */
export const UPLOAD_DEFAULTS = {
  /** Max file size for images (10MB) */
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  /** Max file size for PDFs (50MB) */
  MAX_PDF_SIZE: 50 * 1024 * 1024,
  /** Max file size for DXF (100MB) */
  MAX_DXF_SIZE: 100 * 1024 * 1024,
  /** Upload timeout (45 seconds) */
  UPLOAD_TIMEOUT: 45000,
  /** Progress timeout before fallback (10 seconds) */
  PROGRESS_TIMEOUT: 10000,
  /** Max retry attempts */
  MAX_RETRIES: 2,
} as const;

/**
 * Allowed MIME types per category
 */
export const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  pdf: ['application/pdf'],
  dxf: ['application/dxf', 'application/x-dxf', 'application/octet-stream'],
} as const;
