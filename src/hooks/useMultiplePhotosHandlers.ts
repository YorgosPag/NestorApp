import { useCallback } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
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

  // Base64 conversion handler (OLD WORKING SYSTEM)
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
  // DEPENDENCIES
  // ========================================================================

  const notifications = useNotifications();

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

    const validFiles: File[] = [];
    const maxFiles = 5;
    const maxSize = 5 * 1024 * 1024; // 5MB

    for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
      const file = files[i];

      // Check file type
      if (!file.type.startsWith('image/')) {
        notifications.error(`📸 Αρχείο ${file.name}: Μόνο εικόνες επιτρέπονται`);
        console.warn('❌ MULTIPLE PHOTOS HANDLER: Invalid file type:', file.name, file.type);
        continue;
      }

      // Check file size
      if (file.size > maxSize) {
        notifications.error(`📏 Αρχείο ${file.name}: Μέγεθος > 5MB`);
        console.warn('❌ MULTIPLE PHOTOS HANDLER: File too large:', file.name, file.size);
        continue;
      }

      validFiles.push(file);
    }

    if (files.length > maxFiles) {
      notifications.error(`📊 Μπορείτε να προσθέσετε μέχρι ${maxFiles} φωτογραφίες`);
      console.warn('❌ MULTIPLE PHOTOS HANDLER: Too many files:', files.length);
    }

    return validFiles;
  }, [notifications]);

  // ========================================================================
  // FILE PROCESSING HANDLERS
  // ========================================================================

  /**
   * Process multiple photos files
   *
   * @param files - Files to process
   */
  const processMultiplePhotos = useCallback((files: File[]) => {

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


    // Update form state
    onMultiplePhotosChange(photoSlots);
  }, []); // 🔧 FIX: Removed dependencies to prevent infinite re-renders

  /**
   * Clear all photos
   */
  const clearAllPhotos = useCallback(() => {
    onMultiplePhotosChange([]);
  }, []); // 🔧 FIX: Removed dependencies to prevent infinite re-renders

  /**
   * Clear photo at specific index
   *
   * @param index - Index of photo to clear
   * @param currentPhotos - Current photos array
   */
  const clearPhotoAtIndex = useCallback((index: number, currentPhotos: PhotoSlot[]) => {

    const newPhotos = [...currentPhotos];

    // Cleanup blob URL if exists
    if (newPhotos[index]?.preview?.startsWith('blob:')) {
      URL.revokeObjectURL(newPhotos[index].preview!);
    }

    // Remove photo at index
    newPhotos.splice(index, 1);

    onMultiplePhotosChange(newPhotos);
  }, []); // 🔧 FIX: Removed dependencies to prevent infinite re-renders

  // ========================================================================
  // BASE64 CONVERSION HANDLER (OLD WORKING SYSTEM)
  // ========================================================================

  /**
   * Base64 conversion handler for multiple photos
   * 🔙 OLD WORKING SYSTEM: Direct Base64 conversion - NO Firebase Storage
   *
   * @param file - File to convert
   * @param onProgress - Progress callback
   * @returns Base64 conversion result
   */
  const handleEnterpriseMultiplePhotoUpload = useCallback(async (
    file: File,
    onProgress: (progress: any) => void
  ): Promise<FileUploadResult> => {

    try {
      return new Promise<FileUploadResult>((resolve, reject) => {
        const reader = new FileReader();

        // Progress simulation για UI feedback
        onProgress({ bytesTransferred: 0, totalBytes: file.size });

        reader.onload = (e) => {
          const base64URL = e.target?.result as string;


          // Simulate final progress
          onProgress({ bytesTransferred: file.size, totalBytes: file.size });

          const result: FileUploadResult = {
            success: true,
            url: base64URL, // 🔙 OLD WORKING: Direct Base64 URL
            fileName: file.name,
            compressionInfo: {
              originalSize: file.size,
              compressedSize: file.size,
              compressionRatio: 1.0,
              quality: 1.0
            }
          };

          resolve(result);
        };

        reader.onerror = () => {
          console.error('❌📸 MULTIPLE PHOTOS BASE64: Conversion failed:', file.name);
          reject(new Error('Base64 conversion failed'));
        };

        // 🔙 OLD WORKING SYSTEM: Direct Base64 conversion
        reader.readAsDataURL(file);
      });

    } catch (error) {
      console.error('❌📸 MULTIPLE PHOTOS BASE64: Conversion failed:', error);
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

    // Base64 conversion handler (OLD WORKING SYSTEM)
    handleEnterpriseMultiplePhotoUpload
  };
}