'use client';

import React from 'react';
import { Image, Upload } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { EnterprisePhotoUpload } from './EnterprisePhotoUpload';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import {
  PHOTO_SIZES,
  PHOTO_TEXT_COLORS,
  PHOTO_COLORS,
  PHOTO_LAYOUTS,
  PHOTO_BORDERS,
  PHOTO_COMBINED_EFFECTS
} from '@/components/generic/config/photo-config';
import { layoutUtilities } from '@/styles/design-tokens';

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
  /** Upload complete handler */
  handleUploadComplete?: (slotIndex: number, result: FileUploadResult) => void;
  /** Photos change callback to update parent state */
  onPhotosChange?: (photos: any[]) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Show progress indicators */
  showProgress?: boolean;
  /** Custom className */
  className?: string;
  /** 🔥 RESTORED: Contact data for FileNamingService */
  contactData?: any;
  /** 🏢 ENTERPRISE: Photo click handler για gallery preview */
  onPhotoClick?: (index: number) => void;
  /** Show photos even when component is disabled (for read-only views) */
  showPhotosWhenDisabled?: boolean;
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
  handleUploadComplete,
  onPhotosChange,
  disabled,
  showProgress,
  className = '',
  contactData,
  onPhotoClick,
  showPhotosWhenDisabled = false
}: MultiplePhotosFullProps) {
  const iconSizes = useIconSizes();

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

  // 🎯 Multiple drop handler για bulk upload
  const handleMultipleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('image/')
    );

    if (files.length === 0) return;

    // Βρίσκουμε empty slots για τα νέα αρχεία
    const newPhotos = [...normalizedPhotos];
    let slotIndex = 0;

    for (const file of files) {
      // Βρίσκουμε το επόμενο κενό slot
      while (slotIndex < maxPhotos && (newPhotos[slotIndex].file || newPhotos[slotIndex].uploadUrl)) {
        slotIndex++;
      }

      // Αν έχουμε φτάσει το όριο, σταματάμε
      if (slotIndex >= maxPhotos) break;

      // Προσθέτουμε το αρχείο στο slot
      newPhotos[slotIndex] = {
        ...newPhotos[slotIndex],
        file,
        preview: URL.createObjectURL(file),
        isUploading: false,
        uploadProgress: 0
      };

      slotIndex++;
    }

    // Ενημερώνουμε το parent component
    if (onPhotosChange) {
      onPhotosChange(newPhotos);
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  console.log('📸 MultiplePhotosFull: Rendering with', normalizedPhotos.length, 'slots');

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header αφαιρέθηκε - δεν θέλουμε το "Φωτογραφία" text και Image icon */}

      {/* Photo Grid - 3x2 Layout */}
      <div className={PHOTO_LAYOUTS.INDIVIDUAL_GRID.container}>
        {normalizedPhotos.map((photo, index) => {
          // 🎯 MOBILE + DESKTOP FIX: Calculate responsive style first
          const responsiveStyle = {
            // Mobile: Fixed 240x320 (3:4 ratio - πιο ψηλά)
            width: '240px',
            height: '320px',
            minWidth: '240px',
            minHeight: '320px',
            maxWidth: '240px',
            maxHeight: '320px'
          };

          // Desktop media query override - Force exact 3:4 ratio
          const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 640;
          if (isDesktop) {
            responsiveStyle.width = '100%';
            responsiveStyle.height = 'auto'; // Let aspect-ratio control height
            responsiveStyle.aspectRatio = '3/4'; // Force exact 3:4 ratio (πιο ψηλά)
            responsiveStyle.minWidth = 'auto';
            responsiveStyle.maxWidth = 'none';
            responsiveStyle.minHeight = 'auto';
            responsiveStyle.maxHeight = 'none';
          }

          // 🚨 CRITICAL: Skip filtering that changes indexes! Always render exactly 6 slots
          if (disabled && !showPhotosWhenDisabled && !photo.file && !photo.uploadUrl) {
            // Render empty slot placeholder in disabled mode
            return (
              <div
                key={`full-empty-slot-${index}-${photosKey}`}
                className="overflow-hidden flex-shrink-0 mx-auto opacity-50"
                style={responsiveStyle}
              >
                <div className="w-full h-full bg-gray-100 rounded-lg"></div>
              </div>
            );
          }

          // 🔥 CACHE BUSTING: Using extracted hook
          const rawPreview = photo.preview || photo.uploadUrl;
          const photoPreviewWithCacheBuster = addCacheBuster(rawPreview);

          return (
            <div
              key={`full-photo-slot-${index}-${photosKey}`}
              className="overflow-hidden flex-shrink-0 mx-auto"
              style={responsiveStyle}
            >
              <EnterprisePhotoUpload
                key={`full-enterprise-slot-${index}-${photosKey}`}
                purpose={purpose}
                maxSize={5 * 1024 * 1024} // 5MB
                photoFile={photo.file}
                photoPreview={photoPreviewWithCacheBuster}
                customFileName={photo.fileName} // 🔥 ΔΙΟΡΘΩΣΗ: Περνάμε το custom filename
                onFileChange={(file) => {
                  // 🚨 STOP INFINITE LOOPS: Only update if file actually changed
                  const currentFile = normalizedPhotos[index]?.file;
                  if (currentFile === file) {
                    console.log('📸 MultiplePhotosFull: SKIPPING - File unchanged for slot', index);
                    return;
                  }

                  console.log('📸 MultiplePhotosFull: File changed for slot', index, file?.name);
                  const newPhotos = [...normalizedPhotos];
                  newPhotos[index] = {
                    ...newPhotos[index],
                    file,
                    isUploading: false, // Reset upload state
                    uploadProgress: 0,
                    error: undefined
                  };
                  console.log('📸 MultiplePhotosFull: Calling onPhotosChange with', newPhotos.length, 'photos');
                  if (onPhotosChange) {
                    onPhotosChange(newPhotos);
                  }
                }}
                uploadHandler={uploadHandler}
                onUploadComplete={(result) => {
                  console.log('📸 MultiplePhotosFull: Upload completed for slot', index, result.success);
                  if (handleUploadComplete) {
                    handleUploadComplete(index, result);
                  }
                }}
                disabled={disabled}
                compact={true}
                showProgress={showProgress}
                isLoading={photo.isUploading}
                className="w-full h-full"
                contactData={contactData}
                photoIndex={index}
                onPreviewClick={() => {
                  // 🏢 ENTERPRISE: Photo click handler για gallery modal
                  if (photoPreviewWithCacheBuster && onPhotoClick) {
                    console.log('🖱️ MultiplePhotosFull: Photo clicked at index', index);
                    onPhotoClick(index);
                  }
                }}
// Enterprise standard - let EnterprisePhotoUpload handle uploads naturally
              />
            </div>
          );
        })}
      </div>

      {/* Multiple Upload Zone - Hidden for logo mode (maxPhotos=1) */}
      {availableSlots > 0 && maxPhotos > 1 && (
        <div
          className={`${PHOTO_BORDERS.EMPTY_STATE} rounded-lg flex items-center justify-center text-center cursor-pointer transition-colors ${PHOTO_BORDERS.EMPTY_HOVER} p-6 mt-8`}
          style={layoutUtilities.dxf.colors.backgroundColor(
            PHOTO_COLORS.EMPTY_STATE_BACKGROUND
          )}
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
          <Upload className={`${iconSizes.xl} ${PHOTO_TEXT_COLORS.MUTED} mx-auto mb-2`} />
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