/**
 * 🏢 ENTERPRISE PERFORMANCE MANAGER - CORE ORCHESTRATION
 *
 * Κεντρικός performance manager που ενοποιεί όλα τα performance systems
 * της εφαρμογής σε έναν unified enterprise service.
 *
 * ΑΡΧΙΤΕΚΤΟΝΙΚΗ: Singleton Pattern με Service Registry
 * BASED ON: Google's Web Vitals, Microsoft's Application Insights, AWS CloudWatch
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 */

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
  SystemInfo,
  ApplicationContext,
  RealTimePerformanceUpdate,
  PerformanceSubscription
} from '../types/performance.types';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('EnterprisePerformanceManager');

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Chrome-specific Performance.memory interface */
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/** Extended Performance interface with Chrome-specific memory */
interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

/** Extended PerformanceEntry with loadEventEnd for navigation entries */
interface PerformanceEntryWithLoad extends PerformanceEntry {
  loadEventEnd?: number;
}

/** Performance budget threshold */
interface BudgetThreshold {
  metric: string;
  category: PerformanceCategory;
  warningThreshold: number;
  errorThreshold: number;
}

/** Window with optional gc function (Chrome DevTools) */
interface WindowWithGC extends Window {
  gc?: () => void;
}

export class EnterprisePerformanceManager {
  private static instance: EnterprisePerformanceManager | null = null;

  // 📊 CORE STATE
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private subscriptions: Map<string, PerformanceSubscription> = new Map();
  private config: MonitoringConfig;
  private optimization: OptimizationSettings;
  private budgets: PerformanceBudget[] = [];
  private isMonitoring = false;

  // ⏱️ TIMING & INTERVALS
  private monitoringInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private performanceObserver?: PerformanceObserver;

  // 📈 STATISTICS
  private stats = {
    totalMetrics: 0,
    metricsPerSecond: 0,
    averageResponseTime: 0,
    cacheHitRatio: 0,
    memoryUsage: 0,
    lastUpdated: Date.now()
  };

  /**
   * 🏭 SINGLETON FACTORY - Enterprise Pattern
   */
  public static getInstance(): EnterprisePerformanceManager {
    if (!EnterprisePerformanceManager.instance) {
      EnterprisePerformanceManager.instance = new EnterprisePerformanceManager();
    }
    return EnterprisePerformanceManager.instance;
  }

  private constructor() {
    this.config = this.getDefaultMonitoringConfig();
    this.optimization = this.getDefaultOptimizationSettings();
    this.initializePerformanceAPI();
    this.startCleanupScheduler();
  }

  // ⚙️ CORE LIFECYCLE METHODS

  /**
   * 🚦 Start comprehensive performance monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('Performance monitoring already active');
      return;
    }

    this.isMonitoring = true;
    this.startPerformanceObserver();
    this.startMetricCollection();

    // console.log(`✅ Enterprise Performance Monitoring started (interval: ${this.config.interval}ms)`); // DISABLED - προκαλούσε loops
  }

  /**
   * ⏹️ Stop performance monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = undefined;
    }

    // console.log('⏹️ Performance monitoring stopped'); // DISABLED - προκαλούσε loops
  }

  // 📊 METRIC COLLECTION & MANAGEMENT

  /**
   * 📝 Record a performance metric
   */
  public recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): string {
    const fullMetric: PerformanceMetric = {
      ...metric,
      id: this.generateMetricId(),
      timestamp: Date.now()
    };

    // Store metric by category
    const categoryKey = fullMetric.category;
    if (!this.metrics.has(categoryKey)) {
      this.metrics.set(categoryKey, []);
    }

    const categoryMetrics = this.metrics.get(categoryKey)!;
    categoryMetrics.push(fullMetric);

    // Enforce retention limits
    if (categoryMetrics.length > this.config.maxSamples) {
      categoryMetrics.shift(); // Remove oldest
    }

    this.updateStatistics(fullMetric);
    this.checkThresholds(fullMetric);
    this.notifySubscribers(fullMetric);

    return fullMetric.id;
  }

  /**
   * 📊 Get performance snapshot
   */
  public getSnapshot(): PerformanceSnapshot {
    const allMetrics: PerformanceMetric[] = [];
    this.metrics.forEach(categoryMetrics => {
      allMetrics.push(...categoryMetrics);
    });

    return {
      timestamp: Date.now(),
      metrics: allMetrics,
      systemInfo: this.getSystemInfo(),
      applicationContext: this.getApplicationContext()
    };
  }

  /**
   * 🔍 Get metrics by category
   */
  public getMetrics(category?: PerformanceCategory, limit?: number): PerformanceMetric[] {
    if (category) {
      const categoryMetrics = this.metrics.get(category) || [];
      return limit ? categoryMetrics.slice(-limit) : categoryMetrics;
    }

    // Return all metrics
    const allMetrics: PerformanceMetric[] = [];
    this.metrics.forEach(categoryMetrics => {
      allMetrics.push(...categoryMetrics);
    });

    // Sort by timestamp (newest first) and apply limit
    allMetrics.sort((a, b) => b.timestamp - a.timestamp);
    return limit ? allMetrics.slice(0, limit) : allMetrics;
  }

  // 🎯 REAL-TIME SUBSCRIPTIONS

  /**
   * 📡 Subscribe to real-time performance updates
   */
  public subscribe(subscription: Omit<PerformanceSubscription, 'id'>): string {
    const subscriptionId = this.generateSubscriptionId();
    const fullSubscription: PerformanceSubscription = {
      ...subscription,
      id: subscriptionId
    };

    this.subscriptions.set(subscriptionId, fullSubscription);
    return subscriptionId;
  }

  /**
   * 📡 Unsubscribe from performance updates
   */
  public unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  // ⚙️ CONFIGURATION MANAGEMENT

  /**
   * 🔧 Update monitoring configuration
   */
  public updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart monitoring with new config
    if (this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring();
    }

    // console.log('🔧 Performance monitoring configuration updated'); // DISABLED - προκαλούσε loops
  }

  /**
   * ⚡ Update optimization settings
   */
  public updateOptimization(newSettings: Partial<OptimizationSettings>): void {
    this.optimization = { ...this.optimization, ...newSettings };
    this.applyOptimizations();

    logger.info('Performance optimization settings updated');
  }

  // 💾 CACHE INTEGRATION

  /**
   * 📦 Record cache performance
   */
  public recordCacheMetric(
    operation: 'hit' | 'miss' | 'set' | 'delete',
    key: string,
    duration: number,
    size?: number
  ): void {
    const category = operation === 'hit' ? PerformanceCategory.CACHE_HIT :
                   operation === 'miss' ? PerformanceCategory.CACHE_MISS :
                   PerformanceCategory.CACHE_INVALIDATION;

    this.recordMetric({
      name: `cache_${operation}`,
      value: duration,
      unit: PerformanceUnit.MILLISECONDS,
      source: PerformanceSource.CACHE_SYSTEM,
      category,
      metadata: { key, size }
    });
  }

  // 🎮 API PERFORMANCE

  /**
   * 🌐 Record API performance
   */
  public recordApiMetric(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    size?: number
  ): void {
    const severity = statusCode >= 500 ? PerformanceSeverity.CRITICAL :
                    statusCode >= 400 ? PerformanceSeverity.HIGH :
                    duration > 5000 ? PerformanceSeverity.MEDIUM :
                    PerformanceSeverity.LOW;

    this.recordMetric({
      name: `api_${method.toLowerCase()}_${endpoint}`,
      value: duration,
      unit: PerformanceUnit.MILLISECONDS,
      source: PerformanceSource.API_ENDPOINT,
      category: PerformanceCategory.API_RESPONSE,
      severity,
      metadata: { endpoint, method, statusCode, size }
    });
  }

  // 🖼️ RENDERING PERFORMANCE

  /**
   * 🎨 Record rendering metrics
   */
  public recordRenderingMetric(
    component: string,
    operation: string,
    duration: number,
    metadata?: Record<string, unknown>
  ): void {
    this.recordMetric({
      name: `render_${component}_${operation}`,
      value: duration,
      unit: PerformanceUnit.MILLISECONDS,
      source: PerformanceSource.CUSTOM_MEASUREMENT,
      category: PerformanceCategory.RENDERING,
      metadata: { component, operation, ...metadata }
    });
  }

  // 📊 STATISTICS & REPORTING

  /**
   * 📈 Get performance statistics
   */
  public getStatistics(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * 🏆 Get top performing metrics
   */
  public getTopMetrics(category: PerformanceCategory, count = 10): PerformanceMetric[] {
    const categoryMetrics = this.metrics.get(category) || [];
    return categoryMetrics
      .sort((a, b) => a.value - b.value) // Best performance first
      .slice(0, count);
  }

  /**
   * ⚠️ Get performance issues
   */
  public getPerformanceIssues(severity?: PerformanceSeverity): PerformanceMetric[] {
    const allMetrics = this.getMetrics();
    return allMetrics.filter(metric => {
      if (!metric.severity) return false;
      if (severity) return metric.severity === severity;
      return metric.severity === PerformanceSeverity.HIGH ||
             metric.severity === PerformanceSeverity.CRITICAL;
    });
  }

  // 🔧 PRIVATE IMPLEMENTATION METHODS

  private initializePerformanceAPI(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      // Browser environment - initialize Web APIs
      this.initializeBrowserMetrics();
    }
  }

  private initializeBrowserMetrics(): void {
    // Record initial page load metrics
    if (performance.timing) {
      const timing = performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;

      this.recordMetric({
        name: 'page_load_time',
        value: loadTime,
        unit: PerformanceUnit.MILLISECONDS,
        source: PerformanceSource.BROWSER_API,
        category: PerformanceCategory.APPLICATION
      });
    }
  }

  private startPerformanceObserver(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      entries.forEach(entry => {
        const entryWithLoad = entry as PerformanceEntryWithLoad;
        this.recordMetric({
          name: entry.name,
          value: entry.duration || entryWithLoad.loadEventEnd || 0,
          unit: PerformanceUnit.MILLISECONDS,
          source: PerformanceSource.BROWSER_API,
          category: this.mapEntryTypeToCategory(entry.entryType),
          metadata: { entryType: entry.entryType }
        });
      });
    });

    try {
      this.performanceObserver.observe({
        entryTypes: ['navigation', 'resource', 'measure', 'mark']
      });
    } catch (error) {
      logger.warn('Performance Observer setup failed', { error });
    }
  }

  private startMetricCollection(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.collectMemoryMetrics();
      this.updateStatistics();
    }, this.config.interval);
  }

  private collectSystemMetrics(): void {
    // Memory metrics
    const perfWithMemory = performance as PerformanceWithMemory;
    if (perfWithMemory.memory) {
      const memory = perfWithMemory.memory;

      this.recordMetric({
        name: 'heap_used',
        value: memory.usedJSHeapSize,
        unit: PerformanceUnit.BYTES,
        source: PerformanceSource.BROWSER_API,
        category: PerformanceCategory.MEMORY
      });

      this.recordMetric({
        name: 'heap_total',
        value: memory.totalJSHeapSize,
        unit: PerformanceUnit.BYTES,
        source: PerformanceSource.BROWSER_API,
        category: PerformanceCategory.MEMORY
      });
    }
  }

  private collectMemoryMetrics(): void {
    // Custom memory monitoring
    const memoryUsage = this.estimateMemoryUsage();

    this.recordMetric({
      name: 'estimated_memory_usage',
      value: memoryUsage,
      unit: PerformanceUnit.MEGABYTES,
      source: PerformanceSource.CUSTOM_MEASUREMENT,
      category: PerformanceCategory.MEMORY
    });
  }

  private updateStatistics(newMetric?: PerformanceMetric): void {
    this.stats.totalMetrics = this.getMetrics().length;
    this.stats.lastUpdated = Date.now();

    if (newMetric) {
      // Update specific statistics based on metric category
      switch (newMetric.category) {
        case PerformanceCategory.API_RESPONSE:
          this.updateApiStatistics();
          break;
        case PerformanceCategory.CACHE_HIT:
        case PerformanceCategory.CACHE_MISS:
          this.updateCacheStatistics();
          break;
        case PerformanceCategory.MEMORY:
          this.updateMemoryStatistics();
          break;
      }
    }
  }

  private updateApiStatistics(): void {
    const apiMetrics = this.getMetrics(PerformanceCategory.API_RESPONSE, 100);
    if (apiMetrics.length > 0) {
      const totalTime = apiMetrics.reduce((sum, metric) => sum + metric.value, 0);
      this.stats.averageResponseTime = totalTime / apiMetrics.length;
    }
  }

  private updateCacheStatistics(): void {
    const cacheHits = this.getMetrics(PerformanceCategory.CACHE_HIT, 100);
    const cacheMisses = this.getMetrics(PerformanceCategory.CACHE_MISS, 100);
    const totalRequests = cacheHits.length + cacheMisses.length;

    if (totalRequests > 0) {
      this.stats.cacheHitRatio = (cacheHits.length / totalRequests) * 100;
    }
  }

  private updateMemoryStatistics(): void {
    const memoryMetrics = this.getMetrics(PerformanceCategory.MEMORY, 1);
    if (memoryMetrics.length > 0) {
      this.stats.memoryUsage = memoryMetrics[0].value;
    }
  }

  private checkThresholds(metric: PerformanceMetric): void {
    // Check against performance budgets
    this.budgets.forEach(budget => {
      budget.thresholds.forEach(threshold => {
        if (threshold.metric === metric.name && threshold.category === metric.category) {
          if (metric.value > threshold.errorThreshold) {
            this.triggerAlert(metric, threshold, PerformanceSeverity.CRITICAL);
          } else if (metric.value > threshold.warningThreshold) {
            this.triggerAlert(metric, threshold, PerformanceSeverity.HIGH);
          }
        }
      });
    });
  }

  private triggerAlert(
    metric: PerformanceMetric,
    threshold: BudgetThreshold,
    severity: PerformanceSeverity
  ): void {
    logger.warn(`Performance Alert: ${metric.name} = ${metric.value}${metric.unit} (threshold: ${threshold.errorThreshold}${metric.unit})`);

    // Notify subscribers about the alert
    this.notifySubscribers({
      ...metric,
      severity
    });
  }

  private notifySubscribers(metric: PerformanceMetric): void {
    this.subscriptions.forEach(subscription => {
      // Check if subscriber is interested in this category
      if (subscription.categories.includes(metric.category)) {
        // Check severity threshold
        if (!subscription.threshold || this.meetsSeverityThreshold(metric.severity, subscription.threshold)) {
          const update: RealTimePerformanceUpdate = {
            type: 'metric',
            data: metric,
            timestamp: Date.now()
          };

          try {
            subscription.callback(update);
          } catch (error) {
            logger.error(`Error in performance subscription callback: ${subscription.id}`, { error });
          }
        }
      }
    });
  }

  private meetsSeverityThreshold(
    metricSeverity: PerformanceSeverity | undefined,
    thresholdSeverity: PerformanceSeverity
  ): boolean {
    if (!metricSeverity) return false;

    const severityOrder = {
      [PerformanceSeverity.LOW]: 0,
      [PerformanceSeverity.MEDIUM]: 1,
      [PerformanceSeverity.HIGH]: 2,
      [PerformanceSeverity.CRITICAL]: 3
    };

    return severityOrder[metricSeverity] >= severityOrder[thresholdSeverity];
  }

  private startCleanupScheduler(): void {
    // Clean up old metrics every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000);
  }

  private cleanupOldMetrics(): void {
    const retentionLimit = Date.now() - this.config.retentionPeriod;
    let cleanedCount = 0;

    this.metrics.forEach((categoryMetrics, category) => {
      const originalLength = categoryMetrics.length;
      const filteredMetrics = categoryMetrics.filter(
        metric => metric.timestamp > retentionLimit
      );

      this.metrics.set(category, filteredMetrics);
      cleanedCount += originalLength - filteredMetrics.length;
    });

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} old performance metrics`);
    }
  }

  private applyOptimizations(): void {
    // Apply performance optimizations based on current settings
    if (this.optimization.memory.enableGarbageCollection) {
      this.scheduleGarbageCollection();
    }

    logger.info('Performance optimizations applied');
  }

  private scheduleGarbageCollection(): void {
    // Schedule garbage collection if supported
    if (typeof window !== 'undefined') {
      const windowWithGC = window as WindowWithGC;
      if (windowWithGC.gc) {
        setTimeout(() => {
          try {
            windowWithGC.gc?.();
            logger.info('Garbage collection executed');
          } catch (error) {
            logger.warn('Garbage collection failed', { error });
          }
        }, 1000);
      }
    }
  }

  // 🔧 UTILITY METHODS

  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private mapEntryTypeToCategory(entryType: string): PerformanceCategory {
    switch (entryType) {
      case 'navigation':
      case 'resource':
        return PerformanceCategory.NETWORK;
      case 'measure':
      case 'mark':
        return PerformanceCategory.APPLICATION;
      case 'paint':
        return PerformanceCategory.PAINT;
      case 'layout-shift':
        return PerformanceCategory.LAYOUT;
      default:
        return PerformanceCategory.APPLICATION;
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in MB
    let estimated = 0;

    // Count metrics in memory
    this.metrics.forEach(categoryMetrics => {
      estimated += categoryMetrics.length * 0.001; // ~1KB per metric
    });

    // Add subscriptions
    estimated += this.subscriptions.size * 0.0005; // ~0.5KB per subscription

    return Math.round(estimated * 100) / 100; // Round to 2 decimal places
  }

  private getSystemInfo(): SystemInfo {
    if (typeof window === 'undefined') {
      return {
        userAgent: 'server',
        platform: 'server',
        screen: { width: 0, height: 0, pixelRatio: 1 }
      };
    }

    const perfWithMemory = performance as PerformanceWithMemory;
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      memory: perfWithMemory.memory ? {
        total: perfWithMemory.memory.totalJSHeapSize,
        used: perfWithMemory.memory.usedJSHeapSize,
        available: perfWithMemory.memory.jsHeapSizeLimit
      } : undefined,
      screen: {
        width: screen.width,
        height: screen.height,
        pixelRatio: devicePixelRatio || 1
      }
    };
  }

  private getApplicationContext(): ApplicationContext {
    const env = (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test' | 'staging';
    const environment: ApplicationContext['environment'] =
      env === 'production' ? 'production' :
      env === 'staging' ? 'staging' :
      env === 'test' ? 'test' : 'development';

    return {
      route: typeof window !== 'undefined' ? window.location.pathname : '/',
      subapp: this.detectSubapp(),
      version: '1.0.0', // Should come from package.json
      environment,
      sessionId: this.getSessionId()
    };
  }

  private detectSubapp(): ApplicationContext['subapp'] {
    if (typeof window === 'undefined') return 'main-app';

    const path = window.location.pathname;
    if (path.includes('/dxf')) return 'dxf-viewer';
    if (path.includes('/geo')) return 'geo-canvas';
    if (path.includes('/admin')) return 'admin';
    return 'main-app';
  }

  private getSessionId(): string {
    if (typeof window === 'undefined') return 'server-session';

    let sessionId = sessionStorage.getItem('performance-session-id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      sessionStorage.setItem('performance-session-id', sessionId);
    }
    return sessionId;
  }

  private getDefaultMonitoringConfig(): MonitoringConfig {
    return {
      enabled: true,
      interval: 5000, // 5 seconds
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      maxSamples: 1000,
      categories: Object.values(PerformanceCategory),
      sources: Object.values(PerformanceSource),
      autoOptimization: true,
      realTimeUpdates: true
    };
  }

  private getDefaultOptimizationSettings(): OptimizationSettings {
    return {
      caching: {
        enabled: true,
        strategy: 'balanced',
        ttl: {
          api: 5 * 60 * 1000,     // 5 minutes
          static: 60 * 60 * 1000,  // 1 hour
          dynamic: 30 * 1000       // 30 seconds
        }
      },
      rendering: {
        enableRequestIdleCallback: true,
        enableVirtualization: true,
        maxFPS: 60
      },
      memory: {
        enableGarbageCollection: true,
        gcThreshold: 50, // MB
        enableMemoryMonitoring: true
      },
      network: {
        enableRequestBatching: true,
        maxConcurrentRequests: 6,
        enableCompression: true
      }
    };
  }

  /**
   * 🧹 Cleanup resources
   */
  public destroy(): void {
    this.stopMonitoring();

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    this.metrics.clear();
    this.subscriptions.clear();

    EnterprisePerformanceManager.instance = null;
    logger.info('Enterprise Performance Manager destroyed');
  }
}

// 📤 EXPORT SINGLETON INSTANCE
export const performanceManager = EnterprisePerformanceManager.getInstance();
