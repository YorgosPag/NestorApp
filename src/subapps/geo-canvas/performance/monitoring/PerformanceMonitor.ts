/**
 * PERFORMANCE MONITORING SYSTEM
 * Geo-Alert System - Phase 7: Enterprise Performance Monitoring
 *
 * Real-time metrics collection, memory tracking, render analysis, automated reporting
 *
 * Split (ADR-065 Phase 3, #17):
 * - performance-monitor-types.ts — Types
 * - PerformanceAlertManager.ts — Alert creation, thresholds, reporting
 */

import { PerformanceAlertManager } from './PerformanceAlertManager';
import type {
  PerformanceMetrics,
  PerformanceWithMemory,
  PerformanceEventTimingEntry,
  ComponentPerformanceData,
  PerformanceThresholds,
} from './performance-monitor-types';

// Re-export types
export type {
  PerformanceMetrics,
  PerformanceAlert,
  PerformanceThresholds,
  ComponentPerformanceData,
  PerformanceReportSummary,
} from './performance-monitor-types';

export class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null;
  private isMonitoring = false;
  private metricsHistory: PerformanceMetrics[] = [];
  private componentData = new Map<string, ComponentPerformanceData>();
  private alertManager = new PerformanceAlertManager();

  private metricsInterval: NodeJS.Timeout | null = null;
  private memoryInterval: NodeJS.Timeout | null = null;
  private renderingObserver: PerformanceObserver | null = null;

  private frameCount = 0;
  private lastFrameTime = 0;
  private renderStartTime = 0;
  private networkRequests = new Map<string, number>();
  private memoryBaseline = 0;
  private memoryGrowthHistory: number[] = [];

  private constructor() {
    this.initializeMonitoring();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return;
    this.setupPerformanceObservers();
    const perfWithMemory = performance as PerformanceWithMemory;
    if (perfWithMemory.memory) {
      this.memoryBaseline = perfWithMemory.memory.usedJSHeapSize;
    }
    this.startFrameMonitoring();
  }

  private setupPerformanceObservers(): void {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      this.renderingObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') this.recordRenderingMetric(entry);
          else if (entry.entryType === 'navigation') this.recordNavigationMetric(entry as PerformanceNavigationTiming);
          else if (entry.entryType === 'resource') this.recordNetworkMetric(entry as PerformanceResourceTiming);
        }
      });
      this.renderingObserver.observe({ entryTypes: ['measure', 'navigation', 'resource'] });

      if ('PerformanceEventTiming' in window) {
        const inputObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
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
        if (frameDuration > 0) this.frameCount++;
      }
      this.lastFrameTime = now;
      if (this.isMonitoring) requestAnimationFrame(measureFrame);
    };
    requestAnimationFrame(measureFrame);
  }

  // --- MONITORING CONTROL ---

  public startMonitoring(interval = 1000): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.metricsInterval = setInterval(() => this.collectMetrics(), interval);
    this.memoryInterval = setInterval(() => this.detectMemoryLeaks(), 30000);
  }

  public stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.metricsInterval) { clearInterval(this.metricsInterval); this.metricsInterval = null; }
    if (this.memoryInterval) { clearInterval(this.memoryInterval); this.memoryInterval = null; }
    if (this.renderingObserver) this.renderingObserver.disconnect();
  }

  // --- METRICS COLLECTION ---

  private collectMetrics(): void {
    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      runtime: this.collectRuntimeMetrics(),
      rendering: this.collectRenderingMetrics(),
      network: this.collectNetworkMetrics(),
      interaction: { inputLatency: 0, clickLatency: 0, scrollLatency: 0, gestureLatency: 0 },
      bundle: this.collectBundleMetrics(),
      memoryLeaks: this.collectMemoryLeakMetrics()
    };
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > 1000) this.metricsHistory = this.metricsHistory.slice(-1000);
    this.alertManager.checkThresholds(metrics);
  }

  private collectRuntimeMetrics(): PerformanceMetrics['runtime'] {
    const memory = (performance as PerformanceWithMemory).memory;
    return {
      heapUsed: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0,
      heapTotal: memory ? Math.round(memory.totalJSHeapSize / 1024 / 1024) : 0,
      heapLimit: memory ? Math.round(memory.jsHeapSizeLimit / 1024 / 1024) : 0,
      external: 0
    };
  }

  private collectRenderingMetrics(): PerformanceMetrics['rendering'] {
    const now = performance.now();
    const timeSinceLastFrame = now - this.lastFrameTime;
    const fps = timeSinceLastFrame > 0 ? Math.round(1000 / timeSinceLastFrame) : 0;
    const totalRenderTime = Array.from(this.componentData.values()).reduce((sum, d) => sum + d.totalRenderTime, 0);
    const componentRenders = Array.from(this.componentData.values()).reduce((sum, d) => sum + d.renderCount, 0);
    return {
      fps: Math.min(fps, 60), frameDrops: fps < 30 ? 1 : 0,
      renderTime: totalRenderTime, componentRenders,
      lastRenderDuration: this.renderStartTime > 0 ? now - this.renderStartTime : 0
    };
  }

  private collectNetworkMetrics(): PerformanceMetrics['network'] {
    const requests = this.networkRequests.size;
    let totalSize = 0, totalLatency = 0, failedRequests = 0;
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      for (const entry of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
        totalSize += entry.transferSize || 0;
        totalLatency += entry.duration;
        if (entry.responseEnd === 0) failedRequests++;
      }
    }
    return { requests, totalSize: Math.round(totalSize / 1024), averageLatency: requests > 0 ? Math.round(totalLatency / requests) : 0, failedRequests, cacheHits: 0 };
  }

  private collectBundleMetrics(): PerformanceMetrics['bundle'] {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return { initialLoadTime: nav ? Math.round(nav.loadEventEnd - nav.fetchStart) : 0, bundleSize: 0, chunkLoadTimes: {}, lazyLoadedModules: 0 };
  }

  private collectMemoryLeakMetrics(): PerformanceMetrics['memoryLeaks'] {
    const currentMemory = (performance as PerformanceWithMemory).memory?.usedJSHeapSize ?? 0;
    const memoryGrowth = currentMemory - this.memoryBaseline;
    this.memoryGrowthHistory.push(memoryGrowth);
    if (this.memoryGrowthHistory.length > 10) this.memoryGrowthHistory.shift();
    const isGrowing = this.memoryGrowthHistory.length > 3 &&
      this.memoryGrowthHistory.slice(-3).every((g, i, arr) => i === 0 || g > arr[i - 1]);
    return {
      suspectedLeaks: isGrowing ? 1 : 0, growingObjects: [],
      retainedSize: Math.round(memoryGrowth / 1024 / 1024),
      leakScore: this.calculateLeakScore()
    };
  }

  // --- COMPONENT PERFORMANCE TRACKING ---

  public recordComponentRender(componentName: string, renderTime: number, propsChanged = false, stateChanged = false): void {
    let data = this.componentData.get(componentName);
    if (!data) {
      data = { componentName, renderCount: 0, totalRenderTime: 0, averageRenderTime: 0, maxRenderTime: 0, lastRenderTime: 0, propsChanges: 0, stateChanges: 0 };
      this.componentData.set(componentName, data);
    }
    data.renderCount++;
    data.totalRenderTime += renderTime;
    data.averageRenderTime = data.totalRenderTime / data.renderCount;
    data.maxRenderTime = Math.max(data.maxRenderTime, renderTime);
    data.lastRenderTime = renderTime;
    if (propsChanged) data.propsChanges++;
    if (stateChanged) data.stateChanges++;
    this.alertManager.checkComponentRenderTime(componentName, renderTime, this.collectRenderingMetrics());
  }

  // --- MEMORY LEAK DETECTION ---

  private detectMemoryLeaks(): void {
    const mem = (performance as PerformanceWithMemory).memory;
    if (!mem) return;
    const growthMB = (mem.usedJSHeapSize - this.memoryBaseline) / 1024 / 1024;
    this.alertManager.checkMemoryLeak(growthMB, this.collectRuntimeMetrics());
    if (this.metricsHistory.length > 60) {
      this.memoryBaseline = Math.min(this.memoryBaseline, mem.usedJSHeapSize);
    }
  }

  private calculateLeakScore(): number {
    if (this.memoryGrowthHistory.length < 3) return 0;
    const recent = this.memoryGrowthHistory.slice(-3);
    const isConsistent = recent.every((g, i) => i === 0 || g > recent[i - 1]);
    if (!isConsistent) return 0;
    return Math.min(100, Math.max(0, ((recent[2] - recent[0]) / recent[0]) * 100));
  }

  // --- METRIC RECORDING ---

  private recordRenderingMetric(entry: PerformanceEntry): void {
    if (entry.name.includes('React')) this.recordComponentRender('React', entry.duration);
  }

  private recordNavigationMetric(entry: PerformanceNavigationTiming): void {
    this.alertManager.checkPageLoad(entry.loadEventEnd - entry.fetchStart, this.collectBundleMetrics());
  }

  private recordNetworkMetric(entry: PerformanceResourceTiming): void {
    this.networkRequests.set(entry.name, entry.duration);
    this.alertManager.checkNetworkLatency(entry.name, entry.duration, this.collectNetworkMetrics());
  }

  private recordInputLatency(entry: PerformanceEventTimingEntry): void {
    if (entry.processingStart && entry.startTime) {
      this.alertManager.checkInputLatency(entry.processingStart - entry.startTime, { inputLatency: 0, clickLatency: 0, scrollLatency: 0, gestureLatency: 0 });
    }
  }

  // --- PUBLIC API ---

  public getMetrics(): PerformanceMetrics[] { return [...this.metricsHistory]; }
  public getLatestMetrics(): PerformanceMetrics | null { return this.metricsHistory[this.metricsHistory.length - 1] || null; }
  public getComponentPerformance(): ComponentPerformanceData[] { return Array.from(this.componentData.values()); }
  public getAlerts(severity?: 'low' | 'medium' | 'high' | 'critical') { return this.alertManager.getAlerts(severity); }
  public clearAlerts(): void { this.alertManager.clearAlerts(); }
  public updateThresholds(t: Partial<PerformanceThresholds>): void { this.alertManager.updateThresholds(t); }
  public getThresholds() { return this.alertManager.getThresholds(); }
  public generateReport() { return this.alertManager.generateReport(this.getLatestMetrics(), this.getComponentPerformance()); }

  public dispose(): void {
    this.stopMonitoring();
    this.metricsHistory = [];
    this.componentData.clear();
    this.alertManager.dispose();
    this.networkRequests.clear();
    PerformanceMonitor.instance = null;
  }
}

export const geoCanvasPerformanceMonitor = PerformanceMonitor.getInstance();
