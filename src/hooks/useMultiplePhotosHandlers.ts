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
  }, []); // 🔧 FIX: Removed dependencies to prevent infinite re-renders

  /**
   * Clear all photos
   */
  const clearAllPhotos = useCallback(() => {
    console.log('🧹 MULTIPLE PHOTOS HANDLER: Clearing all photos');
    onMultiplePhotosChange([]);
  }, []); // 🔧 FIX: Removed dependencies to prevent infinite re-renders

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
    console.log('🚀📸 MULTIPLE PHOTOS BASE64: Starting Base64 conversion:', file.name);

    try {
      return new Promise<FileUploadResult>((resolve, reject) => {
        const reader = new FileReader();

        // Progress simulation για UI feedback
        onProgress({ bytesTransferred: 0, totalBytes: file.size });

        reader.onload = (e) => {
          const base64URL = e.target?.result as string;

          console.log('✅📸 MULTIPLE PHOTOS BASE64: Conversion completed:', file.name);
          console.log('📸 BASE64 URL:', base64URL.substring(0, 50) + '...');

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