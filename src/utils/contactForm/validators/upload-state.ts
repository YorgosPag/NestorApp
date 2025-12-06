// ============================================================================
// UPLOAD STATE VALIDATION - ENTERPRISE MODULE
// ============================================================================
//
// ✅ Upload state validation utilities for form data processing
// Handles validation of photo upload states and pending operations
// Part of modular Enterprise form data mapping architecture
//
// ============================================================================

import type { ContactFormData } from '@/types/ContactFormTypes';

/**
 * Upload validation result interface
 */
export interface UploadValidationResult {
  isValid: boolean;
  pendingUploads: number;
  failedUploads: number;
  totalSlots: number;
  errors: string[];
}

/**
 * 🏢 ENTERPRISE CENTRALIZED VALIDATION (Legacy Wrapper)
 *
 * @deprecated Use validateAllPhotos from '@/utils/photo/validation' instead
 * This function is kept for backward compatibility
 */
export function validateUploadState(formData: ContactFormData): UploadValidationResult {
  // 🔄 FORWARD TO CENTRALIZED VALIDATION
  const { validateAllPhotos } = require('@/utils/photo/validation');
  return validateAllPhotos(formData);
}