'use client';

/**
 * @module SCurveChart
 * @enterprise ADR-266 Phase A — S-Curve chart (PV/EV/AC)
 *
 * Uses recharts LineChart with 3 lines + today marker.
 * Colors from useSemanticColors() — no hardcoded hex.
 */

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { ReportSection } from '@/components/reports/core/ReportSection';
import { ReportEmptyState } from '@/components/reports/core/ReportEmptyState';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency, formatDateShort } from '@/lib/intl-utils';
import { getStatusColor } from '@/lib/design-system';
import type { SCurveDataPoint } from '@/services/report-engine/evm-calculator';

// ─── Custom Tooltip ──────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface SCurveTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function SCurveTooltip({ active, payload, label }: SCurveTooltipProps) {
  if (!active || !payload?.length) return null;

  const pv = payload.find(p => p.name === 'PV')?.value ?? 0;
  const ev = payload.find(p => p.name === 'EV')?.value ?? 0;
  const ac = payload.find(p => p.name === 'AC')?.value ?? 0;
  const sv = ev - pv;
  const cv = ev - ac;

  return (
    <div className="rounded-md border bg-popover p-3 shadow-md text-sm">
      <p className="font-medium mb-2">{label ? formatDateShort(label) : ''}</p>
      {payload.map(entry => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
      <hr className="my-1.5 border-border" />
      <p className={sv >= 0 ? getStatusColor('available', 'text') : getStatusColor('error', 'text')}>
        SV: {sv >= 0 ? '+' : ''}{formatCurrency(sv)}
      </p>
      <p className={cv >= 0 ? getStatusColor('available', 'text') : getStatusColor('error', 'text')}>
        CV: {cv >= 0 ? '+' : ''}{formatCurrency(cv)}
      </p>
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────

interface SCurveChartProps {
  data: SCurveDataPoint[];
  loading?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────

export function SCurveChart({ data, loading }: SCurveChartProps) {
  const { t } = useTranslation('building');

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);

  const isEmpty = data.length === 0;

  if (!loading && isEmpty) {
    return (
      <ReportSection
        title={t('tabs.timeline.dashboard.sCurve.title')}
        id="schedule-scurve"
      >
        <ReportEmptyState
          title={t('tabs.timeline.dashboard.empty.noBOQ')}
          description={t('tabs.timeline.dashboard.empty.noBOQDesc')}
        />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('tabs.timeline.dashboard.sCurve.title')}
      id="schedule-scurve"
    >
      <div className="h-[350px] w-full sm:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => formatDateShort(v)}
              className="text-xs"
            />
            <YAxis
              tickFormatter={(v: number) => formatCurrency(v)}
              className="text-xs"
              width={80}
            />
            <Tooltip content={<SCurveTooltip />} />
            <Legend />

            {/* Today marker */}
            <ReferenceLine
              x={todayStr}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              label={{ value: t('tabs.timeline.dashboard.sCurve.today'), position: 'top', fontSize: 11 }}
            />

            {/* PV — dashed gray (baseline) */}
            <Line
              type="monotone"
              dataKey="plannedValue"
              name="PV"
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="5 5"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />

            {/* EV — solid (value produced) */}
            <Line
              type="monotone"
              dataKey="earnedValue"
              name="EV"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />

            {/* AC — solid red (money spent) */}
            <Line
              type="monotone"
              dataKey="actualCost"
              name="AC"
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ReportSection>
  );
}
