'use client';

/**
 * @module reports/sections/crm/TeamPerformanceChart
 * @enterprise ADR-265 — Tasks per assignee
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatNumber } from '@/lib/intl-utils';

interface AssigneeBar {
  assignee: string;
  tasks: number;
}

interface TeamPerformanceChartProps {
  data: AssigneeBar[];
  loading?: boolean;
}

export function TeamPerformanceChart({ data, loading }: TeamPerformanceChartProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<AssigneeBar>[]>(
    () => [{ key: 'tasks', label: t('crm.team.tasks') }],
    [t],
  );

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
        series={series}
        categoryKey="assignee"
        categoryLabel={t('chart.category.assignee')}
        formatValue={formatNumber}
      />
    </ReportSection>
  );
}
