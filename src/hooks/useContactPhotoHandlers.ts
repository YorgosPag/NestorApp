import { useCallback } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UseContactPhotoHandlersProps {
  onFileChange: (file: File | null) => void;
  onUploadComplete: (photoURL: string) => void;
}

export interface UseContactPhotoHandlersReturn {
  // Validation handlers
  validatePhotoFile: (file: File) => boolean;

  // File processing handlers
  processPhotoFile: (file: File) => void;
  clearPhoto: () => void;

  // Drag & drop handlers
  handlePhotoDrop: (e: React.DragEvent) => void;
  handlePhotoDragOver: (e: React.DragEvent) => void;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Contact Photo Upload Handlers
 *
 * Enterprise-class photo upload handlers για contact forms.
 * Χειρίζεται photo validation, processing και drag & drop.
 *
 * Features:
 * - File validation (type, size)
 * - Photo file processing
 * - Drag & drop support
 * - Enterprise error handling
 * - Memory cleanup για blob URLs
 */
export function useContactPhotoHandlers({
  onFileChange,
  onUploadComplete
}: UseContactPhotoHandlersProps): UseContactPhotoHandlersReturn {

  // ========================================================================
  // DEPENDENCIES
  // ========================================================================

  const notifications = useNotifications();

  // ========================================================================
  // VALIDATION HANDLERS
  // ========================================================================

  /**
   * Validate photo file
   *
   * @param file - File to validate
   * @returns true if valid, false if invalid
   */
  const validatePhotoFile = useCallback((file: File): boolean => {

    // Check file type
    if (!file.type.startsWith('image/')) {
      notifications.error('📸 Επιλέξτε μόνο αρχεία εικόνας (JPG, PNG, κλπ.)');
      console.warn('❌ PHOTO HANDLER: Invalid file type:', file.type);
      return false;
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      notifications.error('📏 Το αρχείο πρέπει να είναι μικρότερο από 5MB');
      console.warn('❌ PHOTO HANDLER: File too large:', file.size);
      return false;
    }

    return true;
  }, [notifications]);

  // ========================================================================
  // FILE PROCESSING HANDLERS
  // ========================================================================

  /**
   * Process photo file (validate + direct Base64 conversion)
   * 🔙 OLD WORKING SYSTEM: Pure Base64 approach - NO Firebase Storage
   *
   * @param file - File to process
   */
  const processPhotoFile = useCallback(async (file: File) => {

    if (!validatePhotoFile(file)) {
      return;
    }


    try {
      // 🔙 ΠΑΛΙΟ WORKING SYSTEM: Direct FileReader conversion
      const reader = new FileReader();

      reader.onload = (e) => {
        const base64URL = e.target?.result as string;

        // Update form state με το file (για διαχείριση)
        onFileChange(file);

        // Update form με το Base64 URL - ΠΑΛΙΟ WORKING APPROACH!
        onUploadComplete(base64URL);

        notifications.success('✅ Φωτογραφία φορτώθηκε επιτυχώς!');
      };

      reader.onerror = () => {
        console.error('❌ OLD WORKING: Base64 conversion failed');
        notifications.error('❌ Αποτυχία φόρτωσης φωτογραφίας');
      };

      // 🔙 ΠΑΛΙΟ WORKING: Convert directly to Base64 data URL
      reader.readAsDataURL(file);

    } catch (error) {
      console.error('❌ OLD WORKING: Photo processing failed:', error);
      notifications.error('❌ Αποτυχία φόρτωσης φωτογραφίας');
    }

  }, [onFileChange, onUploadComplete, notifications, validatePhotoFile]);

  /**
   * Clear photo file
   */
  const clearPhoto = useCallback(() => {
    onFileChange(null);
  }, []); // 🔧 FIX: Removed dependencies to prevent infinite re-renders

  // ========================================================================
  // DRAG & DROP HANDLERS
  // ========================================================================

  /**
   * Handle photo file drop
   */
  const handlePhotoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();


    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) {
      console.warn('⚠️ PHOTO HANDLER: No files in drop event');
      return;
    }

    // Process first file only
    const file = files[0];
    processPhotoFile(file);
  }, [processPhotoFile]);

  /**
   * Handle photo drag over
   */
  const handlePhotoDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    // Validation handlers
    validatePhotoFile,

    // File processing handlers
    processPhotoFile,
    clearPhoto,

    // Drag & drop handlers
    handlePhotoDrop,
    handlePhotoDragOver
  };
}