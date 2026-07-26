'use client';

/**
 * @module reports/sections/projects/ProjectProgressChart
 * @enterprise ADR-265 Phase 7 — Project completion bar chart
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatPercentage } from '@/lib/intl-utils';
import type { ProjectProgressItem } from './types';

interface ProjectProgressChartProps {
  data: ProjectProgressItem[];
  loading?: boolean;
}

export function ProjectProgressChart({ data, loading }: ProjectProgressChartProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<ProjectProgressItem>[]>(
    () => [{ key: 'progress', label: t('projects.progress.progress') }],
    [t],
  );

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
        series={series}
        categoryKey="name"
        categoryLabel={t('chart.category.project')}
        formatValue={formatPercentage}
      />
    </ReportSection>
  );
}
