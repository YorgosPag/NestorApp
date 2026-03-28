'use client';

/**
 * @module reports/sections/construction/MilestoneCompletionChart
 * @enterprise ADR-265 Phase 11 — Milestones by status bar chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';

interface MilestoneCompletionChartProps {
  data: { name: string; value: number }[];
  loading?: boolean;
}

export function MilestoneCompletionChart({ data, loading }: MilestoneCompletionChartProps) {
  const { t } = useTranslation('reports');

  const config: ChartConfig = {
    completed: { label: t('construction.milestones.statuses.completed'), color: 'hsl(var(--report-chart-3))' },
    in_progress: { label: t('construction.milestones.statuses.in_progress'), color: 'hsl(var(--report-chart-1))' },
    pending: { label: t('construction.milestones.statuses.pending'), color: 'hsl(var(--report-chart-4))' },
    overdue: { label: t('construction.milestones.statuses.overdue'), color: 'hsl(var(--report-chart-6))' },
    cancelled: { label: t('construction.milestones.statuses.cancelled'), color: 'hsl(var(--report-chart-5))' },
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('construction.milestones.title')} id="milestone-completion">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('construction.milestones.title')}
      description={t('construction.milestones.description')}
      id="milestone-completion"
    >
      <ReportChart type="pie" data={data} config={config} height={300} />
    </ReportSection>
  );
}
