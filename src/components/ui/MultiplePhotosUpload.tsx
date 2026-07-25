'use client';

import React from 'react';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';


import { useCacheBusting } from '@/hooks/useCacheBusting';
// Removed usePhotoSlotHandlers - using enterprise standard EnterprisePhotoUpload
import { MultiplePhotosCompact } from './MultiplePhotosCompact';
import { MultiplePhotosFull } from './MultiplePhotosFull';
import type { UploadPurpose } from '@/config/file-upload-config';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
// 🏢 ADR-596: canonical PhotoSlot (SSoT) — re-exported for API stability
import type { PhotoSlot, MultiplePhotosBaseProps } from './multiple-photos/photo-slot-types';

const logger = createModuleLogger('MultiplePhotosUpload');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

// 🔁 Public API stability — consumers import PhotoSlot from this module
export type { PhotoSlot } from './multiple-photos/photo-slot-types';

export interface MultiplePhotosUploadProps {
  /** Maximum number of photos allowed (default: 5) */
  maxPhotos?: number;
  /** Current photo slots */
  photos?: PhotoSlot[];
  /** Photo change handler */
  onPhotosChange?: (photos: PhotoSlot[]) => void;
  /** Upload completion handler for individual photos */
  onPhotoUploadComplete?: (index: number, result: FileUploadResult) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Custom upload handler */
  uploadHandler?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>;
  /** Custom CSS classes */
  className?: string;
  /** Show upload progress (default: true) */
  showProgress?: boolean;
  /** Compact mode (smaller UI) */
  compact?: boolean;
  /** Purpose for validation and compression */
  purpose?: UploadPurpose;
  /** Contact data for FileNamingService (optional) */
  contactData?: ContactFormData;
  /** 🆕 Profile selection props */
  showProfileSelector?: boolean;
  selectedProfilePhotoIndex?: number;
  onProfilePhotoSelection?: (index: number) => void;
  /** 🏢 ENTERPRISE: Photo click handler για gallery preview */
  onPhotoClick?: (index: number) => void;
  /** Show photos even when component is disabled (for read-only views) */
  showPhotosWhenDisabled?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Multiple Photos Upload Component
 *
 * Enterprise-class component για upload πολλαπλών φωτογραφιών (μέχρι 5).
 * Βασισμένο στο EnterprisePhotoUpload με προσθήκη multiple files support.
 *
 * Features:
 * - Upload μέχρι 5 φωτογραφίες
 * - Drag & drop support για πολλαπλά αρχεία
 * - Individual progress tracking ανά φωτογραφία
 * - Smart file validation και compression
 * - Elegant grid layout με compact mode
 * - Enterprise-class error handling
 */
export function MultiplePhotosUpload({
  maxPhotos = 5,
  photos = [],
  onPhotosChange,
  onPhotoUploadComplete,
  disabled = false,
  uploadHandler,
  className = '',
  showProgress = true,
  compact = false,
  purpose = 'photo',
  contactData,
  showProfileSelector = false,
  selectedProfilePhotoIndex,
  onProfilePhotoSelection,
  onPhotoClick,
  showPhotosWhenDisabled = false
}: MultiplePhotosUploadProps) {
  // ========================================================================
  // HOOKS
  // ========================================================================

  // 🔥 CACHE BUSTING: Extracted to dedicated hook
  const { photosKey, addCacheBuster, createCacheKey } = useCacheBusting();

  // Ensure photos array has the correct length
  const normalizedPhotos = React.useMemo(() => {
    // 🚨 CRITICAL: Force exactly maxPhotos slots, no more, no less!
    //
    // ⚠️ Κάθε κενό slot ΠΡΕΠΕΙ να είναι ΞΕΧΩΡΙΣΤΟ object. Παλαιότερα μοιράζονταν
    // ΕΝΑ κοινό `emptySlot` reference, οπότε κάθε αναζήτηση θέσης με object
    // identity (`findIndex(p => p === photo)`) επέστρεφε το ΙΔΙΟ index για όλα
    // τα κενά slots → λάθος `photoIndex` στο filename ΚΑΙ διπλά React keys →
    // απρόβλεπτο remount των cells → μηδενισμός των upload guards → διπλό upload.
    const result: PhotoSlot[] = [];
    for (let i = 0; i < maxPhotos; i++) {
      if (photos && photos[i] && (photos[i].file || photos[i].uploadUrl || photos[i].preview)) {
        result[i] = photos[i];
      } else {
        result[i] = { file: null, isUploading: false, uploadProgress: 0 };
      }
    }

    // Ensure exactly maxPhotos length - no overflow!
    return result.slice(0, maxPhotos);
  }, [photos, maxPhotos]);

  // Using enterprise standard EnterprisePhotoUpload - no additional handlers needed


  // ========================================================================
  // RENDER
  // ========================================================================

  // 🔥 COMPONENT SEPARATION: Using extracted render components.
  // 🏢 ADR-596: shared prop-forwarding bag → spread into both variants so the
  // near-identical prop list is not duplicated across the two return branches.
  const sharedProps: MultiplePhotosBaseProps = {
    normalizedPhotos,
    maxPhotos,
    photosKey,
    addCacheBuster,
    purpose,
    uploadHandler,
    handleUploadComplete: onPhotoUploadComplete,
    onPhotosChange,
    disabled,
    showProgress,
    className,
    contactData,
    onPhotoClick, // 🏢 ENTERPRISE: Photo click handler
    showPhotosWhenDisabled,
  };

  if (compact) {
    return (
      <MultiplePhotosCompact
        {...sharedProps}
        showProfileSelector={showProfileSelector}
        selectedProfilePhotoIndex={selectedProfilePhotoIndex}
        onProfilePhotoSelection={onProfilePhotoSelection}
      />
    );
  }

  // Full mode
  return <MultiplePhotosFull {...sharedProps} />;
}

export default MultiplePhotosUpload;
