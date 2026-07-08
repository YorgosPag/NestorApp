'use client';

import React from 'react';
import { Upload } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { EnterprisePhotoUpload } from './EnterprisePhotoUpload';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import { PHOTO_TEXT_COLORS, PHOTO_LAYOUTS } from '@/components/generic/config/photo-config';
// 🏢 ADR-596: shared upload-state hook + drop zone primitive (SSoT)
import { usePhotoSlotState } from './multiple-photos/use-photo-slot-state';
import { PhotoMultiDropZone } from './multiple-photos/PhotoMultiDropZone';
import type { MultiplePhotosFullProps } from './multiple-photos/photo-slot-types';

// 🔁 Public API stability — consumers import these from this module
export type { PhotoSlot, MultiplePhotosFullProps } from './multiple-photos/photo-slot-types';

const logger = createModuleLogger('MultiplePhotosFull');

// ============================================================================
// MULTIPLE PHOTOS FULL COMPONENT
// ============================================================================

/**
 * Multiple Photos Upload - Full Mode
 *
 * Thin layout wrapper (ADR-596): κρατά ΜΟΝΟ το full layout (responsive 3:4 slots,
 * empty-slot placeholders σε disabled mode, detailed upload zone copy). Όλη η
 * upload-state λογική ζει στο usePhotoSlotState· η per-slot cell στο buildCellProps.
 *
 * Features:
 * - Full grid layout (3x2) με larger spacing
 * - Large upload zone με detailed instructions
 * - Cache busting με unique keys
 */
export function MultiplePhotosFull(props: MultiplePhotosFullProps) {
  const {
    normalizedPhotos,
    maxPhotos,
    photosKey,
    purpose,
    disabled,
    className = '',
    showPhotosWhenDisabled = false,
  } = props;

  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('common-photos');
  const { availableSlots, handleMultipleDrop, buildCellProps } = usePhotoSlotState(props);

  // 🎯 Δυναμικά κείμενα ανάλογα με purpose και maxPhotos (full-only copy)
  const getDragDropText = () => {
    if (purpose === 'logo' && maxPhotos === 1) {
      return t('upload.dragDropLogo');
    }
    return t('upload.dragDropPhotos');
  };

  const getSubText = () => {
    if (purpose === 'logo' && maxPhotos === 1) {
      return t('upload.logoOnly');
    }
    return t('upload.addMorePhotosInfo', { count: availableSlots });
  };

  logger.debug('Rendering', { slotCount: normalizedPhotos.length });

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header αφαιρέθηκε - δεν θέλουμε το "Φωτογραφία" text και Image icon */}

      {/* Photo Grid - 3x2 Layout */}
      <div className={PHOTO_LAYOUTS.INDIVIDUAL_GRID.container}>
        {normalizedPhotos.map((photo, index) => {
          // 🎯 MOBILE + DESKTOP FIX: Calculate responsive style first
          const responsiveStyle: React.CSSProperties = {
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
                <div className={`w-full h-full ${colors.bg.muted} rounded-lg`} />
              </div>
            );
          }

          return (
            <div
              key={`full-photo-slot-${index}-${photosKey}`}
              className="overflow-hidden flex-shrink-0 mx-auto"
              style={responsiveStyle}
            >
              <EnterprisePhotoUpload
                key={`enterprise-slot-${index}-${photosKey}`}
                {...buildCellProps(photo, index)}
                customFileName={photo.fileName} // 🔥 Full-only: custom filename display
                className="w-full h-full"
              />
            </div>
          );
        })}
      </div>

      {/* Multiple Upload Zone - Hidden for logo mode (maxPhotos=1) */}
      {availableSlots > 0 && maxPhotos > 1 && (
        <PhotoMultiDropZone
          onDropFiles={handleMultipleDrop}
          disabled={disabled}
          padding="p-6"
          ariaLabel={t('photos.management.addMorePhotos', { count: availableSlots })}
        >
          <Upload className={`${iconSizes.xl} ${PHOTO_TEXT_COLORS.MUTED} mx-auto mb-2`} />
          <p className={`text-sm font-medium ${PHOTO_TEXT_COLORS.MEDIUM} mb-1`}>
            {getDragDropText()}
          </p>
          <p className={`text-xs ${PHOTO_TEXT_COLORS.LIGHT_MUTED}`}>
            {getSubText()}
          </p>
        </PhotoMultiDropZone>
      )}
    </div>
  );
}

export default MultiplePhotosFull;
