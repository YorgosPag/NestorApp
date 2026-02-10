'use client';

import React from 'react';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';


import { useCacheBusting } from '@/hooks/useCacheBusting';
// Removed usePhotoSlotHandlers - using enterprise standard EnterprisePhotoUpload
import { MultiplePhotosCompact } from './MultiplePhotosCompact';
import { MultiplePhotosFull } from './MultiplePhotosFull';
import type { UploadPurpose } from '@/config/file-upload-config';
import type { ContactFormData } from '@/types/ContactFormTypes';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PhotoSlot {
  file?: File | null;
  preview?: string;
  uploadUrl?: string;
  fileName?: string; // 🔥 ΠΡΟΣΘΗΚΗ: Custom filename για εμφάνιση στο UI
  isUploading?: boolean;
  uploadProgress?: number;
  error?: string;
}

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
    const emptySlot: PhotoSlot = { file: null, isUploading: false, uploadProgress: 0 };

    // 🚨 CRITICAL: Force exactly maxPhotos slots, no more, no less!
    const result: PhotoSlot[] = [];
    for (let i = 0; i < maxPhotos; i++) {
      if (photos && photos[i] && (photos[i].file || photos[i].uploadUrl || photos[i].preview)) {
        result[i] = photos[i];
      } else {
        result[i] = emptySlot;
      }
    }

    console.log('📸 MultiplePhotosUpload: FORCED slots to exactly', maxPhotos, {
      originalLength: photos?.length || 0,
      resultLength: result.length,
      maxPhotos,
      overflow: (photos?.length || 0) > maxPhotos
    });

    // Ensure exactly maxPhotos length - no overflow!
    return result.slice(0, maxPhotos);
  }, [photos, maxPhotos]);

  // Using enterprise standard EnterprisePhotoUpload - no additional handlers needed


  // ========================================================================
  // RENDER
  // ========================================================================

  // 🔥 COMPONENT SEPARATION: Using extracted render components
  if (compact) {
    return (
      <MultiplePhotosCompact
        normalizedPhotos={normalizedPhotos}
        maxPhotos={maxPhotos}
        photosKey={photosKey}
        addCacheBuster={addCacheBuster}
        purpose={purpose}
        uploadHandler={uploadHandler}
        handleUploadComplete={onPhotoUploadComplete}
        onPhotosChange={onPhotosChange}
        disabled={disabled}
        showProgress={showProgress}
        className={className}
        showProfileSelector={showProfileSelector}
        selectedProfilePhotoIndex={selectedProfilePhotoIndex}
        onProfilePhotoSelection={onProfilePhotoSelection}
        contactData={contactData}
        onPhotoClick={onPhotoClick} // 🏢 ENTERPRISE: Photo click handler
        showPhotosWhenDisabled={showPhotosWhenDisabled}
      />
    );
  }

  // Full mode
  return (
    <MultiplePhotosFull
      normalizedPhotos={normalizedPhotos}
      maxPhotos={maxPhotos}
      photosKey={photosKey}
      addCacheBuster={addCacheBuster}
      purpose={purpose}
      uploadHandler={uploadHandler}
      handleUploadComplete={onPhotoUploadComplete}
      onPhotosChange={onPhotosChange}
      disabled={disabled}
      showProgress={showProgress}
      className={className}
      contactData={contactData}
      onPhotoClick={onPhotoClick} // 🏢 ENTERPRISE: Photo click handler
      showPhotosWhenDisabled={showPhotosWhenDisabled}
    />
  );
}

export default MultiplePhotosUpload;
