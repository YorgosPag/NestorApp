/**
 * =============================================================================
 * ⚠️ DEPRECATED: FileUploader Component
 * =============================================================================
 *
 * @deprecated ADR-054: Use FileUploadButton from @/components/shared/files instead.
 *
 * This file is kept for backward compatibility only.
 * All new code should use the centralized FileUploadButton component.
 *
 * Migration:
 * ```tsx
 * // ❌ OLD (deprecated)
 * import { FileUploader } from '@/components/property-viewer/ViewerToolbar/FileUploader';
 * <FileUploader onFileUpload={handleChange} />
 *
 * // ✅ NEW (canonical)
 * import { FileUploadButton } from '@/components/shared/files/FileUploadButton';
 * <FileUploadButton onFileSelect={handleFile} accept=".pdf,.dwg,.dxf" />
 * ```
 *
 * @module components/property-viewer/ViewerToolbar/FileUploader
 * @enterprise ADR-054 - Upload System Consolidation
 */

'use client';

import React from 'react';
import { FileUploadButton } from '@/components/shared/files/FileUploadButton';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FileUploader');

/**
 * @deprecated Use FileUploadButton from @/components/shared/files instead
 */
export interface FileUploaderProps {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * @deprecated Use FileUploadButton from @/components/shared/files instead
 *
 * Legacy wrapper that converts the old event-based API to the new file-based API.
 */
export function FileUploader({ onFileUpload }: FileUploaderProps) {
  // Log deprecation warning in development
  if (process.env.NODE_ENV === 'development') {
    logger.warn(
      'FileUploader is deprecated. Use FileUploadButton from @/components/shared/files instead.'
    );
  }

  // Convert file to synthetic event for backward compatibility
  const handleFileSelect = (file: File) => {
    // Create a minimal synthetic event-like object
    const syntheticEvent = {
      target: {
        files: [file] as unknown as FileList,
      },
    } as React.ChangeEvent<HTMLInputElement>;

    onFileUpload(syntheticEvent);
  };

  return (
    <FileUploadButton
      onFileSelect={handleFileSelect}
      accept=".pdf,.dwg,.dxf"
      fileType="any"
      buttonText="Upload"
      variant="outline"
      size="sm"
    />
  );
}

export default FileUploader;
