'use client';

/**
 * @module reports/sections/projects/PricePerSqmChart
 * @enterprise ADR-265 Phase 7 — Average price per m2 by building
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { PricePerSqmItem } from './types';

interface PricePerSqmChartProps {
  data: PricePerSqmItem[];
  loading?: boolean;
}

export function PricePerSqmChart({ data, loading }: PricePerSqmChartProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {
    pricePerSqm: {
      label: t('projects.pricePerSqm.pricePerSqm'),
      color: 'hsl(var(--report-chart-5))',
    },
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('projects.pricePerSqm.title')} id="price-sqm">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('projects.pricePerSqm.title')}
      description={t('projects.pricePerSqm.description')}
      id="price-sqm"
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
