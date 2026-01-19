import type { ContactFormData } from '@/types/ContactFormTypes';

// ============================================================================
// 🏢 ENTERPRISE CENTRALIZED PHOTO VALIDATION SYSTEM
// ============================================================================
//
// 🎯 SINGLE SOURCE OF TRUTH για όλες τις φωτογραφίες
// 🔥 UNIFIED LOGIC - Μία λογική για όλους τους contact types
// 🚀 CENTRALIZED RULES - Όλοι οι κανόνες σε ένα μέρος
//
// ✅ CRITICAL SUCCESS: Representative Photo Upload - 2025-12-05
// 🎯 FIXED: Stale closure race condition με formDataRef solution
// 📊 STATUS: WORKING PERFECTLY για όλους τους photo types
// ⚠️ ΜΗΔΕΝΙΚΗ ΑΝΟΧΗ: ΜΗΝ ΑΛΛΑΞΕΙΣ την validation logic!
//
// Created: 2025-12-05
// Purpose: Eliminate code duplication & inconsistent validation behavior
//
// ============================================================================

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type PhotoType = 'logo' | 'representative' | 'main' | 'multiple';
export type ContactType = 'individual' | 'company' | 'service';

export interface PhotoValidationConfig {
  photoType: PhotoType;
  contactType: ContactType;
  isRequired?: boolean;
}

export interface PhotoValidationResult {
  isValid: boolean;
  isPending: boolean;
  isFailed: boolean;
  errorMessage?: string;
  debugInfo?: Record<string, unknown>;
}

export interface UploadValidationSummary {
  isValid: boolean;
  pendingUploads: number;
  failedUploads: number;
  totalSlots: number;
  errors: string[];
}

// ============================================================================
// CORE VALIDATION FUNCTIONS
// ============================================================================

/**
 * 🔥 CORE FUNCTION: Check if URL is valid for upload completion
 *
 * @param url - URL to validate
 * @returns true if URL is valid (Base64 or Firebase Storage)
 */
function isValidPhotoURL(url: string | undefined | null): boolean {
  if (typeof url !== 'string' || !url.trim()) {
    return false;
  }

  // Accept Base64 data URLs
  if (url.startsWith('data:image/')) {
    return true;
  }

  // Accept Firebase Storage URLs
  if (url.includes('firebasestorage.googleapis.com') || url.includes('.appspot.com')) {
    return true;
  }

  // Reject blob URLs (temporary)
  if (url.startsWith('blob:')) {
    return false;
  }

  return false;
}

/**
 * 🎯 UNIFIED VALIDATION: Single photo validation logic
 *
 * @param config - Validation configuration
 * @param formData - Contact form data
 * @returns PhotoValidationResult
 */
export function validateSinglePhoto(
  config: PhotoValidationConfig,
  formData: ContactFormData
): PhotoValidationResult {

  const { photoType, contactType } = config;

  // Get relevant form fields based on photo type
  let photoFile: File | null = null;
  let primaryURL: string | undefined;
  let fallbackURL: string | undefined;

  switch (photoType) {
    case 'logo':
      photoFile = formData.logoFile;
      primaryURL = formData.logoURL;
      fallbackURL = formData.logoPreview;
      break;

    case 'representative':
      photoFile = formData.photoFile;
      primaryURL = formData.photoURL;
      fallbackURL = formData.photoPreview;
      break;

    case 'main':
      photoFile = formData.photoFile;
      primaryURL = formData.photoURL;
      fallbackURL = formData.photoPreview;
      break;

    default:
      return {
        isValid: true,
        isPending: false,
        isFailed: false,
        errorMessage: `Unsupported photo type: ${photoType}`
      };
  }

  // 🔍 DEBUG: Photo validation details (only in dev mode)
  if (process.env.NODE_ENV === 'development' && photoType === 'representative') {
    console.log('🔍 VALIDATION DEBUG: Representative photo check', {
      photoType,
      hasPhotoFile: !!photoFile,
      primaryURLType: primaryURL?.includes('firebasestorage.googleapis.com') ? 'FIREBASE' : 'OTHER',
      fallbackURLType: fallbackURL?.includes('firebasestorage.googleapis.com') ? 'FIREBASE' : 'OTHER'
    });
  }

  // 🔥 CORE LOGIC: Same for ALL photo types

  // If no file selected, validation passes (upload not started)
  if (!photoFile) {
    return {
      isValid: true,
      isPending: false,
      isFailed: false,
      debugInfo: { reason: 'No file selected', photoType, contactType }
    };
  }

  // Check primary URL first
  const hasPrimaryURL = isValidPhotoURL(primaryURL);
  const hasFallbackURL = isValidPhotoURL(fallbackURL);

  // 🔍 DEBUG: URL validation results (dev only)
  if (process.env.NODE_ENV === 'development' && photoType === 'representative') {
    console.log('🔍 URL VALIDATION:', { hasPrimaryURL, hasFallbackURL });
  }

  // 🎯 UNIFIED RULE: Photo is valid if we have ANY valid URL
  const hasValidURL = hasPrimaryURL || hasFallbackURL;

  if (hasValidURL) {
    return {
      isValid: true,
      isPending: false,
      isFailed: false,
      debugInfo: {
        source: hasPrimaryURL ? 'primary' : 'fallback',
        url: (primaryURL || fallbackURL)?.substring(0, 50) + '...',
        photoType,
        contactType
      }
    };
  }

  // File selected but no valid URL = pending upload
  return {
    isValid: false,
    isPending: true,
    isFailed: false,
    errorMessage: `${getPhotoDisplayName(photoType)}: Εκκρεμής upload`,
    debugInfo: {
      hasFile: !!photoFile,
      primaryURL: primaryURL?.substring(0, 50),
      fallbackURL: fallbackURL?.substring(0, 50),
      photoType,
      contactType
    }
  };
}

/**
 * 🏢 ENTERPRISE MASTER VALIDATION: Validate all photos for a contact form
 *
 * @param formData - Contact form data
 * @returns UploadValidationSummary
 */
export function validateAllPhotos(formData: ContactFormData): UploadValidationSummary {
  console.log('🏢 CENTRALIZED VALIDATION: Starting photo validation for', formData.type);

  const result: UploadValidationSummary = {
    isValid: true,
    pendingUploads: 0,
    failedUploads: 0,
    totalSlots: 0,
    errors: []
  };

  // 1. Validate multiple photos (for Individual contacts)
  if (formData.multiplePhotos && formData.multiplePhotos.length > 0) {
    formData.multiplePhotos.forEach((photoSlot, index) => {
      const hasContent = photoSlot.file || photoSlot.preview || photoSlot.uploadUrl || photoSlot.isUploading;

      if (hasContent) {
        result.totalSlots++;

        const hasValidUrl = photoSlot.uploadUrl && isValidPhotoURL(photoSlot.uploadUrl);
        const isUploadingButNotComplete = photoSlot.isUploading && !hasValidUrl;
        const hasFileButNoUrl = (photoSlot.file || photoSlot.preview) && !hasValidUrl;

        // 🌐 i18n: Error messages converted to i18n keys - 2026-01-18
        if (isUploadingButNotComplete || hasFileButNoUrl) {
          if (photoSlot.isUploading) {
            result.pendingUploads++;
            result.errors.push(`photo.validation.pendingUpload`);
          } else if (photoSlot.error) {
            result.failedUploads++;
            result.errors.push(`photo.validation.uploadError`);
          } else {
            result.pendingUploads++;
            result.errors.push(`photo.validation.uploadNotStarted`);
          }
        }
      }
    });
  }

  // 2. Validate main photo (for Individual/Service)
  if ((formData.type === 'individual' || formData.type === 'service') && formData.photoFile) {
    const validation = validateSinglePhoto({
      photoType: 'main',
      contactType: formData.type
    }, formData);

    // 🌐 i18n: Error messages converted to i18n keys - 2026-01-18
    if (validation.isPending) {
      result.pendingUploads++;
      result.errors.push(validation.errorMessage || 'photo.validation.mainPending');
    } else if (validation.isFailed) {
      result.failedUploads++;
      result.errors.push(validation.errorMessage || 'photo.validation.mainFailed');
    }
  }

  // 3. Validate logo (for Company/Service)
  if ((formData.type === 'company' || formData.type === 'service') && formData.logoFile) {
    const validation = validateSinglePhoto({
      photoType: 'logo',
      contactType: formData.type
    }, formData);

    if (validation.isPending) {
      result.pendingUploads++;
      result.errors.push(validation.errorMessage || 'photo.validation.logoPending');
    } else if (validation.isFailed) {
      result.failedUploads++;
      result.errors.push(validation.errorMessage || 'photo.validation.logoFailed');
    }
  }

  // 4. Validate representative photo (for Company)
  if (formData.type === 'company' && formData.photoFile) {
    const validation = validateSinglePhoto({
      photoType: 'representative',
      contactType: 'company'
    }, formData);

    console.log('🏢 CENTRALIZED: Representative photo validation result:', validation);

    if (validation.isPending) {
      result.pendingUploads++;
      result.errors.push(validation.errorMessage || 'photo.validation.representativePending');
    } else if (validation.isFailed) {
      result.failedUploads++;
      result.errors.push(validation.errorMessage || 'photo.validation.representativeFailed');
    }
  }

  // Calculate final result
  result.isValid = result.pendingUploads === 0 && result.failedUploads === 0;

  console.log('🏢 CENTRALIZED VALIDATION: Final result:', {
    isValid: result.isValid,
    pendingUploads: result.pendingUploads,
    failedUploads: result.failedUploads,
    totalSlots: result.totalSlots,
    errors: result.errors
  });

  return result;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get display name for photo type
 * 🌐 i18n: Converted to i18n keys - 2026-01-18
 */
function getPhotoDisplayName(photoType: PhotoType): string {
  switch (photoType) {
    case 'logo': return 'photo.types.logo';
    case 'representative': return 'photo.types.representative';
    case 'main': return 'photo.types.main';
    case 'multiple': return 'photo.types.multiple';
    default: return 'photo.types.default';
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export the main validation function with a legacy-compatible name
export const validateUploadState = validateAllPhotos;

// Note: Individual functions are already exported above with their declarations