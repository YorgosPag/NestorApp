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
    <section className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('video.title')}</h2>
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-violet-700 hover:underline font-medium"
      >
        <ExternalLink className="h-4 w-4" />
        {t('video.openLink')}
      </a>
    </section>
  );
}
