'use client';

import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type FileType = 'image' | 'pdf' | 'document' | 'any';
export type UploadPurpose = 'photo' | 'logo' | 'document' | 'floorplan' | 'avatar';

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export interface FileUploadProgress {
  progress: number;
  phase: 'validation' | 'upload' | 'processing' | 'complete';
}

export interface FileUploadResult {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface UseEnterpriseFileUploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  success: boolean;
  validationError: string | null;
  previewUrl: string | null;
  currentFile: File | null;
  uploadPhase: FileUploadProgress['phase'];
}

export interface UseEnterpriseFileUploadActions {
  validateAndPreview: (file: File) => FileValidationResult;
  uploadFile: (file: File, uploadHandler?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>) => Promise<FileUploadResult | null>;
  clearState: () => void;
  clearError: () => void;
  cancelUpload: () => void;
  cleanup: () => void;
}

export interface UseEnterpriseFileUploadConfig {
  /** Type of files to accept */
  fileType: FileType;
  /** Purpose of the upload for better UX */
  purpose: UploadPurpose;
  /** Maximum file size in bytes (default: 5MB) */
  maxSize?: number;
  /** Accepted MIME types (auto-generated if not provided) */
  acceptedTypes?: string[];
  /** Show toast notifications (default: true) */
  showToasts?: boolean;
}

export interface UseEnterpriseFileUploadReturn extends UseEnterpriseFileUploadState, UseEnterpriseFileUploadActions {}

// ============================================================================
// FILE TYPE CONFIGURATIONS
// ============================================================================

const FILE_TYPE_CONFIG: Record<FileType, {
  mimeTypes: string[],
  extensions: string[],
  maxSize: number,
  errorMessage: string
}> = {
  image: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
    errorMessage: 'Επιλέξτε μόνο αρχεία εικόνας (JPG, PNG, GIF, WebP)'
  },
  pdf: {
    mimeTypes: ['application/pdf'],
    extensions: ['.pdf'],
    maxSize: 20 * 1024 * 1024, // 20MB
    errorMessage: 'Επιλέξτε μόνο αρχεία PDF'
  },
  document: {
    mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensions: ['.pdf', '.doc', '.docx'],
    maxSize: 10 * 1024 * 1024, // 10MB
    errorMessage: 'Επιλέξτε αρχεία PDF, DOC ή DOCX'
  },
  any: {
    mimeTypes: [],
    extensions: [],
    maxSize: 50 * 1024 * 1024, // 50MB
    errorMessage: 'Μη έγκυρος τύπος αρχείου'
  }
};

const PURPOSE_CONFIG: Record<UploadPurpose, {
  label: string,
  description: string
}> = {
  photo: {
    label: 'Φωτογραφία',
    description: 'Κάντε κλικ ή σύρετε φωτογραφία εδώ'
  },
  logo: {
    label: 'Λογότυπο',
    description: 'Κάντε κλικ ή σύρετε λογότυπο εδώ'
  },
  document: {
    label: 'Έγγραφο',
    description: 'Κάντε κλικ ή σύρετε έγγραφο εδώ'
  },
  floorplan: {
    label: 'Κάτοψη',
    description: 'Κάντε κλικ ή σύρετε αρχείο κάτοψης εδώ'
  },
  avatar: {
    label: 'Φωτογραφία Προφίλ',
    description: 'Κάντε κλικ ή σύρετε φωτογραφία προφίλ εδώ'
  }
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Formats file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validates file based on configuration
 */
function validateFile(file: File, config: UseEnterpriseFileUploadConfig): FileValidationResult {
  const typeConfig = FILE_TYPE_CONFIG[config.fileType];
  const maxSize = config.maxSize || typeConfig.maxSize;

  // Check file size
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `Το αρχείο πρέπει να είναι μικρότερο από ${formatFileSize(maxSize)}`
    };
  }

  // For 'any' type, allow everything
  if (config.fileType === 'any') {
    return { isValid: true };
  }

  // Check MIME type
  const acceptedTypes = config.acceptedTypes || typeConfig.mimeTypes;
  if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: typeConfig.errorMessage
    };
  }

  // Check file extension as fallback
  if (typeConfig.extensions.length > 0) {
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!typeConfig.extensions.includes(fileExtension)) {
      return {
        isValid: false,
        error: typeConfig.errorMessage
      };
    }
  }

  return { isValid: true };
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Enterprise File Upload Hook
 *
 * Based on the most advanced upload system in the application (usePDFUpload)
 * Extended to support all file types with enterprise features:
 * - AbortController for cancellation
 * - Progress tracking with phases
 * - File validation & preview
 * - Memory cleanup
 * - Error handling with toast notifications
 * - Configurable file types and purposes
 *
 * @param config Upload configuration
 * @returns Hook state and actions
 */
export function useEnterpriseFileUpload(config: UseEnterpriseFileUploadConfig): UseEnterpriseFileUploadReturn {
  const [state, setState] = useState<UseEnterpriseFileUploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    success: false,
    validationError: null,
    previewUrl: null,
    currentFile: null,
    uploadPhase: 'validation'
  });

  // Keep track of current upload to allow cancellation
  const uploadControllerRef = useRef<AbortController | null>(null);

  /**
   * Validates file and creates preview URL
   */
  const validateAndPreview = useCallback((file: File): FileValidationResult => {
    // Clear previous state
    setState(prev => ({
      ...prev,
      error: null,
      validationError: null,
      success: false,
      uploadPhase: 'validation'
    }));

    // Validate file
    const validation = validateFile(file, config);

    if (!validation.isValid) {
      setState(prev => ({
        ...prev,
        validationError: validation.error || 'Invalid file',
        previewUrl: null,
        currentFile: null
      }));

      if (config.showToasts !== false) {
        toast.error(validation.error || 'Μη έγκυρο αρχείο');
      }

      return validation;
    }

    // Create preview URL for images
    let previewUrl: string | null = null;
    if (config.fileType === 'image' && file.type.startsWith('image/')) {
      previewUrl = URL.createObjectURL(file);
    }

    setState(prev => ({
      ...prev,
      validationError: null,
      previewUrl,
      currentFile: file
    }));

    if (config.showToasts !== false) {
      toast.success(`${PURPOSE_CONFIG[config.purpose].label} επιλέχθηκε επιτυχώς`);
    }

    return validation;
  }, [config]);

  /**
   * Uploads file with progress tracking
   */
  const uploadFile = useCallback(async (
    file: File,
    uploadHandler?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>
  ): Promise<FileUploadResult | null> => {
    // Create new abort controller for this upload
    uploadControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      isUploading: true,
      progress: 0,
      error: null,
      success: false,
      uploadPhase: 'upload'
    }));

    try {
      // Progress callback
      const onProgress = (progress: FileUploadProgress) => {
        setState(prev => ({
          ...prev,
          progress: progress.progress,
          uploadPhase: progress.phase
        }));
      };

      let result: FileUploadResult;

      // Use provided upload handler or create default
      if (uploadHandler) {
        result = await uploadHandler(file, onProgress);
      } else {
        // Default upload simulation for demonstration
        onProgress({ progress: 25, phase: 'upload' });
        await new Promise(resolve => setTimeout(resolve, 500));

        onProgress({ progress: 75, phase: 'processing' });
        await new Promise(resolve => setTimeout(resolve, 500));

        result = {
          url: URL.createObjectURL(file),
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type
        };
      }

      // Check if upload was cancelled
      if (uploadControllerRef.current?.signal.aborted) {
        setState(prev => ({
          ...prev,
          isUploading: false,
          uploadPhase: 'validation',
          error: 'Upload cancelled'
        }));
        return null;
      }

      // Success
      setState(prev => ({
        ...prev,
        isUploading: false,
        success: true,
        progress: 100,
        uploadPhase: 'complete'
      }));

      if (config.showToasts !== false) {
        toast.success(`${PURPOSE_CONFIG[config.purpose].label} ανέβηκε επιτυχώς!`);
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Σφάλμα κατά το ανέβασμα';

      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadPhase: 'validation',
        error: errorMessage,
        progress: 0
      }));

      if (config.showToasts !== false) {
        toast.error(`Σφάλμα: ${errorMessage}`);
      }

      return null;
    } finally {
      uploadControllerRef.current = null;
    }
  }, [config]);

  /**
   * Clears all state
   */
  const clearState = useCallback(() => {
    // Clean up preview URL if it exists
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }

    setState({
      isUploading: false,
      progress: 0,
      error: null,
      success: false,
      validationError: null,
      previewUrl: null,
      currentFile: null,
      uploadPhase: 'validation'
    });
  }, [state.previewUrl]);

  /**
   * Clears only error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      validationError: null
    }));
  }, []);

  /**
   * Cancels current upload
   */
  const cancelUpload = useCallback(() => {
    if (uploadControllerRef.current) {
      uploadControllerRef.current.abort();
    }

    setState(prev => ({
      ...prev,
      isUploading: false,
      progress: 0,
      uploadPhase: 'validation',
      error: 'Upload cancelled'
    }));

    if (config.showToasts !== false) {
      toast.error('Το ανέβασμα ακυρώθηκε');
    }
  }, [config.showToasts]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }
    if (uploadControllerRef.current) {
      uploadControllerRef.current.abort();
    }
  }, [state.previewUrl]);

  // Return state and actions
  return {
    // State
    isUploading: state.isUploading,
    progress: state.progress,
    error: state.error,
    success: state.success,
    validationError: state.validationError,
    previewUrl: state.previewUrl,
    currentFile: state.currentFile,
    uploadPhase: state.uploadPhase,

    // Actions
    validateAndPreview,
    uploadFile,
    clearState,
    clearError,
    cancelUpload,

    // Internal cleanup (for testing)
    cleanup
  };
}

// ============================================================================
// EXPORT CONFIGURATIONS FOR REUSE
// ============================================================================

export { FILE_TYPE_CONFIG, PURPOSE_CONFIG };