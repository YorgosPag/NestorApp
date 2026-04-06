/**
 * PERFORMANCE PROFILER — TYPE DEFINITIONS
 * Geo-Alert System - Phase 7: Advanced Performance Profiling & Analysis
 *
 * All interfaces and types for the performance profiling system.
 * Extracted from PerformanceProfiler.ts (ADR-065 SRP split).
 */

// ============================================================================
// BROWSER API TYPE EXTENSIONS
// ============================================================================

/**
 * Network Information API
 */
export interface NetworkInformation {
  readonly effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  readonly downlink?: number;
  readonly rtt?: number;
  readonly saveData?: boolean;
}

export interface NavigatorWithConnection extends Navigator {
  readonly connection?: NetworkInformation;
}

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
 * Layout Shift Entry (Web Vitals)
 */
export interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

/**
 * First Input Entry
 */
export interface FirstInputEntry extends PerformanceEntry {
  processingStart: number;
  processingEnd: number;
}

// ============================================================================
// CORE PROFILER TYPES
// ============================================================================

/**
 * Performance profile session
 */
export interface ProfileSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metrics: ProfileMetrics;
  traces: PerformanceTrace[];
  analysis: ProfileAnalysis;
  metadata: SessionMetadata;
}

/**
 * Performance metrics collection
 */
export interface ProfileMetrics {
  rendering: RenderingMetrics;
  computation: ComputationMetrics;
  network: NetworkMetrics;
  userInteraction: UserInteractionMetrics;
  memory: MemoryMetrics;
  browser: BrowserMetrics;
}

/**
 * Rendering performance metrics
 */
export interface RenderingMetrics {
  frameRate: {
    average: number;
    min: number;
    max: number;
    p95: number;
    drops: number;
  };
  paintTiming: {
    firstPaint: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    firstInputDelay: number;
    cumulativeLayoutShift: number;
  };
  renderCycles: {
    total: number;
    average: number;
    longest: number;
    shortest: number;
  };
  canvasPerformance: {
    drawCalls: number;
    triangles: number;
    textures: number;
    shaderCompilations: number;
    bufferUpdates: number;
  };
}

/**
 * Computation performance metrics
 */
export interface ComputationMetrics {
  cpuUsage: {
    average: number;
    peak: number;
    idle: number;
  };
  taskTiming: {
    total: number;
    averageTaskDuration: number;
    longestTask: number;
    blockedTime: number;
  };
  algorithms: {
    dxfTransformation: AlgorithmMetrics;
    spatialQueries: AlgorithmMetrics;
    alertProcessing: AlgorithmMetrics;
    rendering: AlgorithmMetrics;
  };
  webWorkers: {
    active: number;
    messageLatency: number;
    taskQueue: number;
  };
}

/**
 * Algorithm-specific metrics
 */
export interface AlgorithmMetrics {
  executionCount: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  complexity: string;
  optimizationOpportunities: string[];
}

/**
 * Network performance metrics
 */
export interface NetworkMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    cached: number;
  };
  timing: {
    dns: number;
    tcp: number;
    ssl: number;
    ttfb: number;
    download: number;
  };
  bandwidth: {
    upload: number;
    download: number;
    effectiveType: string;
  };
  resources: ResourceMetrics[];
}

/**
 * Resource loading metrics
 */
export interface ResourceMetrics {
  url: string;
  type: 'script' | 'stylesheet' | 'image' | 'font' | 'xhr' | 'fetch';
  size: number;
  duration: number;
  cached: boolean;
  priority: 'high' | 'medium' | 'low';
}

/**
 * User interaction metrics
 */
export interface UserInteractionMetrics {
  interactions: {
    clicks: number;
    scrolls: number;
    keypresses: number;
    touches: number;
  };
  responsiveness: {
    averageResponseTime: number;
    inputDelay: number;
    interactionToNextPaint: number;
  };
  usability: {
    timeToInteractive: number;
    taskCompletionRate: number;
    errorRate: number;
  };
}

/**
 * Memory metrics
 */
export interface MemoryMetrics {
  heap: {
    used: number;
    total: number;
    limit: number;
  };
  gc: {
    collections: number;
    duration: number;
    frequency: number;
  };
  leaks: {
    suspected: number;
    confirmed: number;
    impact: number;
  };
}

/**
 * Browser-specific metrics
 */
export interface BrowserMetrics {
  vendor: string;
  version: string;
  features: {
    webgl: boolean;
    webWorkers: boolean;
    serviceWorkers: boolean;
    webAssembly: boolean;
  };
  capabilities: {
    maxTextureSize: number;
    maxRenderBufferSize: number;
    maxViewportDims: number[];
  };
}

/**
 * Performance trace entry
 */
export interface PerformanceTrace {
  id: string;
  name: string;
  category: 'rendering' | 'computation' | 'network' | 'user' | 'memory' | 'system';
  startTime: number;
  endTime: number;
  duration: number;
  details: Record<string, unknown>;
  children: PerformanceTrace[];
  metadata: {
    stackTrace?: string;
    component?: string;
    function?: string;
    line?: number;
  };
}

/**
 * Performance analysis results
 */
export interface ProfileAnalysis {
  bottlenecks: Bottleneck[];
  recommendations: PerformanceRecommendation[];
  score: {
    overall: number;
    rendering: number;
    computation: number;
    network: number;
    userExperience: number;
  };
  trends: {
    performance: 'improving' | 'stable' | 'degrading';
    memory: 'stable' | 'growing' | 'leaking';
    responsiveness: 'good' | 'acceptable' | 'poor';
  };
}

/**
 * Performance bottleneck identification
 */
export interface Bottleneck {
  type: 'rendering' | 'computation' | 'network' | 'memory';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  impact: number;
  frequency: number;
  affectedOperations: string[];
  rootCause: string;
  estimatedFix: string;
}

/**
 * Performance recommendation
 */
export interface PerformanceRecommendation {
  category: 'optimization' | 'architecture' | 'configuration' | 'resource';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  implementation: string;
  expectedImprovement: number;
  effort: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  environment: 'development' | 'production' | 'testing';
  userAgent: string;
  viewport: { width: number; height: number };
  deviceType: 'mobile' | 'tablet' | 'desktop';
  connectionType: string;
  features: string[];
}

/**
 * Profiler configuration
 */
export interface ProfilerConfig {
  sampling: {
    interval: number;
    bufferSize: number;
    enableAutoSampling: boolean;
  };
  metrics: {
    enableRendering: boolean;
    enableComputation: boolean;
    enableNetwork: boolean;
    enableMemory: boolean;
    enableUserInteraction: boolean;
  };
  analysis: {
    enableBottleneckDetection: boolean;
    enableTrendAnalysis: boolean;
    confidenceThreshold: number;
  };
  export: {
    format: 'json' | 'chrome-devtools' | 'flame-graph';
    includeSourceMaps: boolean;
    enableVisualization: boolean;
  };
}
