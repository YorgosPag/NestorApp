/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Upload Button Component (ADR-054)
 * =============================================================================
 *
 * Lightweight file upload button - alternative to FileUploadZone for simple cases.
 * Uses centralized upload hooks from ADR-054.
 *
 * Features:
 * - Uses useFileSelectionHandlers (centralized)
 * - Type-specific file validation
 * - Loading/disabled states
 * - i18n support
 * - Zero inline styles
 *
 * @module components/shared/files/FileUploadButton
 * @enterprise ADR-054 - Upload System Consolidation
 *
 * @example
 * ```tsx
 * <FileUploadButton
 *   onFileSelect={(file) => handleUpload(file)}
 *   accept=".pdf,.dwg,.dxf"
 *   buttonText="Upload PDF"
 * />
 * ```
 */

'use client';

import React, { useRef, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { validateFile } from '@/utils/file-validation';
import type { FileType } from '@/config/file-upload-config';

// ============================================================================
// TYPES
// ============================================================================

export interface FileUploadButtonProps {
  /** Callback when file is selected and validated */
  onFileSelect: (file: File) => void;
  /** Accept file types (e.g., ".pdf,.dwg,.dxf" or "image/*") */
  accept?: string;
  /** File type for validation */
  fileType?: FileType;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Custom button text */
  buttonText?: string;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Show icon */
  showIcon?: boolean;
  /** Custom className */
  className?: string;
  /** Custom icon */
  icon?: React.ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: File Upload Button
 *
 * Simple button for file selection with built-in validation.
 * For drag & drop support, use FileUploadZone instead.
 */
export function FileUploadButton({
  onFileSelect,
  accept = '*/*',
  fileType = 'any',
  maxSize,
  buttonText,
  loading = false,
  disabled = false,
  variant = 'outline',
  size = 'sm',
  showIcon = true,
  className = '',
  icon,
}: FileUploadButtonProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('files');
  const { error: showError } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // =========================================================================
  // FILE SELECTION HANDLER
  // =========================================================================

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file using centralized validation
      const validation = validateFile(file, {
        fileType,
        maxSize,
      });

      if (!validation.isValid) {
        showError(validation.error || t('validation.invalidFile'));
        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      // Call callback with validated file
      onFileSelect(file);

      // Reset input to allow selecting same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [fileType, maxSize, onFileSelect, showError, t]
  );

  // =========================================================================
  // CLICK HANDLER
  // =========================================================================

  const handleClick = useCallback(() => {
    if (!disabled && !loading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled, loading]);

  // =========================================================================
  // RENDER
  // =========================================================================

  const isDisabled = disabled || loading;
  const displayText = buttonText || t('uploadButton.selectFile');
  const displayIcon = icon || <Upload className={`${iconSizes.sm} ${buttonText ? 'mr-2' : ''}`} />;

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={isDisabled}
        aria-label={displayText}
      />

      {/* Button trigger */}
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isDisabled}
        className={className}
        aria-busy={loading}
      >
        {showIcon && displayIcon}
        {loading ? t('uploadButton.loading') : displayText}
      </Button>
    </>
  );
}

export default FileUploadButton;
