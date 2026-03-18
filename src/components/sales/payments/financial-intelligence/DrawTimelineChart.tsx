'use client';

/**
 * DrawTimelineChart — Construction Draw Timeline Visualization
 *
 * ComposedChart showing draw amounts (bars) and cumulative drawn (stepped line).
 * Color-coded by construction phase for instant visual understanding.
 *
 * @enterprise ADR-242 SPEC-242B - Draw Schedule
 */

import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import { formatCurrencyWhole } from '@/lib/intl-utils';
import { FinancialTooltip } from './FinancialTooltip';
import type { DrawPeriodAnalysis, DrawPhaseType } from '@/types/interest-calculator';

// =============================================================================
// CONSTANTS
// =============================================================================

const PHASE_COLORS: Record<DrawPhaseType, string> = {
  land_acquisition: 'hsl(25, 95%, 53%)',    // orange
  permits: 'hsl(280, 68%, 55%)',             // purple
  foundation: 'hsl(200, 98%, 39%)',          // blue
  structure: 'hsl(142, 71%, 45%)',           // green
  masonry: 'hsl(45, 93%, 47%)',              // amber
  mechanical: 'hsl(340, 82%, 52%)',          // rose
  finishes: 'hsl(172, 66%, 50%)',            // teal
  landscaping: 'hsl(84, 81%, 44%)',          // lime
  custom: 'hsl(262, 83%, 58%)',              // violet
};

// =============================================================================
// TYPES
// =============================================================================

interface DrawTimelineChartProps {
  periods: DrawPeriodAnalysis[];
  t: (key: string, opts?: Record<string, string>) => string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DrawTimelineChart({ periods, t }: DrawTimelineChartProps) {
  // Build chart data — only periods with draw events get bar values
  const chartData = periods.map((p) => ({
    month: `M${p.month + 1}`,
    drawAmount: p.drawEvent ? p.drawEvent.drawAmount : 0,
    cumulativeDrawn: p.cumulativeDrawn,
    phase: p.drawEvent?.phase ?? null,
    label: p.drawEvent?.label ?? '',
  }));

  // Collect unique phases for legend
  const activePhases = new Map<DrawPhaseType, string>();
  for (const p of periods) {
    if (p.drawEvent) {
      activePhases.set(p.drawEvent.phase, p.drawEvent.label);
    }
  }

  return (
    <section className="space-y-3">
      <h4 className="text-sm font-semibold">
        {t('costCalculator.drawSchedule.timelineTitle')}
      </h4>

      <figure className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
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
                  valueFormatter={(value, name) => [
                    formatCurrencyWhole(value as number),
                    name === 'drawAmount'
                      ? t('costCalculator.drawSchedule.drawAmount')
                      : t('costCalculator.drawSchedule.cumulativeDrawn'),
                  ]}
                />
              }
            />
            <Bar dataKey="drawAmount" name="drawAmount" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.phase ? PHASE_COLORS[entry.phase] : 'hsl(220, 14%, 70%)'}
                  opacity={entry.drawAmount > 0 ? 1 : 0}
                />
              ))}
            </Bar>
            <Line
              type="stepAfter"
              dataKey="cumulativeDrawn"
              name="cumulativeDrawn"
              stroke="hsl(220, 70%, 50%)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </figure>

      {/* Phase legend */}
      {activePhases.size > 0 && (
        <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {Array.from(activePhases.entries()).map(([phase, label]) => (
            <li key={phase} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: PHASE_COLORS[phase] }}
                aria-hidden="true"
              />
              {label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
