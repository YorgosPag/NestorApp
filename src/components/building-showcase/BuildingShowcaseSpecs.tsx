'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { BuildingShowcaseInfo } from '@/types/building-showcase';

interface BuildingShowcaseSpecsProps {
  building: BuildingShowcaseInfo;
}

export function BuildingShowcaseSpecs({ building: b }: BuildingShowcaseSpecsProps) {
  const { t } = useTranslation('showcase');
  const rows = buildRows(b, t);
  if (rows.length === 0) return null;

  return (
    <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
      <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-4">
        {t('buildingShowcase.specs.title')}
      </h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-3 border-b border-[hsl(var(--showcase-border))] pb-2"
          >
            <dt className="text-[hsl(var(--showcase-muted-fg))]">{label}</dt>
            <dd className="text-[hsl(var(--showcase-fg))] font-medium text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function buildRows(
  b: BuildingShowcaseInfo,
  t: (key: string) => string,
): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const push = (label: string, value: string | number | null | undefined) => {
    if (value === undefined || value === null || value === '') return;
    rows.push([label, String(value)]);
  };

  const areaUnit = t('buildingShowcase.specs.areaUnit');
  push(t('buildingShowcase.specs.code'), b.code);
  push(t('buildingShowcase.specs.type'), b.typeLabel);
  push(t('buildingShowcase.specs.status'), b.statusLabel);
  push(t('buildingShowcase.specs.progress'), b.progress > 0 ? `${b.progress}%` : undefined);
  if (b.totalArea != null) push(t('buildingShowcase.specs.totalArea'), `${b.totalArea} ${areaUnit}`);
  if (b.builtArea != null) push(t('buildingShowcase.specs.builtArea'), `${b.builtArea} ${areaUnit}`);
  push(t('buildingShowcase.specs.floors'), b.floors);
  push(t('buildingShowcase.specs.units'), b.units);
  push(t('buildingShowcase.specs.energyClass'), b.energyClassLabel);
  push(t('buildingShowcase.specs.renovation'), b.renovationLabel);
  push(t('buildingShowcase.specs.constructionYear'), b.constructionYear);
  if (b.totalValue != null) push(t('buildingShowcase.specs.totalValue'), formatValue(b.totalValue));
  push(
    t('buildingShowcase.specs.startDate'),
    b.startDate ? formatDate(b.startDate, { day: 'numeric', month: 'long', year: 'numeric' }) : undefined,
  );
  push(
    t('buildingShowcase.specs.completionDate'),
    b.completionDate ? formatDate(b.completionDate, { day: 'numeric', month: 'long', year: 'numeric' }) : undefined,
  );
  push(t('buildingShowcase.specs.location'), b.location ?? b.address ?? b.city);
  push(t('buildingShowcase.specs.project'), b.projectName);
  push(t('buildingShowcase.specs.linkedCompany'), b.linkedCompanyName);

  return rows;
}

function formatValue(value: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}
