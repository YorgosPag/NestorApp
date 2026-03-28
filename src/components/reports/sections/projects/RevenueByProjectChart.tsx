'use client';

/**
 * @module reports/sections/projects/RevenueByProjectChart
 * @enterprise ADR-265 Phase 7 — Revenue per project bar chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { RevenueByProjectItem } from './types';

interface RevenueByProjectChartProps {
  data: RevenueByProjectItem[];
  loading?: boolean;
}

export function RevenueByProjectChart({ data, loading }: RevenueByProjectChartProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {
    revenue: {
      label: t('projects.revenue.revenue'),
      color: 'hsl(var(--report-chart-3))',
    },
  };

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
        config={chartConfig}
        xAxisKey="project"
        height={300}
      />
    </ReportSection>
  );
}
