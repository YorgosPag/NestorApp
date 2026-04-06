/**
 * PERFORMANCE MONITOR - Type Definitions
 *
 * @module geo-canvas/performance/monitoring/performance-monitor-types
 * Extracted from PerformanceMonitor.ts (ADR-065 Phase 3, #17)
 */

export interface PerformanceEventTimingEntry extends PerformanceEntry {
  processingStart?: number;
  processingEnd?: number;
  duration: number;
  cancelable?: boolean;
  target?: EventTarget | null;
}

export interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

export interface PerformanceReportSummary {
  currentMemory: number;
  currentFPS: number;
  totalAlerts: number;
  criticalAlerts: number;
  slowestComponents: Array<{ name: string; avgRenderTime: number }>;
}

export interface PerformanceMetrics {
  timestamp: number;
  runtime: {
    heapUsed: number;
    heapTotal: number;
    heapLimit: number;
    external: number;
    rss?: number;
  };
  rendering: {
    fps: number;
    frameDrops: number;
    renderTime: number;
    componentRenders: number;
    lastRenderDuration: number;
  };
  network: {
    requests: number;
    totalSize: number;
    averageLatency: number;
    failedRequests: number;
    cacheHits: number;
  };
  interaction: {
    inputLatency: number;
    clickLatency: number;
    scrollLatency: number;
    gestureLatency: number;
  };
  bundle: {
    initialLoadTime: number;
    bundleSize: number;
    chunkLoadTimes: Record<string, number>;
    lazyLoadedModules: number;
  };
  memoryLeaks: {
    suspectedLeaks: number;
    growingObjects: string[];
    retainedSize: number;
    leakScore: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'memory' | 'performance' | 'rendering' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metrics: Partial<PerformanceMetrics>;
  suggestion?: string;
}

export interface PerformanceThresholds {
  memory: {
    heapUsageWarning: number;
    heapUsageCritical: number;
    memoryLeakThreshold: number;
  };
  rendering: {
    fpsWarning: number;
    fpsCritical: number;
    renderTimeWarning: number;
    renderTimeCritical: number;
  };
  interaction: {
    inputLatencyWarning: number;
    inputLatencyCritical: number;
  };
  network: {
    latencyWarning: number;
    latencyCritical: number;
    failureRateWarning: number;
  };
}

export interface ComponentPerformanceData {
  componentName: string;
  renderCount: number;
  totalRenderTime: number;
  averageRenderTime: number;
  maxRenderTime: number;
  lastRenderTime: number;
  propsChanges: number;
  stateChanges: number;
}

export const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  memory: { heapUsageWarning: 100, heapUsageCritical: 200, memoryLeakThreshold: 50 },
  rendering: { fpsWarning: 30, fpsCritical: 15, renderTimeWarning: 16, renderTimeCritical: 33 },
  interaction: { inputLatencyWarning: 100, inputLatencyCritical: 300 },
  network: { latencyWarning: 1000, latencyCritical: 3000, failureRateWarning: 5 }
};
