'use client';

/**
 * @module reports/sections/projects/PricePerSqmChart
 * @enterprise ADR-265 Phase 7 — Average price per m2 by building
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { PricePerSqmItem } from './types';

interface PricePerSqmChartProps {
  data: PricePerSqmItem[];
  loading?: boolean;
}

export function PricePerSqmChart({ data, loading }: PricePerSqmChartProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<PricePerSqmItem>[]>(
    () => [{ key: 'pricePerSqm', label: t('projects.pricePerSqm.pricePerSqm') }],
    [t],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('projects.pricePerSqm.title')} id="price-sqm">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('projects.pricePerSqm.title')}
      description={t('projects.pricePerSqm.description')}
      id="price-sqm"
    >
      <ReportChart
        type="bar"
        data={data}
        series={series}
        categoryKey="building"
        categoryLabel={t('chart.category.building')}
        formatValue={formatCurrencyWhole}
      />
    </ReportSection>
  );
}
