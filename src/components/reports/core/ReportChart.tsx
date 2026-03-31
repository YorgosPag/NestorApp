'use client';

/**
 * @module ReportChart
 * @enterprise ADR-265 — Unified chart wrapper (bar/line/area/pie/stacked-bar)
 *
 * Single component that renders any chart type via the `type` prop.
 * Wraps existing ChartContainer with Okabe-Ito palette (Decision 12.10).
 */

import '@/lib/design-system';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ReportEmptyState } from './ReportEmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'stacked-bar';

export interface ReportChartProps<T extends object = Record<string, unknown>> {
  /** Chart visualization type */
  type: ChartType;
  /** Data array — each object = one data point */
  data: T[];
  /** Chart config — defines series keys, labels, colors */
  config: ChartConfig;
  /** Height in px (default: 350) */
  height?: number;
  /** Key for X axis in cartesian charts */
  xAxisKey?: string;
  /** Optional title above chart */
  title?: string;
  /** Optional description below title */
  description?: string;
  /** Show legend (default: true) */
  showLegend?: boolean;
  /** Show tooltip on hover (default: true) */
  showTooltip?: boolean;
  /** Show grid lines (default: true) */
  showGrid?: boolean;
  /** Pie chart: data key for values (default: 'value') */
  pieDataKey?: string;
  /** Pie chart: data key for labels (default: 'name') */
  pieNameKey?: string;
  /** Click handler for chart elements */
  onElementClick?: (data: T) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const REPORT_PALETTE = [
  'hsl(var(--report-chart-1))',
  'hsl(var(--report-chart-2))',
  'hsl(var(--report-chart-3))',
  'hsl(var(--report-chart-4))',
  'hsl(var(--report-chart-5))',
  'hsl(var(--report-chart-6))',
  'hsl(var(--report-chart-7))',
  'hsl(var(--report-chart-8))',
];

// ---------------------------------------------------------------------------
// Sub-renderers
// ---------------------------------------------------------------------------

function renderCartesian(
  type: 'bar' | 'line' | 'area' | 'stacked-bar',
  data: Record<string, unknown>[],
  config: ChartConfig,
  xAxisKey: string,
  showGrid: boolean,
  showTooltip: boolean,
  showLegend: boolean,
  onElementClick?: (data: Record<string, unknown>) => void,
) {
  const seriesKeys = Object.keys(config);

  const commonChildren = (
    <>
      {showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} />}
      <XAxis dataKey={xAxisKey} tickLine={false} axisLine={false} className="text-xs" />
      <YAxis tickLine={false} axisLine={false} className="text-xs" />
      {showTooltip && <ChartTooltip content={<ChartTooltipContent />} />}
      {showLegend && <ChartLegend content={<ChartLegendContent />} />}
    </>
  );

  if (type === 'line') {
    return (
      <LineChart data={data} onClick={onElementClick ? (e) => { if (e?.activePayload?.[0]) onElementClick(e.activePayload[0].payload); } : undefined}>
        {commonChildren}
        {seriesKeys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={config[key].color ?? REPORT_PALETTE[i % REPORT_PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    );
  }

  if (type === 'area') {
    return (
      <AreaChart data={data}>
        {commonChildren}
        {seriesKeys.map((key, i) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            fill={config[key].color ?? REPORT_PALETTE[i % REPORT_PALETTE.length]}
            stroke={config[key].color ?? REPORT_PALETTE[i % REPORT_PALETTE.length]}
            fillOpacity={0.2}
            stackId={type === 'area' ? undefined : 'stack'}
          />
        ))}
      </AreaChart>
    );
  }

  // bar or stacked-bar
  const isStacked = type === 'stacked-bar';
  return (
    <BarChart data={data} onClick={onElementClick ? (e) => { if (e?.activePayload?.[0]) onElementClick(e.activePayload[0].payload); } : undefined}>
      {commonChildren}
      {seriesKeys.map((key, i) => (
        <Bar
          key={key}
          dataKey={key}
          fill={config[key].color ?? REPORT_PALETTE[i % REPORT_PALETTE.length]}
          radius={isStacked ? 0 : [4, 4, 0, 0]}
          stackId={isStacked ? 'stack' : undefined}
          className="cursor-pointer"
        />
      ))}
    </BarChart>
  );
}

function renderPie(
  data: Record<string, unknown>[],
  config: ChartConfig,
  dataKey: string,
  nameKey: string,
  showTooltip: boolean,
  showLegend: boolean,
  onElementClick?: (data: Record<string, unknown>) => void,
) {
  return (
    <PieChart>
      {showTooltip && <ChartTooltip content={<ChartTooltipContent />} />}
      {showLegend && <ChartLegend content={<ChartLegendContent />} />}
      <Pie
        data={data}
        dataKey={dataKey}
        nameKey={nameKey}
        cx="50%"
        cy="50%"
        outerRadius="80%"
        innerRadius="40%"
        paddingAngle={2}
        onClick={onElementClick}
        className="cursor-pointer"
      >
        {data.map((entry, i) => {
          const key = String(entry[nameKey] ?? i);
          const color = config[key]?.color ?? REPORT_PALETTE[i % REPORT_PALETTE.length];
          return <Cell key={key} fill={color} />;
        })}
      </Pie>
    </PieChart>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportChart<T extends object = Record<string, unknown>>({
  type,
  data,
  config,
  height = 350,
  xAxisKey = 'name',
  title,
  description,
  showLegend = true,
  showTooltip = true,
  showGrid = true,
  pieDataKey = 'value',
  pieNameKey = 'name',
  onElementClick,
  className,
}: ReportChartProps<T>) {
  const colors = useSemanticColors();
  const typography = useTypography();

  if (data.length === 0) {
    return <ReportEmptyState type="no-data" className={className} />;
  }

  const chart = (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      {type === 'pie'
        ? renderPie(data as Record<string, unknown>[], config, pieDataKey, pieNameKey, showTooltip, showLegend, onElementClick as ((data: Record<string, unknown>) => void) | undefined)
        : renderCartesian(type, data as Record<string, unknown>[], config, xAxisKey, showGrid, showTooltip, showLegend, onElementClick as ((data: Record<string, unknown>) => void) | undefined)
      }
    </ChartContainer>
  );

  if (!title) return <div className={className}>{chart}</div>;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className={cn(typography.heading.h4, colors.text.primary)}>{title}</CardTitle>
        {description && (
          <CardDescription className={cn(colors.text.muted)}>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>{chart}</CardContent>
    </Card>
  );
}
