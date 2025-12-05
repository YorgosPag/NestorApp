'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Camera, Upload, X, CheckCircle, Loader2, AlertCircle, Plus, Image, Star, StarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EnterprisePhotoUpload } from './EnterprisePhotoUpload';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import { PHOTO_STYLES, PHOTO_SIZES, PHOTO_TEXT_COLORS, PHOTO_COLORS } from '@/components/generic/config/photo-dimensions';

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
  // STATE
  // ========================================================================

  // 🔥 FORCE RE-RENDER: Key-based invalidation για cache busting
  const [photosKey, setPhotosKey] = React.useState(0);

  // Listen για force re-render events
  React.useEffect(() => {
    const handleForceRerender = (event: CustomEvent) => {
      console.log('🔄 MULTIPLE PHOTOS: Force re-rendering photos due to cache invalidation');

      // 🔥 NUCLEAR CACHE CLEAR: Εξαναγκασμένη εκκαθάριση browser image cache
      // Αυτό καλύπτει περιπτώσεις όπου το cache buster δεν επαρκεί
      if (typeof window !== 'undefined') {
        // ΔΙΑΓΝΩΣΤΙΚΑ: Δες όλες τις εικόνες στη σελίδα
        const allImages = document.querySelectorAll('img');
        console.log('🔍 DEBUG: Found', allImages.length, 'total images in page');

        allImages.forEach((img: any, index) => {
          console.log(`🔍 Image ${index}:`, {
            src: img.src,
            isFirebase: img.src.includes('firebasestorage'),
            isBlob: img.src.startsWith('blob:'),
            isData: img.src.startsWith('data:')
          });
        });

        // Κλείσιμο όλων των Firebase images από το browser memory
        const firebaseImages = document.querySelectorAll('img[src*="firebasestorage"]');
        const blobImages = document.querySelectorAll('img[src^="blob:"]');
        const dataImages = document.querySelectorAll('img[src^="data:"]');

        console.log('🔍 DEBUG: Firebase images:', firebaseImages.length);
        console.log('🔍 DEBUG: Blob images:', blobImages.length);
        console.log('🔍 DEBUG: Data images:', dataImages.length);

        // Clear ΜΟΝΟ τις εικόνες που είναι ΜΕΣΑ στο MultiplePhotosUpload grid
        const gridContainer = document.querySelector('[class*="grid-cols-3"]');
        if (gridContainer) {
          const gridImages = gridContainer.querySelectorAll('img');
          gridImages.forEach((img: any) => {
            const originalSrc = img.src;
            console.log('🔥 Clearing grid image:', originalSrc.substring(0, 50));

            // NUCLEAR CLEAR: Διαγραφή όλων των attributes
            img.removeAttribute('src');
            img.removeAttribute('alt');
            img.src = '';
            img.alt = '';

            // Force DOM update
            img.style.display = 'none';
            setTimeout(() => {
              img.style.display = '';
              // ΜΗΝ reload - αφήνε άδειο!
            }, 50);
          });
          console.log('🔥 NUCLEAR CACHE: TOTAL CLEAR of', gridImages.length, 'grid images (no reload)');
        } else {
          console.log('🔥 NUCLEAR CACHE: Grid container not found - no clearing done');
        }

        console.log('🔥 NUCLEAR CACHE: Force reloaded', firebaseImages.length + blobImages.length + dataImages.length, 'images total');
      }

      setPhotosKey(prev => prev + 1); // Force re-render με νέο key
    };

    window.addEventListener('forceAvatarRerender', handleForceRerender as EventListener);
    return () => {
      window.removeEventListener('forceAvatarRerender', handleForceRerender as EventListener);
    };
  }, []);

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

  // ========================================================================
  // HANDLERS
  // ========================================================================

  /**
   * Handle upload progress update for a specific slot
   */
  const handleUploadProgress = useCallback((slotIndex: number, progress: FileUploadProgress) => {
    const newPhotos = [...normalizedPhotos];
    if (newPhotos[slotIndex]) {
      newPhotos[slotIndex] = {
        ...newPhotos[slotIndex],
        isUploading: true,
        uploadProgress: progress.progress,
        error: undefined
      };
      onPhotosChange?.(newPhotos);
    }
  }, [normalizedPhotos, onPhotosChange]);

  /**
   * Handle upload completion for a specific slot
   */
  const handleUploadComplete = useCallback((slotIndex: number, result: FileUploadResult) => {
    console.log('🔍 MULTIPLE PHOTOS: handleUploadComplete called with:', {
      slotIndex,
      resultUrl: result.url,
      resultSuccess: result.success,
      currentPhotosLength: normalizedPhotos.length
    });

    const newPhotos = [...normalizedPhotos];

    // ✅ SUCCESS CASE: Update the slot with Firebase Storage URL
    if (result.url && result.url.trim() !== '') {
      console.log('✅ MULTIPLE PHOTOS: Upload success - updating slot', slotIndex, 'with URL:', result.url.substring(0, 50) + '...');

      if (newPhotos[slotIndex]) {
        const updatedPhoto = {
          ...newPhotos[slotIndex],
          uploadUrl: result.url,
          isUploading: false,
          uploadProgress: 100,
          error: undefined
        };

        newPhotos[slotIndex] = updatedPhoto;

        console.log('✅ MULTIPLE PHOTOS: Slot updated, calling onPhotosChange with', newPhotos.length, 'photos');
        onPhotosChange?.(newPhotos);

        if (onPhotoUploadComplete) {
          onPhotoUploadComplete(slotIndex, result);
        }
      }
      return;
    }

    // 🔧 REMOVAL CASE: Handle photo removal (empty URL + isRemoval flag)
    if ((!result.url || result.url.trim() === '') && (result as any).isRemoval) {
      console.log('🗑️ MULTIPLE PHOTOS: Photo removal confirmed for slot', slotIndex);

      // Photo already cleared in handleFileSelection - just notify parent
      if (onPhotoUploadComplete) {
        onPhotoUploadComplete(slotIndex, result);
      }
      return;
    }

    // 🚨 FAILURE CASE: Handle failed uploads (empty URL without removal flag)
    if (!result.url || result.url.trim() === '') {
      console.error('❌ MULTIPLE PHOTOS: Upload failed - no URL returned for slot', slotIndex);

      // Mark slot as failed
      if (newPhotos[slotIndex]) {
        newPhotos[slotIndex] = {
          ...newPhotos[slotIndex],
          isUploading: false,
          uploadProgress: 0,
          error: 'Αποτυχία ανεβάσματος'
        };
        onPhotosChange?.(newPhotos);
      }

      if (onPhotoUploadComplete) {
        onPhotoUploadComplete(slotIndex, result);
      }
      return;
    }

    // 🚨 This should never happen as the previous conditions handle all cases
  }, [normalizedPhotos]);

  /**
   * Handle file selection for a specific slot
   */
  const handleFileSelection = useCallback(async (slotIndex: number, file: File | null) => {
    if (slotIndex < 0 || slotIndex >= maxPhotos) return;

    const newPhotos = [...normalizedPhotos];
    if (file) {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      newPhotos[slotIndex] = {
        file,
        preview: previewUrl,
        uploadUrl: undefined,
        isUploading: true,
        uploadProgress: 0,
        error: undefined
      };

      // Update state immediately
      onPhotosChange?.(newPhotos);

      // Start upload automatically if uploadHandler is available
      if (uploadHandler) {
        try {

          const result = await uploadHandler(file, (progress) => {
            handleUploadProgress(slotIndex, progress);
          });

          handleUploadComplete(slotIndex, result);
        } catch (error) {
          console.error(`❌📸 Auto-upload failed for slot ${slotIndex + 1}:`, error);
          console.error(`📋 MULTIPLE: Error details:`, {
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorStack: error instanceof Error ? error.stack : undefined,
            fileName: file.name,
            fileSize: file.size,
            slotIndex,
            uploadHandlerExists: !!uploadHandler
          });

          const errorPhotos = [...normalizedPhotos];
          errorPhotos[slotIndex] = {
            ...errorPhotos[slotIndex],
            isUploading: false,
            error: error instanceof Error ? error.message : 'Upload failed'
          };
          onPhotosChange?.(errorPhotos);
        }
      }
    } else {
      // Clear slot
      if (newPhotos[slotIndex].preview && newPhotos[slotIndex].preview?.startsWith('blob:')) {
        URL.revokeObjectURL(newPhotos[slotIndex].preview!);
      }

      // 🏢 ENTERPRISE CLEANUP: Delete Firebase Storage file if exists
      const currentPhoto = newPhotos[slotIndex];
      if (currentPhoto.uploadUrl) {
        console.log('🧹 ENTERPRISE CLEANUP: Starting cleanup for slot', slotIndex, 'URL:', currentPhoto.uploadUrl.substring(0, 50) + '...');

        // Dynamic import για enterprise cleanup
        import('@/services/photo-upload.service')
          .then(({ PhotoUploadService }) => {
            return PhotoUploadService.deletePhotoByURL(currentPhoto.uploadUrl!);
          })
          .then(() => {
            console.log('✅ ENTERPRISE CLEANUP: Successfully deleted Firebase Storage file');
          })
          .catch((error) => {
            console.warn('⚠️ ENTERPRISE CLEANUP: Failed to delete Firebase Storage file:', error);
            // Non-blocking error - continues with slot clearing
          });
      }

      // ΚΡΙΣΙΜΟ: Καθαρισμός slot με πλήρη null values
      newPhotos[slotIndex] = {
        file: null,
        preview: undefined,
        uploadUrl: undefined,
        fileName: undefined,
        isUploading: false,
        uploadProgress: 0,
        error: undefined
      };

      onPhotosChange?.(newPhotos);

      // ΚΡΙΣΙΜΟ: Καλούμε το onUploadComplete με removal flag για να καθαρίσει και το parent state
      if (onPhotoUploadComplete) {
        onPhotoUploadComplete(slotIndex, {
          success: true,
          url: '',
          fileName: '',
          fileSize: 0,
          mimeType: '',
          isRemoval: true // 🔧 FIX: Flag to indicate this is a removal, not a failed upload
        });
      }
    }
  }, [normalizedPhotos, maxPhotos, uploadHandler, onPhotosChange, onPhotoUploadComplete]);

  /**
   * Handle multiple files drop
   */
  const handleMultipleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('image/')
    );

    if (files.length === 0) return;

    // Find available slots and upload each file
    let fileIndex = 0;
    for (let i = 0; i < maxPhotos && fileIndex < files.length; i++) {
      if (!normalizedPhotos[i].file && !normalizedPhotos[i].uploadUrl) {
        const file = files[fileIndex];
        handleFileSelection(i, file); // This will auto-upload
        fileIndex++;
      }
    }
  }, [disabled, normalizedPhotos, maxPhotos, handleFileSelection]);

  /**
   * Firebase Storage upload handler (ENTERPRISE SOLUTION)
   * 🚀 ΝΕΟΣ ENTERPRISE ΤΡΟΠΟΣ: Firebase Storage με unlimited capacity
   */
  const defaultUploadHandler = useCallback(async (
    file: File,
    onProgress: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> => {

    console.log('🚀 FIREBASE STORAGE: Starting upload with PhotoUploadService');

    try {
      // 🔥 ENTERPRISE: Use existing PhotoUploadService για Firebase Storage
      const { PhotoUploadService } = await import('@/services/photo-upload.service');

      // 🏢 ENTERPRISE: Use uploadPhoto with contact data για FileNamingService
      const result = await PhotoUploadService.uploadPhoto(
        file,
        {
          folderPath: 'contacts/photos',
          onProgress,
          enableCompression: true,
          compressionUsage: purpose === 'logo' ? 'company-logo' : 'profile-modal',
          contactData: contactData, // Pass contact data για FileNamingService
          purpose: purpose,
          photoIndex: undefined // Will be handled by server-side
        }
      );

      console.log('✅ FIREBASE STORAGE: Upload completed successfully:', {
        originalFileName: file.name,
        uploadedURL: result.url.substring(0, 100) + '...',
        fileSize: result.fileSize,
        storagePath: result.storagePath,
        compressionApplied: result.compressionInfo?.wasCompressed || false
      });

      // Return in the format expected by MultiplePhotosUpload
      return {
        success: true,
        url: result.url,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType
      };

    } catch (error) {
      console.error('❌📸 FIREBASE STORAGE: Upload failed:', error);
      throw error;
    }
  }, [purpose, contactData]);

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
            // 🔥 FORCE RE-RENDER: Key-based cache busting αντί για Date.now()
            const rawPreview = photo.preview || photo.uploadUrl;
            const photoPreviewWithCacheBuster = rawPreview &&
              rawPreview.startsWith('https://firebasestorage')
                ? `${rawPreview}?v=${photosKey}`
                : rawPreview;

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
                  uploadHandler={uploadHandler || defaultUploadHandler}
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
                uploadHandler={uploadHandler || defaultUploadHandler}
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