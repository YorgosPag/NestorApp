'use client';

/**
 * @module reports/sections/sales/OverdueAgingSection
 * @enterprise ADR-265 Phase 6 — Overdue payments aging table
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportAgingTable,
  ReportEmptyState,
  type AgingRow,
} from '@/components/reports/core';
import type { AgingBucketResult } from '@/services/report-engine';

interface OverdueAgingSectionProps {
  agingBuckets: AgingBucketResult[];
  loading?: boolean;
}

const BUCKET_LABELS: Record<string, string> = {
  current: '0-30',
  days31to60: '31-60',
  days61to90: '61-90',
  days91to120: '91-120',
  days120plus: '120+',
};

function toAgingRows(
  buckets: AgingBucketResult[],
  t: (k: string) => string,
): AgingRow[] {
  const total = buckets.reduce((s, b) => s + b.amount, 0);
  if (total === 0) return [];

  return [{
    id: 'portfolio',
    name: t('sales.aging.portfolio'),
    total,
    buckets: buckets.map(b => ({
      label: BUCKET_LABELS[b.key] ?? b.key,
      count: b.count,
      amount: b.amount,
    })),
    overdue: buckets.some(b => b.key !== 'current' && b.amount > 0),
  }];
}

export function OverdueAgingSection({ agingBuckets, loading }: OverdueAgingSectionProps) {
  const { t } = useTranslation('reports');

  const rows = useMemo(
    () => toAgingRows(agingBuckets, t),
    [agingBuckets, t],
  );

  if (!loading && rows.length === 0) {
    return (
      <ReportSection title={t('sales.aging.title')} id="overdue-aging">
        <ReportEmptyState
          type="no-data"
          description={t('sales.aging.noOverdue')}
        />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('sales.aging.title')}
      description={t('sales.aging.description')}
      id="overdue-aging"
    >
      <ReportAgingTable data={rows} />
    </ReportSection>
  );
}
