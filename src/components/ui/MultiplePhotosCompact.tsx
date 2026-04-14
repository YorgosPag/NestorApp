'use client';

import React from 'react';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Plus, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnterprisePhotoUpload } from './EnterprisePhotoUpload';
// 🏢 ADR-292: Auth + tenant context for canonical upload pipeline
import { useCompanyId } from '@/hooks/useCompanyId';
import { useAuth } from '@/auth/hooks/useAuth';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('MultiplePhotosCompact');
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import { FILE_TYPE_CONFIG, type UploadPurpose } from '@/config/file-upload-config';
import type { ContactFormData } from '@/types/ContactFormTypes';
import {
  PHOTO_TEXT_COLORS,
  PHOTO_COLORS,
  PHOTO_LAYOUTS,
  PHOTO_BORDERS
} from '@/components/generic/config/photo-config';
import { layoutUtilities } from '@/styles/design-tokens';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PhotoSlot {
  file?: File | null;
  preview?: string;
  uploadUrl?: string;
  fileName?: string;
  isUploading?: boolean;
  uploadProgress?: number;
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
  purpose?: UploadPurpose;
  /** Upload handler */
  uploadHandler?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>;
  /** Upload complete handler */
  handleUploadComplete?: (slotIndex: number, result: FileUploadResult) => void;
  /** Photos change callback to update parent state */
  onPhotosChange?: (photos: PhotoSlot[]) => void;
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
  /** 🔥 RESTORED: Contact data for FileNamingService */
  contactData?: ContactFormData;
  /** 🏢 ENTERPRISE: Photo click handler για gallery preview */
  onPhotoClick?: (index: number) => void;
  /** Show photos even when component is disabled (for read-only views) */
  showPhotosWhenDisabled?: boolean;
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
  handleUploadComplete,
  onPhotosChange,
  disabled,
  showProgress,
  className = '',
  showProfileSelector = false,
  selectedProfilePhotoIndex,
  onProfilePhotoSelection,
  contactData,
  onPhotoClick,
  showPhotosWhenDisabled = false
}: MultiplePhotosCompactProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);

  // 🏢 ADR-292: Resolve canonical fields for tenant-isolated upload
  const companyIdResult = useCompanyId();
  const { user } = useAuth();
  const canonicalCompanyId = companyIdResult?.companyId;
  const canonicalCreatedBy = user?.uid;

  // 🔧 FIX: Refs to avoid stale closures in async onUploadComplete callbacks.
  const normalizedPhotosRef = React.useRef(normalizedPhotos);
  normalizedPhotosRef.current = normalizedPhotos;
  const onPhotosChangeRef = React.useRef(onPhotosChange);
  onPhotosChangeRef.current = onPhotosChange;

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
      return t('photos.management.logo');
    }
    return t('photos.management.photosCount', { used: usedSlots, max: maxPhotos });
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

  return (
    <section className={`space-y-3 ${className}`} role="region" aria-label={t('photos.management.title')}>
      {/* Header αφαιρέθηκε - δεν θέλουμε το "Φωτογραφία" text και Image icon */}

      {/* Compact Grid - Dynamic Layout */}
      <main className={maxPhotos === 1 ? "flex justify-center" : "flex flex-col space-y-4 sm:grid sm:grid-cols-3 sm:gap-8 sm:p-2 sm:space-y-0"} role="main" aria-label={t('photos.management.gallery')}>
        {normalizedPhotos
          // ✅ CRITICAL FIX: Στο disabled mode εμφανίζουμε μόνο τα slots με φωτογραφίες
          .filter((photo, index) => {
            if (!disabled || showPhotosWhenDisabled) {
              return true; // Normal mode: εμφάνιση όλων
            }
            return photo.file || photo.uploadUrl; // Disabled mode: μόνο τα με φωτογραφίες
          })
          .map((photo, originalIndex) => {
            // Βρίσκουμε το πραγματικό index στο original array
            const index = normalizedPhotos.findIndex(p => p === photo);
          // 🔥 CACHE BUSTING: Using extracted hook
          const rawPreview = photo.preview || photo.uploadUrl;
          const photoPreviewWithCacheBuster = addCacheBuster(rawPreview);

          // 🎯 MOBILE FIX: Fixed 4:3 ratio — Tailwind-only (no inline styles)
          const slotSize = maxPhotos === 1
            ? "h-64 w-64 overflow-hidden"
            : "w-[240px] h-[320px] min-w-[240px] min-h-[320px] max-w-[240px] max-h-[320px] flex-shrink-0 mx-auto overflow-hidden sm:w-full sm:h-[300px] sm:min-w-0 sm:min-h-0 sm:max-w-none sm:max-h-none";

          return (
            <article
              key={`compact-photo-slot-${index}-${photosKey}`}
              className={slotSize}
              role="img"
              aria-label={t('photos.management.photoNumber', { number: index + 1 })}
            >
              <EnterprisePhotoUpload
                key={`compact-enterprise-slot-${index}-${photosKey}`}
                purpose={purpose ?? 'photo'}
                maxSize={FILE_TYPE_CONFIG.image.maxSize}
                photoFile={photo.file}
                photoPreview={photoPreviewWithCacheBuster}
                onFileChange={(file) => {
                  // 🚨 STOP INFINITE LOOPS: Only guard against setting the SAME non-null file.
                  // When file===null this is a DELETE request — always allow it through,
                  // even when currentFile is already null (uploaded photos have file:null + uploadUrl).
                  const currentSlot = normalizedPhotos[index];
                  if (file !== null && currentSlot?.file === file) {
                    return;
                  }
                  if (file === null && !currentSlot?.file && !currentSlot?.uploadUrl && !currentSlot?.preview) {
                    return; // Nothing to clear
                  }

                  logger.info('File changed for slot', { index, fileName: file?.name });
                  const newPhotos = [...normalizedPhotos];

                  if (file) {
                    // 🔧 FIX: Αποθήκευση blob preview στο PhotoSlot ώστε να μην χαθεί σε re-render
                    const preview = URL.createObjectURL(file);
                    newPhotos[index] = {
                      ...newPhotos[index],
                      file,
                      preview,
                      isUploading: false,
                      uploadProgress: 0,
                      error: undefined
                    };
                  } else {
                    // 🏢 FIX (2026-02-16): Clear ALL photo data including uploadUrl
                    // Previously only file/preview were cleared, leaving uploadUrl intact
                    // which caused the photo to remain visible even after deletion.
                    newPhotos[index] = {
                      file: null,
                      preview: undefined,
                      uploadUrl: undefined,
                      fileName: undefined,
                      isUploading: false,
                      uploadProgress: 0,
                      error: undefined
                    };
                  }

                  if (onPhotosChange) {
                    onPhotosChange(newPhotos);
                  }
                }}
                uploadHandler={uploadHandler}
                onUploadComplete={(result) => {
                  // 🏢 SINGLE STATE UPDATE: One event → one update (no competing calls)
                  if (handleUploadComplete) {
                    handleUploadComplete(index, result);
                  } else {
                    const currentPhotos = normalizedPhotosRef.current;
                    const currentHandler = onPhotosChangeRef.current;

                    if (result.success && currentHandler) {
                      const newPhotos = [...currentPhotos];

                      if (result.url) {
                        newPhotos[index] = {
                          ...newPhotos[index],
                          file: null,
                          uploadUrl: result.url,
                          preview: result.url,
                          isUploading: false,
                          uploadProgress: 100,
                          error: undefined
                        };
                      } else {
                        newPhotos[index] = {
                          file: null,
                          preview: undefined,
                          uploadUrl: undefined,
                          fileName: undefined,
                          isUploading: false,
                          uploadProgress: 0,
                          error: undefined
                        };
                      }

                      currentHandler(newPhotos);
                    }
                  }
                }}
                disabled={disabled}
                compact
                showProgress={showProgress}
                isLoading={photo.isUploading}
                contactData={contactData}
                photoIndex={index}
                onPreviewClick={() => {
                  // 🏢 ENTERPRISE: Photo click handler για gallery modal
                  if (photoPreviewWithCacheBuster && onPhotoClick) {
                    logger.info('Photo clicked', { index });
                    onPhotoClick(index);
                  }
                }}
                companyId={canonicalCompanyId}
                contactId={contactData?.id}
                createdBy={canonicalCreatedBy}
                contactName={undefined} /* SSoT: resolved by usePhotoUploadLogic via resolveContactName() */
              />
            </article>
          );
        })}
      </main>

      {/* Multiple Drop Zone - Hidden for logo mode (maxPhotos=1) */}
      {availableSlots > 0 && maxPhotos > 1 && (
        <aside
          className={`${PHOTO_BORDERS.EMPTY_STATE} rounded-lg flex items-center justify-center text-center cursor-pointer ${TRANSITION_PRESETS.STANDARD_COLORS} ${PHOTO_BORDERS.EMPTY_HOVER} p-3 mt-8`}
          style={layoutUtilities.dxf.colors.backgroundColor(
            PHOTO_COLORS.EMPTY_STATE_BACKGROUND
          )}
          onDrop={handleMultipleDrop}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          role="button"
          aria-label={t('photos.management.addMorePhotos', { count: availableSlots })}
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
                handleMultipleDrop(dropEvent as unknown as React.DragEvent<HTMLDivElement>);
              }
            };
            input.click();
          }}
        >
          <Plus className={`${iconSizes.sm} mx-auto mb-1 ${PHOTO_TEXT_COLORS.MUTED}`} />
          <p className={`text-xs ${PHOTO_TEXT_COLORS.LIGHT_MUTED}`}>
            {t('photos.management.addMore', { count: availableSlots })}
          </p>
        </aside>
      )}

      {/* 🆕 ENTERPRISE: Profile Photo Selector για compact mode */}
      {showProfileSelector && availableSlots < maxPhotos && (
        <footer className="border-t pt-4 mt-4" role="contentinfo" aria-label={t('photos.management.profileSelection')}>
          <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Star className={`${iconSizes.sm} ${colors.text.warning}`} />
            {t('photos.management.profileSelection')}
          </h4>
          <nav className={PHOTO_LAYOUTS.INDIVIDUAL_GRID.container} role="group" aria-label={t('photos.management.profileOptions')}>
            {normalizedPhotos.map((photo, index) => (
              <article key={`profile-${index}`} className="relative" role="button" aria-label={t('photos.management.selectAsProfile', { number: index + 1 })}>
                {photo.preview || photo.uploadUrl ? (
                  <figure className="relative" role="img" aria-label={t('photos.management.photoNumber', { number: index + 1 })}>
                    <img
                      src={photo.preview || photo.uploadUrl}
                      alt={t('photos.management.photoNumber', { number: index + 1 })}
                      className={`w-full h-20 object-cover ${quick.rounded} ${quick.input}`}
                    />
                    <Button
                      type="button"
                      variant={selectedProfilePhotoIndex === index ? "default" : "outline"}
                      size="sm"
                      className={`absolute bottom-1 right-1 ${iconSizes.lg} p-0`}
                      onClick={() => {
                        if (onProfilePhotoSelection) {
                          onProfilePhotoSelection(index);
                        }
                      }}
                    >
                      <Star className={`${iconSizes.xs} ${selectedProfilePhotoIndex === index ? 'fill-current' : ''}`} />
                    </Button>
                  </figure>
                ) : (
                  <aside className={`w-full h-20 ${colors.bg.muted} ${quick.rounded} ${quick.input} flex items-center justify-center`} role="status" aria-label={t('photos.management.emptySlot')}>
                    <span className={`text-xs ${PHOTO_TEXT_COLORS.MUTED}`}>{t('photos.management.emptySlotNumber', { number: index + 1 })}</span>
                  </aside>
                )}
              </article>
            ))}
          </nav>
        </footer>
      )}
    </section>
  );
}

export default MultiplePhotosCompact;
