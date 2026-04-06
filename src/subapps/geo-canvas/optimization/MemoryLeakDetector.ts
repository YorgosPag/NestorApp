/**
 * MEMORY LEAK DETECTOR — MAIN CLASS
 * Geo-Alert System - Phase 7: Advanced Memory Leak Detection & Analysis
 *
 * Singleton class for centralized memory monitoring.
 * Analysis and detection logic extracted to sibling modules (ADR-065).
 */

import { PerformanceObserver } from 'perf_hooks';

import type {
  PerformanceWithMemory,
  WindowWithGC,
  MemorySnapshot,
  ComponentMemoryUsage,
  MemoryLeakResult,
  MemoryLeakDetectorConfig,
  MemoryHealthReport,
  ComponentHealthStatus,
  MemoryExportData,
} from './memory-leak-detector-types';
import { MEMORY_ENTRY_TYPES } from './memory-leak-detector-types';

import {
  analyzeComponentMemory,
  analyzeEventListeners,
  analyzeDOMNodes,
  analyzeMemoryTrends,
  calculateGrowthRate,
  formatBytes,
} from './memory-leak-detector-analyzers';

import { detectLeaks } from './memory-leak-detector-detection';

// Re-export all types for consumers
export type {
  MemorySnapshot,
  ComponentMemoryUsage,
  MemoryLeakResult,
  MemoryLeakDetectorConfig,
  MemoryHealthReport,
  ComponentHealthStatus,
  MemoryExportData,
} from './memory-leak-detector-types';
export type { EventListenerAnalysis, DOMNodeAnalysis } from './memory-leak-detector-types';

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * Memory Leak Detector - Advanced Memory Profiling & Leak Detection
 * Singleton pattern για centralized memory monitoring
 */
export class GeoAlertMemoryLeakDetector {
  private static instance: GeoAlertMemoryLeakDetector | null = null;
  private config: MemoryLeakDetectorConfig;
  private snapshots: MemorySnapshot[] = [];
  private detectedLeaks: Map<string, MemoryLeakResult> = new Map();
  private componentRegistry: Map<string, ComponentMemoryUsage> = new Map();
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private performanceObserver?: PerformanceObserver;

  // ==========================================================================
  // SINGLETON
  // ==========================================================================

  private constructor() {
    this.config = this.getDefaultConfig();
    this.initializePerformanceObserver();
  }

  public static getInstance(): GeoAlertMemoryLeakDetector {
    if (!GeoAlertMemoryLeakDetector.instance) {
      GeoAlertMemoryLeakDetector.instance = new GeoAlertMemoryLeakDetector();
    }
    return GeoAlertMemoryLeakDetector.instance;
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  private getDefaultConfig(): MemoryLeakDetectorConfig {
    return {
      monitoring: {
        interval: 5000,
        snapshotRetention: 100,
        enableContinuous: true,
      },
      thresholds: {
        memoryGrowthRate: 1024 * 1024,
        componentInstanceLimit: 1000,
        eventListenerLimit: 10000,
        domNodeLimit: 50000,
      },
      detection: {
        minSampleSize: 10,
        confidenceThreshold: 80,
        enablePredictive: true,
      },
      alerts: {
        enableNotifications: true,
        criticalThreshold: 500 * 1024 * 1024,
        warningThreshold: 200 * 1024 * 1024,
      },
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

      this.performanceObserver.observe({ entryTypes: MEMORY_ENTRY_TYPES });
    } catch (error) {
      console.warn('PerformanceObserver not available:', error);
    }
  }

  // ==========================================================================
  // MONITORING CONTROL
  // ==========================================================================

  public startMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('Memory monitoring already active');
      return;
    }

    this.isMonitoring = true;
    this.takeSnapshot();

    this.monitoringInterval = setInterval(() => {
      this.takeSnapshot();
      analyzeMemoryTrends(this.snapshots, this.config, (leak) => this.reportLeak(leak));
      detectLeaks(this.snapshots, (leak) => this.reportLeak(leak));
      this.cleanupOldLeaks();
    }, this.config.monitoring.interval);
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
  }

  // ==========================================================================
  // SNAPSHOT COLLECTION
  // ==========================================================================

  public takeSnapshot(): MemorySnapshot {
    const timestamp = Date.now();
    const memoryUsage = this.getMemoryUsage();

    const snapshot: MemorySnapshot = {
      timestamp,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external || 0,
      rss: memoryUsage.rss || 0,
      arrayBuffers: memoryUsage.arrayBuffers || 0,
      components: analyzeComponentMemory(this.componentRegistry),
      eventListeners: analyzeEventListeners(),
      domNodes: analyzeDOMNodes(),
    };

    this.snapshots.push(snapshot);

    if (this.snapshots.length > this.config.monitoring.snapshotRetention) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  private getMemoryUsage(): NodeJS.MemoryUsage {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }

    if (typeof window !== 'undefined' && 'performance' in window) {
      const perf = window.performance as PerformanceWithMemory;
      if (perf.memory) {
        const memory = perf.memory;
        return {
          rss: 0,
          heapTotal: memory.totalJSHeapSize || 0,
          heapUsed: memory.usedJSHeapSize || 0,
          external: 0,
          arrayBuffers: 0,
        };
      }
    }

    return {
      rss: 64 * 1024 * 1024,
      heapTotal: 32 * 1024 * 1024,
      heapUsed: 24 * 1024 * 1024,
      external: 2 * 1024 * 1024,
      arrayBuffers: 1024 * 1024,
    };
  }

  // ==========================================================================
  // INTERNAL UTILITIES
  // ==========================================================================

  private reportLeak(leak: MemoryLeakResult): void {
    const leakKey = `${leak.leakType}-${leak.description}`;
    this.detectedLeaks.set(leakKey, leak);

    const severity = leak.severity.toUpperCase();
    console.warn(`🚨 [${severity}] Memory Leak Detected: ${leak.description}`);

    if (this.config.alerts.enableNotifications) {
      this.sendLeakNotification(leak);
    }
  }

  private sendLeakNotification(leak: MemoryLeakResult): void {
    console.log(`📱 Memory leak notification sent: ${leak.description}`);
  }

  private processPerformanceEntries(entries: PerformanceEntry[]): void {
    entries.forEach(entry => {
      if (entry.entryType === 'measure' && entry.name.includes('memory')) {
        console.debug(`Memory measurement: ${entry.name} - ${entry.duration}ms`);
      }
    });
  }

  private cleanupOldLeaks(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);

    for (const [key, leak] of this.detectedLeaks.entries()) {
      if (leak.firstDetected < cutoffTime) {
        this.detectedLeaks.delete(key);
      }
    }
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  public getMemoryHealthReport(): MemoryHealthReport {
    const latestSnapshot = this.snapshots[this.snapshots.length - 1];
    const leaksDetected = Array.from(this.detectedLeaks.values());

    const criticalLeaks = leaksDetected.filter(l => l.severity === 'critical').length;
    const highLeaks = leaksDetected.filter(l => l.severity === 'high').length;

    let overall: 'healthy' | 'warning' | 'critical';
    if (criticalLeaks > 0) {
      overall = 'critical';
    } else if (highLeaks > 0 || leaksDetected.length > 5) {
      overall = 'warning';
    } else {
      overall = 'healthy';
    }

    const memoryGrowthRate = this.snapshots.length >= 2
      ? calculateGrowthRate(this.snapshots.map(s => s.heapUsed), this.snapshots)
      : 0;

    const componentHealth: ComponentHealthStatus[] = [];
    if (latestSnapshot) {
      for (const component of latestSnapshot.components) {
        componentHealth.push(this.getComponentHealthStatus(component));
      }
    }

    return {
      overall,
      totalMemoryUsage: latestSnapshot?.heapUsed || 0,
      memoryGrowthRate,
      leaksDetected,
      componentHealth,
      recommendations: this.generateHealthRecommendations(overall, leaksDetected),
      nextCheckIn: this.config.monitoring.interval,
    };
  }

  private getComponentHealthStatus(component: ComponentMemoryUsage): ComponentHealthStatus {
    const leaks = Array.from(this.detectedLeaks.values())
      .filter(leak => leak.affectedComponents.includes(component.componentName));

    let status: 'healthy' | 'suspected-leak' | 'confirmed-leak';
    if (leaks.some(l => l.severity === 'critical' || l.severity === 'high')) {
      status = 'confirmed-leak';
    } else if (leaks.length > 0 || component.memoryTrend === 'increasing') {
      status = 'suspected-leak';
    } else {
      status = 'healthy';
    }

    return {
      component: component.componentName,
      status,
      memoryTrend: [component.estimatedSize],
      lastCleanup: component.lastActivity,
      recommendedActions: this.getComponentRecommendations(component, status),
    };
  }

  private getComponentRecommendations(
    component: ComponentMemoryUsage,
    status: ComponentHealthStatus['status']
  ): string[] {
    const recommendations: string[] = [];

    if (status === 'confirmed-leak') {
      recommendations.push(`Immediately investigate ${component.componentName}`);
      recommendations.push('Check component lifecycle methods');
      recommendations.push('Review event listener cleanup');
    } else if (status === 'suspected-leak') {
      recommendations.push(`Monitor ${component.componentName} closely`);
      recommendations.push('Consider implementing memory profiling');
    }

    if (component.memoryTrend === 'increasing') {
      recommendations.push('Investigate memory growth pattern');
      recommendations.push('Check για state accumulation');
    }

    return recommendations;
  }

  private generateHealthRecommendations(
    overall: MemoryHealthReport['overall'],
    leaks: MemoryLeakResult[]
  ): string[] {
    const recommendations: string[] = [];

    if (overall === 'critical') {
      recommendations.push('🚨 IMMEDIATE ACTION REQUIRED');
      recommendations.push('Stop non-essential operations');
      recommendations.push('Investigate critical memory leaks');
    } else if (overall === 'warning') {
      recommendations.push('⚠️  Monitor memory usage closely');
      recommendations.push('Review recent code changes');
    }

    const leakTypes = new Set(leaks.map(l => l.leakType));

    if (leakTypes.has('component')) {
      recommendations.push('Review React component lifecycle management');
    }
    if (leakTypes.has('event-listener')) {
      recommendations.push('Audit event listener cleanup');
    }
    if (leakTypes.has('dom')) {
      recommendations.push('Check DOM node retention');
    }

    return recommendations;
  }

  public getLeakAnalysis(): {
    totalLeaks: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    timeline: { timestamp: number; leaksDetected: number }[];
  } {
    const leaks = Array.from(this.detectedLeaks.values());

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    leaks.forEach(leak => {
      byType[leak.leakType] = (byType[leak.leakType] || 0) + 1;
      bySeverity[leak.severity] = (bySeverity[leak.severity] || 0) + 1;
    });

    const timeline = this.snapshots.map(snapshot => ({
      timestamp: snapshot.timestamp,
      leaksDetected: leaks.filter(leak => leak.firstDetected <= snapshot.timestamp).length,
    }));

    return { totalLeaks: leaks.length, byType, bySeverity, timeline };
  }

  public forceGarbageCollection(): void {
    if (typeof window !== 'undefined' && 'gc' in window) {
      const win = window as WindowWithGC;
      if (win.gc) {
        console.log('🗑️  Forcing garbage collection...');
        win.gc();
      }
    } else if (typeof global !== 'undefined' && global.gc) {
      console.log('🗑️  Forcing garbage collection...');
      global.gc();
    } else {
      console.warn('Garbage collection not available in this environment');
    }
  }

  public exportData(format: 'json' | 'csv' = 'json'): string {
    const data: MemoryExportData = {
      config: this.config,
      snapshots: this.snapshots,
      leaks: Array.from(this.detectedLeaks.values()),
      components: Array.from(this.componentRegistry.values()),
    };

    if (format === 'csv') {
      return this.convertToCSV(data);
    }

    return JSON.stringify(data, null, 2);
  }

  private convertToCSV(data: MemoryExportData): string {
    const headers = 'Timestamp,HeapUsed,HeapTotal,Components,EventListeners,LeaksDetected\n';
    const rows = data.snapshots.map((snapshot: MemorySnapshot) =>
      `${snapshot.timestamp},${snapshot.heapUsed},${snapshot.heapTotal},${snapshot.components.length},${snapshot.eventListeners.length},${data.leaks.length}`
    ).join('\n');

    return headers + rows;
  }

  public updateConfig(config: Partial<MemoryLeakDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public clearData(): void {
    this.snapshots.length = 0;
    this.detectedLeaks.clear();
    this.componentRegistry.clear();
  }
}

// ============================================================================
// GLOBAL EXPORTS & UTILITIES
// ============================================================================

export const geoAlertMemoryLeakDetector = GeoAlertMemoryLeakDetector.getInstance();

export const startMemoryMonitoring = () => geoAlertMemoryLeakDetector.startMonitoring();
export const stopMemoryMonitoring = () => geoAlertMemoryLeakDetector.stopMonitoring();
export const getMemoryHealth = () => geoAlertMemoryLeakDetector.getMemoryHealthReport();
export const takeMemorySnapshot = () => geoAlertMemoryLeakDetector.takeSnapshot();

export default geoAlertMemoryLeakDetector;
