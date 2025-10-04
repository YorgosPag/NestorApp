'use client';

import React from 'react';
import type { Photo } from './types';
import { PhotoItem } from './PhotoItem';
import { Image as ImageIcon } from 'lucide-react';

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
         <div key={`placeholder-${index}`} className="aspect-square bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border hover:border-primary transition-colors cursor-pointer group">
            <div className="text-center">
              <ImageIcon className="w-8 h-8 text-muted-foreground group-hover:text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Προσθήκη Φωτογραφίας</p>
            </div>
          </div>
      ))}
    </div>
  );
}
