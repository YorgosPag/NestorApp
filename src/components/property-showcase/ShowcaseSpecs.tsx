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
  if (rows.length === 0) return null;
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
  t: (key: string) => string,
): Array<[string, string]> {
  const unit = t('specs.areaUnit');
  const rows: Array<[string, string]> = [];
  const push = (label: string, value: string | number | undefined) => {
    if (value === undefined || value === null || value === '') return;
    rows.push([label, String(value)]);
  };

  push(t('specs.type'), p.typeLabel || p.type);
  push(t('specs.code'), p.code);
  push(t('specs.building'), p.building);
  push(t('specs.floor'), p.floor !== undefined ? String(p.floor) : undefined);

  if (p.areas?.gross !== undefined) push(t('specs.grossArea'), `${p.areas.gross} ${unit}`);
  if (p.areas?.net !== undefined) push(t('specs.netArea'), `${p.areas.net} ${unit}`);
  if (p.areas?.balcony !== undefined) push(t('specs.balcony'), `${p.areas.balcony} ${unit}`);
  if (p.areas?.terrace !== undefined) push(t('specs.terrace'), `${p.areas.terrace} ${unit}`);
  if (p.areas?.garden !== undefined) push(t('specs.garden'), `${p.areas.garden} ${unit}`);
  if (p.areas?.millesimalShares !== undefined)
    push(t('specs.millesimalShares'), `${p.areas.millesimalShares}‰`);

  push(t('specs.bedrooms'), p.layout?.bedrooms);
  push(t('specs.bathrooms'), p.layout?.bathrooms);
  push(t('specs.wc'), p.layout?.wc);
  push(t('specs.totalRooms'), p.layout?.totalRooms);
  push(t('specs.balconies'), p.layout?.balconies);

  push(t('specs.condition'), p.condition?.conditionLabel || p.condition?.condition);
  push(t('specs.renovationYear'), p.condition?.renovationYear);
  push(t('specs.deliveryDate'), p.condition?.deliveryDate);

  return rows;
}
