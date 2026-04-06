/**
 * 🏛️ ADMINISTRATIVE BOUNDARIES PERFORMANCE ANALYTICS - Phase 7.1
 *
 * Enterprise performance monitoring for the administrative boundaries system.
 * Split structure (ADR-065 SRP):
 * - admin-boundaries-analytics-types.ts          — Types (EXEMPT)
 * - admin-boundaries-metrics-calculators.ts       — Pure calculation functions
 * - AdminBoundariesPerformanceAnalytics.ts        — This file: main class
 */

import { performanceMonitor } from '../../performance/monitoring/PerformanceMonitor';
import type { GreekAdminLevel } from '../../types/administrative-types';
import { generateSearchId, generateRequestId, generateAlertId } from '@/services/enterprise-id.service';
import type {
  AdminBoundariesMetrics,
  AdminBoundariesAlert,
  PerformanceThresholds,
  PerformanceReportSummary,
  SearchTrackingState,
  ApiTrackingState,
  CacheTrackingState,
  BoundaryTrackingState,
  MapTrackingState
} from './admin-boundaries-analytics-types';
import {
  calculateSearchMetrics,
  calculateOverpassMetrics,
  calculateCachingMetrics,
  calculateBoundaryMetrics,
  calculateMapMetrics,
  calculateUXMetrics,
  getDefaultThresholds
} from './admin-boundaries-metrics-calculators';

// Re-export types for consumers
export type {
  PerformanceReportSummary,
  AdminBoundariesMetrics,
  AdminBoundariesAlert,
  PerformanceThresholds
} from './admin-boundaries-analytics-types';

/**
 * Specialized Performance Analytics για Administrative Boundaries System
 */
export class AdminBoundariesPerformanceAnalytics {
  private static instance: AdminBoundariesPerformanceAnalytics | null = null;

  private isMonitoring: boolean = false;
  private metricsHistory: AdminBoundariesMetrics[] = [];
  private alerts: AdminBoundariesAlert[] = [];
  private thresholds: PerformanceThresholds;

  private searchMetrics: SearchTrackingState = {
    activeSearches: new Map<string, number>(),
    recentSearchTimes: [],
    totalSearches: 0,
    successfulSearches: 0
  };

  private apiMetrics: ApiTrackingState = {
    activeRequests: new Map<string, number>(),
    recentResponseTimes: [],
    totalRequests: 0,
    failedRequests: 0,
    totalDataSize: 0
  };

  private cacheMetrics: CacheTrackingState = { hits: 0, misses: 0, size: 0, evictions: 0 };

  private boundaryMetrics: BoundaryTrackingState = {
    processedCount: 0, totalProcessingTime: 0, totalGeometryPoints: 0, renderingTimes: []
  };

  private mapMetrics: MapTrackingState = {
    layerUpdates: 0, frameDrops: 0, activeLayers: 0, visibleBoundaries: 0
  };

  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.thresholds = getDefaultThresholds();
    console.debug('🏛️ AdminBoundariesPerformanceAnalytics initialized');
  }

  public static getInstance(): AdminBoundariesPerformanceAnalytics {
    if (!AdminBoundariesPerformanceAnalytics.instance) {
      AdminBoundariesPerformanceAnalytics.instance = new AdminBoundariesPerformanceAnalytics();
    }
    return AdminBoundariesPerformanceAnalytics.instance;
  }

  // ============================================================================
  // MONITORING CONTROL
  // ============================================================================

  public startMonitoring(interval: number = 5000): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    performanceMonitor.startMonitoring(1000);
    this.monitoringInterval = setInterval(() => {
      this.collectBoundariesMetrics();
    }, interval);
  }

  public stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  // ============================================================================
  // SEARCH PERFORMANCE TRACKING
  // ============================================================================

  public startSearchTracking(searchQuery: string, adminLevel?: GreekAdminLevel): string {
    const searchId = generateSearchId();
    this.searchMetrics.activeSearches.set(searchId, performance.now());
    console.debug(`🔍 Search tracking started: "${searchQuery}" (${adminLevel || 'all levels'})`);
    return searchId;
  }

  public endSearchTracking(searchId: string, resultCount: number, cacheHit: boolean = false, error?: Error): void {
    const startTime = this.searchMetrics.activeSearches.get(searchId);
    if (!startTime) return;

    const searchTime = performance.now() - startTime;
    this.searchMetrics.totalSearches++;
    this.searchMetrics.recentSearchTimes.push(searchTime);

    if (!error && resultCount > 0) this.searchMetrics.successfulSearches++;
    if (cacheHit) { this.cacheMetrics.hits++; } else { this.cacheMetrics.misses++; }

    if (this.searchMetrics.recentSearchTimes.length > 100) {
      this.searchMetrics.recentSearchTimes = this.searchMetrics.recentSearchTimes.slice(-50);
    }

    if (searchTime > this.thresholds.search.maxSearchTime) {
      this.createAlert({
        type: 'search',
        severity: searchTime > this.thresholds.search.maxSearchTime * 2 ? 'high' : 'medium',
        message: `Slow search detected: ${Math.round(searchTime)}ms`,
        metrics: { search: calculateSearchMetrics(this.searchMetrics, this.cacheMetrics, this.thresholds) },
        suggestion: cacheHit ? 'Consider cache optimization' : 'Consider query optimization or caching'
      });
    }

    this.searchMetrics.activeSearches.delete(searchId);
    console.debug(`✅ Search completed in ${Math.round(searchTime)}ms (${resultCount} results, cache: ${cacheHit})`);
  }

  // ============================================================================
  // API PERFORMANCE TRACKING
  // ============================================================================

  public startOverpassRequest(query: string): string {
    const requestId = generateRequestId();
    this.apiMetrics.activeRequests.set(requestId, performance.now());
    this.apiMetrics.totalRequests++;
    console.debug(`🌍 Overpass API request started: ${query.substring(0, 50)}...`);
    return requestId;
  }

  public endOverpassRequest(requestId: string, dataSize: number = 0, error?: Error): void {
    const startTime = this.apiMetrics.activeRequests.get(requestId);
    if (!startTime) return;

    const responseTime = performance.now() - startTime;
    this.apiMetrics.recentResponseTimes.push(responseTime);
    this.apiMetrics.totalDataSize += dataSize;
    if (error) this.apiMetrics.failedRequests++;

    if (this.apiMetrics.recentResponseTimes.length > 50) {
      this.apiMetrics.recentResponseTimes = this.apiMetrics.recentResponseTimes.slice(-25);
    }

    if (responseTime > this.thresholds.overpassApi.maxResponseTime) {
      this.createAlert({
        type: 'api',
        severity: responseTime > this.thresholds.overpassApi.maxResponseTime * 2 ? 'high' : 'medium',
        message: `Slow Overpass API response: ${Math.round(responseTime)}ms`,
        metrics: { overpassApi: calculateOverpassMetrics(this.apiMetrics) },
        suggestion: 'Check network conditions or simplify query'
      });
    }

    const failureRate = (this.apiMetrics.failedRequests / this.apiMetrics.totalRequests) * 100;
    if (failureRate > this.thresholds.overpassApi.maxFailureRate) {
      this.createAlert({
        type: 'api', severity: 'high',
        message: `High API failure rate: ${Math.round(failureRate)}%`,
        metrics: { overpassApi: calculateOverpassMetrics(this.apiMetrics) },
        suggestion: 'Check API status or implement retry logic'
      });
    }

    this.apiMetrics.activeRequests.delete(requestId);
    const status = error ? '❌ failed' : '✅ success';
    console.debug(`🌍 Overpass API ${status}: ${Math.round(responseTime)}ms (${dataSize} bytes)`);
  }

  // ============================================================================
  // BOUNDARY PROCESSING TRACKING
  // ============================================================================

  public recordBoundaryProcessing(
    boundaryCount: number, processingTime: number,
    averageGeometryPoints: number, _simplificationRatio: number = 0
  ): void {
    this.boundaryMetrics.processedCount += boundaryCount;
    this.boundaryMetrics.totalProcessingTime += processingTime;
    this.boundaryMetrics.totalGeometryPoints += averageGeometryPoints * boundaryCount;

    const avgProcessingTime = processingTime / boundaryCount;
    if (avgProcessingTime > this.thresholds.boundaries.maxProcessingTime) {
      this.createAlert({
        type: 'boundary',
        severity: avgProcessingTime > this.thresholds.boundaries.maxProcessingTime * 2 ? 'high' : 'medium',
        message: `Slow boundary processing: ${Math.round(avgProcessingTime)}ms per boundary`,
        metrics: { boundaries: calculateBoundaryMetrics(this.boundaryMetrics) },
        suggestion: 'Consider geometry simplification or processing optimization'
      });
    }

    console.debug(`🗺️ Processed ${boundaryCount} boundaries in ${Math.round(processingTime)}ms`);
  }

  public recordMapRendering(renderTime: number, layersCount: number, boundariesCount: number): void {
    this.boundaryMetrics.renderingTimes.push(renderTime);
    this.mapMetrics.layerUpdates++;
    this.mapMetrics.activeLayers = layersCount;
    this.mapMetrics.visibleBoundaries = boundariesCount;

    if (this.boundaryMetrics.renderingTimes.length > 50) {
      this.boundaryMetrics.renderingTimes = this.boundaryMetrics.renderingTimes.slice(-25);
    }

    if (renderTime > this.thresholds.boundaries.maxRenderTime) {
      this.createAlert({
        type: 'map',
        severity: renderTime > this.thresholds.boundaries.maxRenderTime * 2 ? 'high' : 'medium',
        message: `Slow map rendering: ${Math.round(renderTime)}ms`,
        metrics: { mapRendering: calculateMapMetrics(this.boundaryMetrics, this.mapMetrics) },
        suggestion: 'Consider reducing visible boundaries or layer optimization'
      });
    }

    console.debug(`🗺️ Map rendered in ${Math.round(renderTime)}ms (${boundariesCount} boundaries, ${layersCount} layers)`);
  }

  // ============================================================================
  // METRICS COLLECTION & THRESHOLDS
  // ============================================================================

  private collectBoundariesMetrics(): void {
    const metrics: AdminBoundariesMetrics = {
      timestamp: Date.now(),
      search: calculateSearchMetrics(this.searchMetrics, this.cacheMetrics, this.thresholds),
      overpassApi: calculateOverpassMetrics(this.apiMetrics),
      caching: calculateCachingMetrics(this.cacheMetrics),
      boundaries: calculateBoundaryMetrics(this.boundaryMetrics),
      mapRendering: calculateMapMetrics(this.boundaryMetrics, this.mapMetrics),
      userExperience: calculateUXMetrics(this.searchMetrics)
    };

    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory = this.metricsHistory.slice(-1000);
    }
    this.checkThresholds(metrics);
  }

  private checkThresholds(metrics: AdminBoundariesMetrics): void {
    if (metrics.search.searchSuccessRate < this.thresholds.search.minSuccessRate) {
      this.createAlert({
        type: 'search', severity: 'high',
        message: `Low search success rate: ${metrics.search.searchSuccessRate}%`,
        metrics: { search: metrics.search },
        suggestion: 'Check data quality or search algorithm'
      });
    }

    if (metrics.search.cacheHitRate < this.thresholds.search.minCacheHitRate) {
      this.createAlert({
        type: 'cache', severity: 'medium',
        message: `Low cache hit rate: ${metrics.search.cacheHitRate}%`,
        metrics: { caching: metrics.caching },
        suggestion: 'Optimize caching strategy or increase cache size'
      });
    }

    if (metrics.userExperience.searchLatency > this.thresholds.userExperience.maxSearchLatency) {
      this.createAlert({
        type: 'ux', severity: 'medium',
        message: `High search latency: ${metrics.userExperience.searchLatency}ms`,
        metrics: { userExperience: metrics.userExperience },
        suggestion: 'Optimize search debouncing or preloading'
      });
    }
  }

  // ============================================================================
  // ALERTS
  // ============================================================================

  private createAlert(alertData: Omit<AdminBoundariesAlert, 'id' | 'timestamp'>): void {
    const alert: AdminBoundariesAlert = {
      id: generateAlertId(),
      timestamp: Date.now(),
      ...alertData
    };

    this.alerts.unshift(alert);
    if (this.alerts.length > 100) this.alerts = this.alerts.slice(0, 100);

    const emoji = { 'low': '📝', 'medium': '⚠️', 'high': '🚨', 'critical': '🔥' }[alert.severity];
    console.debug(`${emoji} Admin Boundaries ${alert.severity.toUpperCase()}: ${alert.message}`);
    if (alert.suggestion) console.debug(`💡 Suggestion: ${alert.suggestion}`);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  public getMetrics(): AdminBoundariesMetrics[] { return [...this.metricsHistory]; }

  public getLatestMetrics(): AdminBoundariesMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  public getAlerts(severity?: AdminBoundariesAlert['severity']): AdminBoundariesAlert[] {
    return severity ? this.alerts.filter(a => a.severity === severity) : [...this.alerts];
  }

  public clearAlerts(): void {
    this.alerts = [];
    console.debug('🏛️ Administrative boundaries alerts cleared');
  }

  public updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.debug('🏛️ Performance thresholds updated');
  }

  public getPerformanceReport(): {
    summary: PerformanceReportSummary;
    recommendations: string[];
    criticalIssues: AdminBoundariesAlert[];
    topSlowQueries: Array<{ adminLevel: string; avgTime: number }>;
  } {
    const latest = this.getLatestMetrics();
    const criticalAlerts = this.getAlerts('critical');
    const highAlerts = this.getAlerts('high');
    const recommendations: string[] = [];

    if (latest) {
      if (latest.search.cacheHitRate < 80) recommendations.push('Improve caching strategy - current hit rate is below optimal');
      if (latest.overpassApi.averageResponseTime > 2000) recommendations.push('Optimize Overpass API queries - responses are slow');
      if (latest.boundaries.averageProcessingTime > 100) recommendations.push('Consider boundary geometry simplification');
      if (latest.mapRendering.averageLayerRenderTime > 50) recommendations.push('Optimize map layer rendering or reduce visible boundaries');
      if (latest.search.searchSuccessRate < 90) recommendations.push('Improve search algorithm or data quality');
    }

    return {
      summary: {
        totalSearches: latest?.search.totalSearches || 0,
        averageSearchTime: latest?.search.averageSearchTime || 0,
        cacheHitRate: latest?.search.cacheHitRate || 0,
        apiResponseTime: latest?.overpassApi.averageResponseTime || 0,
        boundariesProcessed: latest?.boundaries.processedBoundaries || 0,
        alertsCount: this.alerts.length,
        criticalAlertsCount: criticalAlerts.length
      },
      recommendations,
      criticalIssues: [...criticalAlerts, ...highAlerts],
      topSlowQueries: []
    };
  }

  public dispose(): void {
    this.stopMonitoring();
    this.metricsHistory = [];
    this.alerts = [];
    this.searchMetrics.activeSearches.clear();
    this.apiMetrics.activeRequests.clear();
    AdminBoundariesPerformanceAnalytics.instance = null;
    console.debug('🏛️ AdminBoundariesPerformanceAnalytics disposed');
  }
}

export const adminBoundariesAnalytics = AdminBoundariesPerformanceAnalytics.getInstance();
export default adminBoundariesAnalytics;
