'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import {
  ShowcaseSpecsGrid,
  pushSpecRow,
  type ShowcaseSpecsGridRow,
} from '@/components/showcase-core';
import type { ProjectShowcaseInfo } from '@/types/project-showcase';

interface ProjectShowcaseSpecsProps {
  project: ProjectShowcaseInfo;
}

type TFn = (key: string, options?: Record<string, unknown>) => string;

export function ProjectShowcaseSpecs({ project }: ProjectShowcaseSpecsProps) {
  const { t } = useTranslation('showcase');
  const rows = buildProjectSpecRows(project, t);
  return <ShowcaseSpecsGrid title={t('projectShowcase.specs.title')} rows={rows} />;
}

export function buildProjectSpecRows(
  p: ProjectShowcaseInfo,
  t: TFn,
): ShowcaseSpecsGridRow[] {
  const rows: ShowcaseSpecsGridRow[] = [];
  const areaUnit = t('projectShowcase.specs.areaUnit');

  pushSpecRow(rows, t('projectShowcase.specs.code'), p.projectCode);
  pushSpecRow(rows, t('projectShowcase.specs.type'), p.typeLabel);
  pushSpecRow(rows, t('projectShowcase.specs.status'), p.statusLabel);
  pushSpecRow(rows, t('projectShowcase.specs.progress'), p.progress > 0 ? `${p.progress}%` : undefined);
  if (p.totalArea != null) {
    pushSpecRow(rows, t('projectShowcase.specs.totalArea'), `${p.totalArea} ${areaUnit}`);
  }
  if (p.totalValue != null) {
    pushSpecRow(rows, t('projectShowcase.specs.totalValue'), formatEuro(p.totalValue));
  }
  pushSpecRow(
    rows,
    t('projectShowcase.specs.startDate'),
    p.startDate ? formatDate(p.startDate, { day: 'numeric', month: 'long', year: 'numeric' }) : undefined,
  );
  pushSpecRow(
    rows,
    t('projectShowcase.specs.completionDate'),
    p.completionDate
      ? formatDate(p.completionDate, { day: 'numeric', month: 'long', year: 'numeric' })
      : undefined,
  );
  pushSpecRow(rows, t('projectShowcase.specs.location'), p.location ?? p.address ?? p.city);
  pushSpecRow(rows, t('projectShowcase.specs.client'), p.client ?? p.linkedCompanyName);

  return rows;
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}
