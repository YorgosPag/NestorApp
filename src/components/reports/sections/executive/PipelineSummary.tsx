'use client';

/**
 * @module reports/sections/executive/PipelineSummary
 * @enterprise ADR-265 — Pipeline value per stage
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { PipelineStageData } from './types';

interface PipelineSummaryProps {
  data: PipelineStageData[];
  loading?: boolean;
}

export function PipelineSummary({ data, loading }: PipelineSummaryProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<PipelineStageData>[]>(
    () => [{ key: 'value', label: t('executive.pipeline.value') }],
    [t],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('executive.pipeline.title')} id="pipeline-summary">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('executive.pipeline.title')}
      description={t('executive.pipeline.description')}
      id="pipeline-summary"
    >
      <ReportChart
        type="bar"
        data={data}
        series={series}
        categoryKey="stageLabel"
        categoryLabel={t('chart.category.stage')}
        formatValue={formatCurrencyWhole}
        size="sm"
      />
    </ReportSection>
  );
}
