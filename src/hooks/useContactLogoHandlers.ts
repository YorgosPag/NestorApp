import { useCallback } from 'react';
import toast from 'react-hot-toast';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UseContactLogoHandlersProps {
  onLogoChange: (file: File | null) => void;
  onUploadComplete: (logoURL: string) => void;
}

export interface UseContactLogoHandlersReturn {
  // Validation handlers
  validateLogoFile: (file: File) => boolean;

  // File processing handlers
  processLogoFile: (file: File) => void;
  clearLogo: () => void;

  // Drag & drop handlers
  handleLogoDrop: (e: React.DragEvent) => void;
  handleLogoDragOver: (e: React.DragEvent) => void;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Contact Logo Upload Handlers
 *
 * Enterprise-class logo upload handlers για contact forms.
 * Χειρίζεται logo validation, processing και drag & drop.
 *
 * Features:
 * - File validation (type, size)
 * - Logo file processing
 * - Drag & drop support
 * - Enterprise error handling
 * - Memory cleanup για blob URLs
 */
export function useContactLogoHandlers({
  onLogoChange,
  onUploadComplete
}: UseContactLogoHandlersProps): UseContactLogoHandlersReturn {

  // ========================================================================
  // VALIDATION HANDLERS
  // ========================================================================

  /**
   * Validate logo file
   *
   * @param file - File to validate
   * @returns true if valid, false if invalid
   */
  const validateLogoFile = useCallback((file: File): boolean => {
    console.log('🔍 LOGO HANDLER: Validating file:', file.name);

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Επιλέξτε μόνο αρχεία εικόνας (JPG, PNG, κλπ.)');
      console.warn('❌ LOGO HANDLER: Invalid file type:', file.type);
      return false;
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('Το αρχείο πρέπει να είναι μικρότερο από 5MB');
      console.warn('❌ LOGO HANDLER: File too large:', file.size);
      return false;
    }

    // Logo specific validations
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Επιλέξτε JPG, PNG ή SVG αρχείο για το λογότυπο');
      console.warn('❌ LOGO HANDLER: Invalid logo file type:', file.type);
      return false;
    }

    console.log('✅ LOGO HANDLER: File validation passed');
    return true;
  }, []);

  // ========================================================================
  // FILE PROCESSING HANDLERS
  // ========================================================================

  /**
   * Process logo file (validate + update state)
   *
   * @param file - File to process
   */
  const processLogoFile = useCallback((file: File) => {
    console.log('🔥 LOGO HANDLER: Processing logo file:', file.name);

    if (!validateLogoFile(file)) {
      return;
    }

    // Update form state through callback
    onLogoChange(file);

    console.log('✅ LOGO HANDLER: Logo file processed successfully');
  }, []); // 🔧 FIX: Removed dependencies to prevent infinite re-renders

  /**
   * Clear logo file
   */
  const clearLogo = useCallback(() => {
    console.log('🧹 LOGO HANDLER: Clearing logo');
    onLogoChange(null);
  }, []); // 🔧 FIX: Removed dependencies to prevent infinite re-renders

  // ========================================================================
  // DRAG & DROP HANDLERS
  // ========================================================================

  /**
   * Handle logo file drop
   */
  const handleLogoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('📥 LOGO HANDLER: Logo drop event');

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) {
      console.warn('⚠️ LOGO HANDLER: No files in drop event');
      return;
    }

    // Process first file only
    const file = files[0];
    processLogoFile(file);
  }, [processLogoFile]);

  /**
   * Handle logo drag over
   */
  const handleLogoDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    // Validation handlers
    validateLogoFile,

    // File processing handlers
    processLogoFile,
    clearLogo,

    // Drag & drop handlers
    handleLogoDrop,
    handleLogoDragOver
  };
}