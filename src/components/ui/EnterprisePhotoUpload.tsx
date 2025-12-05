'use client';

import React from 'react';
import { Camera, Loader2, AlertCircle } from 'lucide-react';
import { useEnterpriseFileUpload } from '@/hooks/useEnterpriseFileUpload';
import type { UseEnterpriseFileUploadConfig, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import { UI_COLORS } from '@/subapps/dxf-viewer/config/color-config';
import { PhotoPreview } from './utils/PhotoPreview';
import { usePhotoUploadLogic } from './utils/usePhotoUploadLogic';
import { PHOTO_STYLES, PHOTO_HEIGHTS, PHOTO_TEXT_COLORS, PHOTO_COLORS, PHOTO_HOVER_EFFECTS } from '@/components/generic/config/photo-dimensions';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface EnterprisePhotoUploadProps extends Omit<UseEnterpriseFileUploadConfig, 'fileType'> {
  /** Current photo file */
  photoFile?: File | null;
  /** Current photo preview URL */
  photoPreview?: string;
  /** File change handler */
  onFileChange: (file: File | null) => void;
  /** Upload completion handler */
  onUploadComplete?: (result: FileUploadResult) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Custom upload handler */
  uploadHandler?: (file: File, onProgress: (progress: any) => void) => Promise<FileUploadResult>;
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

  // 🔥 EXTRACTED: Photo upload logic (70+ lines extracted)
  const uploadLogic = usePhotoUploadLogic({
    photoFile,
    upload,
    onUploadComplete,
    uploadHandler,
    purpose
  });

  // ========================================================================
  // ENHANCED HANDLERS (WITH VALIDATION)
  // ========================================================================

  const handleFileSelectionWithValidation = (file: File | null) => {
    if (!file) {
      onFileChange(null);
      upload.clearState();
      return;
    }

    // Validate and preview
    const validation = upload.validateAndPreview(file);
    if (validation.isValid) {
      onFileChange(file);
      uploadLogic.handleFileSelection(file);
    }
  };

  const handleDropWithValidation = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelectionWithValidation(files[0]);
    }
  };

  const handleClickWithValidation = () => {
    if (disabled) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0] || null;
      handleFileSelectionWithValidation(file);
    };
    input.click();
  };

  const handleRemoveWithCleanup = (e: React.MouseEvent) => {
    onFileChange(null);
    uploadLogic.handleRemove(e);
  };

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const rawCurrentPreview = photoPreview || upload.previewUrl;

  // 🔍 DEBUG: Log photo display values
  React.useEffect(() => {
    console.log(`🔍 DEBUG EnterprisePhotoUpload [${purpose}]:`, {
      photoPreview,
      uploadPreviewUrl: upload.previewUrl,
      rawCurrentPreview,
      photoFile,
      currentFile: upload.currentFile,
      uploadSuccess: upload.success
    });
  }, [purpose, photoPreview, upload.previewUrl, rawCurrentPreview, photoFile, upload.currentFile, upload.success]);

  // 🔥 CONDITIONAL CACHE BUSTER: Μόνο όταν χρειάζεται (όχι πάντα)
  // ΠΡΟΒΛΗΜΑ: Browser cache κρατάει τις Firebase images για 1 χρόνο
  // ΛΥΣΗ: Cache buster μόνο όταν υπάρχει λόγος (π.χ. διαγραφή φωτογραφίας)
  // ΣΗΜΕΙΩΣΗ: Για τώρα κρατάμε το default - χρειάζεται smart logic εδώ
  const currentPreview = rawCurrentPreview;

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
            relative rounded-lg p-6 ${PHOTO_HEIGHTS.UPLOAD_ZONE} w-full flex flex-col items-center justify-center text-center cursor-pointer ${PHOTO_HOVER_EFFECTS.COLOR_TRANSITION} overflow-hidden
            ${currentPreview ? 'border-2 border-dashed border-green-300 bg-green-50' : PHOTO_STYLES.EMPTY_STATE}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${hasError ? 'border-red-300 bg-red-50' : ''}
          `}
          onDrop={disabled ? undefined : handleDropWithValidation}
          onDragOver={disabled ? undefined : uploadLogic.handleDragOver}
          onClick={disabled ? undefined : handleClickWithValidation}
        >
          {currentPreview ? (
            <PhotoPreview
              previewUrl={currentPreview}
              fileName={currentFile?.name}
              compact={true}
              purpose={purpose}
              onRemove={!disabled && !isLoading ? handleRemoveWithCleanup : undefined}
              onPreviewClick={handleClickWithValidation}
              disabled={disabled}
              className="w-full"
            />
          ) : (
            <div className="flex flex-col items-center justify-center">
              <Camera className={`w-12 h-12 ${PHOTO_TEXT_COLORS.MUTED} mb-3`} />
              <span className={`text-sm font-medium ${PHOTO_TEXT_COLORS.LIGHT_MUTED} mb-2`}>Προσθήκη φωτογραφίας</span>
              <span className={`text-xs ${PHOTO_TEXT_COLORS.MUTED}`}>Κλικ ή σύρετε αρχείο</span>
            </div>
          )}

          {/* Remove button handled by PhotoPreview component */}
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
          relative rounded-lg p-6 text-center cursor-pointer ${PHOTO_HOVER_EFFECTS.COLOR_TRANSITION} ${PHOTO_HEIGHTS.UPLOAD_MIN} flex flex-col items-center justify-center
          ${currentPreview ? 'border-2 border-dashed border-green-300 bg-green-50' : PHOTO_STYLES.EMPTY_STATE}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${hasError ? 'border-red-300 bg-red-50' : ''}
          ${isLoading ? 'pointer-events-none' : ''}
        `}
        onDrop={disabled ? undefined : handleDropWithValidation}
        onDragOver={disabled ? undefined : uploadLogic.handleDragOver}
        onClick={disabled || isLoading ? undefined : handleClickWithValidation}
      >
        {/* Loading State */}
        {isLoading && (
          <div className={`absolute inset-0 ${PHOTO_COLORS.LOADING_OVERLAY} flex items-center justify-center`}>
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-blue-700">
                {upload.uploadPhase === 'upload' && 'Ανέβασμα...'}
                {upload.uploadPhase === 'processing' && 'Επεξεργασία...'}
                {upload.uploadPhase === 'complete' && 'Ολοκληρώθηκε!'}
              </p>
              {showProgress && (
                <div className={`w-32 ${PHOTO_COLORS.PROGRESS_BACKGROUND} rounded-full h-2 mt-2 mx-auto`}>
                  <div
                    className={`bg-blue-600 h-2 rounded-full ${PHOTO_HOVER_EFFECTS.ALL_TRANSITION}`}
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview State */}
        {currentPreview ? (
          <PhotoPreview
            previewUrl={currentPreview}
            fileName={currentFile?.name}
            compact={false}
            purpose={purpose}
            onRemove={!disabled && !isLoading ? handleRemoveWithCleanup : undefined}
            onPreviewClick={handleClickWithValidation}
            disabled={disabled}
          />
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
                <Camera className={`w-12 h-12 ${PHOTO_TEXT_COLORS.ICON_LIGHT} mx-auto mb-2`} />
                <p className={`text-sm font-medium ${PHOTO_TEXT_COLORS.ICON_LIGHT} mb-1`}>
                  Κάντε κλικ ή σύρετε {purpose === 'logo' ? 'λογότυπο' : 'φωτογραφία'} εδώ
                </p>
                <p className={`text-xs ${PHOTO_TEXT_COLORS.ICON_LIGHT}`}>
                  Υποστηρίζονται JPG, PNG (μέγιστο {maxSize ? `${Math.round(maxSize / 1024 / 1024)}MB` : '5MB'})
                </p>
              </>
            )}
          </div>
        )}

        {/* Remove Button handled by PhotoPreview component */}
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
            className={`px-3 py-1 ${PHOTO_COLORS.CANCEL_BUTTON} ${PHOTO_TEXT_COLORS.LABEL} text-xs rounded ${PHOTO_HOVER_EFFECTS.CANCEL_BUTTON}`}
          >
            Ακύρωση
          </button>
        </div>
      )}
    </div>
  );
}

export default EnterprisePhotoUpload;