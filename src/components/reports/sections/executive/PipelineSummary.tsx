'use client';

/**
 * @module reports/sections/executive/PipelineSummary
 * @enterprise ADR-265 Phase 4 — CRM pipeline summary bar chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportChart,
  ReportEmptyState,
} from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { PipelineStageData } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PipelineSummaryProps {
  data: PipelineStageData[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PipelineSummary({ data, loading }: PipelineSummaryProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {
    value: {
      label: t('executive.pipeline.value'),
      color: 'hsl(var(--report-chart-2))',
    },
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection
        title={t('executive.pipeline.title')}
        description={t('executive.pipeline.description')}
        id="pipeline-summary"
      >
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
        config={chartConfig}
        xAxisKey="stageLabel"
        height={280}
      />
    </ReportSection>
  );
}
