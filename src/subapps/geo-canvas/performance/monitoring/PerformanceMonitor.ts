/**
 * PERFORMANCE MONITORING SYSTEM
 * Geo-Alert System - Phase 7: Enterprise Performance Monitoring
 *
 * Comprehensive performance monitoring με real-time metrics collection,
 * memory tracking, render performance analysis, και automated reporting.
 */

// ============================================================================
// PERFORMANCE TYPES
// ============================================================================

/**
 * ✅ ENTERPRISE: Type definition for PerformanceEventTiming (Event Timing API)
 */
interface PerformanceEventTimingEntry extends PerformanceEntry {
  processingStart?: number;
  processingEnd?: number;
  duration: number;
  cancelable?: boolean;
  target?: EventTarget | null;
}

export interface PerformanceMetrics {
  timestamp: number;

  // Runtime Performance
  runtime: {
    heapUsed: number;
    heapTotal: number;
    heapLimit: number;
    external: number;
    rss?: number; // Node.js only
  };

  // Render Performance
  rendering: {
    fps: number;
    frameDrops: number;
    renderTime: number;
    componentRenders: number;
    lastRenderDuration: number;
  };

  // Network Performance
  network: {
    requests: number;
    totalSize: number;
    averageLatency: number;
    failedRequests: number;
    cacheHits: number;
  };

  // User Interaction
  interaction: {
    inputLatency: number;
    clickLatency: number;
    scrollLatency: number;
    gestureLatency: number;
  };

  // Bundle Performance
  bundle: {
    initialLoadTime: number;
    bundleSize: number;
    chunkLoadTimes: Record<string, number>;
    lazyLoadedModules: number;
  };

  // Memory Leaks
  memoryLeaks: {
    suspectedLeaks: number;
    growingObjects: string[];
    retainedSize: number;
    leakScore: number; // 0-100
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
    heapUsageWarning: number; // MB
    heapUsageCritical: number; // MB
    memoryLeakThreshold: number; // MB growth per minute
  };
  rendering: {
    fpsWarning: number;
    fpsCritical: number;
    renderTimeWarning: number; // ms
    renderTimeCritical: number; // ms
  };
  interaction: {
    inputLatencyWarning: number; // ms
    inputLatencyCritical: number; // ms
  };
  network: {
    latencyWarning: number; // ms
    latencyCritical: number; // ms
    failureRateWarning: number; // percentage
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

// ============================================================================
// PERFORMANCE MONITOR CLASS
// ============================================================================

export class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null;

  private isMonitoring: boolean = false;
  private metricsHistory: PerformanceMetrics[] = [];
  private componentData: Map<string, ComponentPerformanceData> = new Map();
  private alerts: PerformanceAlert[] = [];
  private thresholds: PerformanceThresholds;

  // Monitoring intervals
  private metricsInterval: NodeJS.Timeout | null = null;
  private memoryInterval: NodeJS.Timeout | null = null;
  private renderingObserver: PerformanceObserver | null = null;

  // Performance tracking
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private renderStartTime: number = 0;
  private networkRequests: Map<string, number> = new Map();
  private memoryBaseline: number = 0;
  private memoryGrowthHistory: number[] = [];

  // ========================================================================
  // SINGLETON PATTERN
  // ========================================================================

  private constructor() {
    this.thresholds = this.getDefaultThresholds();
    this.initializeMonitoring();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Initialize performance observers
    this.setupPerformanceObservers();

    // Set memory baseline
    // ✅ ENTERPRISE FIX: Use type assertion for Chrome-specific Performance.memory
    const perfWithMemory = performance as any;
    if (perfWithMemory.memory) {
      this.memoryBaseline = perfWithMemory.memory.usedJSHeapSize;
    }

    // Start frame counting
    this.startFrameMonitoring();

    // console.log('🔍 Performance Monitor initialized'); // DISABLED - προκαλούσε loops
  }

  private setupPerformanceObservers(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      // Rendering performance observer
      this.renderingObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            this.recordRenderingMetric(entry);
          } else if (entry.entryType === 'navigation') {
            this.recordNavigationMetric(entry as PerformanceNavigationTiming);
          } else if (entry.entryType === 'resource') {
            this.recordNetworkMetric(entry as PerformanceResourceTiming);
          }
        }
      });

      this.renderingObserver.observe({
        entryTypes: ['measure', 'navigation', 'resource']
      });

      // User input observer
      if ('PerformanceEventTiming' in window) {
        const inputObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // ✅ ENTERPRISE: Type guard instead of 'as any'
            if ('processingStart' in entry && 'startTime' in entry) {
              this.recordInputLatency(entry as PerformanceEventTimingEntry);
            }
          }
        });

        inputObserver.observe({ entryTypes: ['event'] });
      }

    } catch (error) {
      console.warn('Performance observers not fully supported:', error);
    }
  }

  private startFrameMonitoring(): void {
    const measureFrame = () => {
      const now = performance.now();

      if (this.lastFrameTime > 0) {
        const frameDuration = now - this.lastFrameTime;
        if (frameDuration > 0) {
          this.frameCount++;
        }
      }

      this.lastFrameTime = now;

      if (this.isMonitoring) {
        requestAnimationFrame(measureFrame);
      }
    };

    requestAnimationFrame(measureFrame);
  }

  // ========================================================================
  // MONITORING CONTROL
  // ========================================================================

  public startMonitoring(interval: number = 1000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, interval);

    // Start memory leak detection
    this.memoryInterval = setInterval(() => {
      this.detectMemoryLeaks();
    }, 30000); // Every 30 seconds

    // console.log('📊 Performance monitoring started'); // DISABLED - προκαλούσε loops
  }

  public stopMonitoring(): void {
    this.isMonitoring = false;

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }

    if (this.renderingObserver) {
      this.renderingObserver.disconnect();
    }

    // console.log('📊 Performance monitoring stopped'); // DISABLED - προκαλούσε loops
  }

  // ========================================================================
  // METRICS COLLECTION
  // ========================================================================

  private collectMetrics(): void {
    const timestamp = Date.now();

    const metrics: PerformanceMetrics = {
      timestamp,
      runtime: this.collectRuntimeMetrics(),
      rendering: this.collectRenderingMetrics(),
      network: this.collectNetworkMetrics(),
      interaction: this.collectInteractionMetrics(),
      bundle: this.collectBundleMetrics(),
      memoryLeaks: this.collectMemoryLeakMetrics()
    };

    this.metricsHistory.push(metrics);

    // Keep only last 1000 entries
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory = this.metricsHistory.slice(-1000);
    }

    // Check thresholds and generate alerts
    this.checkThresholds(metrics);
  }

  private collectRuntimeMetrics(): PerformanceMetrics['runtime'] {
    const memory = (performance as any).memory;

    return {
      heapUsed: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0,
      heapTotal: memory ? Math.round(memory.totalJSHeapSize / 1024 / 1024) : 0,
      heapLimit: memory ? Math.round(memory.jsHeapSizeLimit / 1024 / 1024) : 0,
      external: 0 // Browser doesn't expose this
    };
  }

  private collectRenderingMetrics(): PerformanceMetrics['rendering'] {
    const now = performance.now();
    const timeSinceLastFrame = now - this.lastFrameTime;
    const fps = timeSinceLastFrame > 0 ? Math.round(1000 / timeSinceLastFrame) : 0;

    const totalRenderTime = Array.from(this.componentData.values())
      .reduce((sum, data) => sum + data.totalRenderTime, 0);

    const componentRenders = Array.from(this.componentData.values())
      .reduce((sum, data) => sum + data.renderCount, 0);

    return {
      fps: Math.min(fps, 60), // Cap at 60 FPS
      frameDrops: fps < 30 ? 1 : 0,
      renderTime: totalRenderTime,
      componentRenders,
      lastRenderDuration: this.renderStartTime > 0 ? now - this.renderStartTime : 0
    };
  }

  private collectNetworkMetrics(): PerformanceMetrics['network'] {
    const requests = this.networkRequests.size;
    let totalSize = 0;
    let totalLatency = 0;
    let failedRequests = 0;

    // Calculate from performance entries
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

      for (const entry of resourceEntries) {
        totalSize += entry.transferSize || 0;
        totalLatency += entry.duration;

        if (entry.responseEnd === 0) {
          failedRequests++;
        }
      }
    }

    return {
      requests,
      totalSize: Math.round(totalSize / 1024), // KB
      averageLatency: requests > 0 ? Math.round(totalLatency / requests) : 0,
      failedRequests,
      cacheHits: 0 // Would need more sophisticated tracking
    };
  }

  private collectInteractionMetrics(): PerformanceMetrics['interaction'] {
    // These would be collected from event listeners
    return {
      inputLatency: 0,
      clickLatency: 0,
      scrollLatency: 0,
      gestureLatency: 0
    };
  }

  private collectBundleMetrics(): PerformanceMetrics['bundle'] {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    return {
      initialLoadTime: navigation ? Math.round(navigation.loadEventEnd - navigation.fetchStart) : 0,
      bundleSize: 0, // Would need webpack stats
      chunkLoadTimes: {},
      lazyLoadedModules: 0
    };
  }

  private collectMemoryLeakMetrics(): PerformanceMetrics['memoryLeaks'] {
    const currentMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryGrowth = currentMemory - this.memoryBaseline;

    this.memoryGrowthHistory.push(memoryGrowth);
    if (this.memoryGrowthHistory.length > 10) {
      this.memoryGrowthHistory.shift();
    }

    const isGrowing = this.memoryGrowthHistory.length > 3 &&
      this.memoryGrowthHistory.slice(-3).every((growth, index, arr) =>
        index === 0 || growth > arr[index - 1]
      );

    return {
      suspectedLeaks: isGrowing ? 1 : 0,
      growingObjects: [], // Would need heap snapshot analysis
      retainedSize: Math.round(memoryGrowth / 1024 / 1024),
      leakScore: this.calculateLeakScore()
    };
  }

  // ========================================================================
  // COMPONENT PERFORMANCE TRACKING
  // ========================================================================

  public recordComponentRender(
    componentName: string,
    renderTime: number,
    propsChanged: boolean = false,
    stateChanged: boolean = false
  ): void {
    let data = this.componentData.get(componentName);

    if (!data) {
      data = {
        componentName,
        renderCount: 0,
        totalRenderTime: 0,
        averageRenderTime: 0,
        maxRenderTime: 0,
        lastRenderTime: 0,
        propsChanges: 0,
        stateChanges: 0
      };
      this.componentData.set(componentName, data);
    }

    data.renderCount++;
    data.totalRenderTime += renderTime;
    data.averageRenderTime = data.totalRenderTime / data.renderCount;
    data.maxRenderTime = Math.max(data.maxRenderTime, renderTime);
    data.lastRenderTime = renderTime;

    if (propsChanged) data.propsChanges++;
    if (stateChanged) data.stateChanges++;

    // Alert για slow renders
    if (renderTime > this.thresholds.rendering.renderTimeWarning) {
      this.createAlert({
        type: 'rendering',
        severity: renderTime > this.thresholds.rendering.renderTimeCritical ? 'critical' : 'medium',
        message: `Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`,
        metrics: { rendering: this.collectRenderingMetrics() },
        suggestion: 'Consider memoization or component optimization'
      });
    }
  }

  // ========================================================================
  // MEMORY LEAK DETECTION
  // ========================================================================

  private detectMemoryLeaks(): void {
    if (!(performance as any).memory) return;

    const currentMemory = (performance as any).memory.usedJSHeapSize;
    const growthSinceBaseline = currentMemory - this.memoryBaseline;
    const growthMB = growthSinceBaseline / 1024 / 1024;

    // Check για significant memory growth
    if (growthMB > this.thresholds.memory.memoryLeakThreshold) {
      this.createAlert({
        type: 'memory',
        severity: growthMB > this.thresholds.memory.heapUsageCritical ? 'critical' : 'high',
        message: `Potential memory leak detected: ${growthMB.toFixed(1)}MB growth`,
        metrics: { runtime: this.collectRuntimeMetrics() },
        suggestion: 'Check for event listeners, timers, or circular references'
      });
    }

    // Update baseline periodically για normal growth
    if (this.metricsHistory.length > 60) { // After 1 minute
      this.memoryBaseline = Math.min(this.memoryBaseline, currentMemory);
    }
  }

  private calculateLeakScore(): number {
    if (this.memoryGrowthHistory.length < 3) return 0;

    const recentGrowth = this.memoryGrowthHistory.slice(-3);
    const isConsistentGrowth = recentGrowth.every((growth, index) =>
      index === 0 || growth > recentGrowth[index - 1]
    );

    if (!isConsistentGrowth) return 0;

    const growthRate = (recentGrowth[2] - recentGrowth[0]) / recentGrowth[0];
    return Math.min(100, Math.max(0, growthRate * 100));
  }

  // ========================================================================
  // METRIC RECORDING
  // ========================================================================

  private recordRenderingMetric(entry: PerformanceEntry): void {
    if (entry.name.includes('React')) {
      // React-specific measurements
      this.recordComponentRender('React', entry.duration);
    }
  }

  private recordNavigationMetric(entry: PerformanceNavigationTiming): void {
    const loadTime = entry.loadEventEnd - entry.fetchStart;

    if (loadTime > 3000) { // 3 seconds
      this.createAlert({
        type: 'performance',
        severity: 'medium',
        message: `Slow page load: ${Math.round(loadTime)}ms`,
        metrics: { bundle: this.collectBundleMetrics() }
      });
    }
  }

  private recordNetworkMetric(entry: PerformanceResourceTiming): void {
    this.networkRequests.set(entry.name, entry.duration);

    if (entry.duration > this.thresholds.network.latencyWarning) {
      this.createAlert({
        type: 'network',
        severity: entry.duration > this.thresholds.network.latencyCritical ? 'critical' : 'medium',
        message: `Slow network request: ${entry.name} (${Math.round(entry.duration)}ms)`,
        metrics: { network: this.collectNetworkMetrics() }
      });
    }
  }

  private recordInputLatency(entry: PerformanceEventTimingEntry): void {
    if (entry.processingStart && entry.startTime) {
      const latency = entry.processingStart - entry.startTime;

      if (latency > this.thresholds.interaction.inputLatencyWarning) {
        this.createAlert({
          type: 'performance',
          severity: latency > this.thresholds.interaction.inputLatencyCritical ? 'critical' : 'medium',
          message: `High input latency: ${Math.round(latency)}ms`,
          metrics: { interaction: this.collectInteractionMetrics() }
        });
      }
    }
  }

  // ========================================================================
  // THRESHOLD CHECKING
  // ========================================================================

  private checkThresholds(metrics: PerformanceMetrics): void {
    // Memory thresholds
    if (metrics.runtime.heapUsed > this.thresholds.memory.heapUsageCritical) {
      this.createAlert({
        type: 'memory',
        severity: 'critical',
        message: `Critical memory usage: ${metrics.runtime.heapUsed}MB`,
        metrics: { runtime: metrics.runtime },
        suggestion: 'Consider garbage collection or memory optimization'
      });
    } else if (metrics.runtime.heapUsed > this.thresholds.memory.heapUsageWarning) {
      this.createAlert({
        type: 'memory',
        severity: 'medium',
        message: `High memory usage: ${metrics.runtime.heapUsed}MB`,
        metrics: { runtime: metrics.runtime }
      });
    }

    // FPS thresholds
    if (metrics.rendering.fps < this.thresholds.rendering.fpsCritical) {
      this.createAlert({
        type: 'rendering',
        severity: 'critical',
        message: `Critical FPS drop: ${metrics.rendering.fps} FPS`,
        metrics: { rendering: metrics.rendering },
        suggestion: 'Check for expensive renders or layout thrashing'
      });
    } else if (metrics.rendering.fps < this.thresholds.rendering.fpsWarning) {
      this.createAlert({
        type: 'rendering',
        severity: 'medium',
        message: `Low FPS: ${metrics.rendering.fps} FPS`,
        metrics: { rendering: metrics.rendering }
      });
    }
  }

  // ========================================================================
  // ALERT MANAGEMENT
  // ========================================================================

  private createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp'>): void {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...alertData
    };

    this.alerts.unshift(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }

    // Log critical alerts
    if (alert.severity === 'critical') {
      console.error('🚨 Critical Performance Alert:', alert.message);
    } else if (alert.severity === 'high') {
      console.warn('⚠️ Performance Warning:', alert.message);
    }
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  public getMetrics(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  public getLatestMetrics(): PerformanceMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  public getComponentPerformance(): ComponentPerformanceData[] {
    return Array.from(this.componentData.values());
  }

  public getAlerts(severity?: PerformanceAlert['severity']): PerformanceAlert[] {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity);
    }
    return [...this.alerts];
  }

  public clearAlerts(): void {
    this.alerts = [];
  }

  public updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  public getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  public generateReport(): {
    summary: any;
    recommendations: string[];
    criticalIssues: PerformanceAlert[];
  } {
    const latestMetrics = this.getLatestMetrics();
    const criticalAlerts = this.getAlerts('critical');
    const componentData = this.getComponentPerformance();

    const slowestComponents = componentData
      .sort((a, b) => b.averageRenderTime - a.averageRenderTime)
      .slice(0, 5);

    const recommendations: string[] = [];

    // Generate recommendations
    if (latestMetrics) {
      if (latestMetrics.runtime.heapUsed > 100) {
        recommendations.push('Consider implementing memory optimization techniques');
      }
      if (latestMetrics.rendering.fps < 30) {
        recommendations.push('Optimize rendering performance - consider virtualization');
      }
      if (slowestComponents.length > 0) {
        recommendations.push(`Optimize slow components: ${slowestComponents.map(c => c.componentName).join(', ')}`);
      }
    }

    return {
      summary: {
        currentMemory: latestMetrics?.runtime.heapUsed || 0,
        currentFPS: latestMetrics?.rendering.fps || 0,
        totalAlerts: this.alerts.length,
        criticalAlerts: criticalAlerts.length,
        slowestComponents: slowestComponents.map(c => ({
          name: c.componentName,
          avgRenderTime: c.averageRenderTime
        }))
      },
      recommendations,
      criticalIssues: criticalAlerts
    };
  }

  // ========================================================================
  // DEFAULTS
  // ========================================================================

  private getDefaultThresholds(): PerformanceThresholds {
    return {
      memory: {
        heapUsageWarning: 100, // MB
        heapUsageCritical: 200, // MB
        memoryLeakThreshold: 50 // MB growth
      },
      rendering: {
        fpsWarning: 30,
        fpsCritical: 15,
        renderTimeWarning: 16, // 1 frame at 60fps
        renderTimeCritical: 33 // 2 frames at 60fps
      },
      interaction: {
        inputLatencyWarning: 100, // ms
        inputLatencyCritical: 300 // ms
      },
      network: {
        latencyWarning: 1000, // ms
        latencyCritical: 3000, // ms
        failureRateWarning: 5 // percentage
      }
    };
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  public dispose(): void {
    this.stopMonitoring();
    this.metricsHistory = [];
    this.componentData.clear();
    this.alerts = [];
    this.networkRequests.clear();
    PerformanceMonitor.instance = null;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const performanceMonitor = PerformanceMonitor.getInstance();
export default performanceMonitor;