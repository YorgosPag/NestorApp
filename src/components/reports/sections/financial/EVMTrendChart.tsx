'use client';

/**
 * @module reports/sections/financial/EVMTrendChart
 * @enterprise ADR-265 Phase 5 — S-Curve (PV / EV / AC) line chart
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { SCurveDataPoint } from '@/services/report-engine';

interface EVMTrendChartProps {
  data: SCurveDataPoint[];
  loading?: boolean;
}

export function EVMTrendChart({ data, loading }: EVMTrendChartProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<SCurveDataPoint>[]>(
    () => [
      { key: 'plannedValue', label: t('financial.scurve.pv') },
      { key: 'earnedValue', label: t('financial.scurve.ev') },
      { key: 'actualCost', label: t('financial.scurve.ac') },
    ],
    [t],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection
        title={t('financial.scurve.title')}
        description={t('financial.scurve.description')}
        id="evm-scurve"
      >
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('financial.scurve.title')}
      description={t('financial.scurve.description')}
      id="evm-scurve"
    >
      <ReportChart
        type="line"
        data={data}
        series={series}
        categoryKey="date"
        categoryLabel={t('chart.category.date')}
        formatValue={formatCurrencyWhole}
        size="lg"
      />
    </ReportSection>
  );
}
