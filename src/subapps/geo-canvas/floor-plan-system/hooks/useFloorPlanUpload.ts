/**
 * 🎯 USE FLOOR PLAN UPLOAD HOOK
 *
 * Custom hook για floor plan upload workflow management
 *
 * @module floor-plan-system/hooks/useFloorPlanUpload
 *
 * Features:
 * - File upload state management
 * - Automatic format detection & parsing
 * - Error handling & validation
 * - Progress tracking
 * - Result caching
 *
 * Usage:
 * ```tsx
 * const {
 *   file,
 *   result,
 *   isParsing,
 *   error,
 *   uploadFile,
 *   clearUpload,
 *   isModalOpen,
 *   openModal,
 *   closeModal
 * } = useFloorPlanUpload();
 * ```
 */

import { useState, useCallback } from 'react';
import { detectFormat } from '../parsers';
import { parseDxf, parseDwg, parseImage } from '../parsers';
import type { ParserResult, FloorPlanFormat } from '../types';

/**
 * Hook state interface
 */
export interface UseFloorPlanUploadState {
  /** Currently selected file */
  file: File | null;
  /** Parsing result (success or error) */
  result: ParserResult | null;
  /** Parsing in progress */
  isParsing: boolean;
  /** Error message (if any) */
  error: string | null;
  /** Modal open state */
  isModalOpen: boolean;
}

/**
 * Hook actions interface
 */
export interface UseFloorPlanUploadActions {
  /** Upload and parse a file */
  uploadFile: (file: File) => Promise<void>;
  /** Clear current upload state */
  clearUpload: () => void;
  /** Open upload modal */
  openModal: () => void;
  /** Close upload modal */
  closeModal: () => void;
}

/**
 * Hook return type
 */
export type UseFloorPlanUploadReturn = UseFloorPlanUploadState & UseFloorPlanUploadActions;

/**
 * useFloorPlanUpload Hook
 *
 * Manages floor plan upload workflow:
 * 1. File selection
 * 2. Format detection
 * 3. Parsing (DXF/DWG/Image)
 * 4. Error handling
 * 5. Result display
 *
 * @returns Hook state and actions
 */
export function useFloorPlanUpload(): UseFloorPlanUploadReturn {
  // ===================================================================
  // STATE
  // ===================================================================

  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ParserResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ===================================================================
  // ACTIONS
  // ===================================================================

  /**
   * Upload and parse file
   */
  const uploadFile = useCallback(async (selectedFile: File) => {
    console.debug('📤 useFloorPlanUpload: Starting upload...', {
      name: selectedFile.name,
      size: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
      type: selectedFile.type
    });

    // Clear previous state
    setFile(selectedFile);
    setResult(null);
    setError(null);
    setIsParsing(true);

    try {
      // STEP 1: Detect format
      const format = detectFormat(selectedFile);

      if (!format) {
        throw new Error(
          `Unsupported file format. Supported formats: DXF, DWG, PNG, JPG, PDF, TIFF`
        );
      }

      console.debug(`🔍 Format detected: ${format}`);

      // STEP 2: Parse based on format
      let parseResult: ParserResult;

      switch (format) {
        case 'DXF':
          parseResult = await parseDxf(selectedFile);
          break;

        case 'DWG':
          parseResult = await parseDwg(selectedFile);
          break;

        case 'PNG':
        case 'JPG':
        case 'PDF':
        case 'TIFF':
          parseResult = await parseImage(selectedFile);
          break;

        default:
          throw new Error(`Format ${format} not yet supported`);
      }

      console.debug('✅ Parse result:', parseResult);

      // STEP 3: Check result
      if (!parseResult.success) {
        const errorMessage = parseResult.errors?.join(', ') || 'Unknown parsing error';
        throw new Error(errorMessage);
      }

      // STEP 4: Set result
      setResult(parseResult);
      setError(null);

      console.debug('🎉 Upload successful!');

      // STEP 5: Auto-close modal after successful upload
      setTimeout(() => {
        console.debug('🚪 Auto-closing modal after successful upload');
        setIsModalOpen(false);
      }, 1500); // 1.5 second delay to show preview briefly

    } catch (err) {
      console.error('❌ Upload failed:', err);

      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setResult({
        success: false,
        format: detectFormat(selectedFile) || 'UNKNOWN' as FloorPlanFormat,
        errors: [errorMessage]
      });
    } finally {
      setIsParsing(false);
    }
  }, []);

  /**
   * Clear upload state
   */
  const clearUpload = useCallback(() => {
    console.debug('🗑️ useFloorPlanUpload: Clearing upload state');

    setFile(null);
    setResult(null);
    setError(null);
    setIsParsing(false);
  }, []);

  /**
   * Open modal
   */
  const openModal = useCallback(() => {
    console.debug('🏗️ useFloorPlanUpload: Opening modal');
    setIsModalOpen(true);
  }, []);

  /**
   * Close modal (and optionally clear state)
   */
  const closeModal = useCallback(() => {
    console.debug('🚪 useFloorPlanUpload: Closing modal');
    setIsModalOpen(false);
    // Note: We don't clear upload state here - user might want to see result again
  }, []);

  // ===================================================================
  // RETURN
  // ===================================================================

  return {
    // State
    file,
    result,
    isParsing,
    error,
    isModalOpen,

    // Actions
    uploadFile,
    clearUpload,
    openModal,
    closeModal
  };
}

/**
 * Export for convenience
 */
export default useFloorPlanUpload;
