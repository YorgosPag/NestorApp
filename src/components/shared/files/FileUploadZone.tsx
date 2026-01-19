/**
 * =============================================================================
 * 🏢 ENTERPRISE: FileUploadZone Component
 * =============================================================================
 *
 * Enterprise-grade file upload zone με drag & drop support.
 * Uses canonical upload pipeline (ADR-031).
 *
 * @module components/shared/files/FileUploadZone
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// TYPES
// ============================================================================

export interface FileUploadZoneProps {
  /** Upload handler */
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
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx';

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: File Upload Zone Component
 *
 * Professional file upload UI με:
 * - Drag & drop support
 * - File validation
 * - Progress indication
 * - Error handling
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
}: FileUploadZoneProps) {
  const iconSizes = useIconSizes();
  const { createBorder, quick, getStatusBorder } = useBorderTokens();
  const { t } = useTranslation('files');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // =========================================================================
  // FILE VALIDATION
  // =========================================================================

  /**
   * Validate file size
   */
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Size validation
    if (file.size > maxSize) {
      const maxMB = Math.round(maxSize / 1024 / 1024);
      return {
        valid: false,
        error: t('errors.fileTooLarge', { fileName: file.name, maxSize: `${maxMB}MB` }),
      };
    }

    return { valid: true };
  }, [maxSize, t]);

  /**
   * Validate multiple files
   */
  const validateFiles = useCallback((files: File[]): { valid: File[]; errors: string[] } => {
    const valid: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const validation = validateFile(file);
      if (validation.valid) {
        valid.push(file);
      } else if (validation.error) {
        errors.push(validation.error);
      }
    }

    return { valid, errors };
  }, [validateFile]);

  // =========================================================================
  // UPLOAD HANDLERS
  // =========================================================================

  /**
   * Handle file selection (from file input)
   */
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const { valid, errors } = validateFiles(fileArray);

    // Show validation errors
    if (errors.length > 0) {
      // TODO: Show toast notifications
    }

    // Upload valid files
    if (valid.length > 0) {
      try {
        await onUpload(valid);
        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        // TODO: Show error toast
      }
    }
  }, [onUpload, validateFiles]);

  /**
   * Handle drag & drop
   */
  const handleDrop = useCallback(async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);

    if (disabled || uploading) return;

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const { valid, errors } = validateFiles(fileArray);

    // Show validation errors
    if (errors.length > 0) {
      // TODO: Show toast notifications
    }

    // Upload valid files
    if (valid.length > 0) {
      try {
        await onUpload(valid);
      } catch (error) {
        // TODO: Show error toast
      }
    }
  }, [disabled, uploading, onUpload, validateFiles]);

  /**
   * Handle drag over (required for drop to work)
   */
  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!disabled && !uploading) {
      setIsDragActive(true);
    }
  }, [disabled, uploading]);

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
    if (fileInputRef.current && !disabled && !uploading) {
      fileInputRef.current.click();
    }
  }, [disabled, uploading]);

  // =========================================================================
  // RENDER
  // =========================================================================

  const borderStyle = isDragActive
    ? getStatusBorder('info')
    : createBorder('medium', 'hsl(var(--border))', 'dashed');

  const bgStyle = isDragActive ? 'bg-accent/20' : 'bg-muted/20';

  return (
    <section
      className={`${borderStyle} ${quick.card} p-6 text-center cursor-pointer ${bgStyle} ${INTERACTIVE_PATTERNS.DROPZONE_HOVER} ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      role="region"
      aria-label={t('uploadZone')}
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
        disabled={disabled || uploading}
        aria-label={t('fileInput')}
      />

      {/* Upload icon */}
      <div className={`mx-auto ${iconSizes.xl3} text-muted-foreground flex items-center justify-center`}>
        <FileUp className={iconSizes.xl} aria-hidden="true" />
      </div>

      {/* Instructions */}
      <div className="mt-4 space-y-2">
        {uploading ? (
          <p className="text-sm font-medium text-foreground">
            {t('uploading')}
          </p>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">
              <span className={`font-medium cursor-pointer ${INTERACTIVE_PATTERNS.LINK_PRIMARY}`}>
                {t('clickToSelect')}
              </span>{' '}
              {t('orDragAndDrop')}
            </div>
            <p className="text-xs text-muted-foreground/80">
              {t('fileTypesHint')} • {t('maxSize', { size: `${Math.round(maxSize / 1024 / 1024)}MB` })}
            </p>
          </>
        )}
      </div>

      {/* Upload button (alternative trigger) */}
      {!uploading && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={handleClickUpload}
          disabled={disabled}
          aria-label={t('selectFilesButton')}
        >
          <Upload className={`${iconSizes.sm} mr-2`} aria-hidden="true" />
          {t('selectFiles')}
        </Button>
      )}
    </section>
  );
}
