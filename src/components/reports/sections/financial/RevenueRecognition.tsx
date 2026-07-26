'use client';

/**
 * @module reports/sections/financial/RevenueRecognition
 * @enterprise ADR-265 Phase 5 — Earned Value by building bar chart
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { RevenueByBuilding } from './types';

interface RevenueRecognitionProps {
  data: RevenueByBuilding[];
  loading?: boolean;
}

export function RevenueRecognition({ data, loading }: RevenueRecognitionProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<RevenueByBuilding>[]>(
    () => [{ key: 'earnedValue', label: t('financial.revenue.earnedValue') }],
    [t],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection
        title={t('financial.revenue.title')}
        description={t('financial.revenue.description')}
        id="revenue-recognition"
      >
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('financial.revenue.title')}
      description={t('financial.revenue.description')}
      id="revenue-recognition"
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
