'use client';

/**
 * @fileoverview Reusable Performance Chart Component
 * @module core/performance/components/shared/PerformanceChart
 *
 * Google-style reusable bar chart for performance history visualization.
 * Can be used in any dashboard that needs time-series metric display.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 * @since 2026-01-02
 */

import React from 'react';
import { getDynamicHeightClass } from '@/components/ui/utils/dynamic-styles';
import { performanceMonitorUtilities } from '@/styles/design-tokens';

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceDataPoint {
  /** FPS value at this point */
  fps: number;
  /** Timestamp of measurement */
  timestamp: number;
}

export interface PerformanceChartProps {
  /** Array of performance data points */
  history: PerformanceDataPoint[];
  /** Chart title */
  title?: string;
  /** Number of data points to display */
  maxPoints?: number;
  /** Chart height in Tailwind units */
  height?: string;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PerformanceChart - Displays FPS history as a bar chart.
 *
 * @example
 * <PerformanceChart
 *   history={performanceHistory}
 *   title="FPS History (Last 20s)"
 *   maxPoints={20}
 * />
 */
export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  history,
  title = 'FPS History (Last 20s)',
  maxPoints = 20,
  height = 'h-8',
  className
}) => {
  // Process data
  const chartData = history.slice(-maxPoints);
  const maxFPS = Math.max(...chartData.map(m => m.fps || 60), 60);

  if (chartData.length === 0) {
    return (
      <div className="rounded bg-muted/30 p-performance-sm text-center text-muted-foreground text-xs">
        No performance data available
      </div>
    );
  }

  return (
    <div className={`rounded bg-muted/30 p-performance-sm ${className ?? ''}`}>
      {/* Title */}
      <div className="text-performance-xs font-medium text-foreground mb-performance-sm">
        {title}
      </div>

      {/* Bar Chart */}
      <div className={`flex items-end justify-between ${height} gap-0.5`}>
        {chartData.map((metrics, index) => (
          <ChartBar
            key={index}
            value={metrics.fps || 60}
            maxValue={maxFPS}
          />
        ))}
      </div>

      {/* Time Labels */}
      <div className="flex justify-between text-performance-xs text-muted-foreground mt-performance-xs">
        <span>-{maxPoints}s</span>
        <span>now</span>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ChartBarProps {
  value: number;
  maxValue: number;
}

/**
 * ChartBar - Single bar in the performance chart.
 */
const ChartBar: React.FC<ChartBarProps> = ({ value, maxValue }) => {
  const heightPercent = (value / maxValue) * 100;
  const heightClass = getDynamicHeightClass(`${heightPercent}%`);
  const colorClass = performanceMonitorUtilities.getChartBarClasses(value);

  return (
    <div
      className={`flex-1 rounded-sm ${colorClass}`}
      style={{ height: `${heightPercent}%` }}
      title={`${value.toFixed(0)} FPS`}
      role="img"
      aria-label={`${value.toFixed(0)} FPS`}
    />
  );
};

export default PerformanceChart;




