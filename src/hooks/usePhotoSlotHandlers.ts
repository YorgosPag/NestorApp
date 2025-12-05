'use client';

import { useCallback } from 'react';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PhotoSlot {
  file: File | null;
  preview?: string;
  uploadUrl?: string;
  fileName?: string;
  isUploading: boolean;
  uploadProgress: number;
  error?: string;
}

export interface UsePhotoSlotHandlersProps {
  /** Current photos array */
  normalizedPhotos: PhotoSlot[];
  /** Maximum number of photos */
  maxPhotos: number;
  /** Upload handler function */
  uploadHandler?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>;
  /** Contact data για upload path */
  contactData?: { id?: string | number };
  /** Purpose για upload path */
  purpose?: string;
  /** Photo change callback */
  onPhotosChange?: (photos: PhotoSlot[]) => void;
  /** Upload complete callback */
  onPhotoUploadComplete?: (slotIndex: number, result: FileUploadResult) => void;
  /** Disabled state */
  disabled?: boolean;
}

export interface PhotoSlotHandlers {
  /** Handle upload progress για specific slot */
  handleUploadProgress: (slotIndex: number, progress: FileUploadProgress) => void;
  /** Handle upload completion για specific slot */
  handleUploadComplete: (slotIndex: number, result: FileUploadResult) => void;
  /** Handle file selection για specific slot */
  handleFileSelection: (slotIndex: number, file: File | null) => Promise<void>;
  /** Handle multiple file drop */
  handleMultipleDrop: (e: React.DragEvent) => void;
  /** Create upload handler with index */
  createUploadHandlerWithIndex: (photoIndex: number) => (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>;
}

// ============================================================================
// PHOTO SLOT HANDLERS HOOK
// ============================================================================

/**
 * Photo Slot Handlers Hook
 *
 * Εξήχθη από MultiplePhotosUpload.tsx για Single Responsibility Principle.
 * Χειρίζεται όλους τους event handlers για multiple photo slots.
 *
 * Features:
 * - Upload progress tracking per slot
 * - Upload completion με Firebase Storage URLs
 * - File selection με automatic upload
 * - Drag & drop για multiple files
 * - Error handling per slot
 * - Slot-specific upload handlers με unique filenames
 *
 * Usage:
 * ```tsx
 * const handlers = usePhotoSlotHandlers({
 *   normalizedPhotos,
 *   maxPhotos,
 *   uploadHandler,
 *   contactData,
 *   purpose,
 *   onPhotosChange,
 *   onPhotoUploadComplete,
 *   disabled
 * });
 * ```
 */
export function usePhotoSlotHandlers({
  normalizedPhotos,
  maxPhotos,
  uploadHandler,
  contactData,
  purpose,
  onPhotosChange,
  onPhotoUploadComplete,
  disabled
}: UsePhotoSlotHandlersProps): PhotoSlotHandlers {

  // ========================================================================
  // UPLOAD PROGRESS HANDLER
  // ========================================================================

  /**
   * Handle upload progress for a specific slot
   */
  const handleUploadProgress = useCallback((slotIndex: number, progress: FileUploadProgress) => {
    const newPhotos = [...normalizedPhotos];
    if (newPhotos[slotIndex]) {
      newPhotos[slotIndex] = {
        ...newPhotos[slotIndex],
        isUploading: true,
        uploadProgress: progress.progress,
        error: undefined
      };
      onPhotosChange?.(newPhotos);
    }
  }, [normalizedPhotos, onPhotosChange]);

  // ========================================================================
  // UPLOAD COMPLETE HANDLER
  // ========================================================================

  /**
   * Handle upload completion for a specific slot
   */
  const handleUploadComplete = useCallback((slotIndex: number, result: FileUploadResult) => {
    console.log('🔍 SLOT HANDLERS: handleUploadComplete called with:', {
      slotIndex,
      resultUrl: result.url,
      resultSuccess: result.success,
      currentPhotosLength: normalizedPhotos.length
    });

    const newPhotos = [...normalizedPhotos];

    // ✅ SUCCESS CASE: Update the slot with Firebase Storage URL
    if (result.url && result.url.trim() !== '') {
      console.log('✅ SLOT HANDLERS: Upload success - updating slot', slotIndex, 'with URL:', result.url.substring(0, 50) + '...');

      newPhotos[slotIndex] = {
        ...newPhotos[slotIndex],
        uploadUrl: result.url,
        fileName: result.fileName,
        isUploading: false,
        uploadProgress: 100,
        error: undefined
      };

      // Update local state immediately
      onPhotosChange?.(newPhotos);

      // Notify parent component
      if (onPhotoUploadComplete) {
        console.log('📢 SLOT HANDLERS: Calling onPhotoUploadComplete for slot', slotIndex);
        onPhotoUploadComplete(slotIndex, result);
      }

      console.log('🎉 SLOT HANDLERS: Upload processing completed successfully for slot', slotIndex);
    }
    // ❌ ERROR CASE: Failed upload
    else {
      console.log('❌ SLOT HANDLERS: Upload failed - no URL received for slot', slotIndex);

      newPhotos[slotIndex] = {
        ...newPhotos[slotIndex],
        isUploading: false,
        uploadProgress: 0,
        error: 'Upload failed - no URL received'
      };

      onPhotosChange?.(newPhotos);
    }
  }, [normalizedPhotos, onPhotosChange, onPhotoUploadComplete]);

  // ========================================================================
  // FIREBASE UPLOAD HANDLER FACTORY
  // ========================================================================

  /**
   * Firebase Storage upload handler with photoIndex support (ENTERPRISE SOLUTION)
   * 🚀 ΝΕΟΣ ENTERPRISE ΤΡΟΠΟΣ: Firebase Storage με unlimited capacity
   * 🔧 FIX: Added photoIndex parameter για unique filenames
   */
  const createUploadHandlerWithIndex = useCallback((photoIndex: number) => {
    return async (file: File, onProgress: (progress: FileUploadProgress) => void): Promise<FileUploadResult> => {
      try {
        console.log(`🔄 SLOT HANDLERS: Starting Firebase Storage upload για slot ${photoIndex}:`, {
          fileName: file.name,
          fileSize: file.size,
          contactId: contactData?.id,
          purpose,
          photoIndex
        });

        // 🔥 DYNAMIC IMPORT: Load PhotoUploadService only when needed
        const { PhotoUploadService } = await import('@/services/photo-upload.service');

        // 🔧 FIX: Generate unique filename με photoIndex
        const contactId = contactData?.id || 'temp';
        const timestamp = Date.now();
        const extension = file.name.split('.').pop() || 'jpg';
        const uniqueFileName = `${contactId}_photo_${photoIndex + 1}_${timestamp}.${extension}`;

        console.log(`📁 SLOT HANDLERS: Generated unique filename για slot ${photoIndex}:`, uniqueFileName);

        // 🏢 ENTERPRISE UPLOAD: PhotoUploadService με progress tracking
        const result = await PhotoUploadService.uploadPhoto(file, {
          folderPath: `contacts/${contactId}/photos`,
          fileName: uniqueFileName,
          enableCompression: true,
          compressionUsage: purpose || 'profile-modal',
          onProgress: (progress) => {
            console.log(`📈 SLOT HANDLERS: Upload progress για slot ${photoIndex}:`, progress.progress + '%');
            onProgress(progress);
          },
          purpose: purpose || 'multiple-photos'
        });

        console.log(`✅ SLOT HANDLERS: Firebase Storage upload completed για slot ${photoIndex}:`, {
          success: result.success,
          url: result.url,
          fileName: result.fileName,
          originalSize: result.compressionInfo?.originalSize,
          compressedSize: result.compressionInfo?.compressedSize
        });

        return result;
      } catch (error) {
        console.error('❌ SLOT HANDLERS: FIREBASE STORAGE: Upload failed:', error);
        throw error;
      }
    };
  }, [contactData, purpose]);

  // ========================================================================
  // FILE SELECTION HANDLER
  // ========================================================================

  /**
   * Handle file selection for a specific slot
   */
  const handleFileSelection = useCallback(async (slotIndex: number, file: File | null) => {
    if (slotIndex < 0 || slotIndex >= maxPhotos) return;

    const newPhotos = [...normalizedPhotos];
    if (file) {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      newPhotos[slotIndex] = {
        file,
        preview: previewUrl,
        uploadUrl: undefined,
        isUploading: true,
        uploadProgress: 0,
        error: undefined
      };

      // Update state immediately
      onPhotosChange?.(newPhotos);

      // Start upload automatically using appropriate handler
      try {
        // 🔧 FIX: Use the handler with photoIndex για unique filenames
        const activeHandler = uploadHandler || createUploadHandlerWithIndex(slotIndex);

        const result = await activeHandler(file, (progress) => {
          handleUploadProgress(slotIndex, progress);
        });

        handleUploadComplete(slotIndex, result);
      } catch (error) {
        console.error(`❌ SLOT HANDLERS: Auto-upload failed for slot ${slotIndex + 1}:`, error);
        console.error(`📋 SLOT HANDLERS: Error details:`, {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          fileName: file.name,
          fileSize: file.size,
          slotIndex,
          uploadHandlerExists: !!uploadHandler
        });

        const errorPhotos = [...normalizedPhotos];
        errorPhotos[slotIndex] = {
          ...errorPhotos[slotIndex],
          isUploading: false,
          error: error instanceof Error ? error.message : 'Upload failed'
        };
        onPhotosChange?.(errorPhotos);
      }
    } else {
      // Clear slot
      if (newPhotos[slotIndex].preview && newPhotos[slotIndex].preview?.startsWith('blob:')) {
        URL.revokeObjectURL(newPhotos[slotIndex].preview!);
      }

      // 🏢 ENTERPRISE CLEANUP: Delete Firebase Storage file if exists
      const currentPhoto = newPhotos[slotIndex];
      if (currentPhoto.uploadUrl) {
        console.log('🧹 SLOT HANDLERS: ENTERPRISE CLEANUP: Starting cleanup for slot', slotIndex, 'URL:', currentPhoto.uploadUrl.substring(0, 50) + '...');

        // Dynamic import για enterprise cleanup
        import('@/services/photo-upload.service')
          .then(({ PhotoUploadService }) => {
            return PhotoUploadService.deletePhotoByURL(currentPhoto.uploadUrl!);
          })
          .then(() => {
            console.log('✅ SLOT HANDLERS: ENTERPRISE CLEANUP: Successfully deleted Firebase Storage file');
          })
          .catch((error) => {
            console.warn('⚠️ SLOT HANDLERS: ENTERPRISE CLEANUP: Failed to delete Firebase Storage file:', error);
            // Non-blocking error - continues with slot clearing
          });
      }

      // ΚΡΙΣΙΜΟ: Καθαρισμός slot με πλήρη null values
      newPhotos[slotIndex] = {
        file: null,
        preview: undefined,
        uploadUrl: undefined,
        fileName: undefined,
        isUploading: false,
        uploadProgress: 0,
        error: undefined
      };

      onPhotosChange?.(newPhotos);

      // ΚΡΙΣΙΜΟ: Καλούμε το onUploadComplete με removal flag για να καθαρίσει και το parent state
      if (onPhotoUploadComplete) {
        onPhotoUploadComplete(slotIndex, {
          success: true,
          url: '',
          fileName: '',
          fileSize: 0,
          mimeType: '',
          isRemoval: true // 🔧 FIX: Flag to indicate this is a removal, not a failed upload
        } as any);
      }
    }
  }, [normalizedPhotos, maxPhotos, uploadHandler, onPhotosChange, onPhotoUploadComplete, handleUploadProgress, handleUploadComplete, createUploadHandlerWithIndex]);

  // ========================================================================
  // MULTIPLE DROP HANDLER
  // ========================================================================

  /**
   * Handle multiple file drop
   */
  const handleMultipleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('image/')
    );

    if (files.length === 0) return;

    // Find available slots and upload each file
    let fileIndex = 0;
    for (let i = 0; i < maxPhotos && fileIndex < files.length; i++) {
      if (!normalizedPhotos[i].file && !normalizedPhotos[i].uploadUrl) {
        const file = files[fileIndex];
        handleFileSelection(i, file); // This will auto-upload
        fileIndex++;
      }
    }
  }, [disabled, normalizedPhotos, maxPhotos, handleFileSelection]);

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    handleUploadProgress,
    handleUploadComplete,
    handleFileSelection,
    handleMultipleDrop,
    createUploadHandlerWithIndex
  };
}

export default usePhotoSlotHandlers;