'use client';

/**
 * @fileoverview Optimization Panel Section Component
 * @module core/performance/components/sections/OptimizationPanel
 *
 * Displays optimization recommendations with apply actions.
 * Dashboard-specific section with collapsible functionality.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 * @since 2026-01-02
 */

import React from 'react';
import { CheckCircle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { performanceComponents } from '@/styles/design-tokens';
import { migrateLegacyActionButton } from '@/core/actions/SmartActionFactory';

// ============================================================================
// TYPES
// ============================================================================

export interface OptimizationRecommendation {
  id: string;
  description: string;
  estimatedImprovement: string;
}

export interface OptimizationPanelProps {
  /** Array of optimization recommendations */
  recommendations: OptimizationRecommendation[];
  /** Callback when applying single optimization */
  onApplyOptimization: (id: string) => Promise<boolean>;
  /** Callback when applying all optimizations */
  onApplyAll: () => Promise<void>;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * OptimizationPanel - Displays and manages optimization recommendations.
 *
 * @example
 * <OptimizationPanel
 *   recommendations={recommendations}
 *   onApplyOptimization={handleApply}
 *   onApplyAll={handleApplyAll}
 * />
 */
export const OptimizationPanel: React.FC<OptimizationPanelProps> = ({
  recommendations,
  onApplyOptimization,
  onApplyAll,
  className
}) => {
  const iconSizes = useIconSizes();

  // All optimizations applied state
  if (recommendations.length === 0) {
    return (
      <section
        className={`performance-success rounded border p-performance-sm ${className ?? ''}`}
        role="status"
        aria-label="All optimizations applied"
      >
        <div className="flex items-center gap-performance-sm">
          <CheckCircle
            className={iconSizes.sm}
            style={{ color: performanceComponents.performanceMonitor.colors.fps.excellent }}
          />
          <span
            className="text-performance-xs"
            style={{ color: performanceComponents.performanceMonitor.colors.fps.excellent }}
          >
            All optimizations applied!
          </span>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`rounded bg-muted/30 p-performance-sm ${className ?? ''}`}
      aria-label="Optimization recommendations"
    >
      {/* Header */}
      <header className="text-performance-xs font-medium text-foreground mb-performance-sm">
        Optimization Recommendations:
      </header>

      {/* Recommendations List */}
      <ul className="flex flex-col gap-performance-sm max-h-32 overflow-y-auto list-none p-0 m-0">
        {recommendations.map((rec) => (
          <li key={rec.id} className="flex items-center justify-between">
            <div className="flex-1 mr-performance-sm">
              <p className="text-performance-xs text-foreground m-0">
                {rec.description}
              </p>
              <p className="text-performance-xs text-muted-foreground m-0">
                {rec.estimatedImprovement}
              </p>
            </div>
            {migrateLegacyActionButton(
              () => onApplyOptimization(rec.id),
              <></>,
              'Apply',
              'blue'
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default OptimizationPanel;
