'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Camera, Upload, X, CheckCircle, Loader2, AlertCircle, Plus, Image } from 'lucide-react';
import { EnterprisePhotoUpload } from './EnterprisePhotoUpload';
import { PhotoUploadService } from '@/services/photo-upload.service';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PhotoSlot {
  file?: File | null;
  preview?: string;
  uploadUrl?: string;
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
  purpose = 'photo'
}: MultiplePhotosUploadProps) {
  // ========================================================================
  // STATE
  // ========================================================================

  // Ensure photos array has the correct length
  const normalizedPhotos = React.useMemo(() => {
    const result = [...photos];
    while (result.length < maxPhotos) {
      result.push({});
    }
    return result.slice(0, maxPhotos);
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
        uploadProgress: progress.percentage,
        error: undefined
      };
      onPhotosChange?.(newPhotos);
    }
  }, [normalizedPhotos, onPhotosChange]);

  /**
   * Handle upload completion for a specific slot
   */
  const handleUploadComplete = useCallback((slotIndex: number, result: FileUploadResult) => {
    const newPhotos = [...normalizedPhotos];
    if (newPhotos[slotIndex]) {
      newPhotos[slotIndex] = {
        ...newPhotos[slotIndex],
        uploadUrl: result.url,
        isUploading: false,
        uploadProgress: 100,
        error: undefined
      };
      onPhotosChange?.(newPhotos);

      if (onPhotoUploadComplete) {
        onPhotoUploadComplete(slotIndex, result);
      }
    }
  }, [normalizedPhotos, onPhotosChange, onPhotoUploadComplete]);

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
          console.log(`🚀📸 Starting auto-upload for slot ${slotIndex + 1}:`, file.name);

          const result = await uploadHandler(file, (progress) => {
            handleUploadProgress(slotIndex, progress);
          });

          console.log(`✅📸 Auto-upload completed for slot ${slotIndex + 1}:`, result.url);
          handleUploadComplete(slotIndex, result);
        } catch (error) {
          console.error(`❌📸 Auto-upload failed for slot ${slotIndex + 1}:`, error);
          const errorPhotos = [...normalizedPhotos];
          errorPhotos[slotIndex] = {
            ...errorPhotos[slotIndex],
            isUploading: false,
            error: 'Upload failed'
          };
          onPhotosChange?.(errorPhotos);
        }
      }
    } else {
      // Clear slot
      if (newPhotos[slotIndex].preview && newPhotos[slotIndex].preview?.startsWith('blob:')) {
        URL.revokeObjectURL(newPhotos[slotIndex].preview!);
      }
      newPhotos[slotIndex] = {};
      onPhotosChange?.(newPhotos);
    }
  }, [normalizedPhotos, maxPhotos, onPhotosChange, uploadHandler, handleUploadProgress, handleUploadComplete]);

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
        console.log(`🎯📸 Drop upload for slot ${i + 1}:`, file.name);
        handleFileSelection(i, file); // This will auto-upload
        fileIndex++;
      }
    }
  }, [disabled, normalizedPhotos, maxPhotos, handleFileSelection]);

  /**
   * Default enterprise upload handler
   */
  const defaultUploadHandler = useCallback(async (
    file: File,
    onProgress: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> => {
    console.log('🚀📸 MULTIPLE: Starting enterprise upload με compression...', {
      fileName: file.name,
      purpose
    });

    const result = await PhotoUploadService.uploadContactPhoto(
      file,
      undefined, // contactId - θα προστεθεί αργότερα
      onProgress,
      'profile-modal' // Smart compression για multiple photos
    );

    console.log('✅📸 MULTIPLE: Enterprise upload completed:', {
      url: result.url,
      savings: result.compressionInfo?.compressionRatio
    });

    return result;
  }, [purpose]);

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const usedSlots = normalizedPhotos.filter(photo => photo.file || photo.uploadUrl).length;
  const availableSlots = maxPhotos - usedSlots;

  // ========================================================================
  // RENDER
  // ========================================================================

  if (compact) {
    return (
      <div className={`space-y-3 ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Image className="w-4 h-4" />
            Φωτογραφίες ({usedSlots}/{maxPhotos})
          </h4>
        </div>

        {/* Compact Grid */}
        <div className="grid grid-cols-5 gap-2">
          {normalizedPhotos.map((photo, index) => (
            <div key={index} className="aspect-square">
              <EnterprisePhotoUpload
                purpose={purpose}
                maxSize={5 * 1024 * 1024} // 5MB
                photoFile={photo.file}
                photoPreview={photo.preview || photo.uploadUrl}
                onFileChange={(file) => handleFileSelection(index, file)}
                uploadHandler={uploadHandler || defaultUploadHandler}
                onUploadComplete={(result) => handleUploadComplete(index, result)}
                disabled={disabled}
                compact={true}
                showProgress={showProgress}
                className="h-full"
              />
            </div>
          ))}
        </div>

        {/* Multiple Drop Zone */}
        {availableSlots > 0 && (
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer transition-colors hover:border-gray-400 bg-gray-50"
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
            <Plus className="w-4 h-4 mx-auto mb-1 text-gray-400" />
            <p className="text-xs text-gray-500">
              Προσθήκη {availableSlots} ακόμη
            </p>
          </div>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="border-t pt-4 mt-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Image className="w-4 h-4" />
            Φωτογραφίες ({usedSlots}/{maxPhotos})
          </h4>
          {availableSlots > 0 && (
            <span className="text-xs text-gray-500">
              Μπορείτε να προσθέσετε {availableSlots} ακόμη φωτογραφίες
            </span>
          )}
        </div>
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {normalizedPhotos.map((photo, index) => (
          <div key={index} className="aspect-square">
            <EnterprisePhotoUpload
              purpose={purpose}
              maxSize={5 * 1024 * 1024} // 5MB
              photoFile={photo.file}
              photoPreview={photo.preview || photo.uploadUrl}
              onFileChange={(file) => handleFileSelection(index, file)}
              uploadHandler={uploadHandler || defaultUploadHandler}
              onUploadComplete={(result) => handleUploadComplete(index, result)}
              disabled={disabled}
              compact={true}
              showProgress={showProgress}
              className="h-full"
            />
          </div>
        ))}
      </div>

      {/* Multiple Upload Zone */}
      {availableSlots > 0 && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-gray-400"
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
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600 mb-1">
            Σύρετε πολλαπλές φωτογραφίες εδώ ή κάντε κλικ
          </p>
          <p className="text-xs text-gray-500">
            Μπορείτε να προσθέσετε {availableSlots} ακόμη φωτογραφίες (JPG, PNG - μέχρι 5MB η καθεμία)
          </p>
        </div>
      )}
    </div>
  );
}

export default MultiplePhotosUpload;