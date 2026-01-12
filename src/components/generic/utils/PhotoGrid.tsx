'use client';

import React from 'react';
import { PhotoItem, type Photo } from './PhotoItem';
import { Image as ImageIcon } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import {
  PHOTO_TEXT_COLORS,
  PHOTO_COLORS,
  PHOTO_BORDERS,
  PHOTO_COMBINED_EFFECTS
} from '../config/photo-config';
import { HOVER_TEXT_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface PhotoGridProps {
  /** Array of photos to display in grid layout */
  photos: Photo[];
  /** Maximum number of placeholder slots to show (default: 4) */
  maxPlaceholders?: number;
  /** Whether to show upload placeholders when photos < maxPlaceholders (default: true) */
  showPlaceholders?: boolean;
  /** Custom placeholder text (default: "Προσθήκη Φωτογραφίας") */
  placeholderText?: string;
  /** Grid layout columns for different breakpoints */
  gridCols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  /** Callback when upload placeholder is clicked */
  onUploadClick?: () => void;
}

/**
 * Enterprise PhotoGrid Component
 *
 * A professional, reusable photo grid component that follows enterprise standards:
 * - Uses centralized photo-config design system
 * - Semantic HTML structure (no excessive divs)
 * - TypeScript-first with proper interfaces
 * - Responsive grid layout with configurable columns
 * - Upload placeholders with hover effects
 * - Zero inline styles or hardcoded values
 *
 * @example
 * ```tsx
 * <PhotoGrid
 *   photos={buildingPhotos}
 *   maxPlaceholders={6}
 *   onUploadClick={() => openUploadModal()}
 * />
 * ```
 */
export function PhotoGrid({
  photos,
  maxPlaceholders = 4,
  showPlaceholders = true,
  placeholderText,
  gridCols = {
    mobile: 2,
    tablet: 3,
    desktop: 4
  },
  onUploadClick
}: PhotoGridProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();

  // Use translation as default if placeholderText not provided
  const displayPlaceholderText = placeholderText ?? t('photos.addPhoto');

  // Calculate number of placeholders to show (enterprise logic)
  const placeholderCount = showPlaceholders
    ? Math.max(0, maxPlaceholders - photos.length)
    : 0;

  // Build responsive grid classes using centralized configuration
  const gridClasses = `grid gap-4 ${
    gridCols.mobile === 2 ? 'grid-cols-2' :
    gridCols.mobile === 3 ? 'grid-cols-3' : 'grid-cols-1'
  } ${
    gridCols.tablet === 2 ? 'md:grid-cols-2' :
    gridCols.tablet === 3 ? 'md:grid-cols-3' :
    gridCols.tablet === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'
  } ${
    gridCols.desktop === 2 ? 'lg:grid-cols-2' :
    gridCols.desktop === 3 ? 'lg:grid-cols-3' :
    gridCols.desktop === 4 ? 'lg:grid-cols-4' :
    gridCols.desktop === 5 ? 'lg:grid-cols-5' :
    gridCols.desktop === 6 ? 'lg:grid-cols-6' : 'lg:grid-cols-4'
  }`;

  return (
    <section className={gridClasses} role="grid" aria-label={t('photos.galleryLabel')}>
      {/* Photo Items */}
      {photos.map((photo) => (
        <PhotoItem key={photo.id} photo={photo} />
      ))}

      {/* Upload Placeholders - Semantic button elements */}
      {Array.from({ length: placeholderCount }).map((_, index) => (
        <button
          key={`placeholder-${index}`}
          type="button"
          className={`
            aspect-square
            ${PHOTO_COLORS.PHOTO_BACKGROUND}
            ${PHOTO_BORDERS.EMPTY_STATE}
            ${quick.card}
            flex items-center justify-center text-center
            cursor-pointer group
            ${TRANSITION_PRESETS.STANDARD_COLORS}
            ${PHOTO_BORDERS.EMPTY_HOVER}
            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
          `}
          onClick={onUploadClick}
          aria-label={`Upload photo placeholder ${index + 1}`}
        >
          <div className="text-center">
            <ImageIcon
              className={`
                ${iconSizes.xl}
                ${PHOTO_TEXT_COLORS.MUTED}
                mx-auto mb-2
                ${HOVER_TEXT_EFFECTS.TO_PRIMARY}
                ${TRANSITION_PRESETS.STANDARD_COLORS}
              `}
              aria-hidden="true"
            />
            <p className={`text-sm ${PHOTO_TEXT_COLORS.FOREGROUND_MUTED}`}>
              {displayPlaceholderText}
            </p>
          </div>
        </button>
      ))}
    </section>
  );
}

export default PhotoGrid;