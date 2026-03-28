'use client';

/**
 * @module reports/sections/projects/ProjectProgressChart
 * @enterprise ADR-265 Phase 7 — Project completion bar chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { ProjectProgressItem } from './types';

interface ProjectProgressChartProps {
  data: ProjectProgressItem[];
  loading?: boolean;
}

export function ProjectProgressChart({ data, loading }: ProjectProgressChartProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {
    progress: {
      label: t('projects.progress.progress'),
      color: 'hsl(var(--report-chart-2))',
    },
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('projects.progress.title')} id="project-progress">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('projects.progress.title')}
      description={t('projects.progress.description')}
      id="project-progress"
    >
      <ReportChart
        type="bar"
        data={data}
        config={chartConfig}
        xAxisKey="name"
        height={300}
      />
    </ReportSection>
  );
}
