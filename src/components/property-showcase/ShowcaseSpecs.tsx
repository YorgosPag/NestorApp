'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ShowcasePropertySnapshot } from './types';

interface ShowcaseSpecsProps {
  property: ShowcasePropertySnapshot;
}

export function ShowcaseSpecs({ property }: ShowcaseSpecsProps) {
  const { t } = useTranslation('showcase');
  const rows = buildRows(property, t);
  return (
    <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
      <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-4">{t('specs.title')}</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-[hsl(var(--showcase-border))] pb-2">
            <dt className="text-[hsl(var(--showcase-muted-fg))]">{label}</dt>
            <dd className="text-[hsl(var(--showcase-fg))] font-medium text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function buildRows(
  p: ShowcasePropertySnapshot,
  t: (key: string) => string
): Array<[string, string]> {
  const unit = t('specs.areaUnit');
  const dash = '—';
  const orientationDisplay = p.orientationLabels?.length
    ? p.orientationLabels.join(', ')
    : p.orientations?.length
      ? p.orientations.join(', ')
      : dash;
  return [
    [t('specs.type'), p.typeLabel || p.type || dash],
    [t('specs.code'), p.code || dash],
    [t('specs.building'), p.building || dash],
    [t('specs.floor'), p.floor !== undefined ? String(p.floor) : dash],
    [t('specs.grossArea'), p.areas?.gross ? `${p.areas.gross} ${unit}` : dash],
    [t('specs.netArea'), p.areas?.net ? `${p.areas.net} ${unit}` : dash],
    [t('specs.balcony'), p.areas?.balcony ? `${p.areas.balcony} ${unit}` : dash],
    [t('specs.terrace'), p.areas?.terrace ? `${p.areas.terrace} ${unit}` : dash],
    [t('specs.bedrooms'), p.layout?.bedrooms !== undefined ? String(p.layout.bedrooms) : dash],
    [t('specs.bathrooms'), p.layout?.bathrooms !== undefined ? String(p.layout.bathrooms) : dash],
    [t('specs.wc'), p.layout?.wc !== undefined ? String(p.layout.wc) : dash],
    [t('specs.orientation'), orientationDisplay],
    [t('specs.energyClass'), p.energyClass || dash],
    [t('specs.condition'), p.conditionLabel || p.condition || dash],
  ];
}
