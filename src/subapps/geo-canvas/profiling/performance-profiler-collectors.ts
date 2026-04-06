/**
 * PERFORMANCE PROFILER — METRIC COLLECTORS & ENTRY PROCESSORS
 * Geo-Alert System - Phase 7: Advanced Performance Profiling & Analysis
 *
 * Standalone functions for metric initialization, collection, and
 * performance entry processing. Extracted from PerformanceProfiler.ts (ADR-065).
 */

import type {
  ProfileMetrics,
  AlgorithmMetrics,
  BrowserMetrics,
  SessionMetadata,
  ResourceMetrics,
  ProfileSession,
  NavigatorWithConnection,
  PerformanceWithMemory,
  MemoryMetrics,
  FirstInputEntry,
  LayoutShiftEntry,
} from './performance-profiler-types';

// ============================================================================
// METRIC INITIALIZATION
// ============================================================================

export function initializeAlgorithmMetrics(): AlgorithmMetrics {
  return {
    executionCount: 0,
    totalTime: 0,
    averageTime: 0,
    minTime: Infinity,
    maxTime: 0,
    complexity: 'O(1)',
    optimizationOpportunities: [],
  };
}

export function initializeMetrics(): ProfileMetrics {
  return {
    rendering: {
      frameRate: { average: 0, min: Infinity, max: 0, p95: 0, drops: 0 },
      paintTiming: {
        firstPaint: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        firstInputDelay: 0,
        cumulativeLayoutShift: 0,
      },
      renderCycles: { total: 0, average: 0, longest: 0, shortest: Infinity },
      canvasPerformance: {
        drawCalls: 0,
        triangles: 0,
        textures: 0,
        shaderCompilations: 0,
        bufferUpdates: 0,
      },
    },
    computation: {
      cpuUsage: { average: 0, peak: 0, idle: 0 },
      taskTiming: { total: 0, averageTaskDuration: 0, longestTask: 0, blockedTime: 0 },
      algorithms: {
        dxfTransformation: initializeAlgorithmMetrics(),
        spatialQueries: initializeAlgorithmMetrics(),
        alertProcessing: initializeAlgorithmMetrics(),
        rendering: initializeAlgorithmMetrics(),
      },
      webWorkers: { active: 0, messageLatency: 0, taskQueue: 0 },
    },
    network: {
      requests: { total: 0, successful: 0, failed: 0, cached: 0 },
      timing: { dns: 0, tcp: 0, ssl: 0, ttfb: 0, download: 0 },
      bandwidth: { upload: 0, download: 0, effectiveType: 'unknown' },
      resources: [],
    },
    userInteraction: {
      interactions: { clicks: 0, scrolls: 0, keypresses: 0, touches: 0 },
      responsiveness: { averageResponseTime: 0, inputDelay: 0, interactionToNextPaint: 0 },
      usability: { timeToInteractive: 0, taskCompletionRate: 0, errorRate: 0 },
    },
    memory: {
      heap: { used: 0, total: 0, limit: 0 },
      gc: { collections: 0, duration: 0, frequency: 0 },
      leaks: { suspected: 0, confirmed: 0, impact: 0 },
    },
    browser: collectBrowserMetrics(),
  };
}

// ============================================================================
// BROWSER & SESSION METADATA
// ============================================================================

export function collectBrowserMetrics(): BrowserMetrics {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

  return {
    vendor: navigator.userAgent.split(' ')[0] || 'unknown',
    version: extractBrowserVersion(),
    features: {
      webgl: !!gl,
      webWorkers: typeof Worker !== 'undefined',
      serviceWorkers: 'serviceWorker' in navigator,
      webAssembly: typeof WebAssembly !== 'undefined',
    },
    capabilities: {
      maxTextureSize: gl
        ? (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_TEXTURE_SIZE)
        : 0,
      maxRenderBufferSize: gl
        ? (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_RENDERBUFFER_SIZE)
        : 0,
      maxViewportDims: gl
        ? (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_VIEWPORT_DIMS)
        : [0, 0],
    },
  };
}

export function extractBrowserVersion(): string {
  const userAgent = navigator.userAgent;
  const versionMatch = userAgent.match(/(?:Chrome|Firefox|Safari|Edge)\/(\d+\.\d+)/);
  return versionMatch ? versionMatch[1] : 'unknown';
}

export function collectSessionMetadata(): SessionMetadata {
  return {
    environment: detectEnvironment(),
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    deviceType: detectDeviceType(),
    connectionType: getConnectionType(),
    features: getActiveFeatures(),
  };
}

export function detectEnvironment(): 'development' | 'production' | 'testing' {
  if (typeof process !== 'undefined' && process.env) {
    const env = process.env.NODE_ENV;
    if (env === 'development' || env === 'production') {
      return env;
    }
    if (env === 'test') {
      return 'testing';
    }
    return 'development';
  }
  return window.location.hostname === 'localhost' ? 'development' : 'production';
}

export function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export function getConnectionType(): string {
  if ('connection' in navigator) {
    const nav = navigator as NavigatorWithConnection;
    return nav.connection?.effectiveType || 'unknown';
  }
  return 'unknown';
}

export function getActiveFeatures(): string[] {
  const features: string[] = [];

  if ('requestIdleCallback' in window) features.push('idle-callback');
  if ('IntersectionObserver' in window) features.push('intersection-observer');
  if ('PerformanceObserver' in window) features.push('performance-observer');
  if ('requestAnimationFrame' in window) features.push('animation-frame');

  return features;
}

// ============================================================================
// FRAME & NETWORK METRIC UPDATERS
// ============================================================================

export function updateFrameMetrics(
  session: ProfileSession,
  frameTime: number,
  frameTimes: number[]
): void {
  const rendering = session.metrics.rendering;

  const fps = 1000 / frameTime;
  rendering.frameRate.min = Math.min(rendering.frameRate.min, fps);
  rendering.frameRate.max = Math.max(rendering.frameRate.max, fps);

  if (frameTimes.length >= 20) {
    const recentFrames = frameTimes.slice(-20);
    rendering.frameRate.average =
      1000 / (recentFrames.reduce((a, b) => a + b) / recentFrames.length);

    const sorted = [...recentFrames].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    rendering.frameRate.p95 = 1000 / sorted[p95Index];

    if (frameTime > 16.67) {
      rendering.frameRate.drops++;
    }
  }

  rendering.renderCycles.total++;
  rendering.renderCycles.longest = Math.max(rendering.renderCycles.longest, frameTime);
  rendering.renderCycles.shortest = Math.min(rendering.renderCycles.shortest, frameTime);
  rendering.renderCycles.average =
    rendering.renderCycles.total > 0
      ? (rendering.renderCycles.average * (rendering.renderCycles.total - 1) + frameTime) /
        rendering.renderCycles.total
      : frameTime;
}

export function determineResourceType(url: string): ResourceMetrics['type'] {
  if (url.includes('.js')) return 'script';
  if (url.includes('.css')) return 'stylesheet';
  if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
  if (url.match(/\.(woff|woff2|ttf|otf)$/)) return 'font';
  if (url.includes('/api/') || url.includes('fetch')) return 'fetch';
  return 'xhr';
}

export function determineResourcePriority(url: string): ResourceMetrics['priority'] {
  if (url.includes('critical') || url.includes('main')) return 'high';
  if (url.includes('lazy') || url.includes('async')) return 'low';
  return 'medium';
}

export function updateNetworkStats(session: ProfileSession, resource: ResourceMetrics): void {
  const network = session.metrics.network;

  network.requests.total++;
  if (resource.cached) {
    network.requests.cached++;
  } else {
    network.requests.successful++;
  }

  network.timing.download = (network.timing.download + resource.duration) / 2;
}

// ============================================================================
// MEMORY INFO
// ============================================================================

export function getMemoryInfo(): MemoryMetrics['heap'] {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      used: usage.heapUsed,
      total: usage.heapTotal,
      limit: usage.rss,
    };
  }

  if (typeof window !== 'undefined' && 'performance' in window) {
    const perf = window.performance as PerformanceWithMemory;
    if (perf.memory) {
      const memory = perf.memory;
      return {
        used: memory.usedJSHeapSize || 0,
        total: memory.totalJSHeapSize || 0,
        limit: memory.jsHeapSizeLimit || 0,
      };
    }
  }

  return { used: 0, total: 0, limit: 0 };
}

// ============================================================================
// FINALIZATION HELPERS
// ============================================================================

export function updateAlgorithmMetrics(session: ProfileSession): void {
  const algorithmTraces = session.traces.filter(
    (trace) =>
      trace.name.includes('dxf') ||
      trace.name.includes('spatial') ||
      trace.name.includes('alert') ||
      trace.name.includes('render')
  );

  algorithmTraces.forEach((trace) => {
    let algorithmKey: keyof typeof session.metrics.computation.algorithms;

    if (trace.name.includes('dxf')) algorithmKey = 'dxfTransformation';
    else if (trace.name.includes('spatial')) algorithmKey = 'spatialQueries';
    else if (trace.name.includes('alert')) algorithmKey = 'alertProcessing';
    else algorithmKey = 'rendering';

    const algorithm = session.metrics.computation.algorithms[algorithmKey];
    algorithm.executionCount++;
    algorithm.totalTime += trace.duration;
    algorithm.averageTime = algorithm.totalTime / algorithm.executionCount;
    algorithm.minTime = Math.min(algorithm.minTime, trace.duration);
    algorithm.maxTime = Math.max(algorithm.maxTime, trace.duration);
  });
}

export function calculateFinalStatistics(session: ProfileSession): void {
  const userTraces = session.traces.filter((trace) => trace.category === 'user');
  if (userTraces.length > 0) {
    const totalResponseTime = userTraces.reduce((sum, trace) => sum + trace.duration, 0);
    session.metrics.userInteraction.responsiveness.averageResponseTime =
      totalResponseTime / userTraces.length;
  }

  const computationTraces = session.traces.filter((trace) => trace.category === 'computation');
  if (computationTraces.length > 0) {
    const computation = session.metrics.computation.taskTiming;
    computation.total = computationTraces.length;
    computation.averageTaskDuration =
      computationTraces.reduce((sum, trace) => sum + trace.duration, 0) / computationTraces.length;
    computation.longestTask = Math.max(...computationTraces.map((trace) => trace.duration));
  }
}

// ============================================================================
// PERFORMANCE ENTRY PROCESSORS
// ============================================================================

export function processPaintEntry(session: ProfileSession, entry: PerformancePaintTiming): void {
  const paintTiming = session.metrics.rendering.paintTiming;

  if (entry.name === 'first-paint') {
    paintTiming.firstPaint = entry.startTime;
  } else if (entry.name === 'first-contentful-paint') {
    paintTiming.firstContentfulPaint = entry.startTime;
  }
}

export function processLCPEntry(session: ProfileSession, entry: PerformanceEntry): void {
  session.metrics.rendering.paintTiming.largestContentfulPaint = entry.startTime;
}

export function processFIDEntry(session: ProfileSession, entry: PerformanceEntry): void {
  if ('processingStart' in entry) {
    const fidEntry = entry as FirstInputEntry;
    session.metrics.rendering.paintTiming.firstInputDelay =
      fidEntry.processingStart - entry.startTime;
  }
}

export function processCLSEntry(session: ProfileSession, entry: PerformanceEntry): void {
  if ('hadRecentInput' in entry && 'value' in entry) {
    const clsEntry = entry as LayoutShiftEntry;
    if (!clsEntry.hadRecentInput) {
      session.metrics.rendering.paintTiming.cumulativeLayoutShift += clsEntry.value;
    }
  }
}

export function processLongTaskEntry(session: ProfileSession, entry: PerformanceEntry): void {
  session.metrics.computation.taskTiming.longestTask = Math.max(
    session.metrics.computation.taskTiming.longestTask,
    entry.duration
  );
  session.metrics.computation.taskTiming.blockedTime += entry.duration;
}

/**
 * Dispatch a single performance entry to the appropriate processor
 */
export function dispatchPerformanceEntry(session: ProfileSession, entry: PerformanceEntry): void {
  switch (entry.entryType) {
    case 'paint':
      processPaintEntry(session, entry as PerformancePaintTiming);
      break;
    case 'largest-contentful-paint':
      processLCPEntry(session, entry);
      break;
    case 'first-input':
      processFIDEntry(session, entry);
      break;
    case 'layout-shift':
      processCLSEntry(session, entry);
      break;
    case 'longtask':
      processLongTaskEntry(session, entry);
      break;
  }
}

/**
 * Build ResourceMetrics from a PerformanceResourceTiming entry
 */
export function buildResourceFromEntry(entry: PerformanceResourceTiming): ResourceMetrics {
  return {
    url: entry.name,
    type: determineResourceType(entry.name),
    size: entry.transferSize || 0,
    duration: entry.duration,
    cached: entry.transferSize === 0,
    priority: determineResourcePriority(entry.name),
  };
}

/**
 * Update network bandwidth metrics from Navigator connection
 */
export function updateNetworkBandwidth(
  session: ProfileSession,
  connection: NetworkInformation
): void {
  session.metrics.network.bandwidth.effectiveType = connection.effectiveType || 'unknown';
  session.metrics.network.bandwidth.download = (connection.downlink || 0) * 1024 * 1024;
}
