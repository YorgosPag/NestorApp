'use client';

/**
 * @fileoverview Current Metrics Section Component
 * @module core/performance/components/sections/CurrentMetrics
 *
 * Displays the 2x2 grid of current performance metrics.
 * Dashboard-specific section using shared MetricCard components.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 * @since 2026-01-02
 */

import React from 'react';
import { Zap, MemoryStick, BarChart3, Activity, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { designSystem } from '@/lib/design-system';
import { MetricCard } from '../shared';
import { getTrend } from '../utils/performance-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  renderTime: number;
  canvasElements: number;
}

export interface CurrentMetricsProps {
  /** Current performance metrics */
  metrics: PerformanceMetrics | null;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * CurrentMetrics - Displays 2x2 grid of performance metrics.
 *
 * @example
 * <CurrentMetrics metrics={performanceData.metrics} />
 */
export const CurrentMetrics: React.FC<CurrentMetricsProps> = ({
  metrics,
  className
}) => {
  const iconSizes = useIconSizes();

  // Loading state
  if (!metrics) {
    return (
      <div className={cn(designSystem.presets.text.muted, 'text-center p-6', className)}>
        <Cpu className={`${iconSizes.xl} mx-auto mb-2 opacity-50`} />
        Initializing performance monitoring...
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-2 gap-4', className)}>
      {/* FPS - Higher is better */}
      <MetricCard
        icon={<Zap />}
        label="FPS"
        value={metrics.fps}
        type="fps"
        trend={getTrend(metrics.fps, 60)}
      />

      {/* Memory - Lower is better (inverted) */}
      <MetricCard
        icon={<MemoryStick />}
        label="Memory"
        value={metrics.memoryUsage}
        unit="MB"
        type="memory"
        trend={getTrend(metrics.memoryUsage, 256, true)}
      />

      {/* Render Time - Lower is better (inverted) */}
      <MetricCard
        icon={<BarChart3 />}
        label="Render"
        value={metrics.renderTime}
        unit="ms"
        type="render"
        trend={getTrend(metrics.renderTime, 16.67, true)}
      />

      {/* Canvas Elements - No trend */}
      <MetricCard
        icon={<Activity />}
        label="Elements"
        value={metrics.canvasElements}
        type="elements"
        trend={null}
      />
    </div>
  );
};

export default CurrentMetrics;
