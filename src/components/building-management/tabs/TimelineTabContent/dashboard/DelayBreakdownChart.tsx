'use client';

/**
 * @module DelayBreakdownChart
 * @enterprise ADR-266 Phase C — Stacked bar chart: delay reasons per phase
 *
 * Shows per-reason breakdown (weather, materials, permits, subcontractor, other, unspecified).
 * Colors from design system CSS variables — no hardcoded hex.
 * Reason keys derive from DELAY_REASONS SSoT array.
 */

import { useMemo } from 'react';
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
import { DELAY_REASONS } from '@/types/building/construction';
import type { DelayBreakdownDataPoint } from './schedule-dashboard.types';

// ─── Reason Chart Config (SSoT — keys from DELAY_REASONS) ──────────────

const REASON_KEYS = [...DELAY_REASONS, 'unspecified'] as const;

const REASON_COLORS: Record<string, string> = {
  weather: 'hsl(var(--chart-1))',
  materials: 'hsl(var(--chart-2))',
  permits: 'hsl(var(--chart-3))',
  subcontractor: 'hsl(var(--chart-4))',
  other: 'hsl(var(--chart-5))',
  unspecified: 'hsl(var(--muted-foreground))',
};

// ─── Custom Tooltip ──────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

interface ReasonTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  labelMap: Map<string, string>;
  t: (key: string) => string;
}

function ReasonTooltip({ active, payload, label, labelMap, t }: ReasonTooltipProps) {
  if (!active || !payload?.length) return null;

  const phaseName = labelMap.get(label ?? '') ?? label;
  const nonZeroEntries = payload.filter(p => p.value > 0);

  return (
    <div className="rounded-md border bg-popover p-3 shadow-md text-sm">
      <p className="font-medium mb-1.5">{phaseName}</p>
      {nonZeroEntries.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {entry.value} {t('tabs.timeline.dashboard.delayBreakdown.tasks')}
        </p>
      ))}
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

  const labelMap = useMemo(
    () => new Map(data.map(d => [d.phaseCode, d.phaseName])),
    [data],
  );

  // Flatten byReason into top-level keys for Recharts
  const chartData = useMemo(
    () => data.map(d => ({
      phaseCode: d.phaseCode,
      ...d.byReason,
    })),
    [data],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection
        title={t('tabs.timeline.dashboard.delayBreakdown.title')}
        tooltip={t('tabs.timeline.dashboard.tooltips.delayBreakdownTitle')}
        id="schedule-delay-breakdown"
      >
        <ReportEmptyState
          title={t('tabs.timeline.dashboard.delayBreakdown.empty')}
          description={t('tabs.timeline.dashboard.delayBreakdown.emptyDesc')}
        />
      </ReportSection>
    );
  }

  const rotateLabels = data.length > 6;

  return (
    <ReportSection
      title={t('tabs.timeline.dashboard.delayBreakdown.title')}
      tooltip={t('tabs.timeline.dashboard.tooltips.delayBreakdownTitle')}
      id="schedule-delay-breakdown"
    >
      <figure
        role="img"
        aria-label={t('tabs.timeline.dashboard.delayBreakdown.ariaLabel')}
      >
      <div className="h-[300px] w-full sm:h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="phaseCode"
              className="text-xs"
              interval={0}
              angle={rotateLabels ? -45 : 0}
              textAnchor={rotateLabels ? 'end' : 'middle'}
              height={rotateLabels ? 60 : 30}
            />
            <YAxis
              allowDecimals={false}
              className="text-xs"
              width={40}
            />
            <Tooltip
              content={
                <ReasonTooltip
                  labelMap={labelMap}
                  t={t}
                />
              }
            />
            <Legend />

            {REASON_KEYS.map((reason, idx) => (
              <Bar
                key={reason}
                dataKey={reason}
                name={t(`tabs.timeline.dashboard.delayBreakdown.${reason}`)}
                stackId="reasons"
                fill={REASON_COLORS[reason]}
                radius={idx === REASON_KEYS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Screen-reader data table */}
      <table className="sr-only">
        <caption>{t('tabs.timeline.dashboard.delayBreakdown.title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('tabs.timeline.dashboard.variance.colName')}</th>
            {REASON_KEYS.map(reason => (
              <th key={reason} scope="col">
                {t(`tabs.timeline.dashboard.delayBreakdown.${reason}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.phaseCode}>
              <th scope="row">{d.phaseName}</th>
              {REASON_KEYS.map(reason => (
                <td key={reason}>{d.byReason[reason] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </figure>
    </ReportSection>
  );
}
