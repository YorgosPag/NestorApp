'use client';

/**
 * @module reports/sections/projects/PropertyStatusChart
 * @enterprise ADR-265 Phase 7 — Unit commercial status stacked bar per building
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { PropertyStatusByBuildingItem } from './types';

interface PropertyStatusChartProps {
  data: PropertyStatusByBuildingItem[];
  loading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  'sold': 'hsl(var(--report-chart-3))',
  'for-sale': 'hsl(var(--report-chart-1))',
  'reserved': 'hsl(var(--report-chart-4))',
  'for-rent': 'hsl(var(--report-chart-2))',
  'rented': 'hsl(var(--report-chart-5))',
  'unavailable': 'hsl(var(--report-chart-6))',
  'for-sale-and-rent': 'hsl(var(--report-chart-7))',
};

export function PropertyStatusChart({ data, loading }: PropertyStatusChartProps) {
  const { t } = useTranslation('reports');

  // Collect all status keys across buildings
  const allStatuses = new Set<string>();
  for (const item of data) {
    for (const key of Object.keys(item)) {
      if (key !== 'building') allStatuses.add(key);
    }
  }

  const chartConfig: ChartConfig = {};
  for (const status of allStatuses) {
    chartConfig[status] = {
      label: t(`projects.unitStatus.statuses.${status}`),
      color: STATUS_COLORS[status] ?? 'hsl(var(--report-chart-6))',
    };
  }

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('projects.unitStatus.title')} id="unit-status">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('projects.unitStatus.title')}
      description={t('projects.unitStatus.description')}
      id="unit-status"
    >
      <ReportChart
        type="stacked-bar"
        data={data}
        config={chartConfig}
        xAxisKey="building"
        height={350}
      />
    </ReportSection>
  );
}
