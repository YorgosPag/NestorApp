import { useCallback } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import { validateFile } from '@/utils/file-validation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useMultiplePhotosHandlers');

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

  // Base64 conversion handler
  // handleEnterpriseMultiplePhotoUpload removed - using centralized defaultUploadHandler
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
   * ADR-054: Using centralized validateFile() instead of inline validation
   *
   * @param files - Files to validate
   * @returns Valid files array
   */
  const validateMultiplePhotos = useCallback((files: File[]): File[] => {
    const validFiles: File[] = [];
    const maxFiles = 5;

    for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
      const file = files[i];

      // 🏢 ADR-054: Use centralized validateFile() instead of inline validation
      const validation = validateFile(file, {
        fileType: 'image',
        maxSize: 5 * 1024 * 1024, // 5MB
      });

      if (!validation.isValid) {
        notifications.error(`📸 ${file.name}: ${validation.error}`);
        logger.warn('MULTIPLE PHOTOS HANDLER: Validation failed', { fileName: file.name, error: validation.error });
        continue;
      }

      validFiles.push(file);
    }

    if (files.length > maxFiles) {
      notifications.error(`📊 Μπορείτε να προσθέσετε μέχρι ${maxFiles} φωτογραφίες`);
      logger.warn('MULTIPLE PHOTOS HANDLER: Too many files', { count: files.length });
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
      logger.warn('MULTIPLE PHOTOS HANDLER: No valid files to process');
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
  }, []);

  /**
   * Clear all photos
   */
  const clearAllPhotos = useCallback(() => {
    onMultiplePhotosChange([]);
  }, []);

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
  }, []);

  // ========================================================================
  // BASE64 CONVERSION HANDLER
  // ========================================================================

  // 🚀 CENTRALIZATION: Removed duplicate Base64 upload handler - now using centralized defaultUploadHandler from MultiplePhotosUpload

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

    // Base64 conversion handler removed - using centralized defaultUploadHandler
  };
}