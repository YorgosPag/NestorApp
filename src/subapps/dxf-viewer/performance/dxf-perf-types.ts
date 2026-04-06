/**
 * DXF PERFORMANCE OPTIMIZER — TYPE DEFINITIONS
 *
 * Types, interfaces, and browser API type guards for the
 * DXF Viewer performance optimization system.
 * Extracted from DxfPerformanceOptimizer (ADR-065).
 *
 * @module performance/dxf-perf-types
 * @see DxfPerformanceOptimizer.ts
 */

// ============================================================================
// BROWSER API TYPES (Chrome-specific)
// ============================================================================

/**
 * Chrome-specific Performance Memory Info
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory
 */
export interface PerformanceMemoryInfo {
  readonly jsHeapSizeLimit: number;
  readonly totalJSHeapSize: number;
  readonly usedJSHeapSize: number;
}

/** Extended Performance interface with Chrome memory API */
export interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemoryInfo;
}

/** Type guard to check if performance has memory API */
export function hasMemoryAPI(perf: Performance): perf is PerformanceWithMemory {
  return 'memory' in perf && perf.memory !== undefined;
}

/** Window with optional garbage collection (Chrome DevTools) */
export interface WindowWithGC extends Window {
  gc?: () => void;
}

// ============================================================================
// CONFIG & METRICS INTERFACES
// ============================================================================

export interface DxfPerformanceConfig {
  rendering: {
    enableRequestAnimationFrame: boolean;
    maxFPS: number;
    enableCanvasBuffering: boolean;
    enableViewportCulling: boolean;
    enableLOD: boolean;
    debounceDelay: number;
  };

  memory: {
    enableGarbageCollection: boolean;
    maxMemoryUsage: number;
    enableMemoryProfiling: boolean;
    memoryCheckInterval: number;
  };

  bundling: {
    enableChunkSplitting: boolean;
    enablePreloading: boolean;
    maxChunkSize: number;
    enableTreeShaking: boolean;
  };

  network: {
    enableServiceWorker: boolean;
    enableCaching: boolean;
    cacheStrategy: 'aggressive' | 'normal' | 'conservative';
    enableCompression: boolean;
  };

  monitoring: {
    enableRealTimeMonitoring: boolean;
    performanceThresholds: {
      maxLoadTime: number;
      maxRenderTime: number;
      maxMemoryUsage: number;
      minFPS: number;
    };
    enableAlerts: boolean;
  };
}

export interface PerformanceMetrics {
  timestamp: number;
  fps: number;
  memoryUsage: number;
  renderTime: number;
  loadTime: number;
  bundleSize: number;
  cacheHitRatio: number;
  userInteractionDelay: number;
  canvasElements: number;
  grade: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface OptimizationAction {
  id: string;
  type: 'memory' | 'rendering' | 'bundle' | 'network' | 'critical';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  estimatedImprovement: string;
  autoApply: boolean;
  action: () => Promise<void>;
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'critical';
  metric: keyof PerformanceMetrics;
  currentValue: number;
  threshold: number;
  message: string;
  timestamp: number;
  resolved: boolean;
}

// ============================================================================
// GLOBAL TYPE EXTENSIONS
// ============================================================================

declare global {
  interface Window {
    __dxfPerformanceOptimizer?: {
      startRender: () => void;
      endRender: () => void;
    };
  }
}
