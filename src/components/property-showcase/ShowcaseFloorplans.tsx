'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ShowcaseFloorplanGrid } from './ShowcaseFloorplanGrid';
import type { ShowcaseMedia } from './types';

interface ShowcaseFloorplansProps {
  floorplans: ShowcaseMedia[];
}

export function ShowcaseFloorplans({ floorplans }: ShowcaseFloorplansProps) {
  const { t } = useTranslation('showcase');
  if (floorplans.length === 0) return null;

  return (
    <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
      <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-4">
        {t('floorplans.title')}
      </h2>
      <ShowcaseFloorplanGrid floorplans={floorplans} />
    </section>
  );
}
