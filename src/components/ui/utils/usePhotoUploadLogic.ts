'use client';

import { useCallback, useMemo } from 'react';
import type React from 'react';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import { useAutoUploadEffect } from '@/hooks/upload/useAutoUploadEffect';
import { useFileSelectionHandlers } from '@/hooks/upload/useFileSelectionHandlers';
import { createUploadHandlerFromPreset } from '@/services/upload-handlers';
import type { ContactFormData } from '@/types/ContactFormTypes';

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

  const defaultUploadHandler = useMemo(() => {
    // Determine preset based on purpose
    const preset = purpose === 'logo' ? 'company-logo' : 'contact-photo';

    return createUploadHandlerFromPreset(preset, {
      contactData,
      photoIndex,
      fileName: customFileName,
      contactId,
      companyId,
      createdBy,
      contactName: contactName || (contactData?.name as string),
      purpose,
    });
  }, [purpose, contactData, photoIndex, customFileName, contactId, companyId, createdBy, contactName]);

  // Select handler: custom or default
  const uploadHandler = customUploadHandler || defaultUploadHandler;

  // ========================================================================
  // FILE SELECTION HANDLERS (ADR-054: Using extracted hook)
  // ========================================================================

  const fileSelectionHandlers = useFileSelectionHandlers({
    onFileSelect: (file) => {
      if (!file) {
        console.log('📤 LOGIC: File cleared, no upload action needed');
        return;
      }
      console.log('🔍 LOGIC: File selection started:', {
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
    debug: true, // Enable logging for this use case
  });

  // ========================================================================
  // REMOVE HANDLER
  // ========================================================================

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('🗑️ LOGIC: Photo removal initiated');

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

    console.log('✅ LOGIC: Photo removal completed');
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
