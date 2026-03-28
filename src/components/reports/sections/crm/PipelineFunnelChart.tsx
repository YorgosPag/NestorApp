'use client';

/**
 * @module reports/sections/crm/PipelineFunnelChart
 * @enterprise ADR-265 Phase 8 — Opportunity pipeline by stage
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { PipelineStageItem } from './types';

interface PipelineFunnelChartProps {
  data: PipelineStageItem[];
  loading?: boolean;
}

export function PipelineFunnelChart({ data, loading }: PipelineFunnelChartProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {
    count: {
      label: t('crm.pipeline.count'),
      color: 'hsl(var(--report-chart-1))',
    },
    value: {
      label: t('crm.pipeline.value'),
      color: 'hsl(var(--report-chart-3))',
    },
  };

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
        config={chartConfig}
        xAxisKey="stage"
        height={350}
      />
    </ReportSection>
  );
}
