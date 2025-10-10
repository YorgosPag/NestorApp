/**
 * 🏥 SERVICE HEALTH MONITOR - ENTERPRISE MONITORING
 *
 * **Purpose**: Real-time service health checking και performance monitoring
 *
 * **Enterprise Benefits**:
 * - Proactive service health monitoring
 * - Performance degradation detection
 * - Memory leak detection
 * - Service availability tracking
 * - Automatic alerting for critical issues
 *
 * **Use Cases**:
 * - Production monitoring dashboards
 * - DevOps alerts
 * - Performance profiling
 * - Service debugging
 * - Load testing validation
 *
 * @module services/ServiceHealthMonitor
 * @created 2025-09-30
 * @enterprise-grade
 */

import { serviceRegistry, type ServiceName } from './ServiceRegistry';

// ✅ ENTERPRISE: Window interface extension for debug helpers
declare global {
  interface Window {
    serviceHealth?: {
      start: () => void;
      stop: () => void;
      check: () => Promise<unknown>;
      report: () => unknown;
      stats: () => unknown;
      log: () => void;
    };
  }
}

/**
 * Health status levels
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

/**
 * Service health check result
 */
export interface HealthCheckResult {
  service: ServiceName;
  status: HealthStatus;
  responseTime: number; // milliseconds
  lastChecked: number; // timestamp
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Aggregate health report για όλα τα services
 */
export interface HealthReport {
  timestamp: number;
  overallStatus: HealthStatus;
  totalServices: number;
  healthyServices: number;
  degradedServices: number;
  unhealthyServices: number;
  services: HealthCheckResult[];
}

/**
 * Health check configuration
 */
interface HealthCheckConfig {
  enabled: boolean;
  intervalMs: number; // How often to check (default: 30000ms = 30s)
  timeoutMs: number; // Max time for health check (default: 1000ms = 1s)
  degradedThresholdMs: number; // Response time για degraded status (default: 500ms)
  unhealthyThresholdMs: number; // Response time για unhealthy status (default: 1000ms)
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: HealthCheckConfig = {
  enabled: true,
  intervalMs: 30000, // Check every 30 seconds
  timeoutMs: 1000, // 1 second timeout
  degradedThresholdMs: 500, // > 500ms = degraded
  unhealthyThresholdMs: 1000 // > 1000ms = unhealthy
};

/**
 * 🏥 SERVICE HEALTH MONITOR
 *
 * Monitors service health, performance, και availability
 */
export class ServiceHealthMonitor {
  private static instance: ServiceHealthMonitor;
  private config: HealthCheckConfig = { ...DEFAULT_CONFIG };
  private intervalId: number | null = null;
  private lastReport: HealthReport | null = null;
  private healthHistory: HealthCheckResult[] = [];
  private maxHistorySize = 100; // Keep last 100 checks per service
  private listeners: Array<(report: HealthReport) => void> = [];

  private constructor() {
    // Private constructor για singleton pattern
  }

  /**
   * Singleton instance access
   */
  public static getInstance(): ServiceHealthMonitor {
    if (!ServiceHealthMonitor.instance) {
      ServiceHealthMonitor.instance = new ServiceHealthMonitor();
    }
    return ServiceHealthMonitor.instance;
  }

  /**
   * 🔧 Configure health monitor
   */
  public configure(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart monitoring με νέο configuration
    if (this.intervalId !== null) {
      this.stop();
      this.start();
    }
  }

  /**
   * 🚀 Start automatic health monitoring
   */
  public start(): void {
    if (this.intervalId !== null) {
      console.warn('🏥 Health monitor already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('🏥 Health monitor disabled in config');
      return;
    }

    // Run initial check
    this.checkAllServices().then(report => {
      this.notifyListeners(report);
    });

    // Schedule periodic checks
    this.intervalId = window.setInterval(() => {
      this.checkAllServices().then(report => {
        this.notifyListeners(report);
      });
    }, this.config.intervalMs);

    console.log(`🏥 Health monitor started (interval: ${this.config.intervalMs}ms)`);
  }

  /**
   * 🛑 Stop automatic health monitoring
   */
  public stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🏥 Health monitor stopped');
    }
  }

  /**
   * 🔍 Check health για όλα τα registered services
   */
  public async checkAllServices(): Promise<HealthReport> {
    const services: ServiceName[] = [
      'fit-to-view',
      'hit-testing',
      'canvas-bounds',
      'layer-operations',
      'entity-merge',
      'dxf-firestore',
      'dxf-import',
      'scene-update',
      'smart-bounds'
    ];

    const results: HealthCheckResult[] = [];

    for (const serviceName of services) {
      const result = await this.checkService(serviceName);
      results.push(result);
      this.addToHistory(result);
    }

    const report = this.generateReport(results);
    this.lastReport = report;

    return report;
  }

  /**
   * 🔍 Check health για συγκεκριμένο service
   */
  public async checkService(serviceName: ServiceName): Promise<HealthCheckResult> {
    const startTime = performance.now();

    try {
      // Check if service exists
      if (!serviceRegistry.has(serviceName)) {
        return {
          service: serviceName,
          status: HealthStatus.UNHEALTHY,
          responseTime: 0,
          lastChecked: Date.now(),
          error: 'Service not registered'
        };
      }

      // Try to get service (triggers lazy initialization)
      const service = serviceRegistry.get(serviceName);

      if (!service) {
        return {
          service: serviceName,
          status: HealthStatus.UNHEALTHY,
          responseTime: 0,
          lastChecked: Date.now(),
          error: 'Service is null or undefined'
        };
      }

      // Calculate response time
      const responseTime = performance.now() - startTime;

      // Determine status based on response time
      let status: HealthStatus;
      if (responseTime < this.config.degradedThresholdMs) {
        status = HealthStatus.HEALTHY;
      } else if (responseTime < this.config.unhealthyThresholdMs) {
        status = HealthStatus.DEGRADED;
      } else {
        status = HealthStatus.UNHEALTHY;
      }

      // Get service metadata
      const metadata = serviceRegistry.getMetadata(serviceName);

      return {
        service: serviceName,
        status,
        responseTime,
        lastChecked: Date.now(),
        metadata: metadata ? {
          initialized: metadata.initialized,
          instanceCount: metadata.instanceCount,
          lastAccessed: metadata.lastAccessed
        } : undefined
      };

    } catch (error) {
      return {
        service: serviceName,
        status: HealthStatus.UNHEALTHY,
        responseTime: performance.now() - startTime,
        lastChecked: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 📊 Generate aggregate health report
   */
  private generateReport(results: HealthCheckResult[]): HealthReport {
    const healthyServices = results.filter(r => r.status === HealthStatus.HEALTHY).length;
    const degradedServices = results.filter(r => r.status === HealthStatus.DEGRADED).length;
    const unhealthyServices = results.filter(r => r.status === HealthStatus.UNHEALTHY).length;

    // Determine overall status
    let overallStatus: HealthStatus;
    if (unhealthyServices > 0) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (degradedServices > 0) {
      overallStatus = HealthStatus.DEGRADED;
    } else {
      overallStatus = HealthStatus.HEALTHY;
    }

    return {
      timestamp: Date.now(),
      overallStatus,
      totalServices: results.length,
      healthyServices,
      degradedServices,
      unhealthyServices,
      services: results
    };
  }

  /**
   * 📝 Add health check result to history
   */
  private addToHistory(result: HealthCheckResult): void {
    this.healthHistory.push(result);

    // Keep only last N checks
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 📊 Get health check history για συγκεκριμένο service
   */
  public getServiceHistory(serviceName: ServiceName, limit: number = 10): HealthCheckResult[] {
    return this.healthHistory
      .filter(h => h.service === serviceName)
      .slice(-limit);
  }

  /**
   * 📊 Get last health report
   */
  public getLastReport(): HealthReport | null {
    return this.lastReport;
  }

  /**
   * 🔔 Subscribe to health check notifications
   */
  public subscribe(callback: (report: HealthReport) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 🔔 Notify all listeners
   */
  private notifyListeners(report: HealthReport): void {
    for (const listener of this.listeners) {
      try {
        listener(report);
      } catch (error) {
        console.error('🏥 Health monitor listener error:', error);
      }
    }
  }

  /**
   * 📊 Get statistics
   */
  public getStats() {
    return {
      enabled: this.config.enabled,
      intervalMs: this.config.intervalMs,
      lastReport: this.lastReport,
      historySize: this.healthHistory.length,
      listenerCount: this.listeners.length,
      isRunning: this.intervalId !== null
    };
  }

  /**
   * 🧹 Clear history
   */
  public clearHistory(): void {
    this.healthHistory = [];
  }

  /**
   * 🧹 Reset monitor
   */
  public reset(): void {
    this.stop();
    this.clearHistory();
    this.lastReport = null;
    this.listeners = [];
  }
}

/**
 * 🎯 Global health monitor instance (convenience export)
 *
 * **Usage**:
 * ```typescript
 * import { serviceHealthMonitor } from '@/subapps/dxf-viewer/services/ServiceHealthMonitor';
 *
 * // Start monitoring
 * serviceHealthMonitor.start();
 *
 * // Subscribe to health updates
 * const unsubscribe = serviceHealthMonitor.subscribe(report => {
 *   if (report.overallStatus === HealthStatus.UNHEALTHY) {
 *     alert('Services are unhealthy!');
 *   }
 * });
 *
 * // Check health manually
 * const report = await serviceHealthMonitor.checkAllServices();
 * console.log('Overall health:', report.overallStatus);
 *
 * // Stop monitoring
 * serviceHealthMonitor.stop();
 * unsubscribe();
 * ```
 */
export const serviceHealthMonitor = ServiceHealthMonitor.getInstance();

/**
 * 📊 Development helper - log health status
 */
export const logHealthStatus = async (): Promise<void> => {
  if (process.env.NODE_ENV === 'development') {
    const report = await serviceHealthMonitor.checkAllServices();

    console.group('🏥 Service Health Report');
    console.log('Overall Status:', report.overallStatus);
    console.log('Healthy Services:', `${report.healthyServices}/${report.totalServices}`);
    console.log('Degraded Services:', report.degradedServices);
    console.log('Unhealthy Services:', report.unhealthyServices);
    console.table(report.services.map(s => ({
      Service: s.service,
      Status: s.status,
      'Response Time': `${s.responseTime.toFixed(2)}ms`,
      Error: s.error || '-'
    })));
    console.groupEnd();
  }
};

/**
 * 🎯 Browser console helper
 */
if (typeof window !== 'undefined') {
  window.serviceHealth = {
    start: () => serviceHealthMonitor.start(),
    stop: () => serviceHealthMonitor.stop(),
    check: () => serviceHealthMonitor.checkAllServices(),
    report: () => serviceHealthMonitor.getLastReport(),
    stats: () => serviceHealthMonitor.getStats(),
    log: () => logHealthStatus()
  };

  console.log('🏥 Service Health Monitor loaded!');
  console.log('Run in console:');
  console.log('  serviceHealth.start() - Start monitoring');
  console.log('  serviceHealth.stop() - Stop monitoring');
  console.log('  serviceHealth.check() - Check all services');
  console.log('  serviceHealth.report() - Get last report');
  console.log('  serviceHealth.log() - Pretty print status');
}
