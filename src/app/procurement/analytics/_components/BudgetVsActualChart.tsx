'use client';

/**
 * BudgetVsActualChart — Cross-project budget vs committed vs delivered per
 * ATOE category (3-bar grouped chart).
 *
 * Off-budget detection: a row whose committed > 0 but budget = 0 means the
 * category has no BOQ entry yet — labelled "Off-budget" with a warning
 * tooltip line per ADR-331 §4 D9.
 *
 * ⚠️ **ADR-710 (μετανάστευση 2026-08-01)**: πλαίσιο κάρτας, υπόμνημα, κενή
 * κατάσταση και `ResponsiveContainer` ζουν στο `<ChartCard>`· ελεύθερο ύψος
 * 300px → βήμα `lg`. Τα χρώματα γίνονται **θεσιακά** (`--color-<key>` από τη
 * δήλωση σειρών) αντί για χειρόγραφα `--chart-N`: η **σειρά** των slots είναι ο
 * μηχανισμός διαχωρισμού CVD (CHECK 3.32), οπότε δεν την επιλέγει το κάθε
 * γράφημα. Πρακτικά budget/committed ανταλλάσσουν απόχρωση — **σκόπιμο**.
 *
 * 🔑 **Το tooltip μένει χειρόγραφο, και δεν είναι παράλειψη.** Η γραμμή
 * προειδοποίησης «εκτός προϋπολογισμού» είναι **ανά γραμμή δεδομένων**, ενώ η
 * περιγραφή του shell μιλά ανά **σειρά**. Το `<ChartCard.Tooltip />` δεν μπορεί
 * να την εκφράσει χωρίς να αποκτήσει prop για περιεχόμενο — δηλαδή χωρίς να
 * ξαναγίνει η υπερ-παραμετροποιημένη fabrique που το ADR-710 απέφυγε. Το
 * ADR-710 απαγορεύει το `ResponsiveContainer`, **όχι** το κατάλληλο tooltip.
 *
 * @see ADR-331 §2.5, §4 D4, D9, D22, D23 · ADR-710 (chart-card shell)
 */

import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import {
  seriesColorVar,
  type ChartSeries,
} from '@/components/ui/chart-card';
import { SpendAnalyticsChart } from './SpendAnalyticsChart';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { BudgetVsActualPoint } from '@/services/procurement/aggregators/spendAnalyticsAggregator';
import {
  CHART_MARGIN,
  EUR_VALUE_AXIS,
  ROTATED_CATEGORY_AXIS,
  formatEur,
  truncateLabel,
} from './chart-utils';

interface BudgetVsActualChartProps {
  data: readonly BudgetVsActualPoint[];
  isLoading: boolean;
  className?: string;
}

interface BudgetRow {
  categoryCode: string;
  label: string;
  budget: number;
  committed: number;
  delivered: number;
  isOffBudget: boolean;
}

interface OffBudgetTooltipMessages {
  budget: string;
  committed: string;
  delivered: string;
  offBudgetWarning: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  messages,
}: TooltipProps<number, string> & { messages: OffBudgetTooltipMessages }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as BudgetRow | undefined;
  if (!row) return null;
  return (
    <section className="min-w-[140px] rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-semibold">{label}</p>
      <p>{`${messages.budget}: ${formatEur(row.budget)}`}</p>
      <p>{`${messages.committed}: ${formatEur(row.committed)}`}</p>
      <p>{`${messages.delivered}: ${formatEur(row.delivered)}`}</p>
      {row.isOffBudget && (
        <p className="mt-1 font-medium text-destructive">{messages.offBudgetWarning}</p>
      )}
    </section>
  );
}

export function BudgetVsActualChart({
  data,
  isLoading,
  className,
}: BudgetVsActualChartProps) {
  const { t } = useTranslation('procurement');

  const rows = useMemo<BudgetRow[]>(
    () =>
      data.map((point) => {
        const isOffBudget = point.budget === 0 && point.committed > 0;
        const baseLabel = truncateLabel(
          t(`categories.${point.categoryCode}`, { defaultValue: point.categoryCode }),
          18,
        );
        return {
          categoryCode: point.categoryCode,
          label: isOffBudget ? `⚠ ${baseLabel}` : baseLabel,
          budget: point.budget,
          committed: point.committed,
          delivered: point.delivered,
          isOffBudget,
        };
      }),
    [data, t],
  );

  const messages: OffBudgetTooltipMessages = useMemo(
    () => ({
      budget: t('analytics.charts.budgetVsActual.budget'),
      committed: t('analytics.charts.budgetVsActual.committed'),
      delivered: t('analytics.charts.budgetVsActual.delivered'),
      offBudgetWarning: t('analytics.charts.budgetVsActual.offBudgetTooltip'),
    }),
    [t],
  );

  const series = useMemo<readonly ChartSeries<BudgetRow>[]>(
    () => [
      { key: 'budget', label: messages.budget },
      { key: 'committed', label: messages.committed },
      { key: 'delivered', label: messages.delivered },
    ],
    [messages],
  );


  return (
    <SpendAnalyticsChart
      className={className}
      isLoading={isLoading}
      series={series}
      data={rows}
      categoryKey="label"
      categoryLabel={t('analytics.charts.budgetVsActual.categoryLabel')}
      formatValue={formatEur}
      title={t('analytics.charts.budgetVsActual.title')}
      emptyMessage={t('analytics.charts.budgetVsActual.empty')}
      size="lg"
    >
          <ComposedChart data={rows} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              {...ROTATED_CATEGORY_AXIS}
              height={64}
            />
            <YAxis {...EUR_VALUE_AXIS} />
            <Tooltip
              content={(props: TooltipProps<number, string>) => (
                <CustomTooltip {...props} messages={messages} />
              )}
            />
            <Bar
              dataKey="budget"
              fill={seriesColorVar('budget')}
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="committed"
              fill={seriesColorVar('committed')}
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="delivered"
              fill={seriesColorVar('delivered')}
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
            />
          </ComposedChart>
    </SpendAnalyticsChart>
  );
}
