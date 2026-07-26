'use client';

/**
 * @module reports/sections/construction/MilestoneCompletionChart
 * @enterprise ADR-265 — Milestones by status
 * @enterprise ADR-710 §11.6
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportCategoryPies,
  ReportEmptyState,
  type ReportCategorySlice,
} from '@/components/reports/core';

/**
 * Milestone lifecycle, best outcome first. Declared here because the domain has no
 * constant of its own yet; the locale group `construction.milestones.statuses` is the
 * only other place that enumerates it, and the two must not drift.
 */
const MILESTONE_STATUSES = [
  'completed',
  'in_progress',
  'pending',
  'overdue',
  'cancelled',
  'unknown',
] as const;

interface MilestoneCompletionChartProps {
  data: ReportCategorySlice[];
  loading?: boolean;
}

export function MilestoneCompletionChart({ data, loading }: MilestoneCompletionChartProps) {
  const { t } = useTranslation('reports');

  const charts = useMemo(
    () => [
      {
        data,
        categoryLabel: t('chart.category.status'),
        categoryOrder: MILESTONE_STATUSES.map((status) =>
          t(`construction.milestones.statuses.${status}`),
        ),
      },
    ],
    [data, t],
  );

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
      <ReportCategoryPies charts={charts} size="md" />
    </ReportSection>
  );
}
