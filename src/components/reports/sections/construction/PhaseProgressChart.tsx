'use client';

/**
 * @module reports/sections/construction/PhaseProgressChart
 * @enterprise ADR-265 — CPI / SPI per building
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatNumber } from '@/lib/intl-utils';
import type { EVMBuildingItem } from './types';

interface PhaseProgressChartProps {
  data: EVMBuildingItem[];
  loading?: boolean;
}

/** CPI and SPI are indices around 1.00; two decimals is what makes them readable. */
const INDEX_FORMAT: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

function formatIndex(value: number): string {
  return formatNumber(value, INDEX_FORMAT);
}

export function PhaseProgressChart({ data, loading }: PhaseProgressChartProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<EVMBuildingItem>[]>(
    () => [
      { key: 'cpi', label: t('construction.evm.cpi') },
      { key: 'spi', label: t('construction.evm.spi') },
    ],
    [t],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('construction.evm.title')} id="phase-progress">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('construction.evm.title')}
      description={t('construction.evm.description')}
      id="phase-progress"
    >
      <ReportChart
        type="bar"
        data={data}
        series={series}
        categoryKey="building"
        categoryLabel={t('chart.category.building')}
        formatValue={formatIndex}
      />
    </ReportSection>
  );
}
