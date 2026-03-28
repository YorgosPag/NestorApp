'use client';

/**
 * @module reports/sections/sales/ChequeStatusChart
 * @enterprise ADR-265 Phase 6 — Cheque status distribution pie chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';

interface ChequeStatusChartProps {
  data: { name: string; value: number }[];
  loading?: boolean;
}

export function ChequeStatusChart({ data, loading }: ChequeStatusChartProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = Object.fromEntries(
    data.map((d, i) => [
      `item-${i}`,
      { label: d.name, color: `hsl(var(--report-chart-${(i % 8) + 1}))` },
    ]),
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('sales.cheques.title')} id="cheque-status">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('sales.cheques.title')}
      description={t('sales.cheques.description')}
      id="cheque-status"
    >
      <ReportChart type="pie" data={data} config={chartConfig} height={300} />
    </ReportSection>
  );
}
