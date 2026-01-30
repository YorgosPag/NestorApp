'use client';

import { useCallback } from 'react';
import type React from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Configuration for useFileSelectionHandlers hook
 */
export interface UseFileSelectionHandlersConfig {
  /** Callback when file is selected */
  onFileSelect: (file: File | null) => void;
  /** Accepted file types (e.g., 'image/*', '.pdf,.doc') */
  accept?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Return type for useFileSelectionHandlers hook
 */
export interface FileSelectionHandlers {
  /** Handle file selection from input */
  handleFileSelection: (file: File | null) => void;
  /** Handle drag over events */
  handleDragOver: (e: React.DragEvent) => void;
  /** Handle drag leave events */
  handleDragLeave: (e: React.DragEvent) => void;
  /** Handle drop events */
  handleDrop: (e: React.DragEvent) => void;
  /** Handle click to open file dialog */
  handleClick: () => void;
  /** Handle input change event */
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * File Selection Handlers Hook
 *
 * Extracted from usePhotoUploadLogic (ADR-054) for reusability.
 * Provides unified handlers for file selection via drag/drop, click, or input.
 *
 * Features:
 * - Drag and drop support
 * - Click to open file dialog
 * - Input change handler
 * - Accepts filter support
 * - Debug logging support
 *
 * @param config - Hook configuration
 * @returns File selection handlers
 *
 * @example
 * ```typescript
 * const handlers = useFileSelectionHandlers({
 *   onFileSelect: (file) => {
 *     if (file) {
 *       setSelectedFile(file);
 *     }
 *   },
 *   accept: 'image/*',
 * });
 *
 * <div
 *   onDragOver={handlers.handleDragOver}
 *   onDragLeave={handlers.handleDragLeave}
 *   onDrop={handlers.handleDrop}
 *   onClick={handlers.handleClick}
 * >
 *   Drop files here or click to select
 * </div>
 * ```
 */
export function useFileSelectionHandlers({
  onFileSelect,
  accept = '*/*',
  debug = false,
}: UseFileSelectionHandlersConfig): FileSelectionHandlers {
  /**
   * Handle file selection
   */
  const handleFileSelection = useCallback(
    (file: File | null) => {
      if (debug) {
        console.log('📁 FILE SELECTION:', {
          hasFile: !!file,
          fileName: file?.name,
          fileSize: file?.size,
          fileType: file?.type,
        });
      }

      onFileSelect(file);
    },
    [onFileSelect, debug]
  );

  /**
   * Handle drag over events
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.dataset.dragOver = 'true';
    }
  }, []);

  /**
   * Handle drag leave events
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Remove visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      delete e.currentTarget.dataset.dragOver;
    }
  }, []);

  /**
   * Handle drop events
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Remove visual feedback
      if (e.currentTarget instanceof HTMLElement) {
        delete e.currentTarget.dataset.dragOver;
      }

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        const file = files[0];

        if (debug) {
          console.log('📥 FILE DROPPED:', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          });
        }

        handleFileSelection(file);
      }
    },
    [handleFileSelection, debug]
  );

  /**
   * Handle click to open file dialog
   */
  const handleClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;

    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0] || null;
      handleFileSelection(file);
    };

    input.click();
  }, [accept, handleFileSelection]);

  /**
   * Handle input change event (for controlled inputs)
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      handleFileSelection(file);

      // Reset input value to allow selecting the same file again
      e.target.value = '';
    },
    [handleFileSelection]
  );

  return {
    handleFileSelection,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleClick,
    handleInputChange,
  };
}
