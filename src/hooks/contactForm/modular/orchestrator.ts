// ============================================================================
// CONTACT FORM STATE ORCHESTRATOR - ENTERPRISE MODULE
// ============================================================================
//
// 🎭 Main orchestration hook combining all contact form functionalities
// Provides the same API as the original useContactFormState with modular architecture
// Part of modular Enterprise contact form hooks architecture
//
// ============================================================================

import React from 'react';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { useFormState } from '../core/useFormState';
import { useFormReset } from '../core/useFormReset';
import { useFileUploads } from '../files/useFileUploads';
import { useUploadCompletion } from '../files/useUploadCompletion';
import { usePhotoSelection } from '../photos/usePhotoSelection';
import { useDragAndDrop } from '../interactions/useDragAndDrop';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Result from multiple photo upload operation */
interface MultiplePhotoUploadResult {
  url?: string;
  fileName?: string;
}

export interface UseContactFormStateReturn {
  // State
  formData: ContactFormData;

  // Basic setters
  setFormData: (data: ContactFormData) => void;

  // Field handlers
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleNestedChange: (path: string, value: unknown) => void;

  // File handlers
  handleFileChange: (file: File | null) => void;
  handleLogoChange: (file: File | null) => void;
  handleMultiplePhotosChange: (photos: PhotoSlot[]) => void;

  // Upload completion handlers
  handleUploadedPhotoURL: (photoURL: string) => void;
  handleUploadedLogoURL: (logoURL: string) => void;
  handleMultiplePhotoUploadComplete: (index: number, result: MultiplePhotoUploadResult) => void;

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

  // File upload management - get hook functions
  const fileUploadsHook = useFileUploads();

  // Upload completion handlers - get hook functions
  const uploadCompletionHook = useUploadCompletion();

  // Photo selection management - get hook functions
  const photoSelectionHook = usePhotoSelection();

  // Form reset functionality - get hook functions
  const formResetHook = useFormReset();

  // Drag and drop interactions - get hook functions
  const dragAndDropHook = useDragAndDrop();

  // ========================================================================
  // WRAPPER FUNCTIONS - PARTIAL APPLICATION PATTERN
  // ========================================================================

  // File upload wrappers - inject formData and setFormData
  const handleFileChange = React.useCallback((file: File | null) => {
    fileUploadsHook.handleFileChange(file, formData, setFormData);
  }, [formData, setFormData, fileUploadsHook]);

  const handleLogoChange = React.useCallback((file: File | null) => {
    fileUploadsHook.handleLogoChange(file, formData, setFormData);
  }, [formData, setFormData, fileUploadsHook]);

  const handleMultiplePhotosChange = React.useCallback((photos: PhotoSlot[]) => {
    fileUploadsHook.handleMultiplePhotosChange(photos, formData, setFormData);
  }, [formData, setFormData, fileUploadsHook]);

  // Upload completion wrappers
  const handleUploadedPhotoURL = React.useCallback((photoURL: string) => {
    uploadCompletionHook.handleUploadedPhotoURL(photoURL, formData, setFormData);
  }, [formData, setFormData, uploadCompletionHook]);

  const handleUploadedLogoURL = React.useCallback((logoURL: string) => {
    uploadCompletionHook.handleUploadedLogoURL(logoURL, formData, setFormData);
  }, [formData, setFormData, uploadCompletionHook]);

  const handleMultiplePhotoUploadComplete = React.useCallback((index: number, result: MultiplePhotoUploadResult) => {
    uploadCompletionHook.handleMultiplePhotoUploadComplete(index, result, formData, setFormData);
  }, [formData, setFormData, uploadCompletionHook]);

  // Photo selection wrapper
  const handleProfilePhotoSelection = React.useCallback((index: number) => {
    photoSelectionHook.handleProfilePhotoSelection(index, formData, setFormData);
  }, [formData, setFormData, photoSelectionHook]);

  // Drag and drop wrappers
  const handleDrop = React.useCallback((e: React.DragEvent) => {
    dragAndDropHook.handleDrop(e, handleFileChange);
  }, [dragAndDropHook, handleFileChange]);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    dragAndDropHook.handleDragOver(e);
  }, [dragAndDropHook]);

  // Reset wrapper
  const resetForm = React.useCallback(() => {
    formResetHook.resetForm(formData, setFormData);
  }, [formData, setFormData, formResetHook]);

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