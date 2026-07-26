'use client';

/**
 * @module reports/sections/financial/CostVarianceWaterfall
 * @enterprise ADR-265 Phase 5 — Budget vs Actual grouped bar chart
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { CostVarianceItem } from './types';

interface CostVarianceWaterfallProps {
  data: CostVarianceItem[];
  loading?: boolean;
}

export function CostVarianceWaterfall({ data, loading }: CostVarianceWaterfallProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<CostVarianceItem>[]>(
    () => [
      { key: 'estimated', label: t('financial.costVariance.estimated') },
      { key: 'actual', label: t('financial.costVariance.actual') },
    ],
    [t],
  );

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
        series={series}
        categoryKey="building"
        categoryLabel={t('chart.category.building')}
        formatValue={formatCurrencyWhole}
      />
    </ReportSection>
  );
}
