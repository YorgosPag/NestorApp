import type React from 'react';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { ContactType } from '@/types/contacts';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { FileUploadResult, FileUploadProgress } from '@/hooks/useFileUploadState';
// 🏢 ENTERPRISE: SSoT upload handler factory (ADR-190)
import { createUploadHandlerFromPreset } from '@/services/upload-handlers';

// ============================================================================
// 🏢 SSoT: CONTACT NAME RESOLUTION — SINGLE SOURCE OF TRUTH
// ============================================================================
// ALL contact name resolution MUST go through this function.
// DO NOT compute contactName inline anywhere else in the codebase.
// Priority: explicit override → firstName+lastName → companyName → serviceName → name

/**
 * 🏢 SSoT: Resolve contact display name from form data.
 *
 * This is the SINGLE SOURCE OF TRUTH for contact name resolution.
 * Used by: upload handlers, file display names, tree builders.
 *
 * @param formData - Contact form data (individual, company, or service)
 * @param override - Optional explicit name (takes precedence over formData)
 * @returns Resolved contact name, or undefined if unavailable
 */
export function resolveContactName(
  formData: Pick<ContactFormData, 'type' | 'firstName' | 'lastName' | 'companyName' | 'serviceName' | 'name'>,
  override?: string,
): string | undefined {
  if (override) return override;

  if (formData.type === 'individual') {
    const fullName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim();
    return fullName || formData.name || undefined;
  }
  return formData.companyName || formData.serviceName || formData.name || undefined;
}

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

// 🏢 ENTERPRISE: Re-export FileUploadProgress for backward compatibility
export type { FileUploadProgress as UploadProgress };

/**
 * 🏢 ENTERPRISE: Canonical upload context for ADR-031 compliance
 * @enterprise Required for canonical pipeline (no legacy folderPath)
 * @see ADR-031 - Canonical File Storage System
 */
export interface CanonicalUploadContext {
  /** Company ID for multi-tenant isolation (from user.companyId custom claim) */
  companyId: string;
  /** User ID who is uploading (from user.uid) */
  createdBy: string;
  /** Contact ID for FileRecord linkage (pre-generated for new, existing for edits) */
  contactId: string;
  /**
   * Optional override for contact name. DO NOT compute this in callers.
   * SSoT: resolveContactName() in getPhotoUploadHandlers() resolves from formData.
   * Use this ONLY for edge cases where formData is unavailable.
   */
  contactName?: string;
}

export interface PhotoUploadHandlers {
  logoUploadHandler?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>;
  photoUploadHandler?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>;
}

export interface UnifiedPhotoHandlers {
  onPhotosChange?: (photos: PhotoSlot[]) => void;
  handleMultiplePhotosChange?: (photos: PhotoSlot[]) => void;
  setFormData?: (data: ContactFormData) => void;
  formData: ContactFormData;
}

// ============================================================================
// 🔥 EXTRACTED: PHOTO UPLOAD CONFIGURATION LOGIC
// ============================================================================

/**
 * Photo Upload Configuration Provider - Specialized για photo upload management
 *
 * Extracted από UnifiedContactTabbedSection για Single Responsibility Principle.
 * Χειρίζεται μόνο τη photo upload configuration logic.
 *
 * Features:
 * - Firebase upload handlers configuration
 * - Unified photo change handlers
 * - WORKING PERFECTLY preservation για company logos & representative photos
 * - Clean separation από UI logic
 */

/**
 * 🏢 ENTERPRISE: Photo upload handlers with canonical pipeline support
 *
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * If canonicalContext is provided, uses canonical pipeline (recommended).
 * Otherwise falls back to legacy folderPath (deprecated, will show warning).
 *
 * @param formData - Contact form data for naming context
 * @param canonicalContext - Optional canonical upload context (companyId, createdBy, contactId)
 * @returns Photo upload handlers for logo and representative photo
 *
 * @example
 * // Canonical usage (recommended) — contactName resolved automatically from formData
 * const handlers = getPhotoUploadHandlers(formData, {
 *   companyId: user.companyId,
 *   createdBy: user.uid,
 *   contactId: formData.id || generatedContactId,
 * });
 */
export function getPhotoUploadHandlers(
  formData: ContactFormData,
  canonicalContext?: CanonicalUploadContext
): PhotoUploadHandlers {
  const resolvedName = resolveContactName(formData, canonicalContext?.contactName);

  // 🏢 ENTERPRISE: Build contactData for FileNamingService compatibility
  const contactData = {
    type: formData.type,
    name: formData.name || formData.companyName || formData.serviceName || `${formData.firstName} ${formData.lastName}`.trim(),
    id: formData.id,
  };

  // 🏢 ADR-190: Use SSoT factory (defaultUploadHandler) instead of direct service calls
  const canonicalOverrides = canonicalContext
    ? {
        companyId: canonicalContext.companyId,
        createdBy: canonicalContext.createdBy,
        contactId: canonicalContext.contactId,
        contactName: resolvedName,
      }
    : {};

  return {
    logoUploadHandler: createUploadHandlerFromPreset('company-logo', {
      contactData,
      ...canonicalOverrides,
    }),
    photoUploadHandler: createUploadHandlerFromPreset('contact-representative', {
      contactData,
      ...canonicalOverrides,
    }),
  };
}

/**
 * 🔄 UNIFIED PHOTO HANDLER: Consolidate all photo change handlers
 *
 * Extracted και καθαρισμένη από το μεγάλο useMemo του component.
 * Ενοποιεί τους διαφορετικούς photo change handlers.
 */
export function createUnifiedPhotosChangeHandler(handlers: UnifiedPhotoHandlers) {
  const { onPhotosChange, handleMultiplePhotosChange, setFormData, formData } = handlers;

  return onPhotosChange || handleMultiplePhotosChange || ((photos: PhotoSlot[]) => {
    // 🏢 ENTERPRISE: Default behavior - update formData if available
    if (setFormData && formData) {
      setFormData({
        ...formData,
        multiplePhotos: photos
      });
    }
  });
}

/**
 * 🎭 Build renderer props based on contact type
 *
 * 🔥 ΚΡΙΣΙΜΗ ΣΥΝΑΡΤΗΣΗ: Χτίζει τα σωστά props για κάθε renderer.
 * Extracted από το μεγάλο rendererProps useMemo.
 */
// 🏢 ENTERPRISE: Base props interface for renderer configuration
interface RendererBaseProps {
  sections: unknown[];
  formData: ContactFormData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSelectChange: (name: string, value: string) => void;
  disabled?: boolean;
  customRenderers?: Record<string, unknown>;
  fieldErrors?: Record<string, string>;
  onFieldBlur?: (fieldName: string) => void;
  [key: string]: unknown;
}

export function buildRendererPropsForContactType(
  contactType: ContactType,
  baseProps: RendererBaseProps,
  photoHandlers: {
    handleLogoChange?: (file: File | null) => void;
    handleFileChange?: (file: File | null) => void;
    handleUploadedLogoURL?: (logoURL: string) => void;
    handleUploadedPhotoURL?: (photoURL: string) => void;
    unifiedPhotosChange: (photos: PhotoSlot[]) => void;
    handleMultiplePhotoUploadComplete?: (index: number, result: FileUploadResult) => void;
    handleProfilePhotoSelection?: (index: number) => void;
    setFormData?: (data: ContactFormData) => void;
    formData: ContactFormData;
    onPhotoClick?: (index: number) => void;
  }
) {
  // 👤 Individual-specific props
  if (contactType === 'individual') {
    return {
      ...baseProps, // ✅ ΚΡΙΣΙΜΟ: Περιλαμβάνει ΟΛΑ τα baseProps συμπεριλαμβανομένου του relationships renderer!
      onPhotoChange: photoHandlers.handleFileChange,
      onMultiplePhotosChange: photoHandlers.unifiedPhotosChange,
      onMultiplePhotoUploadComplete: photoHandlers.handleMultiplePhotoUploadComplete,
      onProfilePhotoSelection: photoHandlers.handleProfilePhotoSelection,
      onPhotoClick: photoHandlers.onPhotoClick
    };
  }

  // 🏢 Company & Service props
  return {
    ...baseProps, // ✅ ΚΡΙΣΙΜΟ: Περιλαμβάνει ΟΛΑ τα baseProps συμπεριλαμβανομένου του relationships renderer!
    onPhotosChange: photoHandlers.unifiedPhotosChange,
    onLogoChange: photoHandlers.handleLogoChange,
    handleUploadedLogoURL: photoHandlers.handleUploadedLogoURL,
    handleUploadedPhotoURL: photoHandlers.handleUploadedPhotoURL,
    setFormData: photoHandlers.setFormData
  };
}