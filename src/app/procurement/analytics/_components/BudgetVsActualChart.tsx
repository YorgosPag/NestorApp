'use client';

/**
 * BudgetVsActualChart — Cross-project budget vs committed vs delivered per
 * ATOE category (3-bar grouped chart).
 *
 * Off-budget detection: a row whose committed > 0 but budget = 0 means the
 * category has no BOQ entry yet — labelled "Off-budget" with a warning
 * tooltip line per ADR-331 §4 D9.
 *
 * @see ADR-331 §2.5, §4 D4, D9, D22, D23
 */

import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import { KpiChartSkeleton } from '@/components/projects/procurement/overview/skeleton/KpiSkeleton';
import type { BudgetVsActualPoint } from '@/services/procurement/aggregators/spendAnalyticsAggregator';
import { formatEurShort, truncateLabel } from './chart-utils';

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
    <section className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground">{`${messages.budget}: ${formatCurrency(row.budget, 'EUR')}`}</p>
      <p className="text-muted-foreground">{`${messages.committed}: ${formatCurrency(row.committed, 'EUR')}`}</p>
      <p className="text-muted-foreground">{`${messages.delivered}: ${formatCurrency(row.delivered, 'EUR')}`}</p>
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

  if (isLoading) return <KpiChartSkeleton />;

  const messages: OffBudgetTooltipMessages = {
    budget: t('analytics.charts.budgetVsActual.budget'),
    committed: t('analytics.charts.budgetVsActual.committed'),
    delivered: t('analytics.charts.budgetVsActual.delivered'),
    offBudgetWarning: t('analytics.charts.budgetVsActual.offBudgetTooltip'),
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t('analytics.charts.budgetVsActual.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('analytics.charts.budgetVsActual.empty')}
          </p>
        ) : (
          <figure aria-label={t('analytics.charts.budgetVsActual.ariaLabel')} className="m-0">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={rows} margin={{ top: 8, right: 16, left: 4, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={64}
                />
                <YAxis tickFormatter={formatEurShort} tick={{ fontSize: 11 }} width={56} />
                <Tooltip content={(props) => <CustomTooltip {...props} messages={messages} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="budget"
                  name={messages.budget}
                  fill="hsl(var(--chart-2))"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="committed"
                  name={messages.committed}
                  fill="hsl(var(--chart-1))"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="delivered"
                  name={messages.delivered}
                  fill="hsl(var(--chart-3))"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </figure>
        )}
      </CardContent>
    </Card>
  );
}
