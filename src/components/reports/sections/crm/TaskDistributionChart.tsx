'use client';

/**
 * @module reports/sections/crm/TaskDistributionChart
 * @enterprise ADR-265 — Tasks by status and by priority
 * @enterprise ADR-710 §11.6
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportCategoryPies,
  buildCategoryPie,
  ReportEmptyState,
} from '@/components/reports/core';
import { PRIORITY_LEVELS } from '@/constants/priority-levels';
import type { TaskDistributionItem } from './types';

/** Task lifecycle, as the locale group `crm.taskStatuses` enumerates it. */
const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;

interface TaskDistributionChartProps {
  statusData: TaskDistributionItem[];
  priorityData: TaskDistributionItem[];
  loading?: boolean;
}

export function TaskDistributionChart({
  statusData,
  priorityData,
  loading,
}: TaskDistributionChartProps) {
  const { t } = useTranslation('reports');

  const charts = useMemo(
    () => [
      buildCategoryPie(t, {
        data: statusData,
        labelKey: 'chart.category.status',
        keys: TASK_STATUSES,
        keyPrefix: 'crm.taskStatuses',
      }),
      // Priority order from the PRIORITY_LEVELS SSoT — low to critical, never retyped.
      buildCategoryPie(t, {
        data: priorityData,
        labelKey: 'chart.category.priority',
        keys: PRIORITY_LEVELS,
        keyPrefix: 'crm.priorities',
      }),
    ],
    [statusData, priorityData, t],
  );

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
      <ReportCategoryPies charts={charts} />
    </ReportSection>
  );
}
