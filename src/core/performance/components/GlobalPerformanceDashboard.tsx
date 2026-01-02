'use client';

/**
 * @fileoverview Global Performance Dashboard - Main Orchestrator
 * @module core/performance/components/GlobalPerformanceDashboard
 *
 * Google-style clean orchestrator component that composes section components.
 * Single responsibility: Layout and state management only.
 *
 * @author Claude (Anthropic AI)
 * @version 6.0.0 - Google-style modular architecture
 * @since 2026-01-02
 */

import React, { useState } from 'react';
import { Activity, Settings } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useEnterprisePerformance } from '../hooks/useEnterprisePerformance';
import { PerformanceCategory } from '../types/performance.types';
import { FloatingPanel } from '@/components/ui/floating';
import { FloatingStyleUtils } from '@/styles/design-tokens';

// 🏢 GOOGLE-STYLE MODULAR IMPORTS
import { PerformanceGradeBadge, PerformanceChart } from './shared';
import { CurrentMetrics, PerformanceAlerts, QuickActions, OptimizationPanel } from './sections';
import { getInitialPosition, PANEL_DIMENSIONS } from './utils/performance-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface GlobalPerformanceDashboardProps {
  /** Show detailed metrics including chart */
  showDetails?: boolean;
  /** Update interval in milliseconds */
  updateInterval?: number;
  /** Categories to monitor */
  categories?: PerformanceCategory[];
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * GlobalPerformanceDashboard - Enterprise performance monitoring panel.
 *
 * Google-style architecture:
 * - Clean orchestrator (this file): ~100 lines
 * - Reusable components (shared/): ~150 lines
 * - Section components (sections/): ~200 lines
 * - Utilities (utils/): ~100 lines
 *
 * @example
 * <GlobalPerformanceDashboard showDetails updateInterval={2000} />
 */
export const GlobalPerformanceDashboard: React.FC<GlobalPerformanceDashboardProps> = ({
  showDetails = true,
  updateInterval = 2000,
  categories,
  className
}) => {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // 🎯 LOCAL STATE
  const [isVisible, setIsVisible] = useState(true);
  const [showOptimizations, setShowOptimizations] = useState(false);
  const [, setDismissedAlerts] = useState<Set<string>>(new Set());

  // 🎯 PERFORMANCE MONITORING HOOK
  useEnterprisePerformance({
    autoStart: true,
    realTimeUpdates: true,
    updateInterval,
    categories: categories ?? [
      PerformanceCategory.RENDERING,
      PerformanceCategory.API_RESPONSE,
      PerformanceCategory.CACHE_HIT,
      PerformanceCategory.MEMORY
    ]
  });

  // 🎯 MOCK DATA (TODO: Connect to real performance hook)
  const status = {
    grade: 'good',
    metrics: { fps: 50, memoryUsage: 316.5, renderTime: 0.0, canvasElements: 974 },
    alerts: [
      { id: '1', message: 'Memory usage high: 316.5MB > 256MB' },
      { id: '2', message: 'FPS below threshold: 8 < 30' }
    ],
    recommendations: [],
    history: Array.from({ length: 20 }, (_, i) => ({
      fps: Math.random() * 40 + 20,
      timestamp: Date.now() - (20 - i) * 1000
    }))
  };

  // 🎯 CONTROLS
  const controls = {
    measurePerformance: () => console.log('Measuring performance...'),
    applyAllOptimizations: () => console.log('Applying optimizations...'),
    clearAlerts: () => setDismissedAlerts(new Set())
  };

  // 🎯 HIDDEN STATE: Restore button
  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className={FloatingStyleUtils?.getCornerButtonClasses?.('top-right') ??
          `fixed top-4 right-4 z-modal p-2 ${colors.bg.primary} ${getStatusBorder('default')} rounded-md shadow-lg hover:bg-accent transition-colors`}
        title="Show Performance Dashboard"
        type="button"
      >
        <Activity className={iconSizes.sm} />
      </button>
    );
  }

  // 🎯 HEADER ACTIONS
  const headerActions = (
    <>
      <PerformanceGradeBadge grade={status.grade} />
      <button
        onClick={() => setShowOptimizations(prev => !prev)}
        className="p-1 rounded transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
        title="Toggle optimizations"
        type="button"
      >
        <Settings className={iconSizes.xs} />
      </button>
    </>
  );

  // 🎯 RENDER
  return (
    <FloatingPanel
      defaultPosition={getInitialPosition()}
      dimensions={PANEL_DIMENSIONS}
      onClose={() => setIsVisible(false)}
      className={className}
    >
      <FloatingPanel.Header
        title="Performance Monitor"
        icon={<Activity />}
        actions={headerActions}
      />
      <FloatingPanel.Content>
        <CurrentMetrics metrics={status.metrics} />

        {status.alerts.length > 0 && (
          <PerformanceAlerts
            alerts={status.alerts}
            onClearAlerts={controls.clearAlerts}
          />
        )}

        <QuickActions
          controls={controls}
          recommendations={status.recommendations}
        />

        {showOptimizations && (
          <OptimizationPanel
            recommendations={status.recommendations}
            onApplyOptimization={async () => true}
            onApplyAll={async () => controls.applyAllOptimizations()}
          />
        )}

        {showDetails && status.history.length > 0 && (
          <PerformanceChart history={status.history} />
        )}
      </FloatingPanel.Content>
    </FloatingPanel>
  );
};

export default GlobalPerformanceDashboard;
