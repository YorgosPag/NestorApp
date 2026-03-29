'use client';

/**
 * @module ResourceHistogramChart
 * @enterprise ADR-266 Phase C, Sub-phase 4 — Resource Histogram
 *
 * Stacked bar chart showing hours/week per resource.
 * Reference line at 40hrs (standard weekly capacity).
 * Follows DelayBreakdownChart pattern (raw Recharts + ReportSection).
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { ReportSection } from '@/components/reports/core/ReportSection';
import { ReportEmptyState } from '@/components/reports/core/ReportEmptyState';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import '@/lib/design-system';
import type {
  ResourceHistogramBar,
  ResourceChartConfigEntry,
} from './resource-histogram.types';

// ─── Props ───────────────────────────────────────────────────────────────

interface ResourceHistogramChartProps {
  data: ResourceHistogramBar[];
  chartConfig: Record<string, ResourceChartConfigEntry>;
  resourceNames: string[];
  loading?: boolean;
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  totalLabel,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  totalLabel: string;
}) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
  const isOver = total > 40;

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}
          </span>
          <span className="tabular-nums font-medium">{entry.value}h</span>
        </div>
      ))}
      <div className={cn(
        'mt-1 pt-1 border-t flex justify-between font-semibold',
        isOver && 'text-destructive'
      )}>
        <span>{totalLabel}</span>
        <span>{Math.round(total * 10) / 10}h</span>
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────

export function ResourceHistogramChart({
  data,
  chartConfig,
  resourceNames,
  loading,
}: ResourceHistogramChartProps) {
  const { t } = useTranslation('building');
  const tBase = 'tabs.timeline.dashboard.resourceHistogram';

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t(`${tBase}.title`)} id="resource-histogram">
        <ReportEmptyState
          title={t(`${tBase}.empty`)}
          description={t(`${tBase}.emptyDesc`)}
        />
      </ReportSection>
    );
  }

  return (
    <ReportSection title={t(`${tBase}.title`)} id="resource-histogram">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <XAxis
            dataKey="weekLabel"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            label={{
              value: t(`${tBase}.hoursPerWeek`),
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' },
            }}
          />
          <Tooltip content={<CustomTooltip totalLabel={t(`${tBase}.total`)} />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />

          {/* Capacity reference line at 40hrs */}
          <ReferenceLine
            y={40}
            stroke="hsl(var(--destructive))"
            strokeDasharray="4 4"
            label={{
              value: t(`${tBase}.capacity`),
              position: 'right',
              style: { fontSize: 10, fill: 'hsl(var(--destructive))' },
            }}
          />

          {/* Stacked bars — one per resource */}
          {resourceNames.map((name) => (
            <Bar
              key={name}
              dataKey={name}
              stackId="resources"
              fill={chartConfig[name]?.color ?? 'hsl(var(--muted))'}
              radius={resourceNames.indexOf(name) === resourceNames.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ReportSection>
  );
}
