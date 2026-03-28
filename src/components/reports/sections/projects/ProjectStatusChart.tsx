'use client';

/**
 * @module reports/sections/projects/ProjectStatusChart
 * @enterprise ADR-265 Phase 7 — Projects by status pie chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';

interface ProjectStatusChartProps {
  data: { name: string; value: number }[];
  loading?: boolean;
}

export function ProjectStatusChart({ data, loading }: ProjectStatusChartProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {
    planning: { label: t('projects.status.statuses.planning'), color: 'hsl(var(--report-chart-1))' },
    in_progress: { label: t('projects.status.statuses.in_progress'), color: 'hsl(var(--report-chart-2))' },
    completed: { label: t('projects.status.statuses.completed'), color: 'hsl(var(--report-chart-3))' },
    on_hold: { label: t('projects.status.statuses.on_hold'), color: 'hsl(var(--report-chart-4))' },
    cancelled: { label: t('projects.status.statuses.cancelled'), color: 'hsl(var(--report-chart-5))' },
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('projects.status.title')} id="project-status">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('projects.status.title')}
      description={t('projects.status.description')}
      id="project-status"
    >
      <ReportChart type="pie" data={data} config={chartConfig} height={300} />
    </ReportSection>
  );
}
