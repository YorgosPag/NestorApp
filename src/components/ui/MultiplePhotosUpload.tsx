'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Camera, Upload, X, CheckCircle, Loader2, AlertCircle, Plus, Image, Star, StarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EnterprisePhotoUpload } from './EnterprisePhotoUpload';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import { PHOTO_STYLES, PHOTO_SIZES, PHOTO_TEXT_COLORS, PHOTO_COLORS } from '@/components/generic/config/photo-dimensions';
import { useCacheBusting } from '@/hooks/useCacheBusting';
// Removed usePhotoSlotHandlers - using enterprise standard EnterprisePhotoUpload
import { MultiplePhotosCompact } from './MultiplePhotosCompact';
import { MultiplePhotosFull } from './MultiplePhotosFull';

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
  purpose?: 'photo' | 'logo';
  /** Contact data for FileNamingService (optional) */
  contactData?: any;
  /** 🆕 Profile selection props */
  showProfileSelector?: boolean;
  selectedProfilePhotoIndex?: number;
  onProfilePhotoSelection?: (index: number) => void;
  /** 🏢 ENTERPRISE: Photo click handler για gallery preview */
  onPhotoClick?: (index: number) => void;
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
  onPhotoClick
}: MultiplePhotosUploadProps) {
  // ========================================================================
  // HOOKS
  // ========================================================================

  // 🔥 CACHE BUSTING: Extracted to dedicated hook
  const { photosKey, addCacheBuster, createCacheKey } = useCacheBusting();

  // Ensure photos array has the correct length
  const normalizedPhotos = React.useMemo(() => {
    const emptySlot = {};

    // 🔥 ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: ΑΝ photos είναι κενό array [], force clear όλα
    if (Array.isArray(photos) && photos.length === 0) {
      console.log('🛠️ MULTIPLE PHOTOS: Force clearing - received empty array');
      // Επιστρέφουμε μόνο empty slots
      return Array(maxPhotos).fill(emptySlot);
    }

    return photos.filter(Boolean).concat(Array(Math.max(0, maxPhotos - photos.filter(Boolean).length)).fill(emptySlot));
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
    />
  );
}

export default MultiplePhotosUpload;