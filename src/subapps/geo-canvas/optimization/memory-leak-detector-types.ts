/**
 * MEMORY LEAK DETECTOR — TYPE DEFINITIONS
 * Extracted from MemoryLeakDetector.ts (ADR-065 SRP split)
 */

import { type EntryType } from 'perf_hooks';

// ============================================================================
// BROWSER API TYPE EXTENSIONS
// ============================================================================

/**
 * Chrome Performance Memory API
 */
export interface PerformanceMemory {
  readonly jsHeapSizeLimit: number;
  readonly totalJSHeapSize: number;
  readonly usedJSHeapSize: number;
}

export interface PerformanceWithMemory extends Performance {
  readonly memory?: PerformanceMemory;
}

/**
 * Window with gc() exposed (Chrome --expose-gc flag)
 */
export interface WindowWithGC extends Window {
  gc?: () => void;
}

// ============================================================================
// DATA MODELS
// ============================================================================

/**
 * Memory snapshot δεδομένα
 */
export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  components: ComponentMemoryUsage[];
  eventListeners: EventListenerAnalysis[];
  domNodes: DOMNodeAnalysis[];
}

/**
 * Component memory usage tracking
 */
export interface ComponentMemoryUsage {
  componentName: string;
  instances: number;
  estimatedSize: number;
  retainedSize: number;
  shallowSize: number;
  lifecycle: 'mounted' | 'unmounted' | 'orphaned';
  lastActivity: number;
  memoryTrend: 'increasing' | 'stable' | 'decreasing';
}

/**
 * Event listener analysis
 */
export interface EventListenerAnalysis {
  target: string;
  event: string;
  count: number;
  hasCleanup: boolean;
  potentialLeak: boolean;
  memoryImpact: 'low' | 'medium' | 'high';
}

/**
 * DOM node analysis
 */
export interface DOMNodeAnalysis {
  nodeType: string;
  count: number;
  detachedNodes: number;
  orphanedNodes: number;
  memoryFootprint: number;
  retainedBy: string[];
}

/**
 * Memory leak detection result
 */
export interface MemoryLeakResult {
  leakType: 'component' | 'event-listener' | 'dom' | 'closure' | 'timer' | 'reference' | 'unknown';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedComponents: string[];
  memoryImpact: number;
  growthRate: number;
  detectionConfidence: number;
  recommendations: string[];
  stackTrace?: string;
  firstDetected: number;
  lastDetected: number;
}

/**
 * Memory health report
 */
export interface MemoryHealthReport {
  overall: 'healthy' | 'warning' | 'critical';
  totalMemoryUsage: number;
  memoryGrowthRate: number;
  leaksDetected: MemoryLeakResult[];
  componentHealth: ComponentHealthStatus[];
  recommendations: string[];
  nextCheckIn: number;
}

/**
 * Component health status
 */
export interface ComponentHealthStatus {
  component: string;
  status: 'healthy' | 'suspected-leak' | 'confirmed-leak';
  memoryTrend: number[];
  lastCleanup: number;
  recommendedActions: string[];
}

/**
 * Memory leak detector configuration
 */
export interface MemoryLeakDetectorConfig {
  monitoring: {
    interval: number;
    snapshotRetention: number;
    enableContinuous: boolean;
  };
  thresholds: {
    memoryGrowthRate: number;
    componentInstanceLimit: number;
    eventListenerLimit: number;
    domNodeLimit: number;
  };
  detection: {
    minSampleSize: number;
    confidenceThreshold: number;
    enablePredictive: boolean;
  };
  alerts: {
    enableNotifications: boolean;
    criticalThreshold: number;
    warningThreshold: number;
  };
}

/**
 * Memory export data structure
 */
export interface MemoryExportData {
  config: MemoryLeakDetectorConfig;
  snapshots: MemorySnapshot[];
  leaks: MemoryLeakResult[];
  components: ComponentMemoryUsage[];
}

/**
 * PerformanceObserver entryTypes constant
 */
export const MEMORY_ENTRY_TYPES: readonly EntryType[] = ['measure', 'resource'];
