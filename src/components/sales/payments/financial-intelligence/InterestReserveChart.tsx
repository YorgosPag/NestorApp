'use client';

/**
 * InterestReserveChart — Interest Reserve Depletion Visualization
 *
 * AreaChart showing reserve balance over time with gradient coloring
 * (green → amber → red). Shows exhaustion point with reference line.
 *
 * @enterprise ADR-242 SPEC-242B - Draw Schedule
 */

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { AlertTriangle } from 'lucide-react';

import { formatCurrencyWhole } from '@/lib/intl-utils';
import { FinancialTooltip } from './FinancialTooltip';
import type { DrawPeriodAnalysis, InterestReserveStatus } from '@/types/interest-calculator';

// =============================================================================
// TYPES
// =============================================================================

interface InterestReserveChartProps {
  periods: DrawPeriodAnalysis[];
  reserveStatus: InterestReserveStatus;
  t: (key: string, opts?: Record<string, string>) => string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function InterestReserveChart({ periods, reserveStatus, t }: InterestReserveChartProps) {
  const chartData = periods.map((p) => ({
    month: `M${p.month + 1}`,
    reserveBalance: Math.round(p.reserveBalance),
    monthIndex: p.month,
  }));

  // Unique gradient ID for this chart instance
  const gradientId = 'reserveGradient';

  return (
    <section className="space-y-3">
      <h4 className="text-sm font-semibold">
        {t('costCalculator.drawSchedule.reserveTitle')}
      </h4>

      <figure className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.6} />
                <stop offset="50%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              content={
                <FinancialTooltip
                  labelFormatter={(label) => `${t('costCalculator.drawSchedule.month')} ${label}`}
                  valueFormatter={(value) => [
                    formatCurrencyWhole(value as number),
                    t('costCalculator.drawSchedule.reserveBalance'),
                  ]}
                />
              }
            />
            {/* Zero line — red dashed */}
            <ReferenceLine y={0} stroke="hsl(0, 72%, 51%)" strokeDasharray="5 3" strokeWidth={1.5} />
            {/* Exhaustion month — vertical line */}
            {reserveStatus.exhaustionMonth !== null && (
              <ReferenceLine
                x={`M${reserveStatus.exhaustionMonth + 1}`}
                stroke="hsl(0, 72%, 51%)"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                label={{
                  value: t('costCalculator.drawSchedule.exhaustion'),
                  position: 'top',
                  fontSize: 10,
                  fill: 'hsl(0, 72%, 51%)',
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="reserveBalance"
              stroke="hsl(142, 71%, 45%)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </figure>

      {/* Warning if reserve exhausted */}
      {!reserveStatus.sufficient && (
        <aside className="flex gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed">
            {t('costCalculator.drawSchedule.reserveWarning', {
              month: String((reserveStatus.exhaustionMonth ?? 0) + 1),
              shortfall: formatCurrencyWhole(reserveStatus.cashShortfall),
            })}
          </p>
        </aside>
      )}
    </section>
  );
}
