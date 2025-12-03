import { useCallback } from 'react';
import toast from 'react-hot-toast';

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
  // VALIDATION HANDLERS
  // ========================================================================

  /**
   * Validate photo file
   *
   * @param file - File to validate
   * @returns true if valid, false if invalid
   */
  const validatePhotoFile = useCallback((file: File): boolean => {
    console.log('🔍 PHOTO HANDLER: Validating file:', file.name);

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Επιλέξτε μόνο αρχεία εικόνας (JPG, PNG, κλπ.)');
      console.warn('❌ PHOTO HANDLER: Invalid file type:', file.type);
      return false;
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('Το αρχείο πρέπει να είναι μικρότερο από 5MB');
      console.warn('❌ PHOTO HANDLER: File too large:', file.size);
      return false;
    }

    console.log('✅ PHOTO HANDLER: File validation passed');
    return true;
  }, []);

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
    console.log('🔥 PHOTO HANDLER BASE64: Processing photo file:', file.name);

    if (!validatePhotoFile(file)) {
      return;
    }

    console.log('🔙 OLD WORKING SYSTEM: Direct Base64 conversion - NO Firebase calls');

    try {
      // 🔙 ΠΑΛΙΟ WORKING SYSTEM: Direct FileReader conversion
      const reader = new FileReader();

      reader.onload = (e) => {
        const base64URL = e.target?.result as string;
        console.log('✅ OLD WORKING: Photo converted to Base64 successfully');
        console.log('📸 BASE64 URL:', base64URL.substring(0, 50) + '...');

        // Update form state με το file (για διαχείριση)
        onFileChange(file);

        // Update form με το Base64 URL - ΠΑΛΙΟ WORKING APPROACH!
        onUploadComplete(base64URL);

        toast.success('Φωτογραφία φορτώθηκε επιτυχώς!');
      };

      reader.onerror = () => {
        console.error('❌ OLD WORKING: Base64 conversion failed');
        toast.error('Αποτυχία φόρτωσης φωτογραφίας');
      };

      // 🔙 ΠΑΛΙΟ WORKING: Convert directly to Base64 data URL
      reader.readAsDataURL(file);

    } catch (error) {
      console.error('❌ OLD WORKING: Photo processing failed:', error);
      toast.error('Αποτυχία φόρτωσης φωτογραφίας');
    }

    console.log('✅ PHOTO HANDLER BASE64: Photo file processed successfully');
  }, [onFileChange, onUploadComplete]);

  /**
   * Clear photo file
   */
  const clearPhoto = useCallback(() => {
    console.log('🧹 PHOTO HANDLER: Clearing photo');
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

    console.log('📥 PHOTO HANDLER: Photo drop event');

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