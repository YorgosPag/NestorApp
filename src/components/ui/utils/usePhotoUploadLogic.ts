import { useCallback, useEffect } from 'react';
import React from 'react';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';

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
  /** 🔥 RESTORED: Contact data για FileNamingService */
  contactData?: any;
  /** 🔥 RESTORED: Photo index για multiple photos */
  photoIndex?: number;
  /** 🔥 RESTORED: Custom filename override */
  customFileName?: string;
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
// 🔥 EXTRACTED: PHOTO UPLOAD LOGIC HOOK
// ============================================================================

/**
 * Photo Upload Logic Hook - Specialized για upload business logic
 *
 * Extracted από EnterprisePhotoUpload για Single Responsibility Principle.
 * Χειρίζεται μόνο την upload λογική χωρίς UI concerns.
 *
 * Features:
 * - File selection με validation
 * - Drag & drop functionality
 * - Automatic upload με Firebase Storage
 * - Remove functionality με callbacks
 * - Error handling και progress tracking
 * - Zero UI dependencies (pure business logic)
 */
export function usePhotoUploadLogic({
  photoFile,
  upload,
  onUploadComplete,
  uploadHandler,
  purpose = 'photo',
  contactData,
  photoIndex,
  customFileName
}: UsePhotoUploadLogicProps): PhotoUploadHandlers {

  // ========================================================================
  // DEFAULT UPLOAD HANDLER (FIREBASE STORAGE)
  // ========================================================================

  // 🏢 ENTERPRISE: Default upload handler using CORRECT Firebase Storage
  const defaultUploadHandler = useCallback(async (file: File, onProgress: (progress: FileUploadProgress) => void) => {
    // 🔥 CRITICAL FIX: Use the CORRECT Firebase Storage service, not Base64
    const { PhotoUploadService: FirebasePhotoUploadService } = await import('@/services/photo-upload.service');

    return await FirebasePhotoUploadService.uploadPhoto(file, {
      folderPath: 'contacts/photos',
      enableCompression: true,
      compressionUsage: 'profile-modal',
      onProgress,
      purpose: purpose || 'representative',
      // 🔥 RESTORED: Pass FileNamingService options
      contactData,
      photoIndex,
      fileName: customFileName
    });
  }, [purpose, contactData, photoIndex, customFileName]);

  // ========================================================================
  // FILE SELECTION LOGIC
  // ========================================================================

  /**
   * Handle file selection με validation
   */
  const handleFileSelection = useCallback((file: File | null) => {
    if (!file) {
      // File cleared - cleanup state
      upload.uploadFile(file as any, () => Promise.resolve({
        success: true,
        url: '',
        fileName: '',
        compressionInfo: { originalSize: 0, compressedSize: 0, compressionRatio: 1, quality: 1 }
      }));
      return;
    }

    console.log('🔍 LOGIC: File selection started:', {
      fileName: file.name,
      fileSize: file.size,
      purpose
    });
  }, [upload, purpose]);

  // ========================================================================
  // DRAG & DROP LOGIC
  // ========================================================================

  /**
   * Handle drag over events
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * Handle drop events
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  }, [handleFileSelection]);

  /**
   * Handle click to select file
   */
  const handleClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0] || null;
      handleFileSelection(file);
    };
    input.click();
  }, [handleFileSelection]);

  // ========================================================================
  // AUTOMATIC UPLOAD LOGIC (EXTRACTED 70-LINE USEEFFECT)
  // ========================================================================

  /**
   * 🔥 AUTOMATIC UPLOAD: Start upload immediately when file is selected
   *
   * Extracted από το μεγάλο 70-line useEffect του EnterprisePhotoUpload
   */
  useEffect(() => {
    console.log('🔄 LOGIC AUTO-UPLOAD EFFECT TRIGGERED:', {
      hasPhotoFile: !!photoFile,
      photoFileName: photoFile?.name,
      isUploading: upload.isUploading,
      uploadSuccess: upload.success,
      hasUploadHandler: !!uploadHandler,
      hasOnUploadComplete: !!onUploadComplete,
      purpose
    });

    // 🔥 CRITICAL: Enhanced validation to prevent undefined uploads
    const isValidFile = photoFile && photoFile instanceof File && photoFile.name && photoFile.size > 0;

    if (!isValidFile || upload.isUploading || upload.success) {
      console.log('🛑 LOGIC: Skipping upload:', {
        reason: !photoFile ? 'No file'
              : !(photoFile instanceof File) ? 'Not a File object'
              : !photoFile.name ? 'File has no name'
              : photoFile.size <= 0 ? 'File is empty'
              : upload.isUploading ? 'Already uploading'
              : 'Already successful',
        hasPhotoFile: !!photoFile,
        isFileInstance: photoFile instanceof File,
        fileName: photoFile?.name,
        fileSize: photoFile?.size
      });
      return;
    }

    console.log('🚀 LOGIC: Starting auto-upload for:', photoFile.name);

    const startUpload = async () => {
      try {
        // Use provided uploadHandler or default Firebase Storage handler
        const handlerToUse = uploadHandler || defaultUploadHandler;
        console.log('📡 LOGIC: Using upload handler:', {
          isCustomHandler: !!uploadHandler,
          isDefaultHandler: !uploadHandler,
          handlerName: handlerToUse.name || 'anonymous'
        });

        const result = await upload.uploadFile(photoFile, handlerToUse);

        console.log('🎉 LOGIC: Upload result received!', {
          hasResult: !!result,
          result: result,
          hasSuccess: !!result?.success,
          hasUrl: !!result?.url,
          url: result?.url?.substring(0, 80) + '...',
          fileName: result?.fileName,
          purpose
        });

        if (result?.success && onUploadComplete) {
          console.log('✅ LOGIC: Branch 1 - Explicit success flag present, calling onUploadComplete');
          onUploadComplete(result);
        } else if (result?.url && onUploadComplete) {
          console.log('🔧 LOGIC: Branch 2 - No explicit success flag but has URL, assuming success');
          const enhancedResult = {
            ...result,
            success: true
          };
          console.log('📤 LOGIC: Calling onUploadComplete with enhanced result:', enhancedResult);
          onUploadComplete(enhancedResult);
        } else {
          console.error('❌ LOGIC: Upload callback NOT called!', {
            hasResult: !!result,
            hasSuccess: !!result?.success,
            hasUrl: !!result?.url,
            hasCallback: !!onUploadComplete,
            callbackName: onUploadComplete?.name || 'anonymous',
            purpose
          });
        }
      } catch (err) {
        console.error('⚠️ LOGIC: Auto-upload failed:', err, { purpose, fileName: photoFile?.name });

        // 🔥 CRITICAL: Call onUploadComplete even on failure to prevent hanging
        if (onUploadComplete) {
          console.log('🔧 LOGIC: Calling onUploadComplete with error result');
          onUploadComplete({
            success: false,
            error: err instanceof Error ? err.message : 'Upload failed'
          });
        }
      }
    };

    startUpload();
  }, [photoFile, upload.isUploading, upload.success, uploadHandler, onUploadComplete, upload, defaultUploadHandler, purpose]);

  // ========================================================================
  // REMOVE LOGIC
  // ========================================================================

  /**
   * Handle remove photo με proper cleanup
   */
  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('🗑️ LOGIC: Photo removal initiated');

    // ΚΑΘΑΡΙΖΟΥΜΕ ΜΕ ΤΗ ΒΙΑ ΤΑ ΠΑΝΤΑ
    // ΑΜΕΣΗ ΚΛΗΣΗ ΤΟΥ HANDLER
    if (onUploadComplete) {
      onUploadComplete({
        success: true,
        url: '',
        fileName: '',
        compressionInfo: { originalSize: 0, compressedSize: 0, compressionRatio: 1, quality: 1 }
      });
    }

    console.log('✅ LOGIC: Photo removal completed');
  }, [onUploadComplete]);

  // ========================================================================
  // RETURN HANDLERS
  // ========================================================================

  return {
    handleFileSelection,
    handleDragOver,
    handleDrop,
    handleClick,
    handleRemove
  };
}