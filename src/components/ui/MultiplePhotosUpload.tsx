'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Camera, Upload, X, CheckCircle, Loader2, AlertCircle, Plus, Image, Star, StarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EnterprisePhotoUpload } from './EnterprisePhotoUpload';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import { PHOTO_STYLES, PHOTO_SIZES, PHOTO_TEXT_COLORS, PHOTO_COLORS } from '@/components/generic/config/photo-dimensions';
import { useCacheBusting } from '@/hooks/useCacheBusting';
import { usePhotoSlotHandlers } from '@/hooks/usePhotoSlotHandlers';

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
  onProfilePhotoSelection
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

  // 🔥 PHOTO SLOT HANDLERS: Extracted to dedicated hook
  const {
    handleUploadProgress,
    handleUploadComplete,
    handleFileSelection,
    handleMultipleDrop,
    createUploadHandlerWithIndex
  } = usePhotoSlotHandlers({
    normalizedPhotos,
    maxPhotos,
    uploadHandler,
    contactData,
    purpose,
    onPhotosChange,
    onPhotoUploadComplete,
    disabled
  });

  // ========================================================================
  // HANDLERS
  // ========================================================================





  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const usedSlots = normalizedPhotos.filter(photo => photo.file || photo.uploadUrl).length;
  const availableSlots = maxPhotos - usedSlots;

  // ========================================================================
  // HELPER FUNCTIONS
  // ========================================================================

  // 🎯 Δυναμικά κείμενα ανάλογα με purpose και maxPhotos
  const getHeaderText = () => {
    if (purpose === 'logo' && maxPhotos === 1) {
      return 'Λογότυπο';
    }
    return `Φωτογραφίες (${usedSlots}/${maxPhotos})`;
  };

  const getDragDropText = () => {
    if (purpose === 'logo' && maxPhotos === 1) {
      return 'Σύρετε το λογότυπο εδώ ή κάντε κλικ';
    }
    return 'Σύρετε πολλαπλές φωτογραφίες εδώ ή κάντε κλικ';
  };

  const getSubText = () => {
    if (purpose === 'logo' && maxPhotos === 1) {
      return 'Μόνο ένα λογότυπο (JPG, PNG - μέχρι 5MB)';
    }
    return `Μπορείτε να προσθέσετε ${availableSlots} ακόμη φωτογραφίες (JPG, PNG - μέχρι 5MB η καθεμία)`;
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  if (compact) {
    return (
      <div className={`space-y-3 ${className}`}>
        {/* Header - Centered for logo mode */}
        <div className={maxPhotos === 1 ? "flex justify-center" : "flex items-center justify-between"}>
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Image className="w-4 h-4" />
            {getHeaderText()}
          </h4>
        </div>

        {/* Compact Grid - Dynamic Layout */}
        <div className={maxPhotos === 1 ? "flex justify-center" : "grid grid-cols-3 gap-6 p-2"}>
          {normalizedPhotos.map((photo, index) => {
            // 🔥 CACHE BUSTING: Using extracted hook
            const rawPreview = photo.preview || photo.uploadUrl;
            const photoPreviewWithCacheBuster = addCacheBuster(rawPreview);

            const slotSize = maxPhotos === 1 ? "h-64 w-64" : PHOTO_SIZES.STANDARD_PREVIEW; // Square for logo, full width for photos

            return (
              <div key={`photo-${index}-${photosKey}-${photo.file?.name || photo.uploadUrl || 'empty'}`} className={slotSize}>
                <EnterprisePhotoUpload
                  key={`enterprise-${index}-${photosKey}-${Date.now()}`}
                  purpose={purpose}
                  maxSize={5 * 1024 * 1024} // 5MB
                  photoFile={photo.file}
                  photoPreview={photoPreviewWithCacheBuster}
                  onFileChange={(file) => handleFileSelection(index, file)}
                  uploadHandler={uploadHandler || createUploadHandlerWithIndex(index)}
                  onUploadComplete={(result) => handleUploadComplete(index, result)}
                  disabled={disabled}
                  compact={true}
                  showProgress={showProgress}
                  isLoading={photo.isUploading}
                  className={slotSize}
                />
              </div>
            );
          })}
        </div>

        {/* Multiple Drop Zone - Hidden for logo mode (maxPhotos=1) */}
        {availableSlots > 0 && maxPhotos > 1 && (
          <div
            className={`${PHOTO_STYLES.EMPTY_STATE} p-3`}
            style={{ backgroundColor: PHOTO_COLORS.EMPTY_STATE_BACKGROUND }}
            onDrop={handleMultipleDrop}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => {
              if (disabled) return;
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.multiple = true;
              input.onchange = (e) => {
                const files = Array.from((e.target as HTMLInputElement).files || []);
                if (files.length > 0) {
                  // Simulate drop event
                  const dropEvent = new DragEvent('drop', {
                    dataTransfer: new DataTransfer()
                  });
                  files.forEach(file => dropEvent.dataTransfer!.items.add(file));
                  handleMultipleDrop(dropEvent as any);
                }
              };
              input.click();
            }}
          >
            <Plus className={`w-4 h-4 mx-auto mb-1 ${PHOTO_TEXT_COLORS.MUTED}`} />
            <p className={`text-xs ${PHOTO_TEXT_COLORS.LIGHT_MUTED}`}>
              Προσθήκη {availableSlots} ακόμη
            </p>
          </div>
        )}

        {/* 🆕 ENTERPRISE: Profile Photo Selector για compact mode */}
        {showProfileSelector && availableSlots < maxPhotos && (
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              Επιλογή Φωτογραφίας Προφίλ
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {normalizedPhotos.map((photo, index) => (
                <div key={`profile-${index}`} className="relative">
                  {photo.preview || photo.uploadUrl ? (
                    <div className="relative">
                      <img
                        src={photo.preview || photo.uploadUrl}
                        alt={`Φωτογραφία ${index + 1}`}
                        className="w-full h-20 object-cover rounded border"
                      />
                      <Button
                        type="button"
                        variant={selectedProfilePhotoIndex === index ? "default" : "outline"}
                        size="sm"
                        className="absolute bottom-1 right-1 h-6 px-2 text-xs"
                        onClick={() => onProfilePhotoSelection?.(index)}
                        disabled={disabled}
                      >
                        {selectedProfilePhotoIndex === index ? (
                          <Star className="h-3 w-3 fill-current" />
                        ) : (
                          <StarIcon className="h-3 w-3" />
                        )}
                      </Button>
                      {selectedProfilePhotoIndex === index && (
                        <Badge className="absolute top-1 left-1 text-xs">Προφίλ</Badge>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`w-full h-20 ${PHOTO_STYLES.EMPTY_STATE}`}
                      style={{ backgroundColor: PHOTO_COLORS.EMPTY_STATE_BACKGROUND }}
                    >
                      <span className={`text-xs ${PHOTO_TEXT_COLORS.MUTED}`}>Κενό {index + 1}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header - Centered for logo mode */}
      <div className="border-t pt-4 mt-4">
        <div className={maxPhotos === 1 ? "flex justify-center" : "flex items-center justify-between"}>
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Image className="w-4 h-4" />
            {getHeaderText()}
          </h4>
          {availableSlots > 0 && maxPhotos > 1 && (
            <span className={`text-xs ${PHOTO_TEXT_COLORS.LIGHT_MUTED}`}>
{getSubText()}
            </span>
          )}
        </div>
      </div>

      {/* Photo Grid - 3x2 Layout */}
      <div className="grid grid-cols-3 gap-8 p-6">
        {normalizedPhotos.map((photo, index) => {
          // Photo state available in component props

          return (
            <div key={index} className={PHOTO_SIZES.STANDARD_PREVIEW}>
              <EnterprisePhotoUpload
                purpose={purpose}
                maxSize={5 * 1024 * 1024} // 5MB
                photoFile={photo.file}
                photoPreview={photo.preview || photo.uploadUrl}
                customFileName={photo.fileName} // 🔥 ΔΙΟΡΘΩΣΗ: Περνάμε το custom filename
                onFileChange={(file) => handleFileSelection(index, file)}
                uploadHandler={uploadHandler || createUploadHandlerWithIndex(index)}
                onUploadComplete={(result) => handleUploadComplete(index, result)}
                disabled={disabled}
                compact={true}
                showProgress={showProgress}
                isLoading={photo.isUploading}
                className={PHOTO_SIZES.STANDARD_PREVIEW}
              />
            </div>
          );
        })}
      </div>

      {/* Multiple Upload Zone - Hidden for logo mode (maxPhotos=1) */}
      {availableSlots > 0 && maxPhotos > 1 && (
        <div
          className={`${PHOTO_STYLES.EMPTY_STATE} p-6`}
          style={{ backgroundColor: PHOTO_COLORS.EMPTY_STATE_BACKGROUND }}
          onDrop={handleMultipleDrop}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onClick={() => {
            if (disabled) return;
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.multiple = true;
            input.onchange = (e) => {
              const files = Array.from((e.target as HTMLInputElement).files || []);
              if (files.length > 0) {
                // Simulate drop event
                const dropEvent = new DragEvent('drop', {
                  dataTransfer: new DataTransfer()
                });
                files.forEach(file => dropEvent.dataTransfer!.items.add(file));
                handleMultipleDrop(dropEvent as any);
              }
            };
            input.click();
          }}
        >
          <Upload className={`w-8 h-8 ${PHOTO_TEXT_COLORS.MUTED} mx-auto mb-2`} />
          <p className={`text-sm font-medium ${PHOTO_TEXT_COLORS.MEDIUM} mb-1`}>
{getDragDropText()}
          </p>
          <p className={`text-xs ${PHOTO_TEXT_COLORS.LIGHT_MUTED}`}>
{getSubText()}
          </p>
        </div>
      )}
    </div>
  );
}

export default MultiplePhotosUpload;