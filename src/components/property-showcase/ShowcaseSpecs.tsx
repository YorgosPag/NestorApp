'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  ShowcaseSpecsGrid,
  pushSpecRow,
  type ShowcaseSpecsGridRow,
} from '@/components/showcase-core';
import type { ShowcasePropertySnapshot } from './types';

interface ShowcaseSpecsProps {
  property: ShowcasePropertySnapshot;
}

export function ShowcaseSpecs({ property }: ShowcaseSpecsProps) {
  const { t } = useTranslation('showcase');
  return <ShowcaseSpecsGrid title={t('specs.title')} rows={buildRows(property, t)} />;
}

function buildRows(
  p: ShowcasePropertySnapshot,
  t: (key: string) => string,
): ShowcaseSpecsGridRow[] {
  const unit = t('specs.areaUnit');
  const rows: ShowcaseSpecsGridRow[] = [];

  pushSpecRow(rows, t('specs.type'), p.typeLabel || p.type);
  pushSpecRow(rows, t('specs.code'), p.code);
  pushSpecRow(rows, t('specs.building'), p.building);
  pushSpecRow(rows, t('specs.floor'), p.floor !== undefined ? String(p.floor) : undefined);

  if (p.areas?.gross !== undefined) pushSpecRow(rows, t('specs.grossArea'), `${p.areas.gross} ${unit}`);
  if (p.areas?.net !== undefined) pushSpecRow(rows, t('specs.netArea'), `${p.areas.net} ${unit}`);
  if (p.areas?.balcony !== undefined) pushSpecRow(rows, t('specs.balcony'), `${p.areas.balcony} ${unit}`);
  if (p.areas?.terrace !== undefined) pushSpecRow(rows, t('specs.terrace'), `${p.areas.terrace} ${unit}`);
  if (p.areas?.garden !== undefined) pushSpecRow(rows, t('specs.garden'), `${p.areas.garden} ${unit}`);
  if (p.areas?.millesimalShares !== undefined) {
    pushSpecRow(rows, t('specs.millesimalShares'), `${p.areas.millesimalShares}‰`);
  }

  pushSpecRow(rows, t('specs.bedrooms'), p.layout?.bedrooms);
  pushSpecRow(rows, t('specs.bathrooms'), p.layout?.bathrooms);
  pushSpecRow(rows, t('specs.wc'), p.layout?.wc);
  pushSpecRow(rows, t('specs.totalRooms'), p.layout?.totalRooms);
  pushSpecRow(rows, t('specs.balconies'), p.layout?.balconies);

  pushSpecRow(rows, t('specs.condition'), p.condition?.conditionLabel || p.condition?.condition);
  pushSpecRow(rows, t('specs.renovationYear'), p.condition?.renovationYear);
  pushSpecRow(rows, t('specs.deliveryDate'), p.condition?.deliveryDate);

  return rows;
}
