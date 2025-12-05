'use client';

import React from 'react';
import { Image, Upload } from 'lucide-react';
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

export interface MultiplePhotosFullProps {
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
}

// ============================================================================
// MULTIPLE PHOTOS FULL COMPONENT
// ============================================================================

/**
 * Multiple Photos Upload - Full Mode
 *
 * Εξήχθη από MultiplePhotosUpload.tsx για component separation.
 * Χειρίζεται το full rendering mode για multiple photos με detailed UI.
 *
 * Features:
 * - Full grid layout (3x2) με larger spacing
 * - Detailed header με subtext
 * - Large upload zone με detailed instructions
 * - Cache busting με unique keys
 * - Enterprise photo upload με progress tracking
 *
 * Usage:
 * ```tsx
 * <MultiplePhotosFull
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
export function MultiplePhotosFull({
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
  className = ''
}: MultiplePhotosFullProps) {

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
          // 🔥 CACHE BUSTING: Using extracted hook
          const rawPreview = photo.preview || photo.uploadUrl;
          const photoPreviewWithCacheBuster = addCacheBuster(rawPreview);

          return (
            <div key={`photo-${index}-${photosKey}-${photo.file?.name || photo.uploadUrl || 'empty'}`} className={PHOTO_SIZES.STANDARD_PREVIEW}>
              <EnterprisePhotoUpload
                key={`enterprise-${index}-${photosKey}-${Date.now()}`}
                purpose={purpose}
                maxSize={5 * 1024 * 1024} // 5MB
                photoFile={photo.file}
                photoPreview={photoPreviewWithCacheBuster}
                customFileName={photo.fileName} // 🔥 ΔΙΟΡΘΩΣΗ: Περνάμε το custom filename
                onFileChange={(file) => handleFileSelection(index, file)}
                uploadHandler={uploadHandler || createUploadHandlerWithIndex(index)}
                onUploadComplete={(result) => handleUploadComplete(index, result)}
                disabled={disabled}
                compact={false}
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

export default MultiplePhotosFull;