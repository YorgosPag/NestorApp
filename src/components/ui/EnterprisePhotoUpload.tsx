'use client';

import React, { useCallback, useEffect } from 'react';
import { Camera, Upload, X, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useEnterpriseFileUpload } from '@/hooks/useEnterpriseFileUpload';
import type { UseEnterpriseFileUploadConfig, FileUploadResult, FileUploadProgress } from '@/hooks/useEnterpriseFileUpload';
import { UI_COLORS } from '@/subapps/dxf-viewer/config/color-config';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface EnterprisePhotoUploadProps extends Omit<UseEnterpriseFileUploadConfig, 'fileType'> {
  /** Current photo file */
  photoFile?: File | null;
  /** Current photo preview URL */
  photoPreview?: string;
  /** Custom filename για εμφάνιση (όταν uploaded) */
  customFileName?: string;
  /** File change handler */
  onFileChange: (file: File | null) => void;
  /** Upload completion handler */
  onUploadComplete?: (result: FileUploadResult) => void;
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
  /** External loading state (για sync με parent state) */
  isLoading?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Enterprise Photo Upload Component
 *
 * Based on the most advanced upload system with enterprise features:
 * - Progress tracking with cancellation
 * - File validation with multiple checks
 * - Memory cleanup and error handling
 * - Drag & drop support
 * - Preview functionality
 * - Toast notifications
 *
 * Single source of truth for all photo/image uploads in the application.
 */
export function EnterprisePhotoUpload({
  purpose,
  maxSize,
  acceptedTypes,
  showToasts = true,
  photoFile,
  photoPreview,
  customFileName,
  onFileChange,
  onUploadComplete,
  disabled = false,
  uploadHandler,
  className = '',
  showProgress = true,
  compact = false,
  isLoading: externalIsLoading,
  contactData,
  photoIndex
}: EnterprisePhotoUploadProps) {
  // ========================================================================
  // HOOKS & STATE
  // ========================================================================

  const upload = useEnterpriseFileUpload({
    fileType: 'image',
    purpose,
    maxSize,
    acceptedTypes,
    showToasts,
    contactData,
    photoIndex
  });

  // ========================================================================
  // HANDLERS
  // ========================================================================

  /**
   * Handle file selection
   */
  const handleFileSelection = useCallback((file: File | null) => {
    if (!file) {
      onFileChange(null);
      upload.clearState();
      return;
    }

    // Validate and preview
    const validation = upload.validateAndPreview(file);
    if (validation.isValid) {
      onFileChange(file);
    }
  }, [upload]); // 🔧 FIX: Removed onFileChange to prevent infinite loop

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * Handle drop
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  }, [disabled, handleFileSelection]);

  /**
   * Handle click to select file
   */
  const handleClick = useCallback(() => {
    if (disabled) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0] || null;
      handleFileSelection(file);
    };
    input.click();
  }, [disabled, handleFileSelection]);

  /**
   * 🔥 AUTOMATIC UPLOAD: Start upload immediately when file is selected
   */
  // AUTO-UPLOAD: Εκτέλεση αμέσως μόλις επιλεγεί αρχείο
  useEffect(() => {
    if (!photoFile || upload.isUploading || upload.success) return;
    if (!uploadHandler && !onUploadComplete) return; // προστέθηκε για safety

    console.log('AUTO-UPLOAD STARTED', {
      hasFile: !!photoFile,
      fileName: photoFile.name,
      hasUploadHandler: !!uploadHandler,
      hasOnUploadComplete: !!onUploadComplete
    });

    const startUpload = async () => {
      try {
        const result = await upload.uploadFile(photoFile, uploadHandler);

        console.log('AUTO-UPLOAD FINISHED → result:', result);

        if (result?.success && onUploadComplete) {
          console.log('CALLING onUploadComplete WITH FULL RESULT');
          onUploadComplete(result); // ← ΟΛΟΚΛΗΡΟ OBJECT
        }
      } catch (err) {
        console.error('AUTO-UPLOAD FAILED', err);
      }
    };

    startUpload();
  }, [photoFile, upload.isUploading, upload.success, uploadHandler, onUploadComplete, upload]);

  /**
   * Handle remove photo
   */
  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    handleFileSelection(null);
  }, [handleFileSelection]);

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const currentPreview = photoPreview || upload.previewUrl;
  const currentFile = photoFile || upload.currentFile;
  const hasError = upload.error || upload.validationError;
  const isLoading = externalIsLoading ?? upload.isUploading;

  // Delete button visibility logic for compact mode

  // ========================================================================
  // RENDER
  // ========================================================================

  // Compact mode
  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-6 h-[280px] w-full flex flex-col items-center justify-center text-center cursor-pointer transition-colors overflow-hidden
            ${currentPreview ? 'border-green-300 bg-green-50' : `border-gray-300 hover:border-gray-400`}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${hasError ? 'border-red-300 bg-red-50' : ''}
          `}
          style={{
            backgroundColor: currentPreview ? undefined : UI_COLORS.UPLOAD_AREA_BG,
          }}
          onDrop={disabled ? undefined : handleDrop}
          onDragOver={disabled ? undefined : handleDragOver}
          onClick={disabled ? undefined : handleClick}
          onMouseEnter={(e) => {
            if (!currentPreview && !disabled) {
              e.currentTarget.style.backgroundColor = UI_COLORS.UPLOAD_AREA_BG_HOVER;
            }
          }}
          onMouseLeave={(e) => {
            if (!currentPreview && !disabled) {
              e.currentTarget.style.backgroundColor = UI_COLORS.UPLOAD_AREA_BG;
            }
          }}
        >
          {currentPreview ? (
            <div className="flex flex-col items-center justify-center w-full max-h-full">
              <div className="w-full h-[220px] rounded overflow-hidden bg-gray-200 shadow-sm mb-3">
                <img
                  src={currentPreview}
                  alt="Προεπισκόπηση"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center w-full">
                <p className="text-sm font-medium text-green-700"><CheckCircle className="w-4 h-4 inline mr-1" />{customFileName || currentFile?.name}</p>
                {/* 🔥 DEBUG: Explicit filename labels */}
                <p className="text-xs text-gray-500 mt-1">Original: {currentFile?.name || 'N/A'}</p>
                <p className="text-xs text-blue-500 mt-1">Custom: {customFileName || 'Generating...'}</p>
                {showProgress && isLoading && (
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <Camera className="w-12 h-12 text-gray-400 mb-3" />
              <span className="text-sm font-medium text-gray-500 mb-2">Προσθήκη φωτογραφίας</span>
              <span className="text-xs text-gray-400">Κλικ ή σύρετε αρχείο</span>
            </div>
          )}

          {/* Remove button */}
          {currentPreview && !disabled && !isLoading && (
            <button
              type="button"
              className="absolute top-1 right-1 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200 transition-colors"
              onClick={handleRemove}
              title="Αφαίρεση φωτογραφίας"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Error display */}
        {hasError && (
          <p className="text-xs text-red-600 mt-1">{hasError}</p>
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
            <Camera className="w-4 h-4" />
            {purpose === 'logo' ? 'Λογότυπο' : 'Φωτογραφία'}
            {isLoading && <span className="text-xs text-blue-600 ml-2">Ανεβαίνει αυτόματα...</span>}
          </h4>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors min-h-[120px] flex flex-col items-center justify-center
          ${currentPreview ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${hasError ? 'border-red-300 bg-red-50' : ''}
          ${isLoading ? 'pointer-events-none' : ''}
        `}
        style={{
          backgroundColor: currentPreview ? undefined : UI_COLORS.UPLOAD_AREA_BG,
          borderColor: currentPreview ? undefined : UI_COLORS.UPLOAD_AREA_BORDER,
        }}
        onDrop={disabled ? undefined : handleDrop}
        onDragOver={disabled ? undefined : handleDragOver}
        onClick={disabled || isLoading ? undefined : handleClick}
        onMouseEnter={(e) => {
          if (!currentPreview && !disabled && !isLoading) {
            e.currentTarget.style.backgroundColor = UI_COLORS.UPLOAD_AREA_BG_HOVER;
          }
        }}
        onMouseLeave={(e) => {
          if (!currentPreview && !disabled && !isLoading) {
            e.currentTarget.style.backgroundColor = UI_COLORS.UPLOAD_AREA_BG;
          }
        }}
      >
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-100 bg-opacity-75 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-blue-700">
                {upload.uploadPhase === 'upload' && 'Ανέβασμα...'}
                {upload.uploadPhase === 'processing' && 'Επεξεργασία...'}
                {upload.uploadPhase === 'complete' && 'Ολοκληρώθηκε!'}
              </p>
              {showProgress && (
                <div className="w-32 bg-gray-200 rounded-full h-2 mt-2 mx-auto">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview State */}
        {currentPreview ? (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 shadow-sm">
              <img
                src={currentPreview}
                alt="Προεπισκόπηση"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-green-700 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                {purpose === 'logo' ? 'Λογότυπο' : 'Φωτογραφία'} φορτώθηκε
              </p>
              <p className="text-xs text-green-600">{currentFile?.name}</p>
              <p className="text-xs text-gray-500 mt-1">Κάντε κλικ για αλλαγή</p>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div>
            {hasError ? (
              <>
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-red-700 mb-1">Σφάλμα επιλογής αρχείου</p>
                <p className="text-xs text-red-600">{hasError}</p>
              </>
            ) : (
              <>
                <Camera className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-200 mb-1">
                  Κάντε κλικ ή σύρετε {purpose === 'logo' ? 'λογότυπο' : 'φωτογραφία'} εδώ
                </p>
                <p className="text-xs text-gray-300">
                  Υποστηρίζονται JPG, PNG (μέγιστο {maxSize ? `${Math.round(maxSize / 1024 / 1024)}MB` : '5MB'})
                </p>
              </>
            )}
          </div>
        )}

        {/* Remove Button */}
        {currentPreview && !disabled && !isLoading && (
          <button
            type="button"
            className="absolute top-2 right-2 bg-red-100 text-red-600 rounded-full p-2 hover:bg-red-200 transition-colors"
            onClick={handleRemove}
            title={`Αφαίρεση ${purpose === 'logo' ? 'λογότυπου' : 'φωτογραφίας'}`}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Upload Actions */}
      {currentFile && !isLoading && upload.success && (
        <div className="text-center">
          <p className="text-sm text-green-600 flex items-center justify-center gap-1">
            <CheckCircle className="w-4 h-4" />
            Το {purpose === 'logo' ? 'λογότυπο' : 'φωτογραφία'} ανέβηκε επιτυχώς!
          </p>
        </div>
      )}

      {/* Cancel Upload */}
      {isLoading && (
        <div className="text-center">
          <button
            type="button"
            onClick={upload.cancelUpload}
            className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400 transition-colors"
          >
            Ακύρωση
          </button>
        </div>
      )}
    </div>
  );
}

export default EnterprisePhotoUpload;