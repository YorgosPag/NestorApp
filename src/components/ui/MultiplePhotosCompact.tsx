'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EnterprisePhotoUpload } from './EnterprisePhotoUpload';
import { PHOTO_TEXT_COLORS } from '@/components/generic/config/photo-config';
// 🏢 ADR-596: shared upload-state hook + primitives (SSoT)
import { usePhotoSlotState } from './multiple-photos/use-photo-slot-state';
import { PhotoMultiDropZone } from './multiple-photos/PhotoMultiDropZone';
import { PhotoProfileSelector } from './multiple-photos/PhotoProfileSelector';
import type { MultiplePhotosCompactProps } from './multiple-photos/photo-slot-types';

// 🔁 Public API stability — consumers import these from this module
export type { PhotoSlot, MultiplePhotosCompactProps } from './multiple-photos/photo-slot-types';

// ============================================================================
// MULTIPLE PHOTOS COMPACT COMPONENT
// ============================================================================

/**
 * Multiple Photos Upload - Compact Mode
 *
 * Thin layout wrapper (ADR-596): κρατά ΜΟΝΟ το compact layout (semantic grid,
 * disabled-mode slot filter, profile selector). Όλη η upload-state λογική ζει στο
 * usePhotoSlotState· η per-slot cell στο buildCellProps· το drop zone / profile
 * selector σε shared primitives.
 *
 * Features:
 * - Compact grid layout (3x2 για photos, centered για logo)
 * - Multiple drop zone για bulk upload
 * - Profile photo selector integration
 * - Cache busting με unique keys
 */
export function MultiplePhotosCompact(props: MultiplePhotosCompactProps) {
  const {
    normalizedPhotos,
    maxPhotos,
    photosKey,
    disabled,
    className = '',
    showProfileSelector = false,
    selectedProfilePhotoIndex,
    onProfilePhotoSelection,
    showPhotosWhenDisabled = false,
  } = props;

  const iconSizes = useIconSizes();
  const { t } = useTranslation('common-photos');
  const { availableSlots, handleMultipleDrop, buildCellProps } = usePhotoSlotState(props);

  return (
    <section className={`space-y-3 ${className}`} role="region" aria-label={t('photos.management.title')}>
      {/* Header αφαιρέθηκε - δεν θέλουμε το "Φωτογραφία" text και Image icon */}

      {/* Compact Grid - Dynamic Layout */}
      <main className={maxPhotos === 1 ? "flex justify-center" : "flex flex-col space-y-4 sm:grid sm:grid-cols-3 sm:gap-8 sm:p-2 sm:space-y-0"} role="main" aria-label={t('photos.management.gallery')}>
        {normalizedPhotos
          // ✅ CRITICAL FIX: Στο disabled mode εμφανίζουμε μόνο τα slots με φωτογραφίες
          .filter((photo) => {
            if (!disabled || showPhotosWhenDisabled) {
              return true; // Normal mode: εμφάνιση όλων
            }
            return photo.file || photo.uploadUrl; // Disabled mode: μόνο τα με φωτογραφίες
          })
          .map((photo) => {
            // Βρίσκουμε το πραγματικό index στο original array
            const index = normalizedPhotos.findIndex(p => p === photo);

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
                  key={`enterprise-slot-${index}-${photosKey}`}
                  {...buildCellProps(photo, index)}
                />
              </article>
            );
          })}
      </main>

      {/* Multiple Drop Zone - Hidden for logo mode (maxPhotos=1) */}
      {availableSlots > 0 && maxPhotos > 1 && (
        <PhotoMultiDropZone
          onDropFiles={handleMultipleDrop}
          disabled={disabled}
          padding="p-3"
          ariaLabel={t('photos.management.addMorePhotos', { count: availableSlots })}
        >
          <Plus className={`${iconSizes.sm} mx-auto mb-1 ${PHOTO_TEXT_COLORS.MUTED}`} />
          <p className={`text-xs ${PHOTO_TEXT_COLORS.LIGHT_MUTED}`}>
            {t('photos.management.addMore', { count: availableSlots })}
          </p>
        </PhotoMultiDropZone>
      )}

      {/* 🆕 ENTERPRISE: Profile Photo Selector για compact mode */}
      {showProfileSelector && availableSlots < maxPhotos && (
        <PhotoProfileSelector
          normalizedPhotos={normalizedPhotos}
          selectedProfilePhotoIndex={selectedProfilePhotoIndex}
          onProfilePhotoSelection={onProfilePhotoSelection}
        />
      )}
    </section>
  );
}

export default MultiplePhotosCompact;
