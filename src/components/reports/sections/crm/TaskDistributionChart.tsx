'use client';

/**
 * @module reports/sections/crm/TaskDistributionChart
 * @enterprise ADR-265 Phase 8 — Tasks by status and priority pie charts
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';

interface TaskDistributionChartProps {
  statusData: { name: string; value: number }[];
  priorityData: { name: string; value: number }[];
  loading?: boolean;
}

export function TaskDistributionChart({ statusData, priorityData, loading }: TaskDistributionChartProps) {
  const { t } = useTranslation('reports');

  const statusConfig: ChartConfig = {
    pending: { label: t('crm.taskStatuses.pending'), color: 'hsl(var(--report-chart-4))' },
    in_progress: { label: t('crm.taskStatuses.in_progress'), color: 'hsl(var(--report-chart-1))' },
    completed: { label: t('crm.taskStatuses.completed'), color: 'hsl(var(--report-chart-3))' },
    cancelled: { label: t('crm.taskStatuses.cancelled'), color: 'hsl(var(--report-chart-6))' },
  };

  const priorityConfig: ChartConfig = {
    low: { label: t('crm.priorities.low'), color: 'hsl(var(--report-chart-2))' },
    medium: { label: t('crm.priorities.medium'), color: 'hsl(var(--report-chart-4))' },
    high: { label: t('crm.priorities.high'), color: 'hsl(var(--report-chart-5))' },
    critical: { label: t('crm.priorities.critical'), color: 'hsl(var(--report-chart-6))' },
  };

  const hasData = statusData.length > 0 || priorityData.length > 0;

  if (!loading && !hasData) {
    return (
      <ReportSection title={t('crm.tasks.title')} id="task-distribution">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('crm.tasks.title')}
      description={t('crm.tasks.description')}
      id="task-distribution"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {statusData.length > 0 && (
          <ReportChart type="pie" data={statusData} config={statusConfig} height={280} />
        )}
        {priorityData.length > 0 && (
          <ReportChart type="pie" data={priorityData} config={priorityConfig} height={280} />
        )}
      </div>
    </ReportSection>
  );
}
