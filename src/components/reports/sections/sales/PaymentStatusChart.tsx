'use client';

/**
 * @module reports/sections/sales/PaymentStatusChart
 * @enterprise ADR-265 — Paid against outstanding
 * @enterprise ADR-710 §11.6
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportCategoryPies,
  ReportEmptyState,
  type ReportCategorySlice,
} from '@/components/reports/core';
import { formatCurrencyWhole } from '@/lib/intl-utils';

interface PaymentStatusChartProps {
  data: ReportCategorySlice[];
  loading?: boolean;
}

export function PaymentStatusChart({ data, loading }: PaymentStatusChartProps) {
  const { t } = useTranslation('reports');

  const charts = useMemo(
    () => [
      {
        data,
        categoryLabel: t('chart.category.status'),
        categoryOrder: [t('sales.payment.paid'), t('sales.payment.outstanding')],
        // Two euro amounts, not two counts — the slices are money.
        valueLabel: t('chart.series.amount'),
        formatValue: formatCurrencyWhole,
      },
    ],
    [data, t],
  );

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
      <ReportCategoryPies charts={charts} size="md" />
    </ReportSection>
  );
}
