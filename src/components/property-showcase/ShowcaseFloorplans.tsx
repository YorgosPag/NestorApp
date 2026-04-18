'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ShowcaseFloorplanGrid } from './ShowcaseFloorplanGrid';
import type { ShowcaseMedia, ShowcasePropertyFloorFloorplans } from './types';

interface ShowcaseFloorplansProps {
  floorplans: ShowcaseMedia[];
  /** Phase 7.5 — κάτοψη ορόφου resolved server-side via `resolveFloorId`. */
  propertyFloorFloorplans?: ShowcasePropertyFloorFloorplans;
}

export function ShowcaseFloorplans({
  floorplans,
  propertyFloorFloorplans,
}: ShowcaseFloorplansProps) {
  const { t } = useTranslation('showcase');
  const hasProperty = floorplans.length > 0;
  const hasFloor = (propertyFloorFloorplans?.media.length ?? 0) > 0;
  if (!hasProperty && !hasFloor) return null;

  const floorSubtitle = propertyFloorFloorplans?.floorLabel
    ? `${t('floorplans.floorSubtitle')} — ${propertyFloorFloorplans.floorLabel}`
    : t('floorplans.floorSubtitle');

  return (
    <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
      <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-4">
        {t('floorplans.title')}
      </h2>
      {hasProperty && <ShowcaseFloorplanGrid floorplans={floorplans} />}
      {hasFloor && (
        <article className={hasProperty ? 'mt-6 space-y-3' : 'space-y-3'}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[hsl(var(--showcase-muted-fg))]">
            {floorSubtitle}
          </h3>
          <ShowcaseFloorplanGrid
            floorplans={propertyFloorFloorplans!.media}
            density="dense"
          />
        </article>
      )}
    </section>
  );
}
