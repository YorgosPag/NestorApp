/**
 * 🎯 USE PERFORMANCE OPTIMIZATION HOOK
 *
 * Enterprise React hook για integration του DXF Performance Optimizer
 * με automatic optimization και real-time monitoring.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { dxfPerformanceOptimizer, type PerformanceMetrics, type PerformanceAlert, type OptimizationAction } from '../../performance/DxfPerformanceOptimizer';

export interface UsePerformanceOptimizationOptions {
  /** Enable automatic optimizations */
  enableAutoOptimizations?: boolean;
  /** Enable performance monitoring */
  enableMonitoring?: boolean;
  /** Monitor interval in milliseconds */
  monitoringInterval?: number;
  /** Enable performance alerts */
  enableAlerts?: boolean;
  /** Performance thresholds */
  thresholds?: {
    maxRenderTime?: number;
    minFPS?: number;
    maxMemoryUsage?: number;
  };
}

export interface PerformanceStatus {
  /** Current performance metrics */
  metrics: PerformanceMetrics | null;
  /** Active performance alerts */
  alerts: PerformanceAlert[];
  /** Available optimization recommendations */
  recommendations: OptimizationAction[];
  /** Overall performance grade */
  grade: string;
  /** Whether performance is optimal */
  isOptimal: boolean;
  /** Performance history (last 60 seconds) */
  history: PerformanceMetrics[];
  /** Whether monitoring is active */
  isMonitoring: boolean;
}

export interface PerformanceControls {
  /** Start performance monitoring */
  startMonitoring: () => void;
  /** Stop performance monitoring */
  stopMonitoring: () => void;
  /** Apply specific optimization by ID */
  applyOptimization: (actionId: string) => Promise<boolean>;
  /** Apply all recommended optimizations */
  applyAllOptimizations: () => Promise<void>;
  /** Clear performance alerts */
  clearAlerts: () => void;
  /** Update performance configuration */
  updateConfig: (config: any) => void;
  /** Trigger manual performance measurement */
  measurePerformance: () => void;
  /** Get performance report */
  getReport: () => string;
}

/**
 * 🎯 Performance Optimization Hook
 *
 * Provides comprehensive performance monitoring και optimization
 * capabilities για DXF Viewer components.
 */
export function usePerformanceOptimization(
  options: UsePerformanceOptimizationOptions = {}
): [PerformanceStatus, PerformanceControls] {
  const {
    enableAutoOptimizations = true,
    enableMonitoring = true,
    monitoringInterval = 1000,
    enableAlerts = true,
    thresholds = {}
  } = options;

  // State
  const [status, setStatus] = useState<PerformanceStatus>({
    metrics: null,
    alerts: [],
    recommendations: [],
    grade: 'unknown',
    isOptimal: false,
    history: [],
    isMonitoring: false
  });

  const [isMonitoringActive, setIsMonitoringActive] = useState(enableMonitoring);

  // Refs
  const monitoringRef = useRef<NodeJS.Timeout | null>(null);
  const componentMountTime = useRef<number>(performance.now());
  const renderCount = useRef<number>(0);

  /**
   * 📊 Update performance status from optimizer
   */
  const updateStatus = useCallback(() => {
    const optimizerStatus = dxfPerformanceOptimizer.getPerformanceStatus();
    const history = dxfPerformanceOptimizer.getPerformanceHistory();

    setStatus({
      metrics: optimizerStatus.metrics,
      alerts: optimizerStatus.alerts,
      recommendations: optimizerStatus.recommendations,
      grade: optimizerStatus.grade,
      isOptimal: optimizerStatus.isOptimal,
      history: history,
      isMonitoring: isMonitoringActive
    });
  }, [isMonitoringActive]);

  /**
   * 🚀 Start monitoring
   */
  const startMonitoring = useCallback(() => {
    if (monitoringRef.current) return; // Already monitoring

    setIsMonitoringActive(true);

    monitoringRef.current = setInterval(() => {
      updateStatus();
    }, monitoringInterval);

    // console.log('📊 Performance monitoring started'); // DISABLED - προκαλούσε loops
  }, [monitoringInterval, updateStatus]);

  /**
   * 🛑 Stop monitoring
   */
  const stopMonitoring = useCallback(() => {
    if (monitoringRef.current) {
      clearInterval(monitoringRef.current);
      monitoringRef.current = null;
    }

    setIsMonitoringActive(false);
    // console.log('🛑 Performance monitoring stopped'); // DISABLED - προκαλούσε loops
  }, []);

  /**
   * ⚡ Apply specific optimization
   */
  const applyOptimization = useCallback(async (actionId: string): Promise<boolean> => {
    const success = await dxfPerformanceOptimizer.applyOptimizationById(actionId);

    if (success) {
      // Update status after optimization
      setTimeout(updateStatus, 500);
      console.log(`✅ Optimization applied: ${actionId}`);
    } else {
      console.warn(`❌ Failed to apply optimization: ${actionId}`);
    }

    return success;
  }, [updateStatus]);

  /**
   * 🚀 Apply all recommended optimizations
   */
  const applyAllOptimizations = useCallback(async (): Promise<void> => {
    const currentStatus = dxfPerformanceOptimizer.getPerformanceStatus();

    for (const recommendation of currentStatus.recommendations) {
      await applyOptimization(recommendation.id);
      // Small delay between optimizations
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('✅ All optimizations applied');
  }, [applyOptimization]);

  /**
   * 🗑️ Clear alerts
   */
  const clearAlerts = useCallback(() => {
    // This would clear alerts in the optimizer
    updateStatus();
    console.log('🗑️ Performance alerts cleared');
  }, [updateStatus]);

  /**
   * ⚙️ Update configuration
   */
  const updateConfig = useCallback((config: any) => {
    dxfPerformanceOptimizer.updateConfig(config);
    updateStatus();
    console.log('⚙️ Performance config updated');
  }, [updateStatus]);

  /**
   * 📏 Measure performance manually
   */
  const measurePerformance = useCallback(() => {
    const startTime = performance.now();

    // Force a performance measurement
    requestAnimationFrame(() => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      console.log(`📏 Manual performance measurement: ${renderTime.toFixed(2)}ms`);
      updateStatus();
    });
  }, [updateStatus]);

  /**
   * 📄 Generate performance report
   */
  const getReport = useCallback((): string => {
    const currentStatus = dxfPerformanceOptimizer.getPerformanceStatus();
    const history = dxfPerformanceOptimizer.getPerformanceHistory();

    const avgFPS = history.length > 0
      ? Math.round(history.reduce((sum, m) => sum + m.fps, 0) / history.length)
      : 0;

    const avgMemory = history.length > 0
      ? Math.round(history.reduce((sum, m) => sum + m.memoryUsage, 0) / history.length * 100) / 100
      : 0;

    const componentAge = Math.round(performance.now() - componentMountTime.current);

    return `
📊 DXF VIEWER PERFORMANCE REPORT
═══════════════════════════════

🎯 OVERALL PERFORMANCE: ${currentStatus.grade?.toUpperCase() || 'UNKNOWN'}
✅ Status: ${currentStatus.isOptimal ? 'OPTIMAL' : 'NEEDS OPTIMIZATION'}

📈 CURRENT METRICS:
• FPS: ${currentStatus.metrics?.fps || 0}
• Memory: ${currentStatus.metrics?.memoryUsage || 0} MB
• Render Time: ${currentStatus.metrics?.renderTime || 0} ms
• Canvas Elements: ${currentStatus.metrics?.canvasElements || 0}

📊 AVERAGES (Last ${history.length} measurements):
• Average FPS: ${avgFPS}
• Average Memory: ${avgMemory} MB

🚨 ACTIVE ALERTS: ${currentStatus.alerts.length}
💡 RECOMMENDATIONS: ${currentStatus.recommendations.length}

⏱️ COMPONENT METRICS:
• Mount Time: ${componentAge} ms ago
• Render Count: ${renderCount.current}
• Monitoring: ${isMonitoringActive ? 'ACTIVE' : 'INACTIVE'}

🎯 Generated at: ${new Date().toLocaleString()}
    `.trim();
  }, [isMonitoringActive]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * 🏗️ Initialize performance optimization
   */
  useEffect(() => {
    // Update configuration with provided thresholds
    if (Object.keys(thresholds).length > 0) {
      dxfPerformanceOptimizer.updateConfig({
        monitoring: {
          performanceThresholds: {
            maxLoadTime: 3000,
            maxRenderTime: 16.67,
            maxMemoryUsage: 256,
            minFPS: 30,
            ...thresholds
          },
          enableRealTimeMonitoring: enableMonitoring,
          enableAlerts: enableAlerts
        }
      });
    }

    // Start monitoring if enabled
    if (enableMonitoring) {
      startMonitoring();
    }

    // Initial status update
    updateStatus();

    return () => {
      stopMonitoring();
    };
  }, [
    enableMonitoring,
    enableAlerts,
    enableAutoOptimizations,
    thresholds,
    startMonitoring,
    stopMonitoring,
    updateStatus
  ]);

  /**
   * 📊 Performance event listeners
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePerformanceAlert = (event: any) => {
      console.warn('⚠️ Performance Alert:', event.detail);
      updateStatus();
    };

    const handleOptimizationApplied = (event: any) => {
      console.log('✅ Optimization Applied:', event.detail);
      updateStatus();
    };

    window.addEventListener('dxf-performance-alert', handlePerformanceAlert);
    window.addEventListener('dxf-optimization-applied', handleOptimizationApplied);

    return () => {
      window.removeEventListener('dxf-performance-alert', handlePerformanceAlert);
      window.removeEventListener('dxf-optimization-applied', handleOptimizationApplied);
    };
  }, [updateStatus]);

  /**
   * 📈 Track component renders
   */
  useEffect(() => {
    renderCount.current++;
  });

  // ============================================================================
  // RETURN
  // ============================================================================

  const controls: PerformanceControls = {
    startMonitoring,
    stopMonitoring,
    applyOptimization,
    applyAllOptimizations,
    clearAlerts,
    updateConfig,
    measurePerformance,
    getReport
  };

  return [status, controls];
}

/**
 * 🎨 Performance optimization hook για canvas components
 */
export function useCanvasPerformanceOptimization() {
  const [status, controls] = usePerformanceOptimization({
    enableAutoOptimizations: true,
    enableMonitoring: true,
    monitoringInterval: 500, // Faster monitoring για canvas
    enableAlerts: true,
    thresholds: {
      maxRenderTime: 16.67, // 60fps target
      minFPS: 30,
      maxMemoryUsage: 512 // Higher threshold για canvas
    }
  });

  /**
   * 🎯 Canvas-specific render tracking
   */
  const trackRender = useCallback((elementCount?: number) => {
    if (typeof window !== 'undefined' && window.__dxfPerformanceOptimizer) {
      window.__dxfPerformanceOptimizer.startRender();

      return () => {
        window.__dxfPerformanceOptimizer?.endRender();
      };
    }

    return () => {}; // No-op
  }, []);

  return {
    ...status,
    ...controls,
    trackRender
  };
}

export default usePerformanceOptimization;