'use client';

/**
 * @module reports/sections/projects/RevenueByProjectChart
 * @enterprise ADR-265 Phase 7 — Revenue per project bar chart
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { RevenueByProjectItem } from './types';

interface RevenueByProjectChartProps {
  data: RevenueByProjectItem[];
  loading?: boolean;
}

export function RevenueByProjectChart({ data, loading }: RevenueByProjectChartProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<RevenueByProjectItem>[]>(
    () => [{ key: 'revenue', label: t('projects.revenue.revenue') }],
    [t],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('projects.revenue.title')} id="revenue-project">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('projects.revenue.title')}
      description={t('projects.revenue.description')}
      id="revenue-project"
    >
      <ReportChart
        type="bar"
        data={data}
        series={series}
        categoryKey="project"
        categoryLabel={t('chart.category.project')}
        formatValue={formatCurrencyWhole}
      />
    </ReportSection>
  );
}
