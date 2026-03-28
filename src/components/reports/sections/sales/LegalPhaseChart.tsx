'use client';

/**
 * @module reports/sections/sales/LegalPhaseChart
 * @enterprise ADR-265 Phase 6 — Legal phase distribution bar chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';

interface LegalPhaseChartProps {
  data: { phase: string; count: number }[];
  loading?: boolean;
}

export function LegalPhaseChart({ data, loading }: LegalPhaseChartProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {
    count: {
      label: t('sales.legal.count'),
      color: 'hsl(var(--report-chart-4))',
    },
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('sales.legal.title')} id="legal-phases">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('sales.legal.title')}
      description={t('sales.legal.description')}
      id="legal-phases"
    >
      <ReportChart
        type="bar"
        data={data}
        config={chartConfig}
        xAxisKey="phase"
        height={280}
      />
    </ReportSection>
  );
}
