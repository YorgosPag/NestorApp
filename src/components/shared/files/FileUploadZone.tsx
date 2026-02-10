/**
 * =============================================================================
 * 🏢 ENTERPRISE: FileUploadZone Component
 * =============================================================================
 *
 * Enterprise-grade file upload zone με drag & drop support.
 * Uses canonical upload pipeline (ADR-031).
 *
 * Features:
 * - Centralized file type validation (file-upload-config.ts)
 * - Smart image compression (photo-compression-config.ts)
 * - Toast notifications for user feedback
 * - Drag & drop support
 *
 * @module components/shared/files/FileUploadZone
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { createModuleLogger } from '@/lib/telemetry';

// 🏢 ENTERPRISE: Centralized configs
import {
  FILE_TYPE_CONFIG,
  UPLOAD_LIMITS,
  type FileType,
} from '@/config/file-upload-config';
import compressionConfig, {
  type UsageContext,
  COMPRESSION_USAGE,
} from '@/config/photo-compression-config';

// 🏢 ENTERPRISE: Image compression
import { smartCompressContactPhoto } from '@/subapps/geo-canvas/floor-plan-system/parsers/raster/ImageParser';

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('FILE_UPLOAD_ZONE');

// ============================================================================
// TYPES
// ============================================================================

export interface FileUploadZoneProps {
  /** Upload handler - receives processed files (compressed if applicable) */
  onUpload: (files: File[]) => Promise<void>;
  /** Accept file types (e.g., "image/*,.pdf") */
  accept?: string;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Allow multiple file selection */
  multiple?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Uploading state */
  uploading?: boolean;
  /** Enable image compression (default: true) */
  enableCompression?: boolean;
  /** Compression usage context for smart compression */
  compressionUsage?: UsageContext;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_MAX_SIZE = UPLOAD_LIMITS.MAX_FILE_SIZE; // 50MB from centralized config
const DEFAULT_ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx';

// Image MIME types for compression detection
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Detect file type from MIME type
 */
function detectFileType(mimeType: string): FileType {
  if (IMAGE_MIME_TYPES.includes(mimeType)) {
    return 'image';
  }
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'document';
  }
  return 'any';
}

/**
 * Get max size for specific file type
 */
function getMaxSizeForType(fileType: FileType): number {
  return FILE_TYPE_CONFIG[fileType]?.maxSize || UPLOAD_LIMITS.MAX_FILE_SIZE;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: File Upload Zone Component
 *
 * Professional file upload UI με:
 * - Drag & drop support
 * - Type-specific file validation
 * - Smart image compression
 * - Toast notifications
 * - Semantic HTML
 * - Zero inline styles
 */
export function FileUploadZone({
  onUpload,
  accept = DEFAULT_ACCEPT,
  maxSize = DEFAULT_MAX_SIZE,
  multiple = true,
  disabled = false,
  uploading = false,
  enableCompression = true,
  compressionUsage = COMPRESSION_USAGE.DOCUMENT_SCAN,
}: FileUploadZoneProps) {
  const iconSizes = useIconSizes();
  const { createBorder, quick, getStatusBorder } = useBorderTokens();
  const { t } = useTranslation('files');
  const { success, error: showError, warning } = useNotifications();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // =========================================================================
  // 🏢 ENTERPRISE FILE VALIDATION (Type-specific limits)
  // =========================================================================

  /**
   * Validate file against type-specific rules
   * Pattern: Google Drive / Dropbox / OneDrive
   */
  const validateFile = useCallback((file: File): { valid: boolean; error?: string; warning?: string } => {
    const fileType = detectFileType(file.type);
    const typeConfig = FILE_TYPE_CONFIG[fileType];
    const typeMaxSize = typeConfig?.maxSize || maxSize;

    logger.info('Validating file', {
      name: file.name,
      type: file.type,
      size: file.size,
      detectedType: fileType,
      maxAllowed: typeMaxSize,
    });

    // 🔒 Size validation (type-specific)
    if (file.size > typeMaxSize) {
      const errorMsg = t('uploadZone.errors.fileTooLarge', {
        fileName: file.name,
        maxSize: formatBytes(typeMaxSize),
      });
      logger.warn('File too large', { name: file.name, size: file.size, max: typeMaxSize });
      return { valid: false, error: errorMsg };
    }

    // 🔒 Minimum size validation (prevent empty files)
    if (file.size < UPLOAD_LIMITS.MIN_FILE_SIZE) {
      const errorMsg = t('validation.fileTooSmall', { fileName: file.name });
      logger.warn('File too small', { name: file.name, size: file.size });
      return { valid: false, error: errorMsg || `Το αρχείο ${file.name} είναι πολύ μικρό` };
    }

    // ⚠️ Warning for large files (but still valid)
    if (file.size > 5 * 1024 * 1024) { // > 5MB
      return {
        valid: true,
        warning: t('validation.fileLargeWarning') || 'Μεγάλο αρχείο - μπορεί να χρειαστεί περισσότερος χρόνος',
      };
    }

    return { valid: true };
  }, [maxSize, t]);

  /**
   * Validate multiple files
   */
  const validateFiles = useCallback((files: File[]): {
    valid: File[];
    errors: string[];
    warnings: string[];
  } => {
    const valid: File[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const file of files) {
      const validation = validateFile(file);
      if (validation.valid) {
        valid.push(file);
        if (validation.warning) {
          warnings.push(validation.warning);
        }
      } else if (validation.error) {
        errors.push(validation.error);
      }
    }

    return { valid, errors, warnings };
  }, [validateFile]);

  // =========================================================================
  // 🗜️ ENTERPRISE IMAGE COMPRESSION
  // =========================================================================

  /**
   * Compress image files using centralized compression config
   * Pattern: Google Photos / Dropbox / OneDrive
   */
  const compressImages = useCallback(async (files: File[]): Promise<File[]> => {
    if (!enableCompression) {
      logger.info('Compression disabled, returning original files');
      return files;
    }

    const processedFiles: File[] = [];

    for (const file of files) {
      // Only compress images
      if (!IMAGE_MIME_TYPES.includes(file.type)) {
        processedFiles.push(file);
        continue;
      }

      // Check if compression is needed
      const compressionDecision = compressionConfig.shouldCompress(file.size, compressionUsage);

      if (!compressionDecision.shouldCompress) {
        logger.info('No compression needed', {
          name: file.name,
          reason: compressionDecision.strategy.reason,
        });
        processedFiles.push(file);
        continue;
      }

      logger.info('Compressing image', {
        name: file.name,
        originalSize: file.size,
        strategy: compressionDecision.strategy.name,
        estimatedSavings: compressionDecision.estimatedSavings,
      });

      try {
        // Map compression usage to supported types
        type SmartCompressUsage = 'avatar' | 'list-item' | 'profile-modal' | 'print';
        const usageMap: Record<UsageContext, SmartCompressUsage> = {
          'avatar': 'avatar',
          'list-item': 'list-item',
          'profile-modal': 'profile-modal',
          'company-logo': 'profile-modal',
          'business-card': 'profile-modal',
          'document-scan': 'print',
          'technical-drawing': 'print',
          'print': 'print',
          'archive': 'print',
        };
        const mappedUsage = usageMap[compressionUsage] || 'profile-modal';

        const result = await smartCompressContactPhoto(file, mappedUsage);

        // Create new File from compressed blob
        const compressedFile = new File([result.blob], file.name, {
          type: 'image/jpeg',
          lastModified: file.lastModified,
        });

        const savings = Math.round((1 - result.blob.size / file.size) * 100);

        logger.info('Compression completed', {
          name: file.name,
          originalSize: file.size,
          compressedSize: result.blob.size,
          savings: `${savings}%`,
        });

        // Show success notification for significant compression
        if (savings > 20) {
          success(
            `${file.name}: Συμπιέστηκε κατά ${savings}% (${formatBytes(file.size)} → ${formatBytes(result.blob.size)})`
          );
        }

        processedFiles.push(compressedFile);
      } catch (compressionError) {
        logger.warn('Compression failed, using original', {
          name: file.name,
          error: compressionError instanceof Error ? compressionError.message : 'Unknown',
        });
        // Fallback to original file
        processedFiles.push(file);
      }
    }

    return processedFiles;
  }, [enableCompression, compressionUsage, success]);

  // =========================================================================
  // UPLOAD HANDLERS
  // =========================================================================

  /**
   * Process and upload files
   */
  const processAndUpload = useCallback(async (files: File[]) => {
    // Step 1: Validate files
    const { valid, errors, warnings } = validateFiles(files);

    // Show validation errors
    if (errors.length > 0) {
      errors.forEach((error) => showError(error));
      logger.warn('Validation errors', { count: errors.length, errors });
    }

    // Show warnings
    if (warnings.length > 0) {
      warnings.forEach((warn) => warning(warn));
    }

    // Exit if no valid files
    if (valid.length === 0) {
      logger.info('No valid files to upload');
      return;
    }

    setIsProcessing(true);

    try {
      // Step 2: Compress images (if enabled)
      logger.info('Processing files', { count: valid.length });
      const processedFiles = await compressImages(valid);

      // Step 3: Upload processed files
      logger.info('Uploading files', { count: processedFiles.length });
      await onUpload(processedFiles);

      logger.info('Upload completed successfully');
    } catch (uploadError) {
      const errorMsg = uploadError instanceof Error ? uploadError.message : 'Upload failed';
      logger.error('Upload failed', { error: errorMsg });
      showError(t('upload.errors.generic') || 'Σφάλμα κατά την αποστολή αρχείων');
    } finally {
      setIsProcessing(false);
    }
  }, [validateFiles, compressImages, onUpload, showError, warning, t]);

  /**
   * Handle file selection (from file input)
   */
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    await processAndUpload(Array.from(files));

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processAndUpload]);

  /**
   * Handle drag & drop
   */
  const handleDrop = useCallback(async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);

    if (disabled || uploading || isProcessing) return;

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;

    await processAndUpload(Array.from(files));
  }, [disabled, uploading, isProcessing, processAndUpload]);

  /**
   * Handle drag over (required for drop to work)
   */
  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!disabled && !uploading && !isProcessing) {
      setIsDragActive(true);
    }
  }, [disabled, uploading, isProcessing]);

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
  }, []);

  /**
   * Programmatic file selection
   */
  const handleClickUpload = useCallback(() => {
    if (fileInputRef.current && !disabled && !uploading && !isProcessing) {
      fileInputRef.current.click();
    }
  }, [disabled, uploading, isProcessing]);

  // =========================================================================
  // RENDER
  // =========================================================================

  const isDisabled = disabled || uploading || isProcessing;

  const borderStyle = isDragActive
    ? getStatusBorder('info')
    : createBorder('medium', 'hsl(var(--border))', 'dashed');

  const bgStyle = isDragActive ? 'bg-accent/20' : 'bg-muted/20';

  return (
    <section
      className={`${borderStyle} ${quick.card} p-6 text-center cursor-pointer ${bgStyle} ${INTERACTIVE_PATTERNS.DROPZONE_HOVER} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      role="region"
      aria-label={t('uploadZone.uploadZone')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClickUpload}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        disabled={isDisabled}
        aria-label={t('uploadZone.fileInput')}
      />

      {/* Upload icon */}
      <div className={`mx-auto ${iconSizes.xl3} text-muted-foreground flex items-center justify-center`}>
        <FileUp className={iconSizes.xl} aria-hidden="true" />
      </div>

      {/* Instructions */}
      <div className="mt-4 space-y-2">
        {uploading || isProcessing ? (
          <p className="text-sm font-medium text-foreground">
            {isProcessing ? (t('uploadZone.processing') || 'Επεξεργασία αρχείων...') : t('uploadZone.uploading')}
          </p>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">
              <span className={`font-medium cursor-pointer ${INTERACTIVE_PATTERNS.LINK_PRIMARY}`}>
                {t('uploadZone.clickToSelect')}
              </span>{' '}
              {t('uploadZone.orDragAndDrop')}
            </div>
            <p className="text-xs text-muted-foreground/80">
              {t('uploadZone.fileTypesHint')} • {t('uploadZone.maxSize', { size: `${Math.round(maxSize / 1024 / 1024)}MB` })}
            </p>
            {/* 🏢 ENTERPRISE: Show type-specific limits */}
            <p className="text-xs text-muted-foreground/60">
              Εικόνες: {formatBytes(FILE_TYPE_CONFIG.image.maxSize)} •
              PDF: {formatBytes(FILE_TYPE_CONFIG.pdf.maxSize)} •
              Έγγραφα: {formatBytes(FILE_TYPE_CONFIG.document.maxSize)}
            </p>
          </>
        )}
      </div>

      {/* Upload button (alternative trigger) */}
      {!uploading && !isProcessing && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={handleClickUpload}
          disabled={disabled}
          aria-label={t('uploadZone.selectFilesButton')}
        >
          <Upload className={`${iconSizes.sm} mr-2`} aria-hidden="true" />
          {t('uploadZone.selectFiles')}
        </Button>
      )}
    </section>
  );
}
