// ============================================================================
// DRAG & DROP HOOK - ENTERPRISE MODULE
// ============================================================================
//
// 🎭 Drag and drop interactions for file uploads
// Handles drag over and file drop events for enhanced UX
// Part of modular Enterprise contact form hooks architecture
//
// ============================================================================

import { useCallback } from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UseDragAndDropReturn {
  // Drag & drop handlers
  handleDrop: (
    e: React.DragEvent,
    handleFileChange: (file: File | null) => void
  ) => void;
  handleDragOver: (e: React.DragEvent) => void;
}

// ============================================================================
// DRAG & DROP HOOK
// ============================================================================

/**
 * Drag and drop interactions hook
 *
 * Provides drag and drop functionality for file uploads.
 * Enhances user experience with natural file dropping interactions.
 *
 * Features:
 * - File drop handling
 * - Drag over prevention
 * - First file extraction
 * - Clean event handling
 */
export function useDragAndDrop(): UseDragAndDropReturn {
  // ========================================================================
  // DRAG & DROP HANDLERS
  // ========================================================================

  /**
   * Handle file drop
   */
  const handleDrop = useCallback((
    e: React.DragEvent,
    handleFileChange: (file: File | null) => void
  ) => {
    console.log('🎭 DRAG & DROP: File drop detected');
    e.preventDefault();

    const files = Array.from(e.dataTransfer.files);
    console.log('🎭 DRAG & DROP: Dropped files count:', files.length);

    if (files.length > 0) {
      console.log('🎭 DRAG & DROP: Processing first file:', files[0].name);
      handleFileChange(files[0]);
    }
  }, []);

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Visual feedback could be added here in the future
  }, []);

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    handleDrop,
    handleDragOver
  };
}