'use client';

/**
 * @module reports/sections/compliance/InsuranceClassChart
 * @enterprise ADR-265 — Workers per insurance class
 * @enterprise ADR-710 Φάση Γ
 *
 * One series, one colour. The previous version gave every bar its own palette slot by
 * position, which encodes nothing: the bars are already told apart by where they sit on
 * the axis, and a second, meaningless encoding costs the reader the assumption that
 * colour means something here. The insurance classes are also open-ended, so a slot taken
 * by position would move the moment a class appeared or disappeared.
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatNumber } from '@/lib/intl-utils';

interface InsuranceClassBar {
  name: string;
  value: number;
}

interface InsuranceClassChartProps {
  data: InsuranceClassBar[];
  loading?: boolean;
}

export function InsuranceClassChart({ data, loading }: InsuranceClassChartProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<InsuranceClassBar>[]>(
    () => [{ key: 'value', label: t('chart.series.count') }],
    [t],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('compliance.insurance.title')} id="insurance-class">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('compliance.insurance.title')}
      description={t('compliance.insurance.description')}
      id="insurance-class"
    >
      <ReportChart
        type="bar"
        data={data}
        series={series}
        categoryKey="name"
        categoryLabel={t('chart.category.insuranceClass')}
        formatValue={formatNumber}
      />
    </ReportSection>
  );
}
