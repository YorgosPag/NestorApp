'use client';

/**
 * @module reports/sections/construction/PhaseProgressChart
 * @enterprise ADR-265 Phase 11 — EVM per building (CPI + SPI bars)
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { EVMBuildingItem } from './types';

interface PhaseProgressChartProps {
  data: EVMBuildingItem[];
  loading?: boolean;
}

export function PhaseProgressChart({ data, loading }: PhaseProgressChartProps) {
  const { t } = useTranslation('reports');

  const config: ChartConfig = {
    cpi: { label: t('construction.evm.cpi'), color: 'hsl(var(--report-chart-1))' },
    spi: { label: t('construction.evm.spi'), color: 'hsl(var(--report-chart-3))' },
  };

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
        config={config}
        height={320}
        xAxisKey="building"
      />
    </ReportSection>
  );
}
