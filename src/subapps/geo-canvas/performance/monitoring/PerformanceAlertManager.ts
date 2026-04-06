/**
 * PERFORMANCE ALERT MANAGER
 *
 * Manages performance alerts, threshold checking, and report generation
 *
 * @module geo-canvas/performance/monitoring/PerformanceAlertManager
 * Extracted from PerformanceMonitor.ts (ADR-065 Phase 3, #17)
 */

import { generateAlertId } from '@/services/enterprise-id.service';
import type {
  PerformanceAlert,
  PerformanceMetrics,
  PerformanceThresholds,
  PerformanceReportSummary,
  ComponentPerformanceData,
} from './performance-monitor-types';
import { DEFAULT_THRESHOLDS } from './performance-monitor-types';

export class PerformanceAlertManager {
  private alerts: PerformanceAlert[] = [];
  private thresholds: PerformanceThresholds;

  constructor() {
    this.thresholds = { ...DEFAULT_THRESHOLDS };
  }

  createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp'>): void {
    const alert: PerformanceAlert = {
      id: generateAlertId(),
      timestamp: Date.now(),
      ...alertData
    };

    this.alerts.unshift(alert);
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }

    if (alert.severity === 'critical') {
      console.error('Critical Performance Alert:', alert.message);
    } else if (alert.severity === 'high') {
      console.warn('Performance Warning:', alert.message);
    }
  }

  checkThresholds(metrics: PerformanceMetrics): void {
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

  checkComponentRenderTime(componentName: string, renderTime: number, renderingMetrics: PerformanceMetrics['rendering']): void {
    if (renderTime > this.thresholds.rendering.renderTimeWarning) {
      this.createAlert({
        type: 'rendering',
        severity: renderTime > this.thresholds.rendering.renderTimeCritical ? 'critical' : 'medium',
        message: `Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`,
        metrics: { rendering: renderingMetrics },
        suggestion: 'Consider memoization or component optimization'
      });
    }
  }

  checkNetworkLatency(entryName: string, duration: number, networkMetrics: PerformanceMetrics['network']): void {
    if (duration > this.thresholds.network.latencyWarning) {
      this.createAlert({
        type: 'network',
        severity: duration > this.thresholds.network.latencyCritical ? 'critical' : 'medium',
        message: `Slow network request: ${entryName} (${Math.round(duration)}ms)`,
        metrics: { network: networkMetrics }
      });
    }
  }

  checkInputLatency(latency: number, interactionMetrics: PerformanceMetrics['interaction']): void {
    if (latency > this.thresholds.interaction.inputLatencyWarning) {
      this.createAlert({
        type: 'performance',
        severity: latency > this.thresholds.interaction.inputLatencyCritical ? 'critical' : 'medium',
        message: `High input latency: ${Math.round(latency)}ms`,
        metrics: { interaction: interactionMetrics }
      });
    }
  }

  checkMemoryLeak(growthMB: number, runtimeMetrics: PerformanceMetrics['runtime']): void {
    if (growthMB > this.thresholds.memory.memoryLeakThreshold) {
      this.createAlert({
        type: 'memory',
        severity: growthMB > this.thresholds.memory.heapUsageCritical ? 'critical' : 'high',
        message: `Potential memory leak detected: ${growthMB.toFixed(1)}MB growth`,
        metrics: { runtime: runtimeMetrics },
        suggestion: 'Check for event listeners, timers, or circular references'
      });
    }
  }

  checkPageLoad(loadTime: number, bundleMetrics: PerformanceMetrics['bundle']): void {
    if (loadTime > 3000) {
      this.createAlert({
        type: 'performance',
        severity: 'medium',
        message: `Slow page load: ${Math.round(loadTime)}ms`,
        metrics: { bundle: bundleMetrics }
      });
    }
  }

  // --- PUBLIC API ---

  getAlerts(severity?: PerformanceAlert['severity']): PerformanceAlert[] {
    if (severity) return this.alerts.filter(a => a.severity === severity);
    return [...this.alerts];
  }

  clearAlerts(): void { this.alerts = []; }

  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  getThresholds(): PerformanceThresholds { return { ...this.thresholds }; }

  generateReport(
    latestMetrics: PerformanceMetrics | null,
    componentData: ComponentPerformanceData[]
  ): { summary: PerformanceReportSummary; recommendations: string[]; criticalIssues: PerformanceAlert[] } {
    const criticalAlerts = this.getAlerts('critical');
    const slowestComponents = componentData
      .sort((a, b) => b.averageRenderTime - a.averageRenderTime)
      .slice(0, 5);

    const recommendations: string[] = [];
    if (latestMetrics) {
      if (latestMetrics.runtime.heapUsed > 100) recommendations.push('Consider implementing memory optimization techniques');
      if (latestMetrics.rendering.fps < 30) recommendations.push('Optimize rendering performance - consider virtualization');
      if (slowestComponents.length > 0) recommendations.push(`Optimize slow components: ${slowestComponents.map(c => c.componentName).join(', ')}`);
    }

    return {
      summary: {
        currentMemory: latestMetrics?.runtime.heapUsed || 0,
        currentFPS: latestMetrics?.rendering.fps || 0,
        totalAlerts: this.alerts.length,
        criticalAlerts: criticalAlerts.length,
        slowestComponents: slowestComponents.map(c => ({ name: c.componentName, avgRenderTime: c.averageRenderTime }))
      },
      recommendations,
      criticalIssues: criticalAlerts
    };
  }

  dispose(): void { this.alerts = []; }
}
