'use client';

/**
 * @module reports/sections/construction/BOQCostBreakdownChart
 * @enterprise ADR-265 Phase 11 — BOQ estimated vs actual per building
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { BOQComparisonItem } from './types';

interface BOQCostBreakdownChartProps {
  data: BOQComparisonItem[];
  loading?: boolean;
}

export function BOQCostBreakdownChart({ data, loading }: BOQCostBreakdownChartProps) {
  const { t } = useTranslation('reports');

  const config: ChartConfig = {
    estimated: { label: t('construction.boq.estimated'), color: 'hsl(var(--report-chart-1))' },
    actual: { label: t('construction.boq.actual'), color: 'hsl(var(--report-chart-4))' },
  };

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
        config={config}
        height={320}
        xKey="building"
        bars={['estimated', 'actual']}
      />
    </ReportSection>
  );
}
