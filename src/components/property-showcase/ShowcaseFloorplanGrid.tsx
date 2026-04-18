'use client';

/**
 * SSoT — single floorplan grid primitive (ADR-312 Phase 7).
 *
 * Extracted from `ShowcaseFloorplans.tsx` so the property-level floorplans
 * container and the new linked-spaces floorplans container both render the
 * same tile UI (DXF raster preview + download DXF link or native image +
 * displayName caption). Two consumers, zero drift.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ShowcaseMedia } from './types';

interface ShowcaseFloorplanGridProps {
  floorplans: ShowcaseMedia[];
  /** Controls tile density. `dense` renders 3 columns on sm+ (used inside the
   * linked-spaces 2-column layout where each column only has ≤3 tiles). */
  density?: 'default' | 'dense';
}

export function ShowcaseFloorplanGrid({ floorplans, density = 'default' }: ShowcaseFloorplanGridProps) {
  const { t } = useTranslation('showcase');
  if (floorplans.length === 0) return null;

  const defaultAlt = t('floorplans.defaultAlt');
  const downloadDxf = t('floorplans.downloadDxf');
  const previewUnavailable = t('floorplans.previewUnavailable');
  const defaultName = t('floorplans.defaultName');

  const columnsClass =
    density === 'dense'
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
      : 'grid grid-cols-1 sm:grid-cols-2 gap-4';

  return (
    <ul className={columnsClass}>
      {floorplans.map((plan) => {
        const label = plan.displayName || defaultName;
        const isDxf = plan.ext === 'dxf';
        return (
          <li
            key={plan.id}
            className="border border-[hsl(var(--showcase-border))] rounded-lg overflow-hidden bg-[hsl(var(--showcase-bg))]"
          >
            {plan.previewUrl ? (
              <img
                src={plan.previewUrl}
                alt={label || defaultAlt}
                loading="lazy"
                className="w-full h-auto block bg-white"
              />
            ) : (
              <div className="aspect-[3/2] flex items-center justify-center text-sm text-[hsl(var(--showcase-muted-fg))] bg-[hsl(var(--showcase-bg))]">
                {previewUnavailable}
              </div>
            )}
            <div className="p-3 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-[hsl(var(--showcase-fg))] truncate">{label}</span>
              <a
                href={plan.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-300 hover:text-violet-200 hover:underline whitespace-nowrap"
              >
                {isDxf ? downloadDxf : label}
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
