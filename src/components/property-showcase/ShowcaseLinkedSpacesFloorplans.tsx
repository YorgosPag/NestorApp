'use client';

/**
 * Property Showcase — linked-spaces floorplans card (ADR-312 Phase 7).
 *
 * Renders the DXF rasters (PNG previews) of every parking spot and storage
 * unit linked to the property in a single two-column section, preserving
 * each space's allocation code as a sub-header. Reuses the SSoT
 * `ShowcaseFloorplanGrid` tile primitive — no duplicated tile markup.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ShowcaseFloorplanGrid } from './ShowcaseFloorplanGrid';
import type {
  ShowcaseLinkedSpaceFloorplanGroup,
  ShowcaseLinkedSpaceFloorplans as LinkedSpaceFloorplansPayload,
} from './types';

interface ShowcaseLinkedSpacesFloorplansProps {
  linkedSpaceFloorplans: LinkedSpaceFloorplansPayload;
}

export function ShowcaseLinkedSpacesFloorplans({
  linkedSpaceFloorplans,
}: ShowcaseLinkedSpacesFloorplansProps) {
  const { t } = useTranslation('showcase');
  const { parking, storage } = linkedSpaceFloorplans;
  if (parking.length === 0 && storage.length === 0) return null;

  return (
    <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
      <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-4">
        {t('linkedSpacesFloorplans.sectionTitle')}
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LinkedGroupColumn
          columnTitle={t('linkedSpacesFloorplans.parkingColumn')}
          emptyLabel={t('linkedSpacesFloorplans.emptyParking')}
          unnamedLabel={t('linkedSpacesFloorplans.unnamedSpace')}
          groups={parking}
        />
        <LinkedGroupColumn
          columnTitle={t('linkedSpacesFloorplans.storageColumn')}
          emptyLabel={t('linkedSpacesFloorplans.emptyStorage')}
          unnamedLabel={t('linkedSpacesFloorplans.unnamedSpace')}
          groups={storage}
        />
      </div>
    </section>
  );
}

interface LinkedGroupColumnProps {
  columnTitle: string;
  emptyLabel: string;
  unnamedLabel: string;
  groups: ShowcaseLinkedSpaceFloorplanGroup[];
}

function LinkedGroupColumn({ columnTitle, emptyLabel, unnamedLabel, groups }: LinkedGroupColumnProps) {
  const { t } = useTranslation('showcase');
  return (
    <article className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[hsl(var(--showcase-muted-fg))]">
        {columnTitle}
      </h3>
      {groups.length === 0 ? (
        <p className="text-sm text-[hsl(var(--showcase-muted-fg))]">{emptyLabel}</p>
      ) : (
        <ul className="space-y-4">
          {groups.map((group) => {
            const hasFloor = (group.floorFloorplans?.length ?? 0) > 0;
            const floorSubtitle = group.floorLabel
              ? `${t('linkedSpacesFloorplans.floorSubtitle')} — ${group.floorLabel}`
              : t('linkedSpacesFloorplans.floorSubtitle');
            return (
              <li key={group.spaceId} className="space-y-2">
                <p className="text-sm font-medium text-[hsl(var(--showcase-fg))]">
                  {group.allocationCode || unnamedLabel}
                </p>
                {group.media.length > 0 && (
                  <ShowcaseFloorplanGrid floorplans={group.media} density="dense" />
                )}
                {hasFloor && (
                  <div className="pt-1">
                    <p className="text-xs uppercase tracking-wide text-[hsl(var(--showcase-muted-fg))] mb-2">
                      {floorSubtitle}
                    </p>
                    <ShowcaseFloorplanGrid
                      floorplans={group.floorFloorplans!}
                      density="dense"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
