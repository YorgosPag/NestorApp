'use client';

/**
 * @fileoverview Reusable Metric Card Component
 * @module core/performance/components/shared/MetricCard
 *
 * Google-style reusable component for displaying performance metrics.
 * Can be used in any dashboard that needs metric visualization.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 * @since 2026-01-02
 */

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { designSystem } from '@/lib/design-system';
import {
  performanceComponents,
  performanceMonitorUtilities
} from '@/styles/design-tokens';
import { formatMetricValue, type TrendDirection, type MetricType } from '../utils/performance-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface MetricCardProps {
  /** Icon element to display */
  icon: React.ReactNode;
  /** Metric label */
  label: string;
  /** Metric value */
  value: number;
  /** Unit suffix (e.g., "MB", "ms") */
  unit?: string;
  /** Metric type for color coding */
  type: MetricType;
  /** Trend direction indicator */
  trend: TrendDirection;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * MetricCard - Displays a single performance metric with trend indicator.
 *
 * @example
 * <MetricCard
 *   icon={<Zap />}
 *   label="FPS"
 *   value={60}
 *   type="fps"
 *   trend="up"
 * />
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  unit = '',
  type,
  trend,
  className
}) => {
  const iconSizes = useIconSizes();
  const valueColorClass = performanceMonitorUtilities.getMetricValueClasses(type, value);

  return (
    <div
      className={cn(
        designSystem.presets.card.default,
        'p-3 space-y-2',
        className
      )}
    >
      {/* Header: Label + Icon */}
      <div className="flex items-center justify-between">
        <span className={designSystem.presets.text.caption}>
          {label}
        </span>
        <div className={cn(iconSizes.sm, valueColorClass)}>
          {icon}
        </div>
      </div>

      {/* Value + Trend */}
      <div className="flex items-center justify-between">
        <span className={cn('text-lg font-semibold', valueColorClass)}>
          {formatMetricValue(value)}
          {unit && (
            <span className="text-muted-foreground ml-1 text-sm">
              {unit}
            </span>
          )}
        </span>

        {trend && (
          <TrendIndicator
            direction={trend}
            className={iconSizes.sm}
          />
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface TrendIndicatorProps {
  direction: 'up' | 'down';
  className?: string;
}

/**
 * TrendIndicator - Shows trend direction with color coding.
 */
const TrendIndicator: React.FC<TrendIndicatorProps> = ({
  direction,
  className
}) => {
  const color = direction === 'up'
    ? performanceComponents.performanceMonitor.colors.fps.excellent
    : performanceComponents.performanceMonitor.colors.fps.poor;

  return (
    <div className={className} style={{ color }}>
      {direction === 'up' ? <TrendingUp /> : <TrendingDown />}
    </div>
  );
};

export default MetricCard;
