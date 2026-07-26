'use client';

/**
 * @module reports/sections/construction/BOQCostBreakdownChart
 * @enterprise ADR-265 — BOQ estimated vs actual by building
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { BOQComparisonItem } from './types';

interface BOQCostBreakdownChartProps {
  data: BOQComparisonItem[];
  loading?: boolean;
}

export function BOQCostBreakdownChart({ data, loading }: BOQCostBreakdownChartProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<BOQComparisonItem>[]>(
    () => [
      { key: 'estimated', label: t('construction.boq.estimated') },
      { key: 'actual', label: t('construction.boq.actual') },
    ],
    [t],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('construction.boq.title')} id="boq-cost-breakdown">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('construction.boq.title')}
      description={t('construction.boq.description')}
      id="boq-cost-breakdown"
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
