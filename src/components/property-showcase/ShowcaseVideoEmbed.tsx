'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ShowcaseVideoEmbedProps {
  videoUrl?: string;
}

export function ShowcaseVideoEmbed({ videoUrl }: ShowcaseVideoEmbedProps) {
  const { t } = useTranslation('showcase');
  if (!videoUrl) return null;
  return (
    <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
      <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-2">{t('video.title')}</h2>
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-violet-300 hover:text-violet-200 hover:underline font-medium"
      >
        <ExternalLink className="h-4 w-4" />
        {t('video.openLink')}
      </a>
    </section>
  );
}
