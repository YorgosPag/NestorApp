'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ShowcaseMedia } from './types';

interface ShowcaseFloorplansProps {
  floorplans: ShowcaseMedia[];
}

export function ShowcaseFloorplans({ floorplans }: ShowcaseFloorplansProps) {
  const { t } = useTranslation('showcase');
  if (floorplans.length === 0) return null;

  const title = t('floorplans.title');
  const defaultAlt = t('floorplans.defaultAlt');
  const downloadDxf = t('floorplans.downloadDxf');
  const previewUnavailable = t('floorplans.previewUnavailable');
  const defaultName = t('floorplans.defaultName');

  return (
    <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
      <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-4">{title}</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {floorplans.map((plan) => {
          const label = plan.displayName || defaultName;
          const isDxf = plan.ext === 'dxf';
          return (
            <li key={plan.id} className="border border-[hsl(var(--showcase-border))] rounded-lg overflow-hidden bg-[hsl(var(--showcase-bg))]">
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
                {isDxf ? (
                  <a
                    href={plan.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-violet-300 hover:text-violet-200 hover:underline whitespace-nowrap"
                  >
                    {downloadDxf}
                  </a>
                ) : (
                  <a
                    href={plan.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-violet-300 hover:text-violet-200 hover:underline whitespace-nowrap"
                  >
                    {label}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
