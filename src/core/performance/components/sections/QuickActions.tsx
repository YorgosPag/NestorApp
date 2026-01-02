'use client';

/**
 * @fileoverview Quick Actions Section Component
 * @module core/performance/components/sections/QuickActions
 *
 * Provides quick action buttons for performance testing and optimization.
 * Dashboard-specific section using Smart Action Factory.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 * @since 2026-01-02
 */

import React from 'react';
import { RefreshCcw, Zap, BarChart3 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { migrateLegacyActionButton } from '@/core/actions/SmartActionFactory';

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceControls {
  measurePerformance: () => void;
  applyAllOptimizations: () => void;
}

export interface Recommendation {
  id: string;
  description: string;
  estimatedImprovement: string;
}

export interface QuickActionsProps {
  /** Performance control functions */
  controls: PerformanceControls;
  /** Array of optimization recommendations */
  recommendations: Recommendation[];
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * QuickActions - Provides quick action buttons for performance operations.
 *
 * @example
 * <QuickActions
 *   controls={performanceControls}
 *   recommendations={optimizationRecommendations}
 * />
 */
export const QuickActions: React.FC<QuickActionsProps> = ({
  controls,
  recommendations,
  className
}) => {
  const iconSizes = useIconSizes();

  return (
    <section className={`flex flex-col gap-performance-sm ${className ?? ''}`}>
      {/* Primary Actions Row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-performance-sm">
          {/* Test Button */}
          {migrateLegacyActionButton(
            controls.measurePerformance,
            <RefreshCcw className={iconSizes.xs} />,
            'Test',
            'blue',
            { title: 'Measure performance' }
          )}

          {/* Optimize Button (only when recommendations exist) */}
          {recommendations.length > 0 &&
            migrateLegacyActionButton(
              controls.applyAllOptimizations,
              <Zap className={iconSizes.xs} />,
              'Optimize',
              'green',
              { title: 'Apply all optimizations' }
            )
          }
        </div>

        {/* Recommendations Count */}
        <span className="text-performance-xs text-muted-foreground">
          {recommendations.length} recommendations
        </span>
      </div>

      {/* Detailed Analytics Button */}
      {migrateLegacyActionButton(
        () => window.open('/admin/performance', '_blank'),
        <BarChart3 className={iconSizes.xs} />,
        'Detailed Analytics',
        'purple',
        {
          title: 'Open detailed analytics dashboard',
          fullWidth: true
        }
      )}
    </section>
  );
};

export default QuickActions;
