/**
 * 🏛️ ADMINISTRATIVE BOUNDARIES PERFORMANCE ANALYTICS - Phase 7.1
 *
 * Enterprise performance monitoring συγκεκριμένα για το administrative boundaries system
 * Specialized metrics, caching analytics, API performance tracking
 *
 * @module services/performance/AdminBoundariesPerformanceAnalytics
 */

import { performanceMonitor } from '../../performance/monitoring/PerformanceMonitor';
import type {
  GreekAdminLevel
} from '../../types/administrative-types';
import { generateSearchId, generateRequestId, generateAlertId } from '@/services/enterprise-id.service';

// ============================================================================
// ADMINISTRATIVE BOUNDARIES SPECIFIC TYPES
// ============================================================================

// 🏢 ENTERPRISE: Performance Report Summary interface
export interface PerformanceReportSummary {
  totalSearches: number;
  averageSearchTime: number;
  cacheHitRate: number;
  apiResponseTime: number;
  boundariesProcessed: number;
  alertsCount: number;
  criticalAlertsCount: number;
}

export interface AdminBoundariesMetrics {
  timestamp: number;

  // Search Performance
  search: {
    totalSearches: number;
    averageSearchTime: number;
    searchSuccessRate: number;
    cacheHitRate: number;
    slowSearches: number; // > 2 seconds
  };

  // API Performance
  overpassApi: {
    totalRequests: number;
    averageResponseTime: number;
    failedRequests: number;
    rateLimitHits: number;
    dataSize: number; // Total bytes received
    queriesPerMinute: number;
  };

  // Caching Performance
  caching: {
    totalCacheSize: number; // MB
    cacheHitRatio: number;
    cacheMisses: number;
    evictedEntries: number;
    averageCacheAge: number; // minutes
  };

  // Boundary Processing
  boundaries: {
    processedBoundaries: number;
    averageProcessingTime: number;
    geometryComplexity: number; // Average points per boundary
    simplificationSavings: number; // % reduction
    renderingTime: number; // ms to render boundaries
  };

  // Map Performance
  mapRendering: {
    layerUpdates: number;
    averageLayerRenderTime: number;
    boundaryLayersActive: number;
    visibleBoundariesCount: number;
    mapFrameDrops: number;
  };

  // User Experience
  userExperience: {
    searchLatency: number; // Time from input to first result
    suggestionLatency: number; // Time to show suggestions
    mapInteractionLatency: number; // Click to boundary highlight
    totalUserSessions: number;
  };
}

export interface AdminBoundariesAlert {
  id: string;
  type: 'search' | 'api' | 'cache' | 'boundary' | 'map' | 'ux';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metrics: Partial<AdminBoundariesMetrics>;
  suggestion?: string;
  adminLevel?: GreekAdminLevel;
  affectedQuery?: string;
}

export interface PerformanceThresholds {
  search: {
    maxSearchTime: number; // ms
    minSuccessRate: number; // %
    minCacheHitRate: number; // %
  };
  overpassApi: {
    maxResponseTime: number; // ms
    maxFailureRate: number; // %
    maxQueriesPerMinute: number;
  };
  boundaries: {
    maxProcessingTime: number; // ms
    maxGeometryComplexity: number; // points
    maxRenderTime: number; // ms
  };
  userExperience: {
    maxSearchLatency: number; // ms
    maxSuggestionLatency: number; // ms
    maxMapInteractionLatency: number; // ms
  };
}

// ============================================================================
// ADMIN BOUNDARIES PERFORMANCE ANALYTICS CLASS
// ============================================================================

/**
 * Specialized Performance Analytics για Administrative Boundaries System
 * Extends the general PerformanceMonitor με domain-specific metrics
 */
export class AdminBoundariesPerformanceAnalytics {

  private static instance: AdminBoundariesPerformanceAnalytics | null = null;

  private isMonitoring: boolean = false;
  private metricsHistory: AdminBoundariesMetrics[] = [];
  private alerts: AdminBoundariesAlert[] = [];
  private thresholds: PerformanceThresholds;

  // Real-time tracking
  private searchMetrics = {
    activeSearches: new Map<string, number>(), // searchId -> startTime
    recentSearchTimes: new Array<number>(),
    totalSearches: 0,
    successfulSearches: 0
  };

  private apiMetrics = {
    activeRequests: new Map<string, number>(), // requestId -> startTime
    recentResponseTimes: new Array<number>(),
    totalRequests: 0,
    failedRequests: 0,
    totalDataSize: 0
  };

  private cacheMetrics = {
    hits: 0,
    misses: 0,
    size: 0,
    evictions: 0
  };

  private boundaryMetrics = {
    processedCount: 0,
    totalProcessingTime: 0,
    totalGeometryPoints: 0,
    renderingTimes: new Array<number>()
  };

  private mapMetrics = {
    layerUpdates: 0,
    frameDrops: 0,
    activeLayers: 0,
    visibleBoundaries: 0
  };

  private monitoringInterval: NodeJS.Timeout | null = null;

  // ============================================================================
  // SINGLETON PATTERN
  // ============================================================================

  private constructor() {
    this.thresholds = this.getDefaultThresholds();
    console.log('🏛️ AdminBoundariesPerformanceAnalytics initialized');
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

    // Start general performance monitoring
    performanceMonitor.startMonitoring(1000);

    // Start specialized boundaries monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectBoundariesMetrics();
    }, interval);

    // console.log('🏛️ Administrative Boundaries Performance Monitoring started'); // DISABLED - προκαλούσε loops
  }

  public stopMonitoring(): void {
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // console.log('🏛️ Administrative Boundaries Performance Monitoring stopped'); // DISABLED - προκαλούσε loops
  }

  // ============================================================================
  // SEARCH PERFORMANCE TRACKING
  // ============================================================================

  /**
   * Record the start of a search operation
   */
  public startSearchTracking(searchQuery: string, adminLevel?: GreekAdminLevel): string {
    const searchId = generateSearchId();
    const startTime = performance.now();

    this.searchMetrics.activeSearches.set(searchId, startTime);

    console.log(`🔍 Search tracking started: "${searchQuery}" (${adminLevel || 'all levels'})`);
    return searchId;
  }

  /**
   * Record search completion
   */
  public endSearchTracking(
    searchId: string,
    resultCount: number,
    cacheHit: boolean = false,
    error?: Error
  ): void {
    const startTime = this.searchMetrics.activeSearches.get(searchId);
    if (!startTime) return;

    const endTime = performance.now();
    const searchTime = endTime - startTime;

    // Update metrics
    this.searchMetrics.totalSearches++;
    this.searchMetrics.recentSearchTimes.push(searchTime);

    if (!error && resultCount > 0) {
      this.searchMetrics.successfulSearches++;
    }

    if (cacheHit) {
      this.cacheMetrics.hits++;
    } else {
      this.cacheMetrics.misses++;
    }

    // Limit history size
    if (this.searchMetrics.recentSearchTimes.length > 100) {
      this.searchMetrics.recentSearchTimes = this.searchMetrics.recentSearchTimes.slice(-50);
    }

    // Check για slow searches
    if (searchTime > this.thresholds.search.maxSearchTime) {
      this.createAlert({
        type: 'search',
        severity: searchTime > this.thresholds.search.maxSearchTime * 2 ? 'high' : 'medium',
        message: `Slow search detected: ${Math.round(searchTime)}ms`,
        metrics: { search: this.calculateSearchMetrics() },
        suggestion: cacheHit ? 'Consider cache optimization' : 'Consider query optimization or caching'
      });
    }

    // Cleanup
    this.searchMetrics.activeSearches.delete(searchId);

    console.log(`✅ Search completed in ${Math.round(searchTime)}ms (${resultCount} results, cache: ${cacheHit})`);
  }

  // ============================================================================
  // API PERFORMANCE TRACKING
  // ============================================================================

  /**
   * Record Overpass API request start
   */
  public startOverpassRequest(query: string): string {
    const requestId = generateRequestId();
    const startTime = performance.now();

    this.apiMetrics.activeRequests.set(requestId, startTime);
    this.apiMetrics.totalRequests++;

    console.log(`🌍 Overpass API request started: ${query.substring(0, 50)}...`);
    return requestId;
  }

  /**
   * Record Overpass API request completion
   */
  public endOverpassRequest(
    requestId: string,
    dataSize: number = 0,
    error?: Error
  ): void {
    const startTime = this.apiMetrics.activeRequests.get(requestId);
    if (!startTime) return;

    const endTime = performance.now();
    const responseTime = endTime - startTime;

    // Update metrics
    this.apiMetrics.recentResponseTimes.push(responseTime);
    this.apiMetrics.totalDataSize += dataSize;

    if (error) {
      this.apiMetrics.failedRequests++;
    }

    // Limit history size
    if (this.apiMetrics.recentResponseTimes.length > 50) {
      this.apiMetrics.recentResponseTimes = this.apiMetrics.recentResponseTimes.slice(-25);
    }

    // Check για slow API responses
    if (responseTime > this.thresholds.overpassApi.maxResponseTime) {
      this.createAlert({
        type: 'api',
        severity: responseTime > this.thresholds.overpassApi.maxResponseTime * 2 ? 'high' : 'medium',
        message: `Slow Overpass API response: ${Math.round(responseTime)}ms`,
        metrics: { overpassApi: this.calculateOverpassMetrics() },
        suggestion: 'Check network conditions or simplify query'
      });
    }

    // Check failure rate
    const failureRate = (this.apiMetrics.failedRequests / this.apiMetrics.totalRequests) * 100;
    if (failureRate > this.thresholds.overpassApi.maxFailureRate) {
      this.createAlert({
        type: 'api',
        severity: 'high',
        message: `High API failure rate: ${Math.round(failureRate)}%`,
        metrics: { overpassApi: this.calculateOverpassMetrics() },
        suggestion: 'Check API status or implement retry logic'
      });
    }

    // Cleanup
    this.apiMetrics.activeRequests.delete(requestId);

    const status = error ? '❌ failed' : '✅ success';
    console.log(`🌍 Overpass API ${status}: ${Math.round(responseTime)}ms (${dataSize} bytes)`);
  }

  // ============================================================================
  // BOUNDARY PROCESSING TRACKING
  // ============================================================================

  /**
   * Record boundary processing performance
   */
  public recordBoundaryProcessing(
    boundaryCount: number,
    processingTime: number,
    averageGeometryPoints: number,
    simplificationRatio: number = 0
  ): void {
    this.boundaryMetrics.processedCount += boundaryCount;
    this.boundaryMetrics.totalProcessingTime += processingTime;
    this.boundaryMetrics.totalGeometryPoints += averageGeometryPoints * boundaryCount;

    const avgProcessingTime = processingTime / boundaryCount;

    // Check για slow boundary processing
    if (avgProcessingTime > this.thresholds.boundaries.maxProcessingTime) {
      this.createAlert({
        type: 'boundary',
        severity: avgProcessingTime > this.thresholds.boundaries.maxProcessingTime * 2 ? 'high' : 'medium',
        message: `Slow boundary processing: ${Math.round(avgProcessingTime)}ms per boundary`,
        metrics: { boundaries: this.calculateBoundaryMetrics() },
        suggestion: 'Consider geometry simplification or processing optimization'
      });
    }

    console.log(`🗺️ Processed ${boundaryCount} boundaries in ${Math.round(processingTime)}ms`);
  }

  /**
   * Record map rendering performance
   */
  public recordMapRendering(renderTime: number, layersCount: number, boundariesCount: number): void {
    this.boundaryMetrics.renderingTimes.push(renderTime);
    this.mapMetrics.layerUpdates++;
    this.mapMetrics.activeLayers = layersCount;
    this.mapMetrics.visibleBoundaries = boundariesCount;

    // Limit history
    if (this.boundaryMetrics.renderingTimes.length > 50) {
      this.boundaryMetrics.renderingTimes = this.boundaryMetrics.renderingTimes.slice(-25);
    }

    // Check για slow rendering
    if (renderTime > this.thresholds.boundaries.maxRenderTime) {
      this.createAlert({
        type: 'map',
        severity: renderTime > this.thresholds.boundaries.maxRenderTime * 2 ? 'high' : 'medium',
        message: `Slow map rendering: ${Math.round(renderTime)}ms`,
        metrics: { mapRendering: this.calculateMapMetrics() },
        suggestion: 'Consider reducing visible boundaries or layer optimization'
      });
    }

    console.log(`🗺️ Map rendered in ${Math.round(renderTime)}ms (${boundariesCount} boundaries, ${layersCount} layers)`);
  }

  // ============================================================================
  // METRICS CALCULATION
  // ============================================================================

  private collectBoundariesMetrics(): void {
    const metrics: AdminBoundariesMetrics = {
      timestamp: Date.now(),
      search: this.calculateSearchMetrics(),
      overpassApi: this.calculateOverpassMetrics(),
      caching: this.calculateCachingMetrics(),
      boundaries: this.calculateBoundaryMetrics(),
      mapRendering: this.calculateMapMetrics(),
      userExperience: this.calculateUXMetrics()
    };

    this.metricsHistory.push(metrics);

    // Keep only last 1000 entries (about 1.4 hours at 5s intervals)
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory = this.metricsHistory.slice(-1000);
    }

    // Check thresholds
    this.checkThresholds(metrics);
  }

  private calculateSearchMetrics(): AdminBoundariesMetrics['search'] {
    const recentTimes = this.searchMetrics.recentSearchTimes;
    const avgTime = recentTimes.length > 0
      ? recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length
      : 0;

    const successRate = this.searchMetrics.totalSearches > 0
      ? (this.searchMetrics.successfulSearches / this.searchMetrics.totalSearches) * 100
      : 0;

    const totalCacheRequests = this.cacheMetrics.hits + this.cacheMetrics.misses;
    const cacheHitRate = totalCacheRequests > 0
      ? (this.cacheMetrics.hits / totalCacheRequests) * 100
      : 0;

    const slowSearches = recentTimes.filter(time => time > this.thresholds.search.maxSearchTime).length;

    return {
      totalSearches: this.searchMetrics.totalSearches,
      averageSearchTime: Math.round(avgTime),
      searchSuccessRate: Math.round(successRate),
      cacheHitRate: Math.round(cacheHitRate),
      slowSearches
    };
  }

  private calculateOverpassMetrics(): AdminBoundariesMetrics['overpassApi'] {
    const recentTimes = this.apiMetrics.recentResponseTimes;
    const avgResponseTime = recentTimes.length > 0
      ? recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length
      : 0;

    const failureRate = this.apiMetrics.totalRequests > 0
      ? (this.apiMetrics.failedRequests / this.apiMetrics.totalRequests) * 100
      : 0;

    // Calculate requests per minute (approximate based on recent activity)
    const recentMinute = Date.now() - 60000;
    const recentRequestsCount = Math.min(this.apiMetrics.totalRequests, 10); // Rough estimate

    return {
      totalRequests: this.apiMetrics.totalRequests,
      averageResponseTime: Math.round(avgResponseTime),
      failedRequests: this.apiMetrics.failedRequests,
      rateLimitHits: 0, // Would need specific tracking
      dataSize: Math.round(this.apiMetrics.totalDataSize / 1024 / 1024), // MB
      queriesPerMinute: recentRequestsCount
    };
  }

  private calculateCachingMetrics(): AdminBoundariesMetrics['caching'] {
    const totalRequests = this.cacheMetrics.hits + this.cacheMetrics.misses;
    const hitRatio = totalRequests > 0 ? (this.cacheMetrics.hits / totalRequests) * 100 : 0;

    return {
      totalCacheSize: Math.round(this.cacheMetrics.size / 1024 / 1024), // MB
      cacheHitRatio: Math.round(hitRatio),
      cacheMisses: this.cacheMetrics.misses,
      evictedEntries: this.cacheMetrics.evictions,
      averageCacheAge: 0 // Would need timestamp tracking
    };
  }

  private calculateBoundaryMetrics(): AdminBoundariesMetrics['boundaries'] {
    const avgProcessingTime = this.boundaryMetrics.processedCount > 0
      ? this.boundaryMetrics.totalProcessingTime / this.boundaryMetrics.processedCount
      : 0;

    const avgGeometryComplexity = this.boundaryMetrics.processedCount > 0
      ? this.boundaryMetrics.totalGeometryPoints / this.boundaryMetrics.processedCount
      : 0;

    const avgRenderTime = this.boundaryMetrics.renderingTimes.length > 0
      ? this.boundaryMetrics.renderingTimes.reduce((sum, time) => sum + time, 0) / this.boundaryMetrics.renderingTimes.length
      : 0;

    return {
      processedBoundaries: this.boundaryMetrics.processedCount,
      averageProcessingTime: Math.round(avgProcessingTime),
      geometryComplexity: Math.round(avgGeometryComplexity),
      simplificationSavings: 0, // Would need specific tracking
      renderingTime: Math.round(avgRenderTime)
    };
  }

  private calculateMapMetrics(): AdminBoundariesMetrics['mapRendering'] {
    const avgRenderTime = this.boundaryMetrics.renderingTimes.length > 0
      ? this.boundaryMetrics.renderingTimes.reduce((sum, time) => sum + time, 0) / this.boundaryMetrics.renderingTimes.length
      : 0;

    return {
      layerUpdates: this.mapMetrics.layerUpdates,
      averageLayerRenderTime: Math.round(avgRenderTime),
      boundaryLayersActive: this.mapMetrics.activeLayers,
      visibleBoundariesCount: this.mapMetrics.visibleBoundaries,
      mapFrameDrops: this.mapMetrics.frameDrops
    };
  }

  private calculateUXMetrics(): AdminBoundariesMetrics['userExperience'] {
    const searchLatency = this.searchMetrics.recentSearchTimes.length > 0
      ? Math.min(...this.searchMetrics.recentSearchTimes)
      : 0;

    return {
      searchLatency: Math.round(searchLatency),
      suggestionLatency: 0, // Would need specific tracking
      mapInteractionLatency: 0, // Would need specific tracking
      totalUserSessions: 1 // Would need session tracking
    };
  }

  // ============================================================================
  // THRESHOLD CHECKING & ALERTS
  // ============================================================================

  private checkThresholds(metrics: AdminBoundariesMetrics): void {
    // Search performance thresholds
    if (metrics.search.searchSuccessRate < this.thresholds.search.minSuccessRate) {
      this.createAlert({
        type: 'search',
        severity: 'high',
        message: `Low search success rate: ${metrics.search.searchSuccessRate}%`,
        metrics: { search: metrics.search },
        suggestion: 'Check data quality or search algorithm'
      });
    }

    if (metrics.search.cacheHitRate < this.thresholds.search.minCacheHitRate) {
      this.createAlert({
        type: 'cache',
        severity: 'medium',
        message: `Low cache hit rate: ${metrics.search.cacheHitRate}%`,
        metrics: { caching: metrics.caching },
        suggestion: 'Optimize caching strategy or increase cache size'
      });
    }

    // User experience thresholds
    if (metrics.userExperience.searchLatency > this.thresholds.userExperience.maxSearchLatency) {
      this.createAlert({
        type: 'ux',
        severity: 'medium',
        message: `High search latency: ${metrics.userExperience.searchLatency}ms`,
        metrics: { userExperience: metrics.userExperience },
        suggestion: 'Optimize search debouncing or preloading'
      });
    }
  }

  private createAlert(alertData: Omit<AdminBoundariesAlert, 'id' | 'timestamp'>): void {
    const alert: AdminBoundariesAlert = {
      id: generateAlertId(),
      timestamp: Date.now(),
      ...alertData
    };

    this.alerts.unshift(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }

    // Log alerts
    const emoji = {
      'low': '📝',
      'medium': '⚠️',
      'high': '🚨',
      'critical': '🔥'
    }[alert.severity];

    console.log(`${emoji} Admin Boundaries ${alert.severity.toUpperCase()}: ${alert.message}`);
    if (alert.suggestion) {
      console.log(`💡 Suggestion: ${alert.suggestion}`);
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  public getMetrics(): AdminBoundariesMetrics[] {
    return [...this.metricsHistory];
  }

  public getLatestMetrics(): AdminBoundariesMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  public getAlerts(severity?: AdminBoundariesAlert['severity']): AdminBoundariesAlert[] {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity);
    }
    return [...this.alerts];
  }

  public clearAlerts(): void {
    this.alerts = [];
    console.log('🏛️ Administrative boundaries alerts cleared');
  }

  public updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('🏛️ Performance thresholds updated');
  }

  // 🏢 ENTERPRISE: Proper return type instead of any
  public getPerformanceReport(): {
    summary: PerformanceReportSummary;
    recommendations: string[];
    criticalIssues: AdminBoundariesAlert[];
    topSlowQueries: Array<{adminLevel: string; avgTime: number;}>;
  } {
    const latest = this.getLatestMetrics();
    const criticalAlerts = this.getAlerts('critical');
    const highAlerts = this.getAlerts('high');

    const recommendations: string[] = [];

    if (latest) {
      // Generate recommendations based on metrics
      if (latest.search.cacheHitRate < 80) {
        recommendations.push('Improve caching strategy - current hit rate is below optimal');
      }

      if (latest.overpassApi.averageResponseTime > 2000) {
        recommendations.push('Optimize Overpass API queries - responses are slow');
      }

      if (latest.boundaries.averageProcessingTime > 100) {
        recommendations.push('Consider boundary geometry simplification');
      }

      if (latest.mapRendering.averageLayerRenderTime > 50) {
        recommendations.push('Optimize map layer rendering or reduce visible boundaries');
      }

      if (latest.search.searchSuccessRate < 90) {
        recommendations.push('Improve search algorithm or data quality');
      }
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
      topSlowQueries: [] // Would need query-specific tracking
    };
  }

  // ============================================================================
  // DEFAULTS & CLEANUP
  // ============================================================================

  private getDefaultThresholds(): PerformanceThresholds {
    return {
      search: {
        maxSearchTime: 2000, // 2 seconds
        minSuccessRate: 85, // 85%
        minCacheHitRate: 70 // 70%
      },
      overpassApi: {
        maxResponseTime: 3000, // 3 seconds
        maxFailureRate: 10, // 10%
        maxQueriesPerMinute: 60
      },
      boundaries: {
        maxProcessingTime: 100, // 100ms per boundary
        maxGeometryComplexity: 1000, // 1000 points
        maxRenderTime: 50 // 50ms
      },
      userExperience: {
        maxSearchLatency: 300, // 300ms
        maxSuggestionLatency: 150, // 150ms
        maxMapInteractionLatency: 100 // 100ms
      }
    };
  }

  public dispose(): void {
    this.stopMonitoring();
    this.metricsHistory = [];
    this.alerts = [];
    this.searchMetrics.activeSearches.clear();
    this.apiMetrics.activeRequests.clear();
    AdminBoundariesPerformanceAnalytics.instance = null;
    console.log('🏛️ AdminBoundariesPerformanceAnalytics disposed');
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Singleton instance για Administrative Boundaries Performance Analytics
 */
export const adminBoundariesAnalytics = AdminBoundariesPerformanceAnalytics.getInstance();
export default adminBoundariesAnalytics;