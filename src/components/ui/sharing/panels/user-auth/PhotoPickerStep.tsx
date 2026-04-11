/**
 * =============================================================================
 * 🏢 ENTERPRISE: PhotoPickerStep — Gallery Picker Before App Share
 * =============================================================================
 *
 * Extracted photo picker sub-view from the legacy ShareModal. Shown when the
 * user selects Telegram/WhatsApp/Instagram/Messenger and the shareData has a
 * multi-photo gallery attached.
 *
 * @module components/ui/sharing/panels/user-auth/PhotoPickerStep
 * @see ADR-147 Unified Share Surface (Phase B)
 */

'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { PhotoPickerGrid } from '@/components/ui/social-sharing/PhotoPickerGrid';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export interface PhotoPickerStepProps {
  galleryPhotos: string[];
  selectedPhoto: string | null;
  onSelectionChange: (photo: string | null) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function PhotoPickerStep({
  galleryPhotos,
  selectedPhoto,
  onSelectionChange,
  onCancel,
  onConfirm,
}: PhotoPickerStepProps): React.ReactElement {
  const { t } = useTranslation('common');

  return (
    <section className="space-y-4">
      <PhotoPickerGrid
        photos={galleryPhotos}
        selected={selectedPhoto ? [selectedPhoto] : []}
        onSelectionChange={(sel) => onSelectionChange(sel[0] ?? null)}
        mode="single"
      />

      <nav className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('emailShare.back')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!selectedPhoto}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {t('emailShare.send')}
        </button>
      </nav>
    </section>
  );
}
