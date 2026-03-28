'use client';

/**
 * @module reports/sections/executive/RevenueTrendChart
 * @enterprise ADR-265 Phase 4 — Monthly revenue line chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportChart,
  ReportEmptyState,
} from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { RevenueTrendPoint } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RevenueTrendChartProps {
  data: RevenueTrendPoint[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RevenueTrendChart({ data, loading }: RevenueTrendChartProps) {
  const { t } = useTranslation('reports');

  const hasData = data.some(d => d.revenue > 0);

  const chartConfig: ChartConfig = {
    revenue: {
      label: t('executive.revenueTrend.revenue'),
      color: 'hsl(var(--report-chart-1))',
    },
  };

  if (!loading && !hasData) {
    return (
      <ReportSection
        title={t('executive.revenueTrend.title')}
        description={t('executive.revenueTrend.description')}
        id="revenue-trend"
      >
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
        config={chartConfig}
        xAxisKey="label"
        height={300}
      />
    </ReportSection>
  );
}
