'use client';

/**
 * 🏢 ENTERPRISE: EnterprisePhotoUpload with full i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 */

import React, { useEffect } from 'react';
import { Camera, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useEnterpriseFileUpload } from '@/hooks/useEnterpriseFileUpload';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import type { UseEnterpriseFileUploadConfig, FileUploadResult, FileUploadProgress } from '@/hooks/useEnterpriseFileUpload';
import { UI_COLORS } from '@/subapps/dxf-viewer/config/color-config';
import { PhotoPreview } from './utils/PhotoPreview';
import { usePhotoUploadLogic } from './utils/usePhotoUploadLogic';
import { getDynamicBackgroundClass } from './utils/dynamic-styles';
import { layoutUtilities, performanceComponents } from '@/styles/design-tokens';
import {
  getProgressBarWidthStyles
} from '@/subapps/dxf-viewer/ui/DxfViewerComponents.styles';
import {
  PHOTO_HEIGHTS,
  PHOTO_TEXT_COLORS,
  PHOTO_COLORS,
  PHOTO_HOVER_EFFECTS,
  PHOTO_TYPOGRAPHY,
  PHOTO_SEMANTIC_COLORS,
  PHOTO_COMBINED_EFFECTS,
  PHOTO_BORDERS
} from '@/components/generic/config/photo-config';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  uploadHandler?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>;
  /** Custom CSS classes */
  className?: string;
  /** Show upload progress (default: true) */
  showProgress?: boolean;
  /** Compact mode (smaller UI) */
  compact?: boolean;
  /** External loading state (για sync με parent state) */
  isLoading?: boolean;
  /** 🔥 RESTORED: Contact data for FileNamingService */
  contactData?: Record<string, unknown>;
  /** 🔥 RESTORED: Photo index for FileNamingService */
  photoIndex?: number;
  /** 🔥 RESTORED: Custom filename override */
  customFileName?: string;
  /** Photo preview click handler (for gallery modal) */
  onPreviewClick?: () => void;
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
  photoIndex,
  customFileName,
  onPreviewClick
}: EnterprisePhotoUploadProps) {
  // ========================================================================
  // HOOKS & STATE
  // ========================================================================

  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();

  const upload = useEnterpriseFileUpload({
    fileType: 'image',
    purpose,
    maxSize,
    acceptedTypes,
    showToasts,
    contactData,
    photoIndex,
    customFileName
  });

  // 🔥 DEBUG: Log photoFile value to identify undefined issues
  useEffect(() => {
    console.log('🎯 ENTERPRISE: PhotoFile value changed:', {
      hasPhotoFile: !!photoFile,
      isFileInstance: photoFile instanceof File,
      fileName: photoFile?.name,
      fileSize: photoFile?.size,
      fileType: photoFile?.type
    });
  }, [photoFile]);

  // 🔥 EXTRACTED: Photo upload logic (70+ lines extracted)
  const uploadLogic = usePhotoUploadLogic({
    photoFile,
    upload,
    onUploadComplete,
    uploadHandler,
    purpose,
    contactData,
    photoIndex,
    customFileName
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
    // Enterprise compact upload area styling - centralized pattern
    const compactUploadClasses = currentPreview
      ? `border border-dashed ${quick.success} bg-green-50`
      : `${PHOTO_COLORS.PHOTO_BACKGROUND} ${quick.card} flex items-center justify-center text-center cursor-pointer transition-colors ${PHOTO_BORDERS.EMPTY_HOVER} p-6 flex-col`;

    return (
      <div className={`relative ${className}`}>
        <div
          className={`
            relative h-full w-full text-center cursor-pointer ${PHOTO_HOVER_EFFECTS.COLOR_TRANSITION} overflow-hidden
            ${compactUploadClasses}
            ${disabled && !currentPreview ? 'opacity-50 cursor-not-allowed' : disabled ? 'cursor-default' : ''}
            ${hasError ? `${quick.error} bg-red-50` : ''}
            ${!currentPreview ? getDynamicBackgroundClass(PHOTO_COLORS.EMPTY_STATE_BACKGROUND) : ''}
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
              onPreviewClick={disabled && onPreviewClick ? () => {
                console.log('🔍 DEBUG EnterprisePhotoUpload: Preview click triggered (disabled mode)', { onPreviewClickExists: !!onPreviewClick });
                onPreviewClick();
              } : handleClickWithValidation}
              disabled={disabled}
              className="w-full h-full"
            />
          ) : (
            <div className="flex flex-col items-center justify-center">
              <Camera className={`${iconSizes.xl} ${PHOTO_TEXT_COLORS.MUTED} mb-3`} />
              <span className={`${PHOTO_TYPOGRAPHY.BODY} ${PHOTO_TEXT_COLORS.LIGHT_MUTED} mb-2`}>
                {purpose === 'logo' ? t('upload.addLogo') : t('upload.addPhoto')}
              </span>
              <span className={`${PHOTO_TYPOGRAPHY.CAPTION} ${PHOTO_TEXT_COLORS.MUTED}`}>{t('upload.clickOrDrag')}</span>
            </div>
          )}

          {/* Remove button handled by PhotoPreview component */}
        </div>

        {/* Error display */}
        {hasError && (
          <p className={`${PHOTO_TYPOGRAPHY.ERROR} ${PHOTO_SEMANTIC_COLORS.ERROR} mt-1`}>{hasError}</p>
        )}
      </div>
    );
  }

  // Full mode
  // Enterprise full upload area styling - centralized pattern
  const fullUploadClasses = currentPreview
    ? `border border-dashed ${quick.success} bg-green-50`
    : `${PHOTO_COLORS.PHOTO_BACKGROUND} ${quick.card} flex items-center justify-center text-center cursor-pointer transition-colors ${PHOTO_BORDERS.EMPTY_HOVER}`;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header αφαιρέθηκε - δεν θέλουμε το "Φωτογραφία" text και Camera icon πάνω από κάθε slot */}

      {/* Upload Area */}
      <div
        className={`
          relative p-6 text-center cursor-pointer ${PHOTO_HOVER_EFFECTS.COLOR_TRANSITION} ${PHOTO_HEIGHTS.STANDARD} flex flex-col items-center justify-center
          ${fullUploadClasses}
          ${disabled && !currentPreview ? 'opacity-50 cursor-not-allowed' : disabled ? 'cursor-default' : ''}
          ${hasError ? `${quick.error} bg-red-50` : ''}
          ${isLoading ? 'pointer-events-none' : ''}
          ${!currentPreview ? getDynamicBackgroundClass(PHOTO_COLORS.EMPTY_STATE_BACKGROUND) : ''}
        `}
        onDrop={disabled ? undefined : handleDropWithValidation}
        onDragOver={disabled ? undefined : uploadLogic.handleDragOver}
        onClick={disabled || isLoading ? undefined : handleClickWithValidation}
      >
        {/* Loading State */}
        {isLoading && (
          <div className={`absolute inset-0 ${PHOTO_COLORS.LOADING_OVERLAY} flex items-center justify-center`}>
            <div className="text-center">
              <Loader2 className={`${iconSizes.lg} animate-spin ${PHOTO_SEMANTIC_COLORS.LOADING} mx-auto mb-2`} />
              <p className={`${PHOTO_TYPOGRAPHY.LOADING} ${PHOTO_SEMANTIC_COLORS.INFO}`}>
                {upload.uploadPhase === 'upload' && t('upload.phases.uploading')}
                {upload.uploadPhase === 'processing' && t('upload.phases.processing')}
                {upload.uploadPhase === 'complete' && t('upload.phases.complete')}
              </p>
              {showProgress && (
                <div className={`${iconSizes.xl8} ${PHOTO_COLORS.PROGRESS_BACKGROUND} rounded-full h-2 mt-2 mx-auto`}>
                  <div
                    className={`bg-blue-600 h-2 rounded-full ${PHOTO_HOVER_EFFECTS.ALL_TRANSITION}`}
                    style={getProgressBarWidthStyles(upload.progress)}
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
            onPreviewClick={disabled && onPreviewClick ? () => {
              console.log('🔍 DEBUG EnterprisePhotoUpload: Preview click triggered (full/disabled mode)', { onPreviewClickExists: !!onPreviewClick });
              onPreviewClick();
            } : handleClickWithValidation}
            disabled={disabled}
          />
        ) : (
          /* Empty State */
          <div>
            {hasError ? (
              <>
                <AlertCircle className={`${iconSizes.xl} ${PHOTO_SEMANTIC_COLORS.ERROR} mx-auto mb-2`} />
                <p className={`${PHOTO_TYPOGRAPHY.BODY} ${PHOTO_SEMANTIC_COLORS.ERROR} mb-1`}>{t('upload.errors.fileSelection')}</p>
                <p className={`${PHOTO_TYPOGRAPHY.ERROR} ${PHOTO_SEMANTIC_COLORS.ERROR}`}>{hasError}</p>
              </>
            ) : (
              <>
                <Camera className={`${iconSizes.xl} ${PHOTO_TEXT_COLORS.ICON_LIGHT} mx-auto mb-2`} />
                <p className={`${PHOTO_TYPOGRAPHY.BODY} ${PHOTO_TEXT_COLORS.ICON_LIGHT} mb-1`}>
                  {purpose === 'logo' ? t('upload.clickOrDragLogo') : t('upload.clickOrDragPhoto')}
                </p>
                <p className={`text-xs ${PHOTO_TEXT_COLORS.ICON_LIGHT}`}>
                  {t('upload.supportedFormats', { size: maxSize ? Math.round(maxSize / 1024 / 1024) : 5 })}
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
          <p className={`${PHOTO_TYPOGRAPHY.SUCCESS} ${PHOTO_SEMANTIC_COLORS.SUCCESS} flex items-center justify-center gap-1`}>
            <CheckCircle className={iconSizes.sm} />
            {purpose === 'logo' ? t('upload.success.logoUploaded') : t('upload.success.photoUploaded')}
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
            {t('buttons.cancel')}
          </button>
        </div>
      )}
    </div>
  );
}

export default EnterprisePhotoUpload;