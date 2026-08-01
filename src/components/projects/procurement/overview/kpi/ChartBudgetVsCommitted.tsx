'use client';

/**
 * @module ChartBudgetVsCommitted
 * @enterprise ADR-710 — Budget vs committed per ATOE category (KPI overview).
 *
 * ⚠️ **Μετανάστευση 2026-08-01**: πλαίσιο κάρτας, υπόμνημα, κενή κατάσταση και
 * `ResponsiveContainer` ζουν στο `<ChartCard>`· ελεύθερο ύψος 200px → βήμα `sm`.
 *
 * 🔴 Τα χρώματα ήταν `hsl(var(--chart-1, 215 70% 50%))` — δηλαδή **σκληρά
 * fallback** μέσα σε CSS variable. Ένα fallback σε παλέτα που έχει **μετρηθεί**
 * για διαχωρισμό CVD (ADR-710 §10, CHECK 3.32) είναι σιωπηλή παράκαμψη της
 * μέτρησης: αν το token λείψει, ζωγραφίζει χρώμα που **κανείς δεν έλεγξε**.
 * Πλέον το χρώμα έρχεται από τη δήλωση σειρών, θεσιακά.
 */

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  ChartCard,
  seriesColorVar,
  type ChartSeries,
} from '@/components/ui/chart-card';
import type { ProjectProcurementStats } from '@/hooks/useProjectProcurementStats';

interface Props {
  stats: ProjectProcurementStats | null;
}

type BudgetRow = NonNullable<ProjectProcurementStats['budgetVsCommitted']>[number];

function formatEurShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K€`;
  return `${n.toFixed(0)}€`;
}

export function ChartBudgetVsCommitted({ stats }: Props) {
  const { t } = useTranslation('procurement');
  const data = useMemo(() => stats?.budgetVsCommitted ?? [], [stats]);

  const series = useMemo<readonly ChartSeries<BudgetRow>[]>(
    () => [
      { key: 'budget', label: t('overview.kpi.budgetVsCommitted.budget') },
      { key: 'committed', label: t('overview.kpi.budgetVsCommitted.committed') },
    ],
    [t],
  );

  return (
    <section className="col-span-full">
      <ChartCard
        series={series}
        data={data}
        categoryKey="categoryCode"
        categoryLabel={t('overview.kpi.budgetVsCommitted.categoryLabel')}
        formatValue={formatEurShort}
      >
        <ChartCard.Header title={t('overview.kpi.budgetVsCommitted.label')} />
        <ChartCard.Figure
          emptyMessage={t('overview.kpi.budgetVsCommitted.noBoq')}
          size="sm"
        >
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="categoryCode" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={formatEurShort} tick={{ fontSize: 11 }} width={52} />
            <ChartCard.Tooltip />
            <Bar
              dataKey="budget"
              fill={seriesColorVar('budget')}
              radius={[3, 3, 0, 0]}
              maxBarSize={32}
            />
            <Bar
              dataKey="committed"
              fill={seriesColorVar('committed')}
              radius={[3, 3, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ChartCard.Figure>
      </ChartCard>
    </section>
  );
}
