'use client';

import { useState, useCallback, useRef } from 'react';
import { 
  uploadFloorPDF, 
  validatePDFFile, 
  getFloorPDFUrl,
  type PDFUploadResult,
  type PDFUploadProgress,
  type PDFValidationResult,
  handlePDFError
} from '@/lib/pdf-utils';

export interface UsePDFUploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  success: boolean;
  validationError: string | null;
  previewUrl: string | null;
  currentFile: File | null;
}

export interface UsePDFUploadActions {
  validateAndPreview: (file: File) => PDFValidationResult;
  uploadPDF: (file: File, buildingId: string, floorId: string) => Promise<PDFUploadResult | null>;
  clearState: () => void;
  clearError: () => void;
  cancelUpload: () => void;
  loadExistingPDF: (floorId: string) => Promise<string | null>;
  cleanup: () => void;
}

export interface UsePDFUploadReturn extends UsePDFUploadState, UsePDFUploadActions {}

/**
 * Custom hook για τη διαχείριση PDF upload στις κατόψεις
 * 
 * Παρέχει:
 * - State management για upload process
 * - File validation και preview
 * - Progress tracking
 * - Error handling
 * - Cancel functionality
 * - Cleanup utilities
 */
export function usePDFUpload(): UsePDFUploadReturn {
  const [state, setState] = useState<UsePDFUploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    success: false,
    validationError: null,
    previewUrl: null,
    currentFile: null
  });

  // Keep track of current upload to allow cancellation
  const uploadControllerRef = useRef<AbortController | null>(null);

  /**
   * Validates file and creates preview URL
   */
  const validateAndPreview = useCallback((file: File): PDFValidationResult => {
    // Clear previous state
    setState(prev => ({
      ...prev,
      error: null,
      validationError: null,
      success: false
    }));

    // Validate file
    const validation = validatePDFFile(file);
    
    if (!validation.isValid) {
      setState(prev => ({
        ...prev,
        validationError: validation.error || 'Invalid file',
        previewUrl: null,
        currentFile: null
      }));
      return validation;
    }

    // Create preview URL and store file
    const previewUrl = URL.createObjectURL(file);
    setState(prev => ({
      ...prev,
      validationError: null,
      previewUrl,
      currentFile: file
    }));

    return validation;
  }, []);

  /**
   * Uploads PDF with progress tracking
   */
  const uploadPDF = useCallback(async (
    file: File,
    buildingId: string,
    floorId: string
  ): Promise<PDFUploadResult | null> => {
    // Create new abort controller for this upload
    uploadControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      isUploading: true,
      progress: 0,
      error: null,
      success: false
    }));

    try {
      // Progress callback
      const onProgress = (progress: PDFUploadProgress) => {
        setState(prev => ({
          ...prev,
          progress: progress.progress
        }));
      };

      // Upload PDF
      const result = await uploadFloorPDF(file, buildingId, floorId, onProgress);

      // Check if upload was cancelled
      if (uploadControllerRef.current?.signal.aborted) {
        setState(prev => ({
          ...prev,
          isUploading: false,
          error: 'Upload cancelled'
        }));
        return null;
      }

      // Success
      setState(prev => ({
        ...prev,
        isUploading: false,
        success: true,
        progress: 100
      }));

      return result;

    } catch (error) {
      const errorMessage = handlePDFError(error);
      
      setState(prev => ({
        ...prev,
        isUploading: false,
        error: errorMessage,
        progress: 0
      }));

      return null;
    } finally {
      uploadControllerRef.current = null;
    }
  }, []);

  /**
   * Loads existing PDF URL for a floor
   */
  const loadExistingPDF = useCallback(async (floorId: string): Promise<string | null> => {
    try {
      const pdfUrl = await getFloorPDFUrl(floorId);
      return pdfUrl;
    } catch (error) {
      console.error('Error loading existing PDF:', error);
      return null;
    }
  }, []);

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
      currentFile: null
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
      error: 'Upload cancelled'
    }));
  }, []);

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

    // Actions
    validateAndPreview,
    uploadPDF,
    clearState,
    clearError,
    cancelUpload,
    loadExistingPDF,

    // Internal cleanup (for testing)
    cleanup
  };
}