/**
 * ENTERPRISE PERFORMANCE MANAGER - CORE ORCHESTRATION
 *
 * Central performance manager unifying all performance systems
 * Singleton Pattern with Service Registry
 *
 * Split (ADR-065 Phase 3, #18):
 * - enterprise-perf-types.ts — Local type definitions
 * - enterprise-perf-utils.ts — System info, app context, defaults, utilities
 */

import {
  generateMetricId as _generateMetricId,
  generateSubscriptionId as _generateSubscriptionId,
} from '@/services/enterprise-id.service';
import {
  PerformanceMetric,
  PerformanceSnapshot,
  PerformanceSource,
  PerformanceCategory,
  PerformanceUnit,
  PerformanceSeverity,
  MonitoringConfig,
  OptimizationSettings,
  PerformanceBudget,
  RealTimePerformanceUpdate,
  PerformanceSubscription
} from '../types/performance.types';
import { createModuleLogger } from '@/lib/telemetry';
import type { PerformanceWithMemory, PerformanceEntryWithLoad, BudgetThreshold } from './enterprise-perf-types';
import {
  mapEntryTypeToCategory,
  estimateMemoryUsage,
  getSystemInfo,
  getApplicationContext,
  scheduleGarbageCollection,
  getDefaultMonitoringConfig,
  getDefaultOptimizationSettings,
} from './enterprise-perf-utils';

const logger = createModuleLogger('EnterprisePerformanceManager');

export class EnterprisePerformanceManager {
  private static instance: EnterprisePerformanceManager | null = null;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private subscriptions: Map<string, PerformanceSubscription> = new Map();
  private config: MonitoringConfig;
  private optimization: OptimizationSettings;
  private budgets: PerformanceBudget[] = [];
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private performanceObserver?: PerformanceObserver;
  private stats = {
    totalMetrics: 0, metricsPerSecond: 0, averageResponseTime: 0,
    cacheHitRatio: 0, memoryUsage: 0, lastUpdated: Date.now()
  };

  public static getInstance(): EnterprisePerformanceManager {
    if (!EnterprisePerformanceManager.instance) {
      EnterprisePerformanceManager.instance = new EnterprisePerformanceManager();
    }
    return EnterprisePerformanceManager.instance;
  }

  private constructor() {
    this.config = getDefaultMonitoringConfig();
    this.optimization = getDefaultOptimizationSettings();
    this.initializePerformanceAPI();
    this.startCleanupScheduler();
  }

  // --- CORE LIFECYCLE ---

  public startMonitoring(): void {
    if (this.isMonitoring) { logger.warn('Performance monitoring already active'); return; }
    this.isMonitoring = true;
    this.startPerformanceObserver();
    this.startMetricCollection();
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) return;
    this.isMonitoring = false;
    if (this.monitoringInterval) { clearInterval(this.monitoringInterval); this.monitoringInterval = undefined; }
    if (this.performanceObserver) { this.performanceObserver.disconnect(); this.performanceObserver = undefined; }
  }

  // --- METRIC COLLECTION ---

  public recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): string {
    const fullMetric: PerformanceMetric = { ...metric, id: _generateMetricId(), timestamp: Date.now() };
    const categoryKey = fullMetric.category;
    if (!this.metrics.has(categoryKey)) this.metrics.set(categoryKey, []);
    const categoryMetrics = this.metrics.get(categoryKey)!;
    categoryMetrics.push(fullMetric);
    if (categoryMetrics.length > this.config.maxSamples) categoryMetrics.shift();
    this.updateStatistics(fullMetric);
    this.checkThresholds(fullMetric);
    this.notifySubscribers(fullMetric);
    return fullMetric.id;
  }

  public getSnapshot(): PerformanceSnapshot {
    const allMetrics: PerformanceMetric[] = [];
    this.metrics.forEach(cm => allMetrics.push(...cm));
    return { timestamp: Date.now(), metrics: allMetrics, systemInfo: getSystemInfo(), applicationContext: getApplicationContext() };
  }

  public getMetrics(category?: PerformanceCategory, limit?: number): PerformanceMetric[] {
    if (category) {
      const cm = this.metrics.get(category) || [];
      return limit ? cm.slice(-limit) : cm;
    }
    const all: PerformanceMetric[] = [];
    this.metrics.forEach(cm => all.push(...cm));
    all.sort((a, b) => b.timestamp - a.timestamp);
    return limit ? all.slice(0, limit) : all;
  }

  // --- SUBSCRIPTIONS ---

  public subscribe(subscription: Omit<PerformanceSubscription, 'id'>): string {
    const id = _generateSubscriptionId();
    this.subscriptions.set(id, { ...subscription, id });
    return id;
  }

  public unsubscribe(subscriptionId: string): boolean { return this.subscriptions.delete(subscriptionId); }

  // --- CONFIGURATION ---

  public updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (this.isMonitoring) { this.stopMonitoring(); this.startMonitoring(); }
  }

  public updateOptimization(newSettings: Partial<OptimizationSettings>): void {
    this.optimization = { ...this.optimization, ...newSettings };
    this.applyOptimizations();
  }

  // --- SPECIALIZED RECORDERS ---

  public recordCacheMetric(operation: 'hit' | 'miss' | 'set' | 'delete', key: string, duration: number, size?: number): void {
    const category = operation === 'hit' ? PerformanceCategory.CACHE_HIT :
                     operation === 'miss' ? PerformanceCategory.CACHE_MISS :
                     PerformanceCategory.CACHE_INVALIDATION;
    this.recordMetric({ name: `cache_${operation}`, value: duration, unit: PerformanceUnit.MILLISECONDS, source: PerformanceSource.CACHE_SYSTEM, category, metadata: { key, size } });
  }

  public recordApiMetric(endpoint: string, method: string, statusCode: number, duration: number, size?: number): void {
    const severity = statusCode >= 500 ? PerformanceSeverity.CRITICAL :
                     statusCode >= 400 ? PerformanceSeverity.HIGH :
                     duration > 5000 ? PerformanceSeverity.MEDIUM : PerformanceSeverity.LOW;
    this.recordMetric({ name: `api_${method.toLowerCase()}_${endpoint}`, value: duration, unit: PerformanceUnit.MILLISECONDS, source: PerformanceSource.API_ENDPOINT, category: PerformanceCategory.API_RESPONSE, severity, metadata: { endpoint, method, statusCode, size } });
  }

  public recordRenderingMetric(component: string, operation: string, duration: number, metadata?: Record<string, unknown>): void {
    this.recordMetric({ name: `render_${component}_${operation}`, value: duration, unit: PerformanceUnit.MILLISECONDS, source: PerformanceSource.CUSTOM_MEASUREMENT, category: PerformanceCategory.RENDERING, metadata: { component, operation, ...metadata } });
  }

  // --- STATISTICS ---

  public getStatistics(): typeof this.stats { return { ...this.stats }; }

  public getTopMetrics(category: PerformanceCategory, count = 10): PerformanceMetric[] {
    return (this.metrics.get(category) || []).sort((a, b) => a.value - b.value).slice(0, count);
  }

  public getPerformanceIssues(severity?: PerformanceSeverity): PerformanceMetric[] {
    return this.getMetrics().filter(m => {
      if (!m.severity) return false;
      if (severity) return m.severity === severity;
      return m.severity === PerformanceSeverity.HIGH || m.severity === PerformanceSeverity.CRITICAL;
    });
  }

  // --- PRIVATE IMPLEMENTATION ---

  private initializePerformanceAPI(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.initializeBrowserMetrics();
    }
  }

  private initializeBrowserMetrics(): void {
    if (performance.timing) {
      const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
      this.recordMetric({ name: 'page_load_time', value: loadTime, unit: PerformanceUnit.MILLISECONDS, source: PerformanceSource.BROWSER_API, category: PerformanceCategory.APPLICATION });
    }
  }

  private startPerformanceObserver(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;
    this.performanceObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        const entryWithLoad = entry as PerformanceEntryWithLoad;
        this.recordMetric({ name: entry.name, value: entry.duration || entryWithLoad.loadEventEnd || 0, unit: PerformanceUnit.MILLISECONDS, source: PerformanceSource.BROWSER_API, category: mapEntryTypeToCategory(entry.entryType), metadata: { entryType: entry.entryType } });
      });
    });
    try {
      this.performanceObserver.observe({ entryTypes: ['navigation', 'resource', 'measure', 'mark'] });
    } catch (error) { logger.warn('Performance Observer setup failed', { error }); }
  }

  private startMetricCollection(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.collectMemoryMetrics();
      this.updateStatistics();
    }, this.config.interval);
  }

  private collectSystemMetrics(): void {
    const mem = (performance as PerformanceWithMemory).memory;
    if (mem) {
      this.recordMetric({ name: 'heap_used', value: mem.usedJSHeapSize, unit: PerformanceUnit.BYTES, source: PerformanceSource.BROWSER_API, category: PerformanceCategory.MEMORY });
      this.recordMetric({ name: 'heap_total', value: mem.totalJSHeapSize, unit: PerformanceUnit.BYTES, source: PerformanceSource.BROWSER_API, category: PerformanceCategory.MEMORY });
    }
  }

  private collectMemoryMetrics(): void {
    let totalMetricCount = 0;
    this.metrics.forEach(cm => { totalMetricCount += cm.length; });
    const memoryUsage = estimateMemoryUsage(totalMetricCount, this.subscriptions.size);
    this.recordMetric({ name: 'estimated_memory_usage', value: memoryUsage, unit: PerformanceUnit.MEGABYTES, source: PerformanceSource.CUSTOM_MEASUREMENT, category: PerformanceCategory.MEMORY });
  }

  private updateStatistics(newMetric?: PerformanceMetric): void {
    this.stats.totalMetrics = this.getMetrics().length;
    this.stats.lastUpdated = Date.now();
    if (newMetric) {
      switch (newMetric.category) {
        case PerformanceCategory.API_RESPONSE: this.updateApiStatistics(); break;
        case PerformanceCategory.CACHE_HIT:
        case PerformanceCategory.CACHE_MISS: this.updateCacheStatistics(); break;
        case PerformanceCategory.MEMORY: this.stats.memoryUsage = newMetric.value; break;
      }
    }
  }

  private updateApiStatistics(): void {
    const apiMetrics = this.getMetrics(PerformanceCategory.API_RESPONSE, 100);
    if (apiMetrics.length > 0) {
      this.stats.averageResponseTime = apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length;
    }
  }

  private updateCacheStatistics(): void {
    const hits = this.getMetrics(PerformanceCategory.CACHE_HIT, 100);
    const misses = this.getMetrics(PerformanceCategory.CACHE_MISS, 100);
    const total = hits.length + misses.length;
    if (total > 0) this.stats.cacheHitRatio = (hits.length / total) * 100;
  }

  private checkThresholds(metric: PerformanceMetric): void {
    this.budgets.forEach(budget => {
      budget.thresholds.forEach((threshold: BudgetThreshold) => {
        if (threshold.metric === metric.name && threshold.category === metric.category) {
          if (metric.value > threshold.errorThreshold) this.triggerAlert(metric, PerformanceSeverity.CRITICAL);
          else if (metric.value > threshold.warningThreshold) this.triggerAlert(metric, PerformanceSeverity.HIGH);
        }
      });
    });
  }

  private triggerAlert(metric: PerformanceMetric, severity: PerformanceSeverity): void {
    logger.warn(`Performance Alert: ${metric.name} = ${metric.value}${metric.unit}`);
    this.notifySubscribers({ ...metric, severity });
  }

  private notifySubscribers(metric: PerformanceMetric): void {
    this.subscriptions.forEach(sub => {
      if (sub.categories.includes(metric.category)) {
        if (!sub.threshold || this.meetsSeverityThreshold(metric.severity, sub.threshold)) {
          const update: RealTimePerformanceUpdate = { type: 'metric', data: metric, timestamp: Date.now() };
          try { sub.callback(update); }
          catch (error) { logger.error(`Error in subscription callback: ${sub.id}`, { error }); }
        }
      }
    });
  }

  private meetsSeverityThreshold(metricSev: PerformanceSeverity | undefined, thresholdSev: PerformanceSeverity): boolean {
    if (!metricSev) return false;
    const order = { [PerformanceSeverity.LOW]: 0, [PerformanceSeverity.MEDIUM]: 1, [PerformanceSeverity.HIGH]: 2, [PerformanceSeverity.CRITICAL]: 3 };
    return order[metricSev] >= order[thresholdSev];
  }

  private startCleanupScheduler(): void {
    this.cleanupInterval = setInterval(() => this.cleanupOldMetrics(), 60 * 60 * 1000);
  }

  private cleanupOldMetrics(): void {
    const limit = Date.now() - this.config.retentionPeriod;
    let cleaned = 0;
    this.metrics.forEach((cm, cat) => {
      const orig = cm.length;
      this.metrics.set(cat, cm.filter(m => m.timestamp > limit));
      cleaned += orig - this.metrics.get(cat)!.length;
    });
    if (cleaned > 0) logger.info(`Cleaned up ${cleaned} old performance metrics`);
  }

  private applyOptimizations(): void {
    if (this.optimization.memory.enableGarbageCollection) scheduleGarbageCollection();
    logger.info('Performance optimizations applied');
  }

  public destroy(): void {
    this.stopMonitoring();
    if (this.cleanupInterval) { clearInterval(this.cleanupInterval); this.cleanupInterval = undefined; }
    this.metrics.clear();
    this.subscriptions.clear();
    EnterprisePerformanceManager.instance = null;
  }
}

export const performanceManager = EnterprisePerformanceManager.getInstance();
