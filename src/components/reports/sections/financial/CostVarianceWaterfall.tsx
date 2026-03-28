'use client';

/**
 * @module reports/sections/financial/CostVarianceWaterfall
 * @enterprise ADR-265 Phase 5 — Budget vs Actual grouped bar chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportChart,
  ReportEmptyState,
} from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { CostVarianceItem } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CostVarianceWaterfallProps {
  data: CostVarianceItem[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CostVarianceWaterfall({ data, loading }: CostVarianceWaterfallProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {
    estimated: {
      label: t('financial.costVariance.estimated'),
      color: 'hsl(var(--report-chart-1))',
    },
    actual: {
      label: t('financial.costVariance.actual'),
      color: 'hsl(var(--report-chart-6))',
    },
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection
        title={t('financial.costVariance.title')}
        description={t('financial.costVariance.description')}
        id="cost-variance"
      >
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('financial.costVariance.title')}
      description={t('financial.costVariance.description')}
      id="cost-variance"
    >
      <ReportChart
        type="bar"
        data={data}
        config={chartConfig}
        xAxisKey="building"
        height={300}
      />
    </ReportSection>
  );
}
