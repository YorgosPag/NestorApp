/**
 * PERFORMANCE PROFILER
 * Geo-Alert System - Phase 7: Advanced Performance Profiling & Analysis
 *
 * Enterprise-class performance profiling system που παρέχει detailed insights
 * για rendering, computation, network, και user interaction performance.
 */

// Use browser Performance API instead of Node.js perf_hooks
declare const performance: Performance;
declare const PerformanceObserver: typeof window.PerformanceObserver;
import { GEO_COLORS } from '../config/color-config';
import { generateTraceId, generateSessionId } from '@/services/enterprise-id.service';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * ✅ ENTERPRISE: Network Information API
 */
interface NetworkInformation {
  readonly effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  readonly downlink?: number;
  readonly rtt?: number;
  readonly saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
  readonly connection?: NetworkInformation;
}

/**
 * ✅ ENTERPRISE: Chrome Performance Memory API
 */
interface PerformanceMemory {
  readonly jsHeapSizeLimit: number;
  readonly totalJSHeapSize: number;
  readonly usedJSHeapSize: number;
}

interface PerformanceWithMemory extends Performance {
  readonly memory?: PerformanceMemory;
}

/**
 * ✅ ENTERPRISE: Layout Shift Entry (Web Vitals)
 */
interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

/**
 * ✅ ENTERPRISE: First Input Entry
 */
interface FirstInputEntry extends PerformanceEntry {
  processingStart: number;
  processingEnd: number;
}

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
  // 🏢 ENTERPRISE: Proper type for trace details
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
  impact: number; // ms impact on performance
  frequency: number; // occurrences per session
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
  expectedImprovement: number; // percentage
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
    interval: number;        // ms
    bufferSize: number;      // max traces
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
    confidenceThreshold: number; // 0-100%
  };
  export: {
    format: 'json' | 'chrome-devtools' | 'flame-graph';
    includeSourceMaps: boolean;
    enableVisualization: boolean;
  };
}

// ============================================================================
// MAIN PERFORMANCE PROFILER CLASS
// ============================================================================

/**
 * Performance Profiler - Advanced Performance Analysis & Profiling
 * Singleton pattern για centralized performance profiling
 */
export class GeoAlertPerformanceProfiler {
  private static instance: GeoAlertPerformanceProfiler | null = null;
  private config: ProfilerConfig;
  private activeSessions: Map<string, ProfileSession> = new Map();
  private performanceObserver?: PerformanceObserver;
  private traces: Map<string, PerformanceTrace> = new Map();
  private isProfileActive: boolean = false;
  private frameMonitor?: number;

  // ========================================================================
  // SINGLETON PATTERN
  // ========================================================================

  private constructor() {
    this.config = this.getDefaultConfig();
    this.initializePerformanceObserver();
  }

  public static getInstance(): GeoAlertPerformanceProfiler {
    if (!GeoAlertPerformanceProfiler.instance) {
      GeoAlertPerformanceProfiler.instance = new GeoAlertPerformanceProfiler();
    }
    return GeoAlertPerformanceProfiler.instance;
  }

  // ========================================================================
  // CONFIGURATION
  // ========================================================================

  private getDefaultConfig(): ProfilerConfig {
    return {
      sampling: {
        interval: 100,        // 100ms
        bufferSize: 10000,    // 10k traces
        enableAutoSampling: true
      },
      metrics: {
        enableRendering: true,
        enableComputation: true,
        enableNetwork: true,
        enableMemory: true,
        enableUserInteraction: true
      },
      analysis: {
        enableBottleneckDetection: true,
        enableTrendAnalysis: true,
        confidenceThreshold: 80
      },
      export: {
        format: 'json',
        includeSourceMaps: true,
        enableVisualization: true
      }
    };
  }

  private initializePerformanceObserver(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        this.processPerformanceEntries(entries);
      });

      // Observe all relevant performance entry types
      this.performanceObserver.observe({
        entryTypes: [
          'measure',
          'navigation',
          'resource',
          'paint',
          'largest-contentful-paint',
          'first-input',
          'layout-shift',
          'longtask'
        ]
      });
    } catch (error) {
      console.warn('PerformanceObserver initialization failed:', error);
    }
  }

  // ========================================================================
  // PROFILING SESSION MANAGEMENT
  // ========================================================================

  /**
   * Start performance profiling session
   */
  public startProfiling(sessionName: string = 'default'): string {
    const sessionId = this.generateSessionId();

    console.log(`🔍 PERFORMANCE PROFILER - Starting session: ${sessionName}`);

    const session: ProfileSession = {
      id: sessionId,
      name: sessionName,
      startTime: performance.now(),
      metrics: this.initializeMetrics(),
      traces: [],
      analysis: this.initializeAnalysis(),
      metadata: this.collectSessionMetadata()
    };

    this.activeSessions.set(sessionId, session);
    this.isProfileActive = true;

    // Start monitoring
    this.startFrameMonitoring();
    this.startResourceMonitoring();
    this.startUserInteractionMonitoring();

    console.log(`✅ Profiling session started: ${sessionId}`);
    return sessionId;
  }

  /**
   * Stop profiling session και generate analysis
   */
  public async stopProfiling(sessionId: string): Promise<ProfileSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    console.log(`🛑 Stopping profiling session: ${sessionId}`);

    session.endTime = performance.now();
    session.duration = session.endTime - session.startTime;

    // Stop monitoring
    this.stopFrameMonitoring();
    this.isProfileActive = false;

    // Collect final metrics
    await this.finalizeMetrics(session);

    // Perform analysis
    await this.analyzePerformance(session);

    console.log(`✅ Profiling session completed: ${sessionId} (${session.duration.toFixed(2)}ms)`);

    return session;
  }

  // ========================================================================
  // METRICS COLLECTION
  // ========================================================================

  private initializeMetrics(): ProfileMetrics {
    return {
      rendering: {
        frameRate: { average: 0, min: Infinity, max: 0, p95: 0, drops: 0 },
        paintTiming: {
          firstPaint: 0,
          firstContentfulPaint: 0,
          largestContentfulPaint: 0,
          firstInputDelay: 0,
          cumulativeLayoutShift: 0
        },
        renderCycles: { total: 0, average: 0, longest: 0, shortest: Infinity },
        canvasPerformance: {
          drawCalls: 0,
          triangles: 0,
          textures: 0,
          shaderCompilations: 0,
          bufferUpdates: 0
        }
      },
      computation: {
        cpuUsage: { average: 0, peak: 0, idle: 0 },
        taskTiming: { total: 0, averageTaskDuration: 0, longestTask: 0, blockedTime: 0 },
        algorithms: {
          dxfTransformation: this.initializeAlgorithmMetrics(),
          spatialQueries: this.initializeAlgorithmMetrics(),
          alertProcessing: this.initializeAlgorithmMetrics(),
          rendering: this.initializeAlgorithmMetrics()
        },
        webWorkers: { active: 0, messageLatency: 0, taskQueue: 0 }
      },
      network: {
        requests: { total: 0, successful: 0, failed: 0, cached: 0 },
        timing: { dns: 0, tcp: 0, ssl: 0, ttfb: 0, download: 0 },
        bandwidth: { upload: 0, download: 0, effectiveType: 'unknown' },
        resources: []
      },
      userInteraction: {
        interactions: { clicks: 0, scrolls: 0, keypresses: 0, touches: 0 },
        responsiveness: { averageResponseTime: 0, inputDelay: 0, interactionToNextPaint: 0 },
        usability: { timeToInteractive: 0, taskCompletionRate: 0, errorRate: 0 }
      },
      memory: {
        heap: { used: 0, total: 0, limit: 0 },
        gc: { collections: 0, duration: 0, frequency: 0 },
        leaks: { suspected: 0, confirmed: 0, impact: 0 }
      },
      browser: this.collectBrowserMetrics()
    };
  }

  private initializeAlgorithmMetrics(): AlgorithmMetrics {
    return {
      executionCount: 0,
      totalTime: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
      complexity: 'O(1)',
      optimizationOpportunities: []
    };
  }

  private collectBrowserMetrics(): BrowserMetrics {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    return {
      vendor: navigator.userAgent.split(' ')[0] || 'unknown',
      version: this.extractBrowserVersion(),
      features: {
        webgl: !!gl,
        webWorkers: typeof Worker !== 'undefined',
        serviceWorkers: 'serviceWorker' in navigator,
        webAssembly: typeof WebAssembly !== 'undefined'
      },
      capabilities: {
        maxTextureSize: gl ? (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_TEXTURE_SIZE) : 0,
        maxRenderBufferSize: gl ? (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_RENDERBUFFER_SIZE) : 0,
        maxViewportDims: gl ? (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_VIEWPORT_DIMS) : [0, 0]
      }
    };
  }

  private extractBrowserVersion(): string {
    const userAgent = navigator.userAgent;
    const versionMatch = userAgent.match(/(?:Chrome|Firefox|Safari|Edge)\/(\d+\.\d+)/);
    return versionMatch ? versionMatch[1] : 'unknown';
  }

  private collectSessionMetadata(): SessionMetadata {
    return {
      environment: this.detectEnvironment(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      deviceType: this.detectDeviceType(),
      connectionType: this.getConnectionType(),
      features: this.getActiveFeatures()
    };
  }

  private detectEnvironment(): 'development' | 'production' | 'testing' {
    if (typeof process !== 'undefined' && process.env) {
      // ✅ ENTERPRISE: Type guard for NODE_ENV
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

  private detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private getConnectionType(): string {
    // ✅ ENTERPRISE: Type-safe Navigator.connection
    if ('connection' in navigator) {
      const nav = navigator as NavigatorWithConnection;
      return nav.connection?.effectiveType || 'unknown';
    }
    return 'unknown';
  }

  private getActiveFeatures(): string[] {
    const features: string[] = [];

    if ('requestIdleCallback' in window) features.push('idle-callback');
    if ('IntersectionObserver' in window) features.push('intersection-observer');
    if ('PerformanceObserver' in window) features.push('performance-observer');
    if ('requestAnimationFrame' in window) features.push('animation-frame');

    return features;
  }

  // ========================================================================
  // FRAME MONITORING
  // ========================================================================

  private startFrameMonitoring(): void {
    if (!this.config.metrics.enableRendering) return;

    let lastFrameTime = performance.now();
    let frameCount = 0;
    const frameTimes: number[] = [];

    const monitorFrame = () => {
      if (!this.isProfileActive) return;

      const currentTime = performance.now();
      const frameTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;
      frameCount++;

      frameTimes.push(frameTime);

      // Update frame rate metrics για active sessions
      Array.from(this.activeSessions.values()).forEach(session => {
        this.updateFrameMetrics(session, frameTime, frameTimes);
      });

      this.frameMonitor = requestAnimationFrame(monitorFrame);
    };

    this.frameMonitor = requestAnimationFrame(monitorFrame);
  }

  private stopFrameMonitoring(): void {
    if (this.frameMonitor) {
      cancelAnimationFrame(this.frameMonitor);
      this.frameMonitor = undefined;
    }
  }

  private updateFrameMetrics(session: ProfileSession, frameTime: number, frameTimes: number[]): void {
    const rendering = session.metrics.rendering;

    // Update frame rate statistics
    const fps = 1000 / frameTime;
    rendering.frameRate.min = Math.min(rendering.frameRate.min, fps);
    rendering.frameRate.max = Math.max(rendering.frameRate.max, fps);

    if (frameTimes.length >= 20) {
      const recentFrames = frameTimes.slice(-20);
      rendering.frameRate.average = 1000 / (recentFrames.reduce((a, b) => a + b) / recentFrames.length);

      // Calculate 95th percentile
      const sorted = [...recentFrames].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      rendering.frameRate.p95 = 1000 / sorted[p95Index];

      // Count frame drops (frames > 16.67ms για 60fps)
      if (frameTime > 16.67) {
        rendering.frameRate.drops++;
      }
    }

    // Update render cycle metrics
    rendering.renderCycles.total++;
    rendering.renderCycles.longest = Math.max(rendering.renderCycles.longest, frameTime);
    rendering.renderCycles.shortest = Math.min(rendering.renderCycles.shortest, frameTime);
    rendering.renderCycles.average = rendering.renderCycles.total > 0 ?
      (rendering.renderCycles.average * (rendering.renderCycles.total - 1) + frameTime) / rendering.renderCycles.total :
      frameTime;
  }

  // ========================================================================
  // RESOURCE MONITORING
  // ========================================================================

  private startResourceMonitoring(): void {
    if (!this.config.metrics.enableNetwork) return;

    // Monitor network information
    // ✅ ENTERPRISE: Type-safe Navigator.connection
    if ('connection' in navigator) {
      const nav = navigator as NavigatorWithConnection;
      const connection = nav.connection;
      if (connection && 'addEventListener' in connection) {
        (connection as EventTarget).addEventListener('change', () => {
          this.updateNetworkMetrics();
        });
      }
    }

    // Monitor resource loading
    this.monitorResourceLoading();
  }

  private monitorResourceLoading(): void {
    const processResource = (entry: PerformanceResourceTiming) => {
      const resource: ResourceMetrics = {
        url: entry.name,
        type: this.determineResourceType(entry.name),
        size: entry.transferSize || 0,
        duration: entry.duration,
        cached: entry.transferSize === 0,
        priority: this.determineResourcePriority(entry.name)
      };

      // Add to active sessions
      Array.from(this.activeSessions.values()).forEach(session => {
        session.metrics.network.resources.push(resource);
        this.updateNetworkStats(session, resource);
      });
    };

    // Process existing resources
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    resources.forEach(processResource);

    // Monitor new resources
    if (this.performanceObserver) {
      // Resources are automatically captured by PerformanceObserver
    }
  }

  private determineResourceType(url: string): ResourceMetrics['type'] {
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|otf)$/)) return 'font';
    if (url.includes('/api/') || url.includes('fetch')) return 'fetch';
    return 'xhr';
  }

  private determineResourcePriority(url: string): ResourceMetrics['priority'] {
    if (url.includes('critical') || url.includes('main')) return 'high';
    if (url.includes('lazy') || url.includes('async')) return 'low';
    return 'medium';
  }

  private updateNetworkStats(session: ProfileSession, resource: ResourceMetrics): void {
    const network = session.metrics.network;

    network.requests.total++;
    if (resource.cached) {
      network.requests.cached++;
    } else {
      network.requests.successful++;
    }

    // Update timing averages (simplified)
    network.timing.download = (network.timing.download + resource.duration) / 2;
  }

  private updateNetworkMetrics(): void {
    if (!('connection' in navigator)) return;

    // ✅ ENTERPRISE: Type-safe Navigator.connection
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection;
    if (!connection) return;

    Array.from(this.activeSessions.values()).forEach(session => {
      session.metrics.network.bandwidth.effectiveType = connection.effectiveType || 'unknown';
      session.metrics.network.bandwidth.download = (connection.downlink || 0) * 1024 * 1024; // Convert to bytes/s
    });
  }

  // ========================================================================
  // USER INTERACTION MONITORING
  // ========================================================================

  private startUserInteractionMonitoring(): void {
    if (!this.config.metrics.enableUserInteraction) return;

    // Track clicks
    document.addEventListener('click', (event) => {
      this.recordInteraction('click', event);
    });

    // Track scrolls
    document.addEventListener('scroll', (event) => {
      this.recordInteraction('scroll', event);
    });

    // Track keypresses
    document.addEventListener('keydown', (event) => {
      this.recordInteraction('keypress', event);
    });

    // Track touches
    document.addEventListener('touchstart', (event) => {
      this.recordInteraction('touch', event);
    });
  }

  private recordInteraction(type: string, event: Event): void {
    const timestamp = performance.now();

    Array.from(this.activeSessions.values()).forEach(session => {
      const interaction = session.metrics.userInteraction.interactions;

      switch (type) {
        case 'click':
          interaction.clicks++;
          break;
        case 'scroll':
          interaction.scrolls++;
          break;
        case 'keypress':
          interaction.keypresses++;
          break;
        case 'touch':
          interaction.touches++;
          break;
      }

      // Record trace
      this.recordTrace({
        id: `interaction-${Date.now()}`,
        name: `user-${type}`,
        category: 'user',
        startTime: timestamp,
        endTime: timestamp,
        duration: 0,
        details: {
          type,
          target: (event.target as Element)?.tagName || 'unknown'
        },
        children: [],
        metadata: {}
      });
    });
  }

  // ========================================================================
  // TRACE RECORDING
  // ========================================================================

  /**
   * Record performance trace
   */
  public recordTrace(trace: PerformanceTrace): void {
    this.traces.set(trace.id, trace);

    // Add to active sessions
    Array.from(this.activeSessions.values()).forEach(session => {
      session.traces.push(trace);
    });

    // Maintain buffer size
    if (this.traces.size > this.config.sampling.bufferSize) {
      const oldestKey = this.traces.keys().next().value;
      if (typeof oldestKey === 'string') {
        this.traces.delete(oldestKey);
      }
    }
  }

  /**
   * Start trace measurement
   */
  // 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
  public startTrace(name: string, category: PerformanceTrace['category'] = 'computation'): string {
    const traceId = generateTraceId();

    const trace: PerformanceTrace = {
      id: traceId,
      name,
      category,
      startTime: performance.now(),
      endTime: 0,
      duration: 0,
      details: {},
      children: [],
      metadata: {
        stackTrace: this.captureStackTrace()
      }
    };

    this.traces.set(traceId, trace);
    return traceId;
  }

  /**
   * End trace measurement
   */
  public endTrace(traceId: string, details?: Record<string, unknown>): PerformanceTrace | null {
    const trace = this.traces.get(traceId);
    if (!trace) return null;

    trace.endTime = performance.now();
    trace.duration = trace.endTime - trace.startTime;
    if (details) trace.details = { ...trace.details, ...details };

    // Add to active sessions
    Array.from(this.activeSessions.values()).forEach(session => {
      session.traces.push({ ...trace });
    });

    return trace;
  }

  private captureStackTrace(): string {
    const error = new Error();
    return error.stack || 'Stack trace not available';
  }

  // ========================================================================
  // PERFORMANCE ANALYSIS
  // ========================================================================

  private initializeAnalysis(): ProfileAnalysis {
    return {
      bottlenecks: [],
      recommendations: [],
      score: {
        overall: 0,
        rendering: 0,
        computation: 0,
        network: 0,
        userExperience: 0
      },
      trends: {
        performance: 'stable',
        memory: 'stable',
        responsiveness: 'good'
      }
    };
  }

  private async analyzePerformance(session: ProfileSession): Promise<void> {
    console.log(`🔍 Analyzing performance για session: ${session.id}`);

    // Detect bottlenecks
    session.analysis.bottlenecks = await this.detectBottlenecks(session);

    // Generate recommendations
    session.analysis.recommendations = await this.generateRecommendations(session);

    // Calculate performance scores
    session.analysis.score = this.calculatePerformanceScores(session);

    // Analyze trends
    session.analysis.trends = this.analyzeTrends(session);

    console.log(`✅ Performance analysis completed για session: ${session.id}`);
  }

  private async detectBottlenecks(session: ProfileSession): Promise<Bottleneck[]> {
    const bottlenecks: Bottleneck[] = [];

    // Rendering bottlenecks
    if (session.metrics.rendering.frameRate.average < 30) {
      bottlenecks.push({
        type: 'rendering',
        severity: 'critical',
        description: `Low frame rate: ${session.metrics.rendering.frameRate.average.toFixed(1)} FPS`,
        impact: 1000 / session.metrics.rendering.frameRate.average - 16.67,
        frequency: session.metrics.rendering.frameRate.drops,
        affectedOperations: ['canvas rendering', 'animations', 'user interactions'],
        rootCause: 'Expensive rendering operations or layout thrashing',
        estimatedFix: 'Optimize rendering pipeline, reduce draw calls'
      });
    }

    // Computation bottlenecks
    if (session.metrics.computation.taskTiming.longestTask > 50) {
      bottlenecks.push({
        type: 'computation',
        severity: 'high',
        description: `Long running task: ${session.metrics.computation.taskTiming.longestTask.toFixed(2)}ms`,
        impact: session.metrics.computation.taskTiming.longestTask,
        frequency: 1,
        affectedOperations: ['DXF processing', 'spatial calculations'],
        rootCause: 'CPU-intensive algorithms blocking main thread',
        estimatedFix: 'Move heavy computation to Web Workers'
      });
    }

    // Network bottlenecks
    const slowResources = session.metrics.network.resources.filter(r => r.duration > 1000);
    if (slowResources.length > 0) {
      bottlenecks.push({
        type: 'network',
        severity: 'medium',
        description: `Slow resource loading: ${slowResources.length} resources > 1s`,
        impact: slowResources.reduce((sum, r) => sum + r.duration, 0) / slowResources.length,
        frequency: slowResources.length,
        affectedOperations: ['initial load', 'feature loading'],
        rootCause: 'Large bundle sizes or slow network conditions',
        estimatedFix: 'Implement code splitting and resource optimization'
      });
    }

    // Memory bottlenecks
    if (session.metrics.memory.leaks.suspected > 0) {
      bottlenecks.push({
        type: 'memory',
        severity: 'high',
        description: `Memory leaks detected: ${session.metrics.memory.leaks.suspected} suspected`,
        impact: session.metrics.memory.leaks.impact,
        frequency: session.metrics.memory.leaks.suspected,
        affectedOperations: ['component lifecycle', 'event handling'],
        rootCause: 'Improper cleanup of event listeners or references',
        estimatedFix: 'Implement proper cleanup in useEffect hooks'
      });
    }

    return bottlenecks;
  }

  private async generateRecommendations(session: ProfileSession): Promise<PerformanceRecommendation[]> {
    const recommendations: PerformanceRecommendation[] = [];

    // Rendering optimizations
    if (session.metrics.rendering.frameRate.average < 60) {
      recommendations.push({
        category: 'optimization',
        priority: 'high',
        title: 'Optimize Rendering Performance',
        description: 'Implement rendering optimizations to achieve 60 FPS',
        implementation: 'Use requestAnimationFrame, implement object pooling, optimize shaders',
        expectedImprovement: 40,
        effort: 'medium',
        risk: 'low'
      });
    }

    // Code splitting recommendations
    const totalBundleSize = session.metrics.network.resources
      .filter(r => r.type === 'script')
      .reduce((sum, r) => sum + r.size, 0);

    if (totalBundleSize > 1024 * 1024) { // > 1MB
      recommendations.push({
        category: 'architecture',
        priority: 'high',
        title: 'Implement Code Splitting',
        description: 'Reduce initial bundle size through code splitting',
        implementation: 'Use dynamic imports and route-based splitting',
        expectedImprovement: 30,
        effort: 'medium',
        risk: 'low'
      });
    }

    // Memory optimization
    if (session.metrics.memory.heap.used > 100 * 1024 * 1024) { // > 100MB
      recommendations.push({
        category: 'optimization',
        priority: 'medium',
        title: 'Optimize Memory Usage',
        description: 'Reduce memory footprint through better memory management',
        implementation: 'Implement object pooling, optimize data structures, add cleanup',
        expectedImprovement: 25,
        effort: 'high',
        risk: 'medium'
      });
    }

    return recommendations;
  }

  private calculatePerformanceScores(session: ProfileSession): ProfileAnalysis['score'] {
    // Rendering score (0-100)
    const renderingScore = Math.min(100, (session.metrics.rendering.frameRate.average / 60) * 100);

    // Computation score (based on task duration)
    const computationScore = Math.max(0, 100 - (session.metrics.computation.taskTiming.averageTaskDuration / 50) * 100);

    // Network score (based on load times)
    const avgResourceTime = session.metrics.network.resources.length > 0 ?
      session.metrics.network.resources.reduce((sum, r) => sum + r.duration, 0) / session.metrics.network.resources.length : 0;
    const networkScore = Math.max(0, 100 - (avgResourceTime / 1000) * 100);

    // User experience score (based on responsiveness)
    const uxScore = Math.max(0, 100 - (session.metrics.userInteraction.responsiveness.averageResponseTime / 100) * 100);

    // Overall score (weighted average)
    const overallScore = (renderingScore * 0.3 + computationScore * 0.25 + networkScore * 0.25 + uxScore * 0.2);

    return {
      overall: Math.round(overallScore),
      rendering: Math.round(renderingScore),
      computation: Math.round(computationScore),
      network: Math.round(networkScore),
      userExperience: Math.round(uxScore)
    };
  }

  private analyzeTrends(session: ProfileSession): ProfileAnalysis['trends'] {
    // Simplified trend analysis
    // In real implementation, would compare με previous sessions

    return {
      performance: session.analysis.score.overall > 80 ? 'stable' : 'degrading',
      memory: session.metrics.memory.leaks.suspected > 0 ? 'leaking' : 'stable',
      responsiveness: session.metrics.userInteraction.responsiveness.averageResponseTime < 100 ? 'good' : 'poor'
    };
  }

  // ========================================================================
  // PROFILING UTILITIES
  // ========================================================================

  /**
   * Profile specific function
   */
  public profileFunction<T>(
    fn: () => T,
    name: string,
    category: PerformanceTrace['category'] = 'computation'
  ): { result: T; trace: PerformanceTrace } {
    const traceId = this.startTrace(name, category);
    const startTime = performance.now();

    try {
      const result = fn();
      const endTime = performance.now();
      const trace = this.endTrace(traceId, { result: 'success' });

      return { result, trace: trace! };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const trace = this.endTrace(traceId, { result: 'error', error: errorMessage });

      throw error;
    }
  }

  /**
   * Profile async function
   */
  public async profileAsync<T>(
    fn: () => Promise<T>,
    name: string,
    category: PerformanceTrace['category'] = 'computation'
  ): Promise<{ result: T; trace: PerformanceTrace }> {
    const traceId = this.startTrace(name, category);

    try {
      const result = await fn();
      const trace = this.endTrace(traceId, { result: 'success' });

      return { result, trace: trace! };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const trace = this.endTrace(traceId, { result: 'error', error: errorMessage });

      throw error;
    }
  }

  /**
   * Measure component render time
   */
  public measureComponentRender(componentName: string): {
    start: () => void;
    end: () => PerformanceTrace | null;
  } {
    let traceId: string;

    return {
      start: () => {
        traceId = this.startTrace(`render-${componentName}`, 'rendering');
      },
      end: () => {
        return this.endTrace(traceId, { component: componentName });
      }
    };
  }

  // ========================================================================
  // FINALIZATION & CLEANUP
  // ========================================================================

  private async finalizeMetrics(session: ProfileSession): Promise<void> {
    // Collect final memory metrics
    if (this.config.metrics.enableMemory) {
      const memoryInfo = this.getMemoryInfo();
      session.metrics.memory.heap = memoryInfo;
    }

    // Update algorithm metrics
    this.updateAlgorithmMetrics(session);

    // Calculate final statistics
    this.calculateFinalStatistics(session);
  }

  private getMemoryInfo(): MemoryMetrics['heap'] {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        used: usage.heapUsed,
        total: usage.heapTotal,
        limit: usage.rss
      };
    }

    // ✅ ENTERPRISE: Type-safe performance.memory
    if (typeof window !== 'undefined' && 'performance' in window) {
      const perf = window.performance as PerformanceWithMemory;
      if (perf.memory) {
        const memory = perf.memory;
        return {
          used: memory.usedJSHeapSize || 0,
          total: memory.totalJSHeapSize || 0,
          limit: memory.jsHeapSizeLimit || 0
        };
      }
    }

    return { used: 0, total: 0, limit: 0 };
  }

  private updateAlgorithmMetrics(session: ProfileSession): void {
    // Update algorithm metrics based on traces
    const algorithmTraces = session.traces.filter(trace =>
      trace.name.includes('dxf') ||
      trace.name.includes('spatial') ||
      trace.name.includes('alert') ||
      trace.name.includes('render')
    );

    algorithmTraces.forEach(trace => {
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

  private calculateFinalStatistics(session: ProfileSession): void {
    // Calculate user interaction responsiveness
    const userTraces = session.traces.filter(trace => trace.category === 'user');
    if (userTraces.length > 0) {
      const totalResponseTime = userTraces.reduce((sum, trace) => sum + trace.duration, 0);
      session.metrics.userInteraction.responsiveness.averageResponseTime = totalResponseTime / userTraces.length;
    }

    // Update computation task timing
    const computationTraces = session.traces.filter(trace => trace.category === 'computation');
    if (computationTraces.length > 0) {
      const computation = session.metrics.computation.taskTiming;
      computation.total = computationTraces.length;
      computation.averageTaskDuration = computationTraces.reduce((sum, trace) => sum + trace.duration, 0) / computationTraces.length;
      computation.longestTask = Math.max(...computationTraces.map(trace => trace.duration));
    }
  }

  // ========================================================================
  // PERFORMANCE OBSERVER PROCESSING
  // ========================================================================

  private processPerformanceEntries(entries: PerformanceEntry[]): void {
    entries.forEach(entry => {
      this.processPerformanceEntry(entry);
    });
  }

  private processPerformanceEntry(entry: PerformanceEntry): void {
    Array.from(this.activeSessions.values()).forEach(session => {
      switch (entry.entryType) {
        case 'paint':
          this.processPaintEntry(session, entry as PerformancePaintTiming);
          break;
        case 'largest-contentful-paint':
          this.processLCPEntry(session, entry);
          break;
        case 'first-input':
          this.processFIDEntry(session, entry);
          break;
        case 'layout-shift':
          this.processCLSEntry(session, entry);
          break;
        case 'longtask':
          this.processLongTaskEntry(session, entry);
          break;
        case 'resource':
          this.processResourceEntry(session, entry as PerformanceResourceTiming);
          break;
      }
    });
  }

  private processPaintEntry(session: ProfileSession, entry: PerformancePaintTiming): void {
    const paintTiming = session.metrics.rendering.paintTiming;

    if (entry.name === 'first-paint') {
      paintTiming.firstPaint = entry.startTime;
    } else if (entry.name === 'first-contentful-paint') {
      paintTiming.firstContentfulPaint = entry.startTime;
    }
  }

  private processLCPEntry(session: ProfileSession, entry: PerformanceEntry): void {
    session.metrics.rendering.paintTiming.largestContentfulPaint = entry.startTime;
  }

  private processFIDEntry(session: ProfileSession, entry: PerformanceEntry): void {
    // ✅ ENTERPRISE: Type guard for FirstInputEntry
    if ('processingStart' in entry) {
      const fidEntry = entry as FirstInputEntry;
      session.metrics.rendering.paintTiming.firstInputDelay = fidEntry.processingStart - entry.startTime;
    }
  }

  private processCLSEntry(session: ProfileSession, entry: PerformanceEntry): void {
    // ✅ ENTERPRISE: Type guard for LayoutShiftEntry
    if ('hadRecentInput' in entry && 'value' in entry) {
      const clsEntry = entry as LayoutShiftEntry;
      if (!clsEntry.hadRecentInput) {
        session.metrics.rendering.paintTiming.cumulativeLayoutShift += clsEntry.value;
      }
    }
  }

  private processLongTaskEntry(session: ProfileSession, entry: PerformanceEntry): void {
    session.metrics.computation.taskTiming.longestTask = Math.max(
      session.metrics.computation.taskTiming.longestTask,
      entry.duration
    );
    session.metrics.computation.taskTiming.blockedTime += entry.duration;
  }

  private processResourceEntry(session: ProfileSession, entry: PerformanceResourceTiming): void {
    // Already handled in resource monitoring
  }

  // ========================================================================
  // EXPORT & REPORTING
  // ========================================================================

  /**
   * Export profiling data
   */
  public exportSession(sessionId: string, format?: 'json' | 'chrome-devtools' | 'flame-graph'): string {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const exportFormat = format || this.config.export.format;

    switch (exportFormat) {
      case 'chrome-devtools':
        return this.exportChromeDevTools(session);
      case 'flame-graph':
        return this.exportFlameGraph(session);
      default:
        return JSON.stringify(session, null, 2);
    }
  }

  private exportChromeDevTools(session: ProfileSession): string {
    // Generate Chrome DevTools compatible format
    const traceEvents = session.traces.map(trace => ({
      name: trace.name,
      cat: trace.category,
      ph: 'X', // Complete event
      ts: trace.startTime * 1000, // microseconds
      dur: trace.duration * 1000,
      pid: 1,
      tid: 1,
      args: trace.details
    }));

    return JSON.stringify({
      traceEvents,
      displayTimeUnit: 'ms',
      metadata: session.metadata
    }, null, 2);
  }

  private exportFlameGraph(session: ProfileSession): string {
    // Generate flame graph data
    const flameGraphData = session.traces.map(trace => ({
      name: trace.name,
      value: trace.duration,
      children: trace.children.map(child => ({
        name: child.name,
        value: child.duration
      }))
    }));

    return JSON.stringify(flameGraphData, null, 2);
  }

  /**
   * Generate performance report
   */
  public generateReport(sessionId: string): string {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return this.generateHTMLReport(session);
  }

  private generateHTMLReport(session: ProfileSession): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Performance Profile Report - ${session.name}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; }
        .header { background: linear-gradient(135deg, ${GEO_COLORS.MONITORING.DASHBOARD_PRIMARY} 0%, ${GEO_COLORS.MONITORING.DASHBOARD_SECONDARY} 100%); color: ${GEO_COLORS.MONITORING.DASHBOARD_TEXT}; padding: 20px; border-radius: 8px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: hsl(var(--card)); padding: 15px; border-radius: 8px; border-left: 4px solid ${GEO_COLORS.MONITORING.INFO}; }
        .score { font-size: 2em; font-weight: bold; color: ${GEO_COLORS.MONITORING.SUCCESS}; }
        .bottleneck { background: hsl(var(--muted)); padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid ${GEO_COLORS.MONITORING.WARNING}; }
        .recommendation { background: hsl(var(--accent)); padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid ${GEO_COLORS.MONITORING.INFO}; }
        .critical { border-left-color: ${GEO_COLORS.MONITORING.ERROR}; }
        .high { border-left-color: ${GEO_COLORS.MONITORING.WARNING}; }
        .medium { border-left-color: ${GEO_COLORS.MONITORING.WARNING}; }
        .low { border-left-color: ${GEO_COLORS.MONITORING.SUCCESS}; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🚀 Performance Profile Report</h1>
        <p><strong>Session:</strong> ${session.name} (${session.duration?.toFixed(2)}ms)</p>
        <p><strong>Environment:</strong> ${session.metadata.environment} | <strong>Device:</strong> ${session.metadata.deviceType}</p>
      </div>

      <div class="metrics">
        <div class="metric-card">
          <h3>Overall Score</h3>
          <div class="score">${session.analysis.score.overall}/100</div>
        </div>
        <div class="metric-card">
          <h3>Rendering</h3>
          <p>FPS: ${session.metrics.rendering.frameRate.average.toFixed(1)}</p>
          <p>Frame Drops: ${session.metrics.rendering.frameRate.drops}</p>
          <p>Score: ${session.analysis.score.rendering}/100</p>
        </div>
        <div class="metric-card">
          <h3>Network</h3>
          <p>Requests: ${session.metrics.network.requests.total}</p>
          <p>Resources: ${session.metrics.network.resources.length}</p>
          <p>Score: ${session.analysis.score.network}/100</p>
        </div>
        <div class="metric-card">
          <h3>Memory</h3>
          <p>Heap Used: ${this.formatBytes(session.metrics.memory.heap.used)}</p>
          <p>Suspected Leaks: ${session.metrics.memory.leaks.suspected}</p>
        </div>
      </div>

      <h2>🚨 Performance Bottlenecks</h2>
      ${session.analysis.bottlenecks.map(bottleneck => `
        <div class="bottleneck ${bottleneck.severity}">
          <h4>${bottleneck.type.toUpperCase()}: ${bottleneck.description}</h4>
          <p><strong>Impact:</strong> ${bottleneck.impact.toFixed(2)}ms</p>
          <p><strong>Root Cause:</strong> ${bottleneck.rootCause}</p>
          <p><strong>Estimated Fix:</strong> ${bottleneck.estimatedFix}</p>
        </div>
      `).join('')}

      <h2>💡 Optimization Recommendations</h2>
      ${session.analysis.recommendations.map(rec => `
        <div class="recommendation ${rec.priority}">
          <h4>${rec.title} (${rec.priority.toUpperCase()})</h4>
          <p>${rec.description}</p>
          <p><strong>Implementation:</strong> ${rec.implementation}</p>
          <p><strong>Expected Improvement:</strong> ${rec.expectedImprovement}% | <strong>Effort:</strong> ${rec.effort}</p>
        </div>
      `).join('')}

      <h2>📊 Detailed Metrics</h2>
      <div class="metrics">
        <div class="metric-card">
          <h4>Algorithms Performance</h4>
          ${Object.entries(session.metrics.computation.algorithms).map(([name, metrics]) => `
            <p><strong>${name}:</strong> ${metrics.executionCount} calls, ${metrics.averageTime.toFixed(2)}ms avg</p>
          `).join('')}
        </div>
        <div class="metric-card">
          <h4>User Interactions</h4>
          <p>Clicks: ${session.metrics.userInteraction.interactions.clicks}</p>
          <p>Scrolls: ${session.metrics.userInteraction.interactions.scrolls}</p>
          <p>Response Time: ${session.metrics.userInteraction.responsiveness.averageResponseTime.toFixed(2)}ms</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  // 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
  private generateSessionId(): string {
    return generateSessionId();
  }

  /**
   * Get all active sessions
   */
  public getActiveSessions(): Map<string, ProfileSession> {
    return this.activeSessions;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ProfilerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear all sessions
   */
  public clearSessions(): void {
    this.activeSessions.clear();
    this.traces.clear();
  }

  /**
   * Get performance insights summary
   */
  public getPerformanceInsights(): {
    activeProfiles: number;
    totalTraces: number;
    averagePerformanceScore: number;
    commonBottlenecks: string[];
  } {
    const sessions = Array.from(this.activeSessions.values());
    const totalTraces = this.traces.size;
    const averageScore = sessions.length > 0 ?
      sessions.reduce((sum, session) => sum + session.analysis.score.overall, 0) / sessions.length : 0;

    const bottleneckTypes = sessions.flatMap(session => session.analysis.bottlenecks.map(b => b.type));
    const commonBottlenecks = Array.from(new Set(bottleneckTypes));

    return {
      activeProfiles: sessions.length,
      totalTraces,
      averagePerformanceScore: Math.round(averageScore),
      commonBottlenecks
    };
  }
}

// ============================================================================
// GLOBAL EXPORTS & UTILITIES
// ============================================================================

/**
 * Global Performance Profiler Instance
 */
export const geoAlertPerformanceProfiler = GeoAlertPerformanceProfiler.getInstance();

/**
 * Quick profiling utilities
 */
export const startProfiler = (name?: string) => geoAlertPerformanceProfiler.startProfiling(name);
export const stopProfiler = (sessionId: string) => geoAlertPerformanceProfiler.stopProfiling(sessionId);
export const profileFunction = <T>(fn: () => T, name: string) => geoAlertPerformanceProfiler.profileFunction(fn, name);
export const profileAsync = <T>(fn: () => Promise<T>, name: string) => geoAlertPerformanceProfiler.profileAsync(fn, name);

/**
 * Default export για convenience
 */
export default geoAlertPerformanceProfiler;
