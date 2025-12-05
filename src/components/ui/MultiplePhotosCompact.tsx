'use client';

import React from 'react';
import { Image, Plus, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnterprisePhotoUpload } from './EnterprisePhotoUpload';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import { PHOTO_STYLES, PHOTO_SIZES, PHOTO_TEXT_COLORS, PHOTO_COLORS } from '@/components/generic/config/photo-dimensions';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PhotoSlot {
  file: File | null;
  preview?: string;
  uploadUrl?: string;
  fileName?: string;
  isUploading: boolean;
  uploadProgress: number;
  error?: string;
}

export interface MultiplePhotosCompactProps {
  /** Normalized photos array */
  normalizedPhotos: PhotoSlot[];
  /** Maximum number of photos */
  maxPhotos: number;
  /** Current cache busting key */
  photosKey: number;
  /** Add cache buster to URLs */
  addCacheBuster: (url: string | undefined) => string | undefined;
  /** Purpose of photos (logo, representative, etc.) */
  purpose?: string;
  /** Upload handler */
  uploadHandler?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>;
  /** File selection handler */
  handleFileSelection: (slotIndex: number, file: File | null) => Promise<void>;
  /** Upload complete handler */
  handleUploadComplete: (slotIndex: number, result: FileUploadResult) => void;
  /** Create upload handler with index */
  createUploadHandlerWithIndex: (photoIndex: number) => (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>;
  /** Multiple drop handler */
  handleMultipleDrop: (e: React.DragEvent) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Show progress indicators */
  showProgress?: boolean;
  /** Custom className */
  className?: string;
  /** Show profile selector */
  showProfileSelector?: boolean;
  /** Selected profile photo index */
  selectedProfilePhotoIndex?: number;
  /** Profile photo selection callback */
  onProfilePhotoSelection?: (index: number) => void;
}

// ============================================================================
// MULTIPLE PHOTOS COMPACT COMPONENT
// ============================================================================

/**
 * Multiple Photos Upload - Compact Mode
 *
 * Εξήχθη από MultiplePhotosUpload.tsx για component separation.
 * Χειρίζεται το compact rendering mode για multiple photos.
 *
 * Features:
 * - Compact grid layout (3x2 για photos, centered για logo)
 * - Dynamic header text based on purpose και maxPhotos
 * - Multiple drop zone για bulk upload
 * - Profile photo selector integration
 * - Cache busting με unique keys
 * - Enterprise photo upload με progress tracking
 *
 * Usage:
 * ```tsx
 * <MultiplePhotosCompact
 *   normalizedPhotos={normalizedPhotos}
 *   maxPhotos={maxPhotos}
 *   photosKey={photosKey}
 *   addCacheBuster={addCacheBuster}
 *   purpose={purpose}
 *   handleFileSelection={handleFileSelection}
 *   handleMultipleDrop={handleMultipleDrop}
 *   disabled={disabled}
 * />
 * ```
 */
export function MultiplePhotosCompact({
  normalizedPhotos,
  maxPhotos,
  photosKey,
  addCacheBuster,
  purpose,
  uploadHandler,
  handleFileSelection,
  handleUploadComplete,
  createUploadHandlerWithIndex,
  handleMultipleDrop,
  disabled,
  showProgress,
  className = '',
  showProfileSelector = false,
  selectedProfilePhotoIndex,
  onProfilePhotoSelection
}: MultiplePhotosCompactProps) {

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

  // ========================================================================
  // RENDER
  // ========================================================================

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
                      className="absolute bottom-1 right-1 h-6 w-6 p-0"
                      onClick={() => onProfilePhotoSelection?.(index)}
                    >
                      <Star className={`h-3 w-3 ${selectedProfilePhotoIndex === index ? 'fill-current' : ''}`} />
                    </Button>
                  </div>
                ) : (
                  <div className="w-full h-20 bg-gray-100 rounded border flex items-center justify-center">
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

export default MultiplePhotosCompact;