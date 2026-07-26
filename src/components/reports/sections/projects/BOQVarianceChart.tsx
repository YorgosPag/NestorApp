'use client';

/**
 * @module reports/sections/projects/BOQVarianceChart
 * @enterprise ADR-265 Phase 7 — BOQ estimated vs actual cost by building
 * @enterprise ADR-710 Φάση Γ — declares its series; it does not choose colours
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { BOQVarianceItem } from './types';

interface BOQVarianceChartProps {
  data: BOQVarianceItem[];
  loading?: boolean;
}

export function BOQVarianceChart({ data, loading }: BOQVarianceChartProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<BOQVarianceItem>[]>(
    () => [
      { key: 'estimated', label: t('projects.boqVariance.estimated') },
      { key: 'actual', label: t('projects.boqVariance.actual') },
    ],
    [t],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('projects.boqVariance.title')} id="boq-variance">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('projects.boqVariance.title')}
      description={t('projects.boqVariance.description')}
      id="boq-variance"
    >
      <ReportChart
        type="bar"
        data={data}
        series={series}
        categoryKey="building"
        categoryLabel={t('chart.category.building')}
        formatValue={formatCurrencyWhole}
        size="lg"
      />
    </ReportSection>
  );
}
