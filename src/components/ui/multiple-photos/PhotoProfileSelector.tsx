'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PHOTO_TEXT_COLORS, PHOTO_LAYOUTS } from '@/components/generic/config/photo-config';
import type { PhotoSlot } from './photo-slot-types';

// ============================================================================
// Compact-only: profile-photo selector footer (ADR-596)
// ----------------------------------------------------------------------------
// Extracted from MultiplePhotosCompact to keep the variant a thin layout wrapper
// under the 500-line ceiling (N.7.1 — extract, not trim). Single consumer; not a
// dedup target, but isolates a self-contained affordance.
// ============================================================================

export interface PhotoProfileSelectorProps {
  normalizedPhotos: PhotoSlot[];
  selectedProfilePhotoIndex?: number;
  onProfilePhotoSelection?: (index: number) => void;
}

export function PhotoProfileSelector({
  normalizedPhotos,
  selectedProfilePhotoIndex,
  onProfilePhotoSelection,
}: PhotoProfileSelectorProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('common-photos');

  return (
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
  );
}
