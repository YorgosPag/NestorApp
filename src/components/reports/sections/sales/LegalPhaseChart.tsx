'use client';

/**
 * @module reports/sections/sales/LegalPhaseChart
 * @enterprise ADR-265 — Properties per legal phase
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatNumber } from '@/lib/intl-utils';

interface LegalPhaseBar {
  phase: string;
  count: number;
}

interface LegalPhaseChartProps {
  data: LegalPhaseBar[];
  loading?: boolean;
}

export function LegalPhaseChart({ data, loading }: LegalPhaseChartProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<LegalPhaseBar>[]>(
    () => [{ key: 'count', label: t('sales.legal.count') }],
    [t],
  );

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
        series={series}
        categoryKey="phase"
        categoryLabel={t('chart.category.phase')}
        formatValue={formatNumber}
        size="sm"
      />
    </ReportSection>
  );
}
