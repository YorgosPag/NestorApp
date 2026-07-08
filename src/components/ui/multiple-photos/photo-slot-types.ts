import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import type { UploadPurpose } from '@/config/file-upload-config';
import type { ContactFormData } from '@/types/ContactFormTypes';

// ============================================================================
// SSoT: Multiple-photos slot model + variant props (ADR-596)
// ----------------------------------------------------------------------------
// Single source of truth for the PhotoSlot shape and the shared prop contract
// consumed by both MultiplePhotosCompact and MultiplePhotosFull. Previously each
// variant (and MultiplePhotosUpload) re-declared PhotoSlot + a near-identical
// props interface — a type-clone flagged by jscpd (CHECK 3.28 / ADR-584).
// ============================================================================

export interface PhotoSlot {
  file?: File | null;
  preview?: string;
  uploadUrl?: string;
  /** Custom filename για εμφάνιση στο UI */
  fileName?: string;
  isUploading?: boolean;
  uploadProgress?: number;
  error?: string;
}

/**
 * Shared prop contract for both photo-grid variants (compact & full).
 * Per-variant extras (profile selector) live in the variant-specific interface.
 */
export interface MultiplePhotosBaseProps {
  /** Normalized photos array (exactly maxPhotos slots) */
  normalizedPhotos: PhotoSlot[];
  /** Maximum number of photos */
  maxPhotos: number;
  /** Current cache busting key */
  photosKey: number;
  /** Add cache buster to URLs */
  addCacheBuster: (url: string | undefined) => string | undefined;
  /** Purpose of photos (logo, representative, etc.) */
  purpose?: UploadPurpose;
  /** Upload handler */
  uploadHandler?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>;
  /** Upload complete handler */
  handleUploadComplete?: (slotIndex: number, result: FileUploadResult) => void;
  /** Photos change callback to update parent state */
  onPhotosChange?: (photos: PhotoSlot[]) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Show progress indicators */
  showProgress?: boolean;
  /** Custom className */
  className?: string;
  /** Contact data for FileNamingService */
  contactData?: ContactFormData;
  /** Photo click handler για gallery preview */
  onPhotoClick?: (index: number) => void;
  /** Show photos even when component is disabled (for read-only views) */
  showPhotosWhenDisabled?: boolean;
}

/** Compact variant adds the profile-photo selector affordance. */
export interface MultiplePhotosCompactProps extends MultiplePhotosBaseProps {
  /** Show profile selector */
  showProfileSelector?: boolean;
  /** Selected profile photo index */
  selectedProfilePhotoIndex?: number;
  /** Profile photo selection callback */
  onProfilePhotoSelection?: (index: number) => void;
}

/** Full variant uses the base contract unchanged. */
export type MultiplePhotosFullProps = MultiplePhotosBaseProps;

// ============================================================================
// Slot builders — SSoT for the repeated PhotoSlot object literals
// ============================================================================

/** Slot after a file is selected/dropped (blob preview, upload not yet started). */
export function buildSelectedSlot(prev: PhotoSlot, file: File): PhotoSlot {
  return {
    ...prev,
    file,
    preview: URL.createObjectURL(file),
    isUploading: false,
    uploadProgress: 0,
    error: undefined,
  };
}

/** Fully-cleared slot (delete / failed upload). Clears uploadUrl too. */
export function buildClearedSlot(): PhotoSlot {
  return {
    file: null,
    preview: undefined,
    uploadUrl: undefined,
    fileName: undefined,
    isUploading: false,
    uploadProgress: 0,
    error: undefined,
  };
}

/** Slot after a successful upload resolves to a remote URL. */
export function buildUploadedSlot(prev: PhotoSlot, url: string): PhotoSlot {
  return {
    ...prev,
    file: null,
    uploadUrl: url,
    preview: url,
    isUploading: false,
    uploadProgress: 100,
    error: undefined,
  };
}
