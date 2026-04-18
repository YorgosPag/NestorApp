'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ShowcaseMedia } from './types';

interface ShowcasePhotoGridProps {
  photos: ShowcaseMedia[];
}

export function ShowcasePhotoGrid({ photos }: ShowcasePhotoGridProps) {
  const { t } = useTranslation('showcase');
  if (photos.length === 0) return null;
  return (
    <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
      <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-4">{t('photos.title')}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map((photo) => (
          <figure key={photo.id} className="overflow-hidden rounded-lg bg-[hsl(var(--showcase-bg))]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.displayName || t('photos.defaultAlt')}
              loading="lazy"
              className="w-full h-40 object-cover hover:scale-105 transition-transform duration-300"
            />
            {photo.displayName && (
              <figcaption className="text-xs text-[hsl(var(--showcase-muted-fg))] px-2 py-1 truncate">
                {photo.displayName}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}
