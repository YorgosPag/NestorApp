'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  ShowcaseSpecsGrid,
  pushSpecRow,
  type ShowcaseSpecsGridRow,
} from '@/components/showcase-core';
import type { ParkingShowcasePayload } from '@/types/parking-showcase';

interface ParkingShowcaseSpecsProps {
  parking: ParkingShowcasePayload['parking'];
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function ParkingShowcaseSpecs({ parking }: ParkingShowcaseSpecsProps) {
  const { t } = useTranslation('showcase');
  const rows: ShowcaseSpecsGridRow[] = [];
  const areaUnit = t('parkingShowcase.specs.areaUnit');

  pushSpecRow(rows, t('parkingShowcase.specs.code'), parking.code);
  pushSpecRow(rows, t('parkingShowcase.specs.type'), parking.typeLabel);
  pushSpecRow(rows, t('parkingShowcase.specs.status'), parking.statusLabel);
  pushSpecRow(rows, t('parkingShowcase.specs.locationZone'), parking.locationZoneLabel);
  if (parking.area != null) {
    pushSpecRow(rows, t('parkingShowcase.specs.area'), `${parking.area} ${areaUnit}`);
  }
  if (parking.price != null) {
    pushSpecRow(rows, t('parkingShowcase.specs.price'), formatEuro(parking.price));
  }
  pushSpecRow(rows, t('parkingShowcase.specs.floor'), parking.floor);
  pushSpecRow(rows, t('parkingShowcase.specs.building'), parking.buildingName);

  return <ShowcaseSpecsGrid title={t('parkingShowcase.specs.title')} rows={rows} />;
}
