'use client';

/**
 * @module reports/sections/crm/PipelineFunnelChart
 * @enterprise ADR-265 — Opportunities and value per pipeline stage
 * @enterprise ADR-710 Φάση Γ
 *
 * Two series over one axis: a count and a euro amount. They are plotted together because
 * the comparison is the point, and they are read apart in the data table, where each has
 * its own column and its own units.
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatNumber } from '@/lib/intl-utils';
import type { PipelineStageItem } from './types';

interface PipelineFunnelChartProps {
  data: PipelineStageItem[];
  loading?: boolean;
}

export function PipelineFunnelChart({ data, loading }: PipelineFunnelChartProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<PipelineStageItem>[]>(
    () => [
      { key: 'count', label: t('crm.pipeline.count') },
      { key: 'value', label: t('crm.pipeline.value') },
    ],
    [t],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('crm.pipeline.title')} id="pipeline-funnel">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('crm.pipeline.title')}
      description={t('crm.pipeline.description')}
      id="pipeline-funnel"
    >
      <ReportChart
        type="bar"
        data={data}
        series={series}
        categoryKey="stage"
        categoryLabel={t('chart.category.stage')}
        formatValue={formatNumber}
        size="lg"
      />
    </ReportSection>
  );
}
