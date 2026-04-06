/**
 * 🏛️ ADMINISTRATIVE BOUNDARIES PERFORMANCE ANALYTICS — TYPES
 *
 * Type definitions for admin boundaries performance monitoring.
 * Extracted from AdminBoundariesPerformanceAnalytics.ts (ADR-065 SRP).
 */

import type { GreekAdminLevel } from '../../types/administrative-types';

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

  search: {
    totalSearches: number;
    averageSearchTime: number;
    searchSuccessRate: number;
    cacheHitRate: number;
    slowSearches: number;
  };

  overpassApi: {
    totalRequests: number;
    averageResponseTime: number;
    failedRequests: number;
    rateLimitHits: number;
    dataSize: number;
    queriesPerMinute: number;
  };

  caching: {
    totalCacheSize: number;
    cacheHitRatio: number;
    cacheMisses: number;
    evictedEntries: number;
    averageCacheAge: number;
  };

  boundaries: {
    processedBoundaries: number;
    averageProcessingTime: number;
    geometryComplexity: number;
    simplificationSavings: number;
    renderingTime: number;
  };

  mapRendering: {
    layerUpdates: number;
    averageLayerRenderTime: number;
    boundaryLayersActive: number;
    visibleBoundariesCount: number;
    mapFrameDrops: number;
  };

  userExperience: {
    searchLatency: number;
    suggestionLatency: number;
    mapInteractionLatency: number;
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
    maxSearchTime: number;
    minSuccessRate: number;
    minCacheHitRate: number;
  };
  overpassApi: {
    maxResponseTime: number;
    maxFailureRate: number;
    maxQueriesPerMinute: number;
  };
  boundaries: {
    maxProcessingTime: number;
    maxGeometryComplexity: number;
    maxRenderTime: number;
  };
  userExperience: {
    maxSearchLatency: number;
    maxSuggestionLatency: number;
    maxMapInteractionLatency: number;
  };
}

/** Raw search tracking state */
export interface SearchTrackingState {
  activeSearches: Map<string, number>;
  recentSearchTimes: number[];
  totalSearches: number;
  successfulSearches: number;
}

/** Raw API tracking state */
export interface ApiTrackingState {
  activeRequests: Map<string, number>;
  recentResponseTimes: number[];
  totalRequests: number;
  failedRequests: number;
  totalDataSize: number;
}

/** Raw cache tracking state */
export interface CacheTrackingState {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
}

/** Raw boundary tracking state */
export interface BoundaryTrackingState {
  processedCount: number;
  totalProcessingTime: number;
  totalGeometryPoints: number;
  renderingTimes: number[];
}

/** Raw map tracking state */
export interface MapTrackingState {
  layerUpdates: number;
  frameDrops: number;
  activeLayers: number;
  visibleBoundaries: number;
}
