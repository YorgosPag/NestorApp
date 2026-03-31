'use client';

/**
 * @module ReportFunnel
 * @enterprise ADR-265 — Conversion funnel chart
 *
 * Wraps recharts FunnelChart for pipeline/conversion visualization.
 * Uses Okabe-Ito report chart palette (Decision 12.25).
 */

import '@/lib/design-system';
import { useMemo } from 'react';

import { FunnelChart, Funnel, Cell, LabelList } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/intl-formatting';
import { ReportEmptyState } from './ReportEmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FunnelStage {
  /** Stage name (displayed as label) */
  name: string;
  /** Numeric value for this stage */
  value: number;
  /** Optional custom fill color */
  fill?: string;
}

export interface ReportFunnelProps {
  /** Funnel stages from widest to narrowest */
  data: FunnelStage[];
  /** Chart height in px (default: 300) */
  height?: number;
  /** Show value labels on bars (default: true) */
  showLabels?: boolean;
  /** Show numeric values (default: true) */
  showValues?: boolean;
  /** Custom value formatter */
  formatValue?: (value: number) => string;
  /** Optional chart title */
  title?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
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
// Component
// ---------------------------------------------------------------------------

export function ReportFunnel({
  data,
  height = 300,
  showLabels = true,
  showValues = true,
  formatValue: customFormat,
  title,
  className,
}: ReportFunnelProps) {
  const colors = useSemanticColors();
  const typography = useTypography();

  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    data.forEach((stage, i) => {
      config[stage.name] = {
        label: stage.name,
        color: stage.fill ?? REPORT_PALETTE[i % REPORT_PALETTE.length],
      };
    });
    return config;
  }, [data]);

  const formatter = customFormat ?? formatNumber;

  if (data.length === 0) {
    return <ReportEmptyState type="no-data" className={className} />;
  }

  const chart = (
    <ChartContainer config={chartConfig} className={cn('mx-auto', className)} style={{ height }}>
      <FunnelChart>
        <ChartTooltip content={<ChartTooltipContent />} />
        <Funnel dataKey="value" data={data} isAnimationActive={false}>
          {data.map((stage, index) => (
            <Cell
              key={stage.name}
              fill={stage.fill ?? REPORT_PALETTE[index % REPORT_PALETTE.length]}
            />
          ))}
          {showLabels && (
            <LabelList
              dataKey="name"
              position="right"
              className="fill-foreground text-sm"
            />
          )}
          {showValues && (
            <LabelList
              dataKey="value"
              position="center"
              className="fill-background font-semibold text-sm"
              formatter={formatter}
            />
          )}
        </Funnel>
      </FunnelChart>
    </ChartContainer>
  );

  if (!title) return chart;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className={cn(typography.heading.h4, colors.text.primary)}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{chart}</CardContent>
    </Card>
  );
}
