import { useCallback } from 'react';
import toast from 'react-hot-toast';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { FileUploadResult } from '@/hooks/useEnterpriseFileUpload';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UseMultiplePhotosHandlersProps {
  onMultiplePhotosChange: (photos: PhotoSlot[]) => void;
  onPhotoUploadComplete: (index: number, result: FileUploadResult) => void;
}

export interface UseMultiplePhotosHandlersReturn {
  // Validation handlers
  validateMultiplePhotos: (files: File[]) => File[];

  // File processing handlers
  processMultiplePhotos: (files: File[]) => void;
  clearAllPhotos: () => void;
  clearPhotoAtIndex: (index: number, currentPhotos: PhotoSlot[]) => void;

  // Enterprise upload handler
  handleEnterpriseMultiplePhotoUpload: (
    file: File,
    onProgress: (progress: any) => void
  ) => Promise<FileUploadResult>;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Multiple Photos Upload Handlers
 *
 * Enterprise-class multiple photos upload handlers για contact forms.
 * Χειρίζεται validation, processing και enterprise upload για 5 φωτογραφίες.
 *
 * Features:
 * - Multiple file validation (type, size, count)
 * - Photo slots management
 * - Enterprise upload integration
 * - Progress tracking ανά φωτογραφία
 * - Memory cleanup για blob URLs
 */
export function useMultiplePhotosHandlers({
  onMultiplePhotosChange,
  onPhotoUploadComplete
}: UseMultiplePhotosHandlersProps): UseMultiplePhotosHandlersReturn {

  // ========================================================================
  // VALIDATION HANDLERS
  // ========================================================================

  /**
   * Validate multiple photos files
   *
   * @param files - Files to validate
   * @returns Valid files array
   */
  const validateMultiplePhotos = useCallback((files: File[]): File[] => {
    console.log('🔍 MULTIPLE PHOTOS HANDLER: Validating', files.length, 'files');

    const validFiles: File[] = [];
    const maxFiles = 5;
    const maxSize = 5 * 1024 * 1024; // 5MB

    for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
      const file = files[i];

      // Check file type
      if (!file.type.startsWith('image/')) {
        toast.error(`Αρχείο ${file.name}: Μόνο εικόνες επιτρέπονται`);
        console.warn('❌ MULTIPLE PHOTOS HANDLER: Invalid file type:', file.name, file.type);
        continue;
      }

      // Check file size
      if (file.size > maxSize) {
        toast.error(`Αρχείο ${file.name}: Μέγεθος > 5MB`);
        console.warn('❌ MULTIPLE PHOTOS HANDLER: File too large:', file.name, file.size);
        continue;
      }

      validFiles.push(file);
      console.log(`✅ MULTIPLE PHOTOS HANDLER: Valid file ${i + 1}:`, file.name);
    }

    if (files.length > maxFiles) {
      toast.error(`Μπορείτε να προσθέσετε μέχρι ${maxFiles} φωτογραφίες`);
      console.warn('❌ MULTIPLE PHOTOS HANDLER: Too many files:', files.length);
    }

    console.log(`✅ MULTIPLE PHOTOS HANDLER: ${validFiles.length}/${files.length} files validated`);
    return validFiles;
  }, []);

  // ========================================================================
  // FILE PROCESSING HANDLERS
  // ========================================================================

  /**
   * Process multiple photos files
   *
   * @param files - Files to process
   */
  const processMultiplePhotos = useCallback((files: File[]) => {
    console.log('🔥 MULTIPLE PHOTOS HANDLER: Processing', files.length, 'files');

    const validFiles = validateMultiplePhotos(files);
    if (validFiles.length === 0) {
      console.warn('⚠️ MULTIPLE PHOTOS HANDLER: No valid files to process');
      return;
    }

    // Create PhotoSlots array
    const photoSlots: PhotoSlot[] = validFiles.map((file, index) => ({
      file,
      preview: URL.createObjectURL(file),
      uploadUrl: undefined,
      isUploading: false,
      uploadProgress: 0,
      error: undefined
    }));

    console.log(`✅ MULTIPLE PHOTOS HANDLER: Created ${photoSlots.length} photo slots`);

    // Update form state
    onMultiplePhotosChange(photoSlots);
  }, [validateMultiplePhotos, onMultiplePhotosChange]);

  /**
   * Clear all photos
   */
  const clearAllPhotos = useCallback(() => {
    console.log('🧹 MULTIPLE PHOTOS HANDLER: Clearing all photos');
    onMultiplePhotosChange([]);
  }, [onMultiplePhotosChange]);

  /**
   * Clear photo at specific index
   *
   * @param index - Index of photo to clear
   * @param currentPhotos - Current photos array
   */
  const clearPhotoAtIndex = useCallback((index: number, currentPhotos: PhotoSlot[]) => {
    console.log('🧹 MULTIPLE PHOTOS HANDLER: Clearing photo at index:', index);

    const newPhotos = [...currentPhotos];

    // Cleanup blob URL if exists
    if (newPhotos[index]?.preview?.startsWith('blob:')) {
      URL.revokeObjectURL(newPhotos[index].preview!);
    }

    // Remove photo at index
    newPhotos.splice(index, 1);

    onMultiplePhotosChange(newPhotos);
  }, [onMultiplePhotosChange]);

  // ========================================================================
  // ENTERPRISE UPLOAD HANDLER
  // ========================================================================

  /**
   * Enterprise upload handler for multiple photos
   *
   * Integrates με το PhotoUploadService για enterprise-class upload.
   *
   * @param file - File to upload
   * @param onProgress - Progress callback
   * @returns Upload result promise
   */
  const handleEnterpriseMultiplePhotoUpload = useCallback(async (
    file: File,
    onProgress: (progress: any) => void
  ): Promise<FileUploadResult> => {
    console.log('🚀📸 MULTIPLE PHOTOS HANDLER: Starting enterprise upload:', file.name);

    // Import PhotoUploadService dynamically to avoid circular dependencies
    const { PhotoUploadService } = await import('@/services/photo-upload.service');

    try {
      const result = await PhotoUploadService.uploadContactPhoto(
        file,
        undefined, // contactId - θα προστεθεί αργότερα
        onProgress,
        'profile-modal' // Smart compression για multiple photos
      );

      console.log('✅📸 MULTIPLE PHOTOS HANDLER: Enterprise upload completed:', {
        url: result.url,
        compressionRatio: result.compressionInfo?.compressionRatio
      });

      return result;

    } catch (error) {
      console.error('❌📸 MULTIPLE PHOTOS HANDLER: Enterprise upload failed:', error);
      throw error;
    }
  }, []);

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    // Validation handlers
    validateMultiplePhotos,

    // File processing handlers
    processMultiplePhotos,
    clearAllPhotos,
    clearPhotoAtIndex,

    // Enterprise upload handler
    handleEnterpriseMultiplePhotoUpload
  };
}