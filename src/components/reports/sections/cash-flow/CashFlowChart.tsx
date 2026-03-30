'use client';

import '@/lib/design-system';

/**
 * @module reports/sections/cash-flow/CashFlowChart
 * @enterprise ADR-268 Phase 8 — Q1: Combo chart (stacked bars + cumulative line)
 * @description ComposedChart with inflow/outflow bars + balance line overlay.
 */

import { useTranslation } from 'react-i18next';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CashFlowChartRow } from '@/hooks/reports/useCashFlowReport';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CashFlowChartProps {
  data: CashFlowChartRow[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Colors (Okabe-Ito accessible palette via CSS vars)
// ---------------------------------------------------------------------------

const INFLOW_COLOR = 'hsl(var(--chart-2))';  // green
const OUTFLOW_COLOR = 'hsl(var(--chart-1))'; // blue
const BALANCE_COLOR = 'hsl(var(--chart-4))'; // orange

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

function formatAmount(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `€${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `€${(value / 1_000).toFixed(0)}K`;
  }
  return `€${value.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CashFlowChart({ data, loading }: CashFlowChartProps) {
  const { t } = useTranslation('cash-flow');

  if (loading || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('chart.title', 'Cash Flow Projection')}</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <p className="text-sm text-muted-foreground">
            {loading ? t('chart.loading', 'Loading...') : t('chart.noData', 'No data')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('chart.title', 'Cash Flow Projection')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              tickFormatter={formatAmount}
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatAmount(value),
                name,
              ]}
              contentStyle={{
                borderRadius: 'var(--radius)',
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--popover))',
                color: 'hsl(var(--popover-foreground))',
              }}
            />
            <Legend />
            <Bar
              dataKey="inflow"
              name={t('chart.inflow', 'Inflows')}
              fill={INFLOW_COLOR}
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="outflow"
              name={t('chart.outflow', 'Outflows')}
              fill={OUTFLOW_COLOR}
              radius={[2, 2, 0, 0]}
            />
            <Line
              type="monotone"
              dataKey="balance"
              name={t('chart.balance', 'Balance')}
              stroke={BALANCE_COLOR}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
