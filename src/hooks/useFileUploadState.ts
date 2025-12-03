// ============================================================================
// FILE UPLOAD STATE MANAGEMENT HOOK
// ============================================================================

/**
 * Enterprise File Upload State Management
 *
 * Κεντρικοποιημένο state management για file upload functionality.
 * Extracted από useEnterpriseFileUpload για reusability.
 */

import { useState, useCallback, useRef } from 'react';
import { UploadPhase } from '@/config/file-upload-config';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface FileUploadProgress {
  progress: number;
  phase: UploadPhase;
}

export interface FileUploadResult {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface FileUploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  success: boolean;
  validationError: string | null;
  previewUrl: string | null;
  currentFile: File | null;
  uploadPhase: UploadPhase;
}

export interface FileUploadStateActions {
  // State setters
  setUploading: (uploading: boolean) => void;
  setProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  setSuccess: (success: boolean) => void;
  setValidationError: (error: string | null) => void;
  setPreviewUrl: (url: string | null) => void;
  setCurrentFile: (file: File | null) => void;
  setUploadPhase: (phase: UploadPhase) => void;

  // Compound actions
  setFileWithPreview: (file: File, createPreview?: boolean) => void;
  setUploadProgress: (progress: FileUploadProgress) => void;
  clearAllErrors: () => void;
  resetToInitialState: () => void;

  // Upload control
  startUpload: () => void;
  completeUpload: (result: FileUploadResult) => void;
  failUpload: (error: string) => void;
  cancelUpload: () => void;

  // Memory management
  cleanupPreviewUrl: () => void;
  cleanup: () => void;
}

export interface UseFileUploadStateReturn extends FileUploadState, FileUploadStateActions {
  // Upload controller for cancellation
  uploadControllerRef: React.MutableRefObject<AbortController | null>;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const INITIAL_STATE: FileUploadState = {
  isUploading: false,
  progress: 0,
  error: null,
  success: false,
  validationError: null,
  previewUrl: null,
  currentFile: null,
  uploadPhase: 'validation'
};

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * File Upload State Management Hook
 *
 * Enterprise-class state management για file uploads.
 * Χειρίζεται όλο το upload state και τις transitions.
 *
 * Features:
 * - Comprehensive state management
 * - Upload progress tracking
 * - Error handling (validation + upload errors)
 * - Preview URL management με memory cleanup
 * - AbortController για cancellation
 * - Compound actions για συχνές operations
 *
 * @returns State και actions για file upload
 */
export function useFileUploadState(): UseFileUploadStateReturn {

  // ========================================================================
  // STATE
  // ========================================================================

  const [state, setState] = useState<FileUploadState>(INITIAL_STATE);

  // Upload controller για cancellation
  const uploadControllerRef = useRef<AbortController | null>(null);

  // ========================================================================
  // BASIC SETTERS
  // ========================================================================

  const setUploading = useCallback((uploading: boolean) => {
    setState(prev => ({ ...prev, isUploading: uploading }));
  }, []);

  const setProgress = useCallback((progress: number) => {
    setState(prev => ({ ...prev, progress }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const setSuccess = useCallback((success: boolean) => {
    setState(prev => ({ ...prev, success }));
  }, []);

  const setValidationError = useCallback((validationError: string | null) => {
    setState(prev => ({ ...prev, validationError }));
  }, []);

  const setPreviewUrl = useCallback((previewUrl: string | null) => {
    setState(prev => ({ ...prev, previewUrl }));
  }, []);

  const setCurrentFile = useCallback((currentFile: File | null) => {
    setState(prev => ({ ...prev, currentFile }));
  }, []);

  const setUploadPhase = useCallback((uploadPhase: UploadPhase) => {
    setState(prev => ({ ...prev, uploadPhase }));
  }, []);

  // ========================================================================
  // COMPOUND ACTIONS
  // ========================================================================

  /**
   * Set file με optional preview URL creation
   */
  const setFileWithPreview = useCallback((file: File, createPreview: boolean = true) => {
    let previewUrl: string | null = null;

    if (createPreview && file.type.startsWith('image/')) {
      previewUrl = URL.createObjectURL(file);
    }

    setState(prev => ({
      ...prev,
      currentFile: file,
      previewUrl,
      validationError: null,
      error: null
    }));
  }, []);

  /**
   * Update upload progress και phase
   */
  const setUploadProgress = useCallback((progress: FileUploadProgress) => {
    setState(prev => ({
      ...prev,
      progress: progress.progress,
      uploadPhase: progress.phase
    }));
  }, []);

  /**
   * Clear όλα τα errors
   */
  const clearAllErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      validationError: null
    }));
  }, []);

  /**
   * Reset σε initial state με cleanup
   */
  const resetToInitialState = useCallback(() => {
    // Cleanup preview URL αν υπάρχει
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }

    // Cancel any ongoing upload
    if (uploadControllerRef.current) {
      uploadControllerRef.current.abort();
      uploadControllerRef.current = null;
    }

    setState(INITIAL_STATE);
  }, []); // 🔧 FIX: Removed state dependency to prevent infinite loop

  // ========================================================================
  // UPLOAD CONTROL ACTIONS
  // ========================================================================

  /**
   * Start upload process
   */
  const startUpload = useCallback(() => {
    // Create new abort controller
    uploadControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      isUploading: true,
      progress: 0,
      error: null,
      success: false,
      uploadPhase: 'upload'
    }));
  }, []);

  /**
   * Complete upload successfully
   */
  const completeUpload = useCallback((result: FileUploadResult) => {
    setState(prev => ({
      ...prev,
      isUploading: false,
      success: true,
      progress: 100,
      uploadPhase: 'complete',
      error: null
    }));

    // Clear upload controller
    uploadControllerRef.current = null;
  }, []);

  /**
   * Fail upload με error message
   */
  const failUpload = useCallback((error: string) => {
    setState(prev => ({
      ...prev,
      isUploading: false,
      uploadPhase: 'validation',
      error,
      progress: 0,
      success: false
    }));

    // Clear upload controller
    uploadControllerRef.current = null;
  }, []);

  /**
   * Cancel ongoing upload
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

    uploadControllerRef.current = null;
  }, []);

  // ========================================================================
  // MEMORY MANAGEMENT
  // ========================================================================

  /**
   * Cleanup preview URL μόνο
   */
  const cleanupPreviewUrl = useCallback(() => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
      setPreviewUrl(null);
    }
  }, []); // 🔧 FIX: Removed state dependencies to prevent infinite loop

  /**
   * Full cleanup - preview URL και upload controller
   */
  const cleanup = useCallback(() => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }

    if (uploadControllerRef.current) {
      uploadControllerRef.current.abort();
      uploadControllerRef.current = null;
    }
  }, []); // 🔧 FIX: Removed state dependency to prevent infinite loop

  // ========================================================================
  // RETURN API
  // ========================================================================

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

    // Upload controller
    uploadControllerRef,

    // Basic setters
    setUploading,
    setProgress,
    setError,
    setSuccess,
    setValidationError,
    setPreviewUrl,
    setCurrentFile,
    setUploadPhase,

    // Compound actions
    setFileWithPreview,
    setUploadProgress,
    clearAllErrors,
    resetToInitialState,

    // Upload control
    startUpload,
    completeUpload,
    failUpload,
    cancelUpload,

    // Memory management
    cleanupPreviewUrl,
    cleanup
  };
}