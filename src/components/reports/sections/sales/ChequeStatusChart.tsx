'use client';

/**
 * @module reports/sections/sales/ChequeStatusChart
 * @enterprise ADR-265 — Cheques by status
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

/**
 * Cheque lifecycle, as the locale group `sales.cheques.statuses` enumerates it.
 *
 * Eleven values against a palette ceiling of eight: the last three read as the neutral
 * token rather than wrapping onto slot 1, which is what the previous `(n % 8) + 1` did.
 * Visibly unassigned beats two statuses sharing a colour — see ADR-710 §11.7.
 */
const CHEQUE_STATUSES = [
  'received',
  'in_custody',
  'deposited',
  'clearing',
  'cleared',
  'bounced',
  'endorsed',
  'cancelled',
  'expired',
  'replaced',
  'unknown',
] as const;

interface ChequeStatusChartProps {
  data: ReportCategorySlice[];
  loading?: boolean;
}

export function ChequeStatusChart({ data, loading }: ChequeStatusChartProps) {
  const { t } = useTranslation('reports');

  const charts = useMemo(
    () => [
      {
        data,
        categoryLabel: t('chart.category.status'),
        categoryOrder: CHEQUE_STATUSES.map((status) => t(`sales.cheques.statuses.${status}`)),
      },
    ],
    [data, t],
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
      <ReportCategoryPies charts={charts} size="md" />
    </ReportSection>
  );
}
