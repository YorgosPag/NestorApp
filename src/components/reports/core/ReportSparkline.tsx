'use client';

/**
 * @module ReportSparkline
 * @enterprise ADR-265 — Mini trend line for KPI cards
 *
 * Lightweight recharts LineChart without axes, grid, or tooltip.
 * Designed to fit inside KPI cards as a small trend indicator.
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportSparklineProps {
  /** Array of numeric values representing the trend */
  data: number[];
  /** Width in pixels (default: 80) */
  width?: number;
  /** Height in pixels (default: 32) */
  height?: number;
  /** Line color — CSS variable or hex (default: report-chart-1) */
  color?: string;
  /** Show dot on last data point (default: true) */
  showLastDot?: boolean;
  /** Line thickness (default: 1.5) */
  strokeWidth?: number;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportSparkline({
  data,
  width = 80,
  height = 32,
  color = 'hsl(var(--report-chart-1))',
  showLastDot = true,
  strokeWidth = 1.5,
  className,
}: ReportSparklineProps) {
  const chartData = useMemo(
    () => data.map((value, index) => ({ index, value })),
    [data],
  );

  if (data.length < 2) return null;

  return (
    <figure
      className={cn('inline-block', className)}
      role="img"
      aria-label="Sparkline trend"
    >
      <ResponsiveContainer width={width} height={height}>
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={strokeWidth}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          {showLastDot && (
            <Line
              type="monotone"
              dataKey="value"
              stroke="none"
              dot={(props) => {
                const { cx, cy, index: dotIndex } = props;
                if (dotIndex !== chartData.length - 1) return <circle r={0} />;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={2.5}
                    fill={color}
                    stroke="none"
                  />
                );
              }}
              activeDot={false}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
