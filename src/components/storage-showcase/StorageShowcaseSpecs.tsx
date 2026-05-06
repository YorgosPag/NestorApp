'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  ShowcaseSpecsGrid,
  pushSpecRow,
  type ShowcaseSpecsGridRow,
} from '@/components/showcase-core';
import type { StorageShowcasePayload } from '@/types/storage-showcase';

interface StorageShowcaseSpecsProps {
  storage: StorageShowcasePayload['storage'];
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function StorageShowcaseSpecs({ storage }: StorageShowcaseSpecsProps) {
  const { t } = useTranslation('showcase');
  const rows: ShowcaseSpecsGridRow[] = [];
  const areaUnit = t('storageShowcase.specs.areaUnit');

  pushSpecRow(rows, t('storageShowcase.specs.code'), storage.code);
  pushSpecRow(rows, t('storageShowcase.specs.type'), storage.typeLabel);
  pushSpecRow(rows, t('storageShowcase.specs.status'), storage.statusLabel);
  if (storage.area != null) {
    pushSpecRow(rows, t('storageShowcase.specs.area'), `${storage.area} ${areaUnit}`);
  }
  if (storage.price != null) {
    pushSpecRow(rows, t('storageShowcase.specs.price'), formatEuro(storage.price));
  }
  pushSpecRow(rows, t('storageShowcase.specs.floor'), storage.floor);
  pushSpecRow(rows, t('storageShowcase.specs.building'), storage.buildingName);

  return <ShowcaseSpecsGrid title={t('storageShowcase.specs.title')} rows={rows} />;
}
