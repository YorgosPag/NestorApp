'use client';

/**
 * @module DelayBreakdownChart
 * @enterprise ADR-266 Phase B — Stacked bar chart: delayed + blocked tasks per phase
 *
 * Aggregates task status by phase. Shows only phases with at least 1 delayed/blocked task.
 * Colors from design system — no hardcoded hex.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ReportSection } from '@/components/reports/core/ReportSection';
import { ReportEmptyState } from '@/components/reports/core/ReportEmptyState';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';
import type { DelayBreakdownDataPoint } from './schedule-dashboard.types';

// ─── Custom Tooltip ──────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface DelayTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  labelMap: Map<string, string>;
  t: (key: string) => string;
}

function DelayTooltip({ active, payload, label, labelMap, t }: DelayTooltipProps) {
  if (!active || !payload?.length) return null;

  const phaseName = labelMap.get(label ?? '') ?? label;
  const delayed = payload.find(p => p.name === 'delayed')?.value ?? 0;
  const blocked = payload.find(p => p.name === 'blocked')?.value ?? 0;

  return (
    <div className="rounded-md border bg-popover p-3 shadow-md text-sm">
      <p className="font-medium mb-1.5">{phaseName}</p>
      <p className="text-amber-500">
        {t('tabs.timeline.dashboard.delayBreakdown.delayed')}: {delayed} {t('tabs.timeline.dashboard.delayBreakdown.tasks')}
      </p>
      <p className="text-destructive">
        {t('tabs.timeline.dashboard.delayBreakdown.blocked')}: {blocked} {t('tabs.timeline.dashboard.delayBreakdown.tasks')}
      </p>
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────

interface DelayBreakdownChartProps {
  data: DelayBreakdownDataPoint[];
  loading?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────

export function DelayBreakdownChart({ data, loading }: DelayBreakdownChartProps) {
  const { t } = useTranslation('building');

  const labelMap = new Map(data.map(d => [d.phaseCode, d.phaseName]));

  if (!loading && data.length === 0) {
    return (
      <ReportSection
        title={t('tabs.timeline.dashboard.delayBreakdown.title')}
        id="schedule-delay-breakdown"
      >
        <ReportEmptyState
          title={t('tabs.timeline.dashboard.delayBreakdown.empty')}
          description={t('tabs.timeline.dashboard.delayBreakdown.emptyDesc')}
        />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('tabs.timeline.dashboard.delayBreakdown.title')}
      id="schedule-delay-breakdown"
    >
      <div className="h-[300px] w-full sm:h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="phaseCode"
              className="text-xs"
              interval={0}
              angle={data.length > 6 ? -45 : 0}
              textAnchor={data.length > 6 ? 'end' : 'middle'}
              height={data.length > 6 ? 60 : 30}
            />
            <YAxis
              allowDecimals={false}
              className="text-xs"
              width={40}
            />
            <Tooltip
              content={
                <DelayTooltip
                  labelMap={labelMap}
                  t={t}
                />
              }
            />
            <Legend />

            <Bar
              dataKey="delayed"
              name={t('tabs.timeline.dashboard.delayBreakdown.delayed')}
              stackId="delays"
              fill="hsl(var(--chart-4))"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="blocked"
              name={t('tabs.timeline.dashboard.delayBreakdown.blocked')}
              stackId="delays"
              fill="hsl(var(--destructive))"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ReportSection>
  );
}
