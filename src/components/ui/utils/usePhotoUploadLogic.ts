'use client';

import { useCallback, useMemo, useRef } from 'react';
import type React from 'react';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import { useAutoUploadEffect } from '@/hooks/upload/useAutoUploadEffect';
import { useFileSelectionHandlers } from '@/hooks/upload/useFileSelectionHandlers';
import { createUploadHandlerFromPreset } from '@/services/upload-handlers';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { resolveContactName } from '@/components/ContactFormSections/utils/PhotoUploadConfiguration';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('usePhotoUploadLogic');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UsePhotoUploadLogicProps {
  /** Current photo file */
  photoFile?: File | null;
  /** Upload instance from useEnterpriseFileUpload */
  upload: {
    isUploading: boolean;
    success: boolean;
    uploadFile: (file: File, handler: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>) => Promise<FileUploadResult | null>;
  };
  /** Upload completion handler */
  onUploadComplete?: (result: FileUploadResult) => void;
  /** Custom upload handler */
  uploadHandler?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>;
  /** Purpose για logging */
  purpose?: string;
  /** Contact data για FileNamingService */
  contactData?: ContactFormData;
  /** Photo index για multiple photos */
  photoIndex?: number;
  /** Custom filename override */
  customFileName?: string;

  // =========================================================================
  // 🏢 CANONICAL PIPELINE FIELDS (ADR-031)
  // =========================================================================

  /** 🏢 CANONICAL: Contact ID for FileRecord linkage */
  contactId?: string;
  /** 🏢 CANONICAL: Company ID for multi-tenant isolation */
  companyId?: string;
  /** 🏢 CANONICAL: User ID who is uploading */
  createdBy?: string;
  /** 🏢 CANONICAL: Contact name for display name generation */
  contactName?: string;
}

export interface PhotoUploadHandlers {
  /** Handle file selection with validation */
  handleFileSelection: (file: File | null) => void;
  /** Handle drag over events */
  handleDragOver: (e: React.DragEvent) => void;
  /** Handle drop events */
  handleDrop: (e: React.DragEvent) => void;
  /** Handle click to select file */
  handleClick: () => void;
  /** Handle remove photo */
  handleRemove: (e: React.MouseEvent) => void;
}

// ============================================================================
// MAIN HOOK (ADR-054: Simplified using extracted hooks)
// ============================================================================

/**
 * Photo Upload Logic Hook - Simplified version using extracted hooks
 *
 * ADR-054: Refactored to use centralized hooks:
 * - useAutoUploadEffect: Handles automatic upload when file changes
 * - useFileSelectionHandlers: Handles drag/drop/click file selection
 * - createUploadHandlerFromPreset: Creates upload handler from preset
 *
 * @see useAutoUploadEffect
 * @see useFileSelectionHandlers
 * @see createUploadHandlerFromPreset
 */
export function usePhotoUploadLogic({
  photoFile,
  upload,
  onUploadComplete,
  uploadHandler: customUploadHandler,
  purpose = 'photo',
  contactData,
  photoIndex,
  customFileName,
  contactId,
  companyId,
  createdBy,
  contactName,
}: UsePhotoUploadLogicProps): PhotoUploadHandlers {

  // ========================================================================
  // DEFAULT UPLOAD HANDLER (ADR-054: Using centralized factory)
  // ========================================================================

  // 🏢 ENTERPRISE: Use ref for contactData to prevent handler recreation on formData changes.
  // contactData is only used for file naming metadata — NOT for upload logic.
  // Without this, every formData change recreates the handler → triggers re-upload → flickering loop.
  const contactDataRef = useRef(contactData);
  contactDataRef.current = contactData;

  const defaultUploadHandler = useMemo(() => {
    // Determine preset based on purpose
    const preset = purpose === 'logo' ? 'company-logo' : 'contact-photo';

    return createUploadHandlerFromPreset(preset, {
      contactData: contactDataRef.current,
      photoIndex,
      fileName: customFileName,
      contactId,
      companyId,
      createdBy,
      contactName: contactName || (contactDataRef.current ? resolveContactName(contactDataRef.current) : undefined),
      purpose,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purpose, photoIndex, customFileName, contactId, companyId, createdBy, contactName]);

  // 🏢 ENTERPRISE: When canonical fields (companyId, contactId, createdBy) are provided,
  // prefer the defaultUploadHandler which embeds them in the upload config.
  // The customUploadHandler from getPhotoUploadHandlers may lack canonical fields
  // if canonicalUploadContext was undefined at creation time (timing issue).
  const uploadHandler = (companyId && contactId && createdBy)
    ? defaultUploadHandler
    : (customUploadHandler || defaultUploadHandler);

  // ========================================================================
  // FILE SELECTION HANDLERS (ADR-054: Using extracted hook)
  // ========================================================================

  const fileSelectionHandlers = useFileSelectionHandlers({
    onFileSelect: (file) => {
      if (!file) {
        logger.info('File cleared, no upload action needed');
        return;
      }
      logger.info('File selection started', {
        fileName: file.name,
        fileSize: file.size,
        purpose,
      });
    },
    accept: 'image/*',
  });

  // ========================================================================
  // AUTOMATIC UPLOAD (ADR-054: Using extracted hook)
  // ========================================================================

  useAutoUploadEffect({
    file: photoFile,
    upload,
    uploadHandler,
    onUploadComplete,
    purpose,
    debug: false,
  });

  // ========================================================================
  // REMOVE HANDLER
  // ========================================================================

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    logger.info('Photo removal initiated');

    if (onUploadComplete) {
      onUploadComplete({
        success: true,
        url: '',
        fileName: '',
        fileSize: 0,
        mimeType: '',
        compressionInfo: { wasCompressed: false, originalSize: 0, compressedSize: 0, compressionRatio: 1, quality: 1 },
      });
    }

    logger.info('Photo removal completed');
  }, [onUploadComplete]);

  // ========================================================================
  // RETURN HANDLERS
  // ========================================================================

  return {
    handleFileSelection: fileSelectionHandlers.handleFileSelection,
    handleDragOver: fileSelectionHandlers.handleDragOver,
    handleDrop: fileSelectionHandlers.handleDrop,
    handleClick: fileSelectionHandlers.handleClick,
    handleRemove,
  };
}
