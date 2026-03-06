import { useCallback } from 'react';
import React from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface UseContactFormHandlersProps {
  handleFileChange: (file: File | null) => void;
  handleLogoChange: (file: File | null) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
}

// ============================================================================
// CONTACT FORM HANDLERS HOOK
// ============================================================================

/**
 * Contact Form Handlers Hook
 *
 * Thin wrapper for legacy compatibility. Logo validation is handled
 * by EnterprisePhotoUpload → useEnterpriseFileUpload.validateAndPreview() (SSoT).
 *
 * ADR-190: Removed duplicate useContactLogoHandlers — validation centralised.
 */
export function useContactFormHandlers({
  handleFileChange,
  handleLogoChange,
  handleDrop,
  handleDragOver
}: UseContactFormHandlersProps) {

  const wrappedFileChange = useCallback((file: File | null) => {
    handleFileChange(file);
  }, [handleFileChange]);

  // Logo validation is done upstream by EnterprisePhotoUpload → useEnterpriseFileUpload
  const wrappedLogoChange = useCallback((file: File | null) => {
    handleLogoChange(file);
  }, [handleLogoChange]);

  const wrappedDrop = useCallback((e: React.DragEvent) => {
    handleDrop(e);
  }, [handleDrop]);

  const wrappedDragOver = useCallback((e: React.DragEvent) => {
    handleDragOver(e);
  }, [handleDragOver]);

  return {
    handleFileChange: wrappedFileChange,
    handleLogoChange: wrappedLogoChange,
    handleDrop: wrappedDrop,
    handleDragOver: wrappedDragOver,
  };
}
