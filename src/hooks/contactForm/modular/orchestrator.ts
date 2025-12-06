// ============================================================================
// CONTACT FORM STATE ORCHESTRATOR - ENTERPRISE MODULE
// ============================================================================
//
// 🎭 Main orchestration hook combining all contact form functionalities
// Provides the same API as the original useContactFormState with modular architecture
// Part of modular Enterprise contact form hooks architecture
//
// ============================================================================

import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import { useFormState } from '../core/useFormState';
import { useFormReset } from '../core/useFormReset';
import { useFileUploads } from '../files/useFileUploads';
import { useUploadCompletion } from '../files/useUploadCompletion';
import { usePhotoSelection } from '../photos/usePhotoSelection';
import { useDragAndDrop } from '../interactions/useDragAndDrop';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UseContactFormStateReturn {
  // State
  formData: any;

  // Basic setters
  setFormData: (data: any) => void;

  // Field handlers
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleNestedChange: (path: string, value: any) => void;

  // File handlers
  handleFileChange: (file: File | null) => void;
  handleLogoChange: (file: File | null) => void;
  handleMultiplePhotosChange: (photos: PhotoSlot[]) => void;

  // Upload completion handlers
  handleUploadedPhotoURL: (photoURL: string) => void;
  handleUploadedLogoURL: (logoURL: string) => void;
  handleMultiplePhotoUploadComplete: (index: number, result: any) => void;

  // Profile photo selection
  handleProfilePhotoSelection: (index: number) => void;

  // Drag & drop handlers
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;

  // Reset
  resetForm: () => void;
}

// ============================================================================
// MAIN ORCHESTRATOR HOOK
// ============================================================================

/**
 * Contact Form State Orchestrator Hook
 *
 * Enterprise-class orchestration of modular contact form hooks.
 * Combines all individual hooks into a unified API that matches the original.
 *
 * Features:
 * - Same API as original useContactFormState
 * - Modular architecture under the hood
 * - Enhanced maintainability through separation of concerns
 * - Better testability with focused hooks
 * - Tree-shaking optimization potential
 */
export function useContactFormState(): UseContactFormStateReturn {
  // ========================================================================
  // CORE STATE MANAGEMENT
  // ========================================================================

  // Core form state management - this is the source of truth
  const { formData, setFormData, handleChange, handleSelectChange, handleNestedChange } = useFormState();

  // ========================================================================
  // SPECIALIZED HOOKS WITH STATE INJECTION
  // ========================================================================

  // File upload management - inject state handlers
  const { handleFileChange, handleLogoChange, handleMultiplePhotosChange } = useFileUploads();

  // Upload completion handlers - inject state handlers
  const { handleUploadedPhotoURL, handleUploadedLogoURL, handleMultiplePhotoUploadComplete } = useUploadCompletion();

  // Photo selection management - inject state handlers
  const { handleProfilePhotoSelection } = usePhotoSelection();

  // Form reset functionality - inject state handlers
  const { resetForm } = useFormReset();

  // Drag and drop interactions - inject file handler
  const { handleDrop, handleDragOver } = useDragAndDrop();

  // ========================================================================
  // RETURN UNIFIED API
  // ========================================================================

  return {
    // State
    formData,

    // Basic setters
    setFormData,

    // Field handlers
    handleChange,
    handleSelectChange,
    handleNestedChange,

    // File handlers
    handleFileChange,
    handleLogoChange,
    handleMultiplePhotosChange,

    // Upload completion handlers
    handleUploadedPhotoURL,
    handleUploadedLogoURL,
    handleMultiplePhotoUploadComplete,

    // Profile photo selection
    handleProfilePhotoSelection,

    // Drag & drop handlers
    handleDrop,
    handleDragOver,

    // Reset
    resetForm
  };
}