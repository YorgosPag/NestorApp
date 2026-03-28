'use client';

/**
 * @module reports/sections/crm/TeamPerformanceChart
 * @enterprise ADR-265 Phase 8 — Tasks per team member bar chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';

interface TeamPerformanceChartProps {
  data: { assignee: string; tasks: number }[];
  loading?: boolean;
}

export function TeamPerformanceChart({ data, loading }: TeamPerformanceChartProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {
    tasks: {
      label: t('crm.team.tasks'),
      color: 'hsl(var(--report-chart-4))',
    },
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('crm.team.title')} id="team-performance">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('crm.team.title')}
      description={t('crm.team.description')}
      id="team-performance"
    >
      <ReportChart
        type="bar"
        data={data}
        config={chartConfig}
        xAxisKey="assignee"
        height={300}
      />
    </ReportSection>
  );
}
