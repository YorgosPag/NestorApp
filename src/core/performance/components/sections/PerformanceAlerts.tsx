'use client';

/**
 * @fileoverview Performance Alerts Section Component
 * @module core/performance/components/sections/PerformanceAlerts
 *
 * Displays active performance alerts with clear action.
 * Dashboard-specific section with enterprise styling.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 * @since 2026-01-02
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { designSystem } from '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceAlert {
  id?: string;
  message?: string;
  name?: string;
}

export interface PerformanceAlertsProps {
  /** Array of active alerts */
  alerts: PerformanceAlert[];
  /** Callback to clear all alerts */
  onClearAlerts: () => void;
  /** Maximum alerts to display before truncating */
  maxVisible?: number;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PerformanceAlerts - Displays performance warnings and alerts.
 *
 * @example
 * <PerformanceAlerts
 *   alerts={activeAlerts}
 *   onClearAlerts={() => clearAllAlerts()}
 * />
 */
export const PerformanceAlerts: React.FC<PerformanceAlertsProps> = ({
  alerts,
  onClearAlerts,
  maxVisible = 3,
  className
}) => {
  const iconSizes = useIconSizes();

  if (alerts.length === 0) {
    return null;
  }

  const visibleAlerts = alerts.slice(0, maxVisible);
  const hiddenCount = alerts.length - maxVisible;

  return (
    <section
      className={cn(
        'rounded-md border border-warning/30 bg-muted p-3 text-foreground',
        className
      )}
      role="alert"
      aria-label="Performance alerts"
    >
      {/* Header */}
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn(iconSizes.xs, 'text-warning')} />
          <span className={cn(
            designSystem.presets.text.caption,
            'font-medium text-warning'
          )}>
            Performance Alerts
          </span>
        </div>
        <button
          onClick={onClearAlerts}
          className="text-xs bg-transparent border-none cursor-pointer text-warning hover:opacity-80 transition-opacity"
          type="button"
        >
          Clear
        </button>
      </header>

      {/* Alert List */}
      <ul className="flex flex-col gap-1 list-none p-0 m-0">
        {visibleAlerts.map((alert, index) => (
          <li key={alert.id ?? index} className="text-xs text-warning/90">
            • {alert.message || alert.name}
          </li>
        ))}
        {hiddenCount > 0 && (
          <li className="text-xs text-warning">
            +{hiddenCount} more alerts
          </li>
        )}
      </ul>
    </section>
  );
};

export default PerformanceAlerts;
