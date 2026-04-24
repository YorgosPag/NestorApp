'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import {
  ShowcaseSpecsGrid,
  pushSpecRow,
  type ShowcaseSpecsGridRow,
} from '@/components/showcase-core';
import type { BuildingShowcaseInfo } from '@/types/building-showcase';

interface BuildingShowcaseSpecsProps {
  building: BuildingShowcaseInfo;
}

type TFn = (key: string, options?: Record<string, unknown>) => string;

export function BuildingShowcaseSpecs({ building }: BuildingShowcaseSpecsProps) {
  const { t } = useTranslation('showcase');
  const rows = buildBuildingSpecRows(building, t);
  return <ShowcaseSpecsGrid title={t('buildingShowcase.specs.title')} rows={rows} />;
}

export function buildBuildingSpecRows(
  b: BuildingShowcaseInfo,
  t: TFn,
): ShowcaseSpecsGridRow[] {
  const rows: ShowcaseSpecsGridRow[] = [];
  const areaUnit = t('buildingShowcase.specs.areaUnit');

  pushSpecRow(rows, t('buildingShowcase.specs.code'), b.code);
  pushSpecRow(rows, t('buildingShowcase.specs.type'), b.typeLabel);
  pushSpecRow(rows, t('buildingShowcase.specs.status'), b.statusLabel);
  pushSpecRow(
    rows,
    t('buildingShowcase.specs.progress'),
    b.progress > 0 ? `${b.progress}%` : undefined,
  );
  if (b.totalArea != null) {
    pushSpecRow(rows, t('buildingShowcase.specs.totalArea'), `${b.totalArea} ${areaUnit}`);
  }
  if (b.builtArea != null) {
    pushSpecRow(rows, t('buildingShowcase.specs.builtArea'), `${b.builtArea} ${areaUnit}`);
  }
  pushSpecRow(rows, t('buildingShowcase.specs.floors'), b.floors);
  pushSpecRow(rows, t('buildingShowcase.specs.units'), b.units);
  pushSpecRow(rows, t('buildingShowcase.specs.energyClass'), b.energyClassLabel);
  pushSpecRow(rows, t('buildingShowcase.specs.renovation'), b.renovationLabel);
  pushSpecRow(rows, t('buildingShowcase.specs.constructionYear'), b.constructionYear);
  if (b.totalValue != null) {
    pushSpecRow(rows, t('buildingShowcase.specs.totalValue'), formatEuro(b.totalValue));
  }
  pushSpecRow(
    rows,
    t('buildingShowcase.specs.startDate'),
    b.startDate ? formatDate(b.startDate, { day: 'numeric', month: 'long', year: 'numeric' }) : undefined,
  );
  pushSpecRow(
    rows,
    t('buildingShowcase.specs.completionDate'),
    b.completionDate
      ? formatDate(b.completionDate, { day: 'numeric', month: 'long', year: 'numeric' })
      : undefined,
  );
  pushSpecRow(rows, t('buildingShowcase.specs.location'), b.location ?? b.address ?? b.city);
  pushSpecRow(rows, t('buildingShowcase.specs.project'), b.projectName);
  pushSpecRow(rows, t('buildingShowcase.specs.linkedCompany'), b.linkedCompanyName);

  return rows;
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}
