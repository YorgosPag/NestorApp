'use client';

/**
 * @module reports/sections/executive/RevenueTrendChart
 * @enterprise ADR-265 — Revenue over time
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { RevenueTrendPoint } from './types';

interface RevenueTrendChartProps {
  data: RevenueTrendPoint[];
  loading?: boolean;
}

export function RevenueTrendChart({ data, loading }: RevenueTrendChartProps) {
  const { t } = useTranslation('reports');

  const hasData = data.some((point) => point.revenue > 0);

  const series = useMemo<ChartSeries<RevenueTrendPoint>[]>(
    () => [{ key: 'revenue', label: t('executive.revenueTrend.revenue') }],
    [t],
  );

  if (!loading && !hasData) {
    return (
      <ReportSection title={t('executive.revenueTrend.title')} id="revenue-trend">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('executive.revenueTrend.title')}
      description={t('executive.revenueTrend.description')}
      id="revenue-trend"
    >
      <ReportChart
        type="line"
        data={data}
        series={series}
        categoryKey="label"
        categoryLabel={t('chart.category.period')}
        formatValue={formatCurrencyWhole}
      />
    </ReportSection>
  );
}
