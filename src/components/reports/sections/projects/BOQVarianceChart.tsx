'use client';

/**
 * @module reports/sections/projects/BOQVarianceChart
 * @enterprise ADR-265 Phase 7 — BOQ estimated vs actual cost by building
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { BOQVarianceItem } from './types';

interface BOQVarianceChartProps {
  data: BOQVarianceItem[];
  loading?: boolean;
}

export function BOQVarianceChart({ data, loading }: BOQVarianceChartProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {
    estimated: {
      label: t('projects.boqVariance.estimated'),
      color: 'hsl(var(--report-chart-1))',
    },
    actual: {
      label: t('projects.boqVariance.actual'),
      color: 'hsl(var(--report-chart-6))',
    },
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('projects.boqVariance.title')} id="boq-variance">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('projects.boqVariance.title')}
      description={t('projects.boqVariance.description')}
      id="boq-variance"
    >
      <ReportChart
        type="bar"
        data={data}
        config={chartConfig}
        xAxisKey="building"
        height={350}
      />
    </ReportSection>
  );
}
