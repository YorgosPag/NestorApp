'use client';

import React from 'react';
import { PhotoItem, type Photo } from '@/components/generic/utils/PhotoItem';
import { Image as ImageIcon } from 'lucide-react';
import { PHOTO_STYLES, PHOTO_TEXT_COLORS } from '@/components/generic/config/photo-dimensions';

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
         <div key={`placeholder-${index}`} className={`aspect-square ${PHOTO_STYLES.EMPTY_STATE} group`}>
            <div className="text-center">
              <ImageIcon className={`w-8 h-8 ${PHOTO_STYLES.ICON_HOVER} mx-auto mb-2`} />
              <p className={`text-sm ${PHOTO_TEXT_COLORS.FOREGROUND_MUTED}`}>Προσθήκη Φωτογραφίας</p>
            </div>
          </div>
      ))}
    </div>
  );
}
