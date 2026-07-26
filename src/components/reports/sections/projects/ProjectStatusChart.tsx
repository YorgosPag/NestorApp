'use client';

/**
 * @module reports/sections/projects/ProjectStatusChart
 * @enterprise ADR-265 Phase 7 — Projects by status pie chart
 * @enterprise ADR-710 §11.6 — colour is the position in the declared vocabulary
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportCategoryPies,
  buildCategoryPie,
  ReportEmptyState,
  type ReportCategorySlice,
} from '@/components/reports/core';
import { ACTIVE_PROJECT_STATUSES } from '@/constants/project-statuses';

interface ProjectStatusChartProps {
  data: ReportCategorySlice[];
  loading?: boolean;
}

export function ProjectStatusChart({ data, loading }: ProjectStatusChartProps) {
  const { t } = useTranslation('reports');

  /**
   * The vocabulary comes from the status SSoT, never from the rows: a status with no
   * projects is filtered out upstream, and colour taken from the row rank would then
   * repaint every status below it. It is mapped through `t` because the rows carry the
   * translated label — the ordering itself stays canonical.
   */
  const charts = useMemo(
    () => [
      buildCategoryPie(t, {
        data,
        labelKey: 'chart.category.status',
        keys: ACTIVE_PROJECT_STATUSES,
        keyPrefix: 'projects.status.statuses',
      }),
    ],
    [data, t],
  );

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
      <ReportCategoryPies charts={charts} size="md" />
    </ReportSection>
  );
}
