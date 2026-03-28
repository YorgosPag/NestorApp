'use client';

/**
 * @module reports/sections/sales/PaymentStatusChart
 * @enterprise ADR-265 Phase 6 — Payment coverage pie chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';

interface PaymentStatusChartProps {
  data: { name: string; value: number }[];
  loading?: boolean;
}

export function PaymentStatusChart({ data, loading }: PaymentStatusChartProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {
    paid: {
      label: t('sales.payment.paid'),
      color: 'hsl(var(--report-chart-3))',
    },
    outstanding: {
      label: t('sales.payment.outstanding'),
      color: 'hsl(var(--report-chart-6))',
    },
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('sales.payment.title')} id="payment-status">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('sales.payment.title')}
      description={t('sales.payment.description')}
      id="payment-status"
    >
      <ReportChart type="pie" data={data} config={chartConfig} height={300} />
    </ReportSection>
  );
}
