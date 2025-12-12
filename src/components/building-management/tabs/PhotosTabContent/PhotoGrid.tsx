'use client';

import React from 'react';
import { PhotoItem, type Photo } from '@/components/generic/utils/PhotoItem';
import { Image as ImageIcon } from 'lucide-react';
import {
  PHOTO_TEXT_COLORS,
  PHOTO_COLORS,
  PHOTO_BORDERS,
  PHOTO_COMBINED_EFFECTS
} from '@/components/generic/config/photo-config';
import { TRANSITION_PRESETS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';

interface PhotoGridProps {
  photos: Photo[];
}

export function PhotoGrid({ photos }: PhotoGridProps) {
  const placeholderCount = Math.max(0, 4 - photos.length);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {photos.map((photo) => (
        <PhotoItem key={photo.id} photo={photo} />
      ))}
      {Array.from({ length: placeholderCount }).map((_, index) => (
         <div key={`placeholder-${index}`} className={`aspect-square ${PHOTO_COLORS.PHOTO_BACKGROUND} ${PHOTO_BORDERS.EMPTY_STATE} rounded-lg flex items-center justify-center text-center cursor-pointer ${TRANSITION_PRESETS.STANDARD_COLORS} ${PHOTO_BORDERS.EMPTY_HOVER} group`}>
            <div className="text-center">
              <ImageIcon className={`w-8 h-8 ${PHOTO_TEXT_COLORS.MUTED} mx-auto mb-2 ${HOVER_TEXT_EFFECTS.TO_PRIMARY} ${TRANSITION_PRESETS.STANDARD_COLORS}`} />
              <p className={`text-sm ${PHOTO_TEXT_COLORS.FOREGROUND_MUTED}`}>Προσθήκη Φωτογραφίας</p>
            </div>
          </div>
      ))}
    </div>
  );
}
