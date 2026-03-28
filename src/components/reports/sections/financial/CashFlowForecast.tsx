'use client';

/**
 * @module reports/sections/financial/CashFlowForecast
 * @enterprise ADR-265 Phase 5 — Receivables vs Collected + Aging Table
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportChart,
  ReportAgingTable,
  ReportEmptyState,
  type AgingRow,
} from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { AgingBucketResult } from '@/services/report-engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CashFlowForecastProps {
  totalReceivables: number;
  totalCollected: number;
  collectionRate: number;
  agingBuckets: AgingBucketResult[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BUCKET_LABELS: Record<string, string> = {
  current: '0-30',
  days31to60: '31-60',
  days61to90: '61-90',
  days91to120: '91-120',
  days120plus: '120+',
};

function toAgingRows(buckets: AgingBucketResult[], t: (k: string) => string): AgingRow[] {
  const total = buckets.reduce((s, b) => s + b.amount, 0);
  if (total === 0) return [];

  const agingBucketItems = buckets.map(b => ({
    label: BUCKET_LABELS[b.key] ?? b.key,
    count: b.count,
    amount: b.amount,
  }));

  return [{
    id: 'portfolio',
    name: t('financial.cashFlow.receivables'),
    total,
    buckets: agingBucketItems,
    overdue: buckets.some(b => b.key !== 'current' && b.amount > 0),
  }];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CashFlowForecast({
  totalReceivables,
  totalCollected,
  collectionRate,
  agingBuckets,
  loading,
}: CashFlowForecastProps) {
  const { t } = useTranslation('reports');

  const hasData = totalReceivables > 0 || totalCollected > 0;

  const chartConfig: ChartConfig = {
    receivables: {
      label: t('financial.cashFlow.receivables'),
      color: 'hsl(var(--report-chart-1))',
    },
    collected: {
      label: t('financial.cashFlow.collected'),
      color: 'hsl(var(--report-chart-3))',
    },
  };

  const summaryData = [{
    category: t('financial.cashFlow.receivables'),
    receivables: totalReceivables,
    collected: totalCollected,
  }];

  const agingRows = useMemo(
    () => toAgingRows(agingBuckets, t),
    [agingBuckets, t],
  );

  if (!loading && !hasData) {
    return (
      <ReportSection
        title={t('financial.cashFlow.title')}
        description={t('financial.cashFlow.description')}
        id="cash-flow"
      >
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('financial.cashFlow.title')}
      description={`${t('financial.cashFlow.description')} — ${t('financial.cashFlow.collectionRate')}: ${collectionRate.toFixed(1)}%`}
      id="cash-flow"
    >
      <ReportChart
        type="bar"
        data={summaryData}
        config={chartConfig}
        xAxisKey="category"
        height={250}
      />

      {agingRows.length > 0 && (
        <section className="mt-6">
          <ReportAgingTable data={agingRows} />
        </section>
      )}
    </ReportSection>
  );
}
