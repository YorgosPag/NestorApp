'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { ProjectShowcaseInfo } from '@/types/project-showcase';

interface ProjectShowcaseSpecsProps {
  project: ProjectShowcaseInfo;
}

export function ProjectShowcaseSpecs({ project: p }: ProjectShowcaseSpecsProps) {
  const { t } = useTranslation('showcase');
  const rows = buildRows(p, t);
  if (rows.length === 0) return null;

  return (
    <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
      <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-4">
        {t('projectShowcase.specs.title')}
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
  p: ProjectShowcaseInfo,
  t: (key: string) => string,
): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const push = (label: string, value: string | number | null | undefined) => {
    if (value === undefined || value === null || value === '') return;
    rows.push([label, String(value)]);
  };

  push(t('projectShowcase.specs.code'), p.projectCode);
  push(t('projectShowcase.specs.type'), p.typeLabel);
  push(t('projectShowcase.specs.status'), p.statusLabel);
  push(t('projectShowcase.specs.progress'), p.progress > 0 ? `${p.progress}%` : undefined);
  if (p.totalArea != null)
    push(t('projectShowcase.specs.totalArea'), `${p.totalArea} ${t('projectShowcase.specs.areaUnit')}`);
  if (p.totalValue != null)
    push(t('projectShowcase.specs.totalValue'), formatValue(p.totalValue));
  push(t('projectShowcase.specs.startDate'), p.startDate ? formatDate(p.startDate, { day: 'numeric', month: 'long', year: 'numeric' }) : undefined);
  push(t('projectShowcase.specs.completionDate'), p.completionDate ? formatDate(p.completionDate, { day: 'numeric', month: 'long', year: 'numeric' }) : undefined);
  push(t('projectShowcase.specs.location'), p.location ?? p.address ?? p.city);
  push(t('projectShowcase.specs.client'), p.client ?? p.linkedCompanyName);

  return rows;
}

function formatValue(value: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}
