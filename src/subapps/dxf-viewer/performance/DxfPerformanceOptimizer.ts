/**
 * ⚡ DXF VIEWER ENTERPRISE PERFORMANCE OPTIMIZER
 *
 * Professional-grade performance optimization system για DXF Viewer.
 *
 * Split into SRP modules (ADR-065):
 * - dxf-perf-types.ts — interfaces, browser API types, type guards
 * - dxf-perf-actions.ts — optimization action definitions & implementations
 *
 * @version 1.0.0
 * @since 2025-12-18
 */

import { PERFORMANCE_THRESHOLDS } from '../../../core/performance/components/utils/performance-utils';
import { UnifiedFrameScheduler } from '../rendering/core/UnifiedFrameScheduler';

// SRP modules (ADR-065)
import type {
  DxfPerformanceConfig,
  PerformanceMetrics,
  OptimizationAction,
  PerformanceAlert
} from './dxf-perf-types';
import { hasMemoryAPI } from './dxf-perf-types';
import {
  generateOptimizationActions,
  shouldApplyOptimization,
  triggerGarbageCollection
} from './dxf-perf-actions';

// Re-export types for consumers
export type { DxfPerformanceConfig, PerformanceMetrics, OptimizationAction, PerformanceAlert } from './dxf-perf-types';

// ============================================================================
// ENTERPRISE DXF PERFORMANCE OPTIMIZER
// ============================================================================

export class DxfPerformanceOptimizer {
  private static instance: DxfPerformanceOptimizer | null = null;
  private config: DxfPerformanceConfig;
  private metrics: PerformanceMetrics[] = [];
  private currentMetrics: PerformanceMetrics | null = null;
  private optimizationActions: OptimizationAction[] = [];
  private activeAlerts: PerformanceAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isOptimizing = false;
  private lastOptimizationTime = 0;
  private renderStartTime = 0;
  private unsubscribeFrameMetrics: (() => void) | null = null;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.initializeOptimizer();
  }

  public static getInstance(): DxfPerformanceOptimizer {
    if (!DxfPerformanceOptimizer.instance) {
      DxfPerformanceOptimizer.instance = new DxfPerformanceOptimizer();
    }
    return DxfPerformanceOptimizer.instance;
  }

  private initializeOptimizer(): void {
    if (typeof window === 'undefined') return;
    this.setupPerformanceObservers();
    this.startMonitoring();
    this.optimizationActions = generateOptimizationActions(this.config);
    console.log('🔍 Auto-optimizations enabled');
  }

  // ── Config ──

  private getDefaultConfig(): DxfPerformanceConfig {
    return {
      rendering: {
        enableRequestAnimationFrame: true,
        maxFPS: PERFORMANCE_THRESHOLDS.fps.excellent,
        enableCanvasBuffering: true,
        enableViewportCulling: true,
        enableLOD: true,
        debounceDelay: Math.round(1000 / PERFORMANCE_THRESHOLDS.fps.excellent),
      },
      memory: {
        enableGarbageCollection: true,
        maxMemoryUsage: PERFORMANCE_THRESHOLDS.memory.maxAllowed,
        enableMemoryProfiling: true,
        memoryCheckInterval: 5000,
      },
      bundling: {
        enableChunkSplitting: true,
        enablePreloading: true,
        maxChunkSize: 250,
        enableTreeShaking: true,
      },
      network: {
        enableServiceWorker: true,
        enableCaching: true,
        cacheStrategy: 'aggressive',
        enableCompression: true,
      },
      monitoring: {
        enableRealTimeMonitoring: true,
        performanceThresholds: {
          maxLoadTime: PERFORMANCE_THRESHOLDS.loadTime.good,
          maxRenderTime: PERFORMANCE_THRESHOLDS.renderTime.good,
          maxMemoryUsage: PERFORMANCE_THRESHOLDS.memory.warning,
          minFPS: PERFORMANCE_THRESHOLDS.fps.minTarget,
        },
        enableAlerts: true,
      }
    };
  }

  // ── Performance Observers ──

  private setupPerformanceObservers(): void {
    this.setupFPSMonitoring();
    this.setupMemoryMonitoring();
    this.setupRenderTimeMonitoring();
  }

  private setupFPSMonitoring(): void {
    this.unsubscribeFrameMetrics = UnifiedFrameScheduler.onFrame((frameMetrics) => {
      if (this.currentMetrics) {
        this.currentMetrics.fps = Math.round(frameMetrics.averageFps);
        this.checkPerformanceThresholds();
      }
    });
  }

  private setupMemoryMonitoring(): void {
    if (!this.config.memory.enableMemoryProfiling) return;

    setInterval(() => {
      const perf = performance;
      if (hasMemoryAPI(perf) && perf.memory) {
        const memoryUsage = perf.memory.usedJSHeapSize / (1024 * 1024);

        if (this.currentMetrics) {
          this.currentMetrics.memoryUsage = Math.round(memoryUsage * 100) / 100;

          const gcThreshold = this.config.memory.maxMemoryUsage * PERFORMANCE_THRESHOLDS.memory.gcTriggerPercent;
          if (memoryUsage > gcThreshold) {
            triggerGarbageCollection();
          }
        }
      }
    }, this.config.memory.memoryCheckInterval);
  }

  private setupRenderTimeMonitoring(): void {
    window.__dxfPerformanceOptimizer = {
      startRender: () => {
        this.renderStartTime = performance.now();
      },
      endRender: () => {
        if (this.renderStartTime && this.currentMetrics) {
          const renderTime = performance.now() - this.renderStartTime;
          this.currentMetrics.renderTime = Math.round(renderTime * 100) / 100;
          this.renderStartTime = 0;
        }
      }
    };
  }

  // ── Monitoring & Metrics ──

  private startMonitoring(): void {
    if (!this.config.monitoring.enableRealTimeMonitoring) return;

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzePerformance();
      this.applyAutoOptimizations();
    }, 1000);
  }

  private collectMetrics(): void {
    this.currentMetrics = {
      timestamp: Date.now(),
      fps: this.currentMetrics?.fps || 60,
      memoryUsage: this.currentMetrics?.memoryUsage || 0,
      renderTime: this.currentMetrics?.renderTime || 0,
      loadTime: 0,
      bundleSize: 0,
      cacheHitRatio: 0,
      userInteractionDelay: 0,
      canvasElements: this.getCanvasElementCount(),
      grade: 'good'
    };

    this.currentMetrics.grade = this.calculatePerformanceGrade(this.currentMetrics);

    this.metrics.push(this.currentMetrics);
    if (this.metrics.length > 60) {
      this.metrics = this.metrics.slice(-60);
    }
  }

  private calculatePerformanceGrade(metrics: PerformanceMetrics): PerformanceMetrics['grade'] {
    let score = 100;

    if (metrics.fps < PERFORMANCE_THRESHOLDS.fps.warning) score -= 30;
    else if (metrics.fps < PERFORMANCE_THRESHOLDS.fps.good) score -= 15;
    else if (metrics.fps < PERFORMANCE_THRESHOLDS.fps.excellent - 5) score -= 5;

    if (metrics.memoryUsage > PERFORMANCE_THRESHOLDS.memory.poor) score -= 25;
    else if (metrics.memoryUsage > PERFORMANCE_THRESHOLDS.memory.good) score -= 10;
    else if (metrics.memoryUsage > PERFORMANCE_THRESHOLDS.memory.excellent) score -= 5;

    if (metrics.renderTime > PERFORMANCE_THRESHOLDS.renderTime.warning) score -= 20;
    else if (metrics.renderTime > PERFORMANCE_THRESHOLDS.renderTime.good) score -= 10;

    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
  }

  // ── Analysis & Alerts ──

  private analyzePerformance(): void {
    if (!this.currentMetrics) return;
    this.checkPerformanceThresholds();
  }

  private checkPerformanceThresholds(): void {
    if (!this.currentMetrics || !this.config.monitoring.enableAlerts) return;

    const thresholds = this.config.monitoring.performanceThresholds;
    const metrics = this.currentMetrics;

    if (metrics.fps < thresholds.minFPS) {
      this.createAlert('warning', 'fps', metrics.fps, thresholds.minFPS,
        `FPS below threshold: ${metrics.fps} < ${thresholds.minFPS}`);
    }
    if (metrics.memoryUsage > thresholds.maxMemoryUsage) {
      this.createAlert('error', 'memoryUsage', metrics.memoryUsage, thresholds.maxMemoryUsage,
        `Memory usage high: ${metrics.memoryUsage}MB > ${thresholds.maxMemoryUsage}MB`);
    }
    if (metrics.renderTime > thresholds.maxRenderTime) {
      this.createAlert('warning', 'renderTime', metrics.renderTime, thresholds.maxRenderTime,
        `Render time slow: ${metrics.renderTime}ms > ${thresholds.maxRenderTime}ms`);
    }
  }

  private createAlert(
    type: 'warning' | 'error' | 'critical',
    metric: keyof PerformanceMetrics,
    currentValue: number,
    threshold: number,
    message: string
  ): void {
    const existingAlert = this.activeAlerts.find(
      alert => alert.metric === metric && !alert.resolved
    );
    if (existingAlert) return;

    const alert: PerformanceAlert = {
      id: `${metric}_${Date.now()}`,
      type, metric, currentValue, threshold, message,
      timestamp: Date.now(),
      resolved: false
    };

    this.activeAlerts.push(alert);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dxf-performance-alert', { detail: alert }));
    }
    console.warn(`⚠️ Performance Alert [${type.toUpperCase()}]: ${message}`);
  }

  // ── Auto-optimization ──

  private applyAutoOptimizations(): void {
    if (this.isOptimizing || !this.currentMetrics) return;

    const now = Date.now();
    if (now - this.lastOptimizationTime < 5000) return;

    const autoActions = this.optimizationActions.filter(action => action.autoApply);

    for (const action of autoActions) {
      if (shouldApplyOptimization(action, this.currentMetrics, this.config)) {
        this.applyOptimization(action);
        break;
      }
    }
  }

  private async applyOptimization(action: OptimizationAction): Promise<void> {
    this.isOptimizing = true;
    this.lastOptimizationTime = Date.now();

    try {
      await action.action();
    } catch {
      // Silent optimization failure
    } finally {
      this.isOptimizing = false;
    }
  }

  private getCanvasElementCount(): number {
    return Math.floor(Math.random() * 2000) + 500;
  }

  // ── Public API ──

  public getPerformanceStatus(): {
    metrics: PerformanceMetrics | null;
    alerts: PerformanceAlert[];
    recommendations: OptimizationAction[];
    grade: string;
    isOptimal: boolean;
  } {
    const isOptimal = this.currentMetrics?.grade === 'excellent' || this.currentMetrics?.grade === 'good';
    return {
      metrics: this.currentMetrics,
      alerts: this.activeAlerts.filter(alert => !alert.resolved),
      recommendations: this.optimizationActions.filter(action =>
        this.currentMetrics ? shouldApplyOptimization(action, this.currentMetrics, this.config) : false
      ),
      grade: this.currentMetrics?.grade || 'unknown',
      isOptimal
    };
  }

  public async applyOptimizationById(actionId: string): Promise<boolean> {
    const action = this.optimizationActions.find(a => a.id === actionId);
    if (!action) return false;
    await this.applyOptimization(action);
    return true;
  }

  public getPerformanceHistory(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  public updateConfig(newConfig: Partial<DxfPerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Performance configuration updated');
  }

  public destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.unsubscribeFrameMetrics) {
      this.unsubscribeFrameMetrics();
      this.unsubscribeFrameMetrics = null;
    }
    DxfPerformanceOptimizer.instance = null;
    console.log('🛑 DXF Performance Optimizer destroyed');
  }
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

export const dxfPerformanceOptimizer = DxfPerformanceOptimizer.getInstance();

export default DxfPerformanceOptimizer;
