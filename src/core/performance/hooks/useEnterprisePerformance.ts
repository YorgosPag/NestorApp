/**
 * 🎯 ENTERPRISE PERFORMANCE HOOK - REACT INTEGRATION
 *
 * Κεντρικό React hook για enterprise performance monitoring.
 * Παρέχει unified API για όλη την εφαρμογή.
 *
 * ΑΝΤΙΚΑΘΙΣΤΑ:
 * - src/subapps/dxf-viewer/hooks/performance/usePerformanceOptimization.ts
 * - Όλα τα διάσπαρτα performance hooks
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { EnterprisePerformanceManager } from '../core/EnterprisePerformanceManager';
import {
  PerformanceMetric,
  PerformanceSnapshot,
  PerformanceCategory,
  RealTimePerformanceUpdate,
  MonitoringConfig,
  OptimizationSettings
} from '../types/performance.types';

export interface EnterprisePerformanceState {
  // 📊 CURRENT METRICS
  metrics: PerformanceMetric[];
  snapshot: PerformanceSnapshot | null;

  // 📈 STATISTICS
  statistics: {
    totalMetrics: number;
    averageResponseTime: number;
    cacheHitRatio: number;
    memoryUsage: number;
    metricsPerSecond: number;
  };

  // 🚨 ALERTS & ISSUES
  alerts: PerformanceMetric[];
  issues: PerformanceMetric[];

  // ⚙️ STATE
  isMonitoring: boolean;
  isOptimizing: boolean;
  lastUpdated: number;
}

export interface EnterprisePerformanceActions {
  // 🚦 LIFECYCLE
  startMonitoring: () => void;
  stopMonitoring: () => void;

  // 📝 METRICS
  recordMetric: (metric: Omit<PerformanceMetric, 'id' | 'timestamp'>) => string;
  recordApiCall: (endpoint: string, duration: number, statusCode?: number) => void;
  recordCacheOperation: (operation: 'hit' | 'miss', key: string, duration: number) => void;
  recordRenderTime: (component: string, duration: number) => void;

  // 🔧 CONFIGURATION
  updateConfig: (config: Partial<MonitoringConfig>) => void;
  updateOptimization: (settings: Partial<OptimizationSettings>) => void;

  // 📊 DATA ACCESS
  getMetrics: (category?: PerformanceCategory, limit?: number) => PerformanceMetric[];
  getSnapshot: () => PerformanceSnapshot;

  // 🧹 CLEANUP
  clearMetrics: () => void;
  resetStatistics: () => void;
}

export interface UseEnterprisePerformanceOptions {
  // 🎛️ CONFIGURATION
  autoStart?: boolean;
  realTimeUpdates?: boolean;
  updateInterval?: number;
  categories?: PerformanceCategory[];

  // 📊 CALLBACKS
  onMetric?: (metric: PerformanceMetric) => void;
  onAlert?: (metric: PerformanceMetric) => void;
  onUpdate?: (state: EnterprisePerformanceState) => void;
}

/**
 * 🎯 Enterprise Performance Hook
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     state: { metrics, statistics, isMonitoring },
 *     actions: { recordMetric, startMonitoring, recordRenderTime }
 *   } = useEnterprisePerformance({
 *     autoStart: true,
 *     realTimeUpdates: true,
 *     categories: [PerformanceCategory.RENDERING, PerformanceCategory.API_RESPONSE]
 *   });
 *
 *   useEffect(() => {
 *     const startTime = performance.now();
 *
 *     // Component logic...
 *
 *     const duration = performance.now() - startTime;
 *     recordRenderTime('MyComponent', duration);
 *   }, []);
 *
 *   return (
 *     <div>
 *       <div>Monitoring: {isMonitoring ? 'Active' : 'Inactive'}</div>
 *       <div>Metrics: {metrics.length}</div>
 *       <div>Cache Hit Ratio: {statistics.cacheHitRatio.toFixed(1)}%</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useEnterprisePerformance(
  options: UseEnterprisePerformanceOptions = {}
): {
  state: EnterprisePerformanceState;
  actions: EnterprisePerformanceActions;
} {
  const {
    autoStart = true,
    realTimeUpdates = true,
    updateInterval = 1000,
    categories = [],
    onMetric,
    onAlert,
    onUpdate
  } = options;

  // 🏢 PERFORMANCE MANAGER INSTANCE
  const performanceManager = useRef(EnterprisePerformanceManager.getInstance());
  const subscriptionId = useRef<string | null>(null);
  const updateTimer = useRef<NodeJS.Timeout | null>(null);

  // 📊 STATE
  const [state, setState] = useState<EnterprisePerformanceState>({
    metrics: [],
    snapshot: null,
    statistics: {
      totalMetrics: 0,
      averageResponseTime: 0,
      cacheHitRatio: 0,
      memoryUsage: 0,
      metricsPerSecond: 0
    },
    alerts: [],
    issues: [],
    isMonitoring: false,
    isOptimizing: false,
    lastUpdated: Date.now()
  });

  // 🔄 UPDATE STATE
  const updateState = useCallback(() => {
    const manager = performanceManager.current;
    const snapshot = manager.getSnapshot();
    const statistics = manager.getStatistics();
    const issues = manager.getPerformanceIssues();
    const alerts = manager.getPerformanceIssues().filter(
      metric => metric.severity === 'high' || metric.severity === 'critical'
    );

    const newState: EnterprisePerformanceState = {
      metrics: categories.length > 0
        ? categories.flatMap(category => manager.getMetrics(category, 100))
        : manager.getMetrics(undefined, 500),
      snapshot,
      statistics,
      alerts,
      issues,
      isMonitoring: true, // TODO: Get actual monitoring state from manager
      isOptimizing: false, // TODO: Get optimization state from manager
      lastUpdated: Date.now()
    };

    setState(newState);
    onUpdate?.(newState);
  }, [categories, onUpdate]);

  // 🚦 LIFECYCLE ACTIONS
  const startMonitoring = useCallback(() => {
    performanceManager.current.startMonitoring();
    updateState();
  }, [updateState]);

  const stopMonitoring = useCallback(() => {
    performanceManager.current.stopMonitoring();

    if (subscriptionId.current) {
      performanceManager.current.unsubscribe(subscriptionId.current);
      subscriptionId.current = null;
    }

    updateState();
  }, [updateState]);

  // 📝 METRIC RECORDING ACTIONS
  const recordMetric = useCallback((metric: Omit<PerformanceMetric, 'id' | 'timestamp'>) => {
    const metricId = performanceManager.current.recordMetric(metric);

    // Call callback if provided
    const fullMetric: PerformanceMetric = {
      ...metric,
      id: metricId,
      timestamp: Date.now()
    };

    onMetric?.(fullMetric);

    // Check for alerts
    if (fullMetric.severity === 'high' || fullMetric.severity === 'critical') {
      onAlert?.(fullMetric);
    }

    return metricId;
  }, [onMetric, onAlert]);

  const recordApiCall = useCallback((
    endpoint: string,
    duration: number,
    statusCode = 200
  ) => {
    performanceManager.current.recordApiMetric(endpoint, 'GET', statusCode, duration);
    if (realTimeUpdates) updateState();
  }, [realTimeUpdates, updateState]);

  const recordCacheOperation = useCallback((
    operation: 'hit' | 'miss',
    key: string,
    duration: number
  ) => {
    performanceManager.current.recordCacheMetric(operation, key, duration);
    if (realTimeUpdates) updateState();
  }, [realTimeUpdates, updateState]);

  const recordRenderTime = useCallback((
    component: string,
    duration: number
  ) => {
    performanceManager.current.recordRenderingMetric(component, 'render', duration);
    if (realTimeUpdates) updateState();
  }, [realTimeUpdates, updateState]);

  // 🔧 CONFIGURATION ACTIONS
  const updateConfig = useCallback((config: Partial<MonitoringConfig>) => {
    performanceManager.current.updateConfig(config);
    updateState();
  }, [updateState]);

  const updateOptimization = useCallback((settings: Partial<OptimizationSettings>) => {
    performanceManager.current.updateOptimization(settings);
    updateState();
  }, [updateState]);

  // 📊 DATA ACCESS ACTIONS
  const getMetrics = useCallback((category?: PerformanceCategory, limit?: number) => {
    return performanceManager.current.getMetrics(category, limit);
  }, []);

  const getSnapshot = useCallback(() => {
    return performanceManager.current.getSnapshot();
  }, []);

  // 🧹 CLEANUP ACTIONS
  const clearMetrics = useCallback(() => {
    // Clear metrics by getting fresh instance (this clears internal state)
    performanceManager.current.destroy();
    performanceManager.current = EnterprisePerformanceManager.getInstance();
    updateState();
  }, [updateState]);

  const resetStatistics = useCallback(() => {
    clearMetrics(); // Statistics are derived from metrics
  }, [clearMetrics]);

  // 🎬 COMPONENT LIFECYCLE
  useEffect(() => {
    if (autoStart) {
      startMonitoring();
    }

    // Setup real-time subscription if enabled
    if (realTimeUpdates) {
      subscriptionId.current = performanceManager.current.subscribe({
        categories: categories.length > 0 ? categories : Object.values(PerformanceCategory),
        callback: (update: RealTimePerformanceUpdate) => {
          // Update state on real-time updates
          updateState();
        }
      });
    }

    // Setup periodic updates
    if (updateInterval > 0) {
      updateTimer.current = setInterval(updateState, updateInterval);
    }

    // Initial state update
    updateState();

    // Cleanup function
    return () => {
      if (subscriptionId.current) {
        performanceManager.current.unsubscribe(subscriptionId.current);
      }

      if (updateTimer.current) {
        clearInterval(updateTimer.current);
      }
    };
  }, [
    autoStart,
    realTimeUpdates,
    updateInterval,
    categories,
    startMonitoring,
    updateState
  ]);

  // 🏁 RETURN API
  return {
    state,
    actions: {
      // Lifecycle
      startMonitoring,
      stopMonitoring,

      // Metrics
      recordMetric,
      recordApiCall,
      recordCacheOperation,
      recordRenderTime,

      // Configuration
      updateConfig,
      updateOptimization,

      // Data Access
      getMetrics,
      getSnapshot,

      // Cleanup
      clearMetrics,
      resetStatistics
    }
  };
}

// 🎯 SPECIALIZED HOOKS

/**
 * 🖼️ Performance hook for rendering components
 */
export function useRenderingPerformance(componentName: string) {
  const { actions: { recordRenderTime } } = useEnterprisePerformance({
    categories: [PerformanceCategory.RENDERING],
    autoStart: true
  });

  const measureRender = useCallback(<T>(renderFunction: () => T): T => {
    const startTime = performance.now();
    const result = renderFunction();
    const duration = performance.now() - startTime;

    recordRenderTime(componentName, duration);

    return result;
  }, [componentName, recordRenderTime]);

  const measureAsyncRender = useCallback(async <T>(renderFunction: () => Promise<T>): Promise<T> => {
    const startTime = performance.now();
    const result = await renderFunction();
    const duration = performance.now() - startTime;

    recordRenderTime(componentName, duration);

    return result;
  }, [componentName, recordRenderTime]);

  return {
    measureRender,
    measureAsyncRender,
    recordRenderTime: (duration: number) => recordRenderTime(componentName, duration)
  };
}

/**
 * 🌐 Performance hook for API calls
 */
export function useApiPerformance() {
  const { actions: { recordApiCall } } = useEnterprisePerformance({
    categories: [PerformanceCategory.API_RESPONSE, PerformanceCategory.NETWORK],
    autoStart: true
  });

  const measureApiCall = useCallback(async <T>(
    endpoint: string,
    apiFunction: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    let statusCode = 200;

    try {
      const result = await apiFunction();
      const duration = performance.now() - startTime;
      recordApiCall(endpoint, duration, statusCode);
      return result;
    } catch (error: unknown) {
      // 🏢 ENTERPRISE: Type-safe error status extraction
      if (error && typeof error === 'object') {
        const errorObj = error as { status?: number; response?: { status?: number } };
        statusCode = errorObj.status ?? errorObj.response?.status ?? 500;
      } else {
        statusCode = 500;
      }
      const duration = performance.now() - startTime;
      recordApiCall(endpoint, duration, statusCode);
      throw error;
    }
  }, [recordApiCall]);

  return {
    measureApiCall,
    recordApiCall
  };
}

/**
 * 💾 Performance hook for cache operations
 */
export function useCachePerformance() {
  const { actions: { recordCacheOperation } } = useEnterprisePerformance({
    categories: [PerformanceCategory.CACHE_HIT, PerformanceCategory.CACHE_MISS],
    autoStart: true
  });

  const measureCacheOperation = useCallback(<T>(
    operation: 'hit' | 'miss',
    key: string,
    cacheFunction: () => T
  ): T => {
    const startTime = performance.now();
    const result = cacheFunction();
    const duration = performance.now() - startTime;

    recordCacheOperation(operation, key, duration);

    return result;
  }, [recordCacheOperation]);

  const measureAsyncCacheOperation = useCallback(async <T>(
    operation: 'hit' | 'miss',
    key: string,
    cacheFunction: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    const result = await cacheFunction();
    const duration = performance.now() - startTime;

    recordCacheOperation(operation, key, duration);

    return result;
  }, [recordCacheOperation]);

  return {
    measureCacheOperation,
    measureAsyncCacheOperation,
    recordCacheOperation
  };
}