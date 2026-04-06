/**
 * 🏛️ ADMINISTRATIVE BOUNDARIES — METRICS CALCULATORS
 *
 * Pure functions for calculating analytics metrics from raw tracking state.
 * Extracted from AdminBoundariesPerformanceAnalytics.ts (ADR-065 SRP).
 */

import type {
  AdminBoundariesMetrics,
  SearchTrackingState,
  ApiTrackingState,
  CacheTrackingState,
  BoundaryTrackingState,
  MapTrackingState,
  PerformanceThresholds
} from './admin-boundaries-analytics-types';

export function calculateSearchMetrics(
  searchState: SearchTrackingState,
  cacheState: CacheTrackingState,
  thresholds: PerformanceThresholds
): AdminBoundariesMetrics['search'] {
  const recentTimes = searchState.recentSearchTimes;
  const avgTime = recentTimes.length > 0
    ? recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length
    : 0;

  const successRate = searchState.totalSearches > 0
    ? (searchState.successfulSearches / searchState.totalSearches) * 100
    : 0;

  const totalCacheRequests = cacheState.hits + cacheState.misses;
  const cacheHitRate = totalCacheRequests > 0
    ? (cacheState.hits / totalCacheRequests) * 100
    : 0;

  const slowSearches = recentTimes.filter(time => time > thresholds.search.maxSearchTime).length;

  return {
    totalSearches: searchState.totalSearches,
    averageSearchTime: Math.round(avgTime),
    searchSuccessRate: Math.round(successRate),
    cacheHitRate: Math.round(cacheHitRate),
    slowSearches
  };
}

export function calculateOverpassMetrics(
  apiState: ApiTrackingState
): AdminBoundariesMetrics['overpassApi'] {
  const recentTimes = apiState.recentResponseTimes;
  const avgResponseTime = recentTimes.length > 0
    ? recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length
    : 0;

  const recentRequestsCount = Math.min(apiState.totalRequests, 10);

  return {
    totalRequests: apiState.totalRequests,
    averageResponseTime: Math.round(avgResponseTime),
    failedRequests: apiState.failedRequests,
    rateLimitHits: 0,
    dataSize: Math.round(apiState.totalDataSize / 1024 / 1024),
    queriesPerMinute: recentRequestsCount
  };
}

export function calculateCachingMetrics(
  cacheState: CacheTrackingState
): AdminBoundariesMetrics['caching'] {
  const totalRequests = cacheState.hits + cacheState.misses;
  const hitRatio = totalRequests > 0 ? (cacheState.hits / totalRequests) * 100 : 0;

  return {
    totalCacheSize: Math.round(cacheState.size / 1024 / 1024),
    cacheHitRatio: Math.round(hitRatio),
    cacheMisses: cacheState.misses,
    evictedEntries: cacheState.evictions,
    averageCacheAge: 0
  };
}

export function calculateBoundaryMetrics(
  boundaryState: BoundaryTrackingState
): AdminBoundariesMetrics['boundaries'] {
  const avgProcessingTime = boundaryState.processedCount > 0
    ? boundaryState.totalProcessingTime / boundaryState.processedCount
    : 0;

  const avgGeometryComplexity = boundaryState.processedCount > 0
    ? boundaryState.totalGeometryPoints / boundaryState.processedCount
    : 0;

  const avgRenderTime = boundaryState.renderingTimes.length > 0
    ? boundaryState.renderingTimes.reduce((sum, time) => sum + time, 0) / boundaryState.renderingTimes.length
    : 0;

  return {
    processedBoundaries: boundaryState.processedCount,
    averageProcessingTime: Math.round(avgProcessingTime),
    geometryComplexity: Math.round(avgGeometryComplexity),
    simplificationSavings: 0,
    renderingTime: Math.round(avgRenderTime)
  };
}

export function calculateMapMetrics(
  boundaryState: BoundaryTrackingState,
  mapState: MapTrackingState
): AdminBoundariesMetrics['mapRendering'] {
  const avgRenderTime = boundaryState.renderingTimes.length > 0
    ? boundaryState.renderingTimes.reduce((sum, time) => sum + time, 0) / boundaryState.renderingTimes.length
    : 0;

  return {
    layerUpdates: mapState.layerUpdates,
    averageLayerRenderTime: Math.round(avgRenderTime),
    boundaryLayersActive: mapState.activeLayers,
    visibleBoundariesCount: mapState.visibleBoundaries,
    mapFrameDrops: mapState.frameDrops
  };
}

export function calculateUXMetrics(
  searchState: SearchTrackingState
): AdminBoundariesMetrics['userExperience'] {
  const searchLatency = searchState.recentSearchTimes.length > 0
    ? Math.min(...searchState.recentSearchTimes)
    : 0;

  return {
    searchLatency: Math.round(searchLatency),
    suggestionLatency: 0,
    mapInteractionLatency: 0,
    totalUserSessions: 1
  };
}

/** Default performance thresholds */
export function getDefaultThresholds(): PerformanceThresholds {
  return {
    search: {
      maxSearchTime: 2000,
      minSuccessRate: 85,
      minCacheHitRate: 70
    },
    overpassApi: {
      maxResponseTime: 3000,
      maxFailureRate: 10,
      maxQueriesPerMinute: 60
    },
    boundaries: {
      maxProcessingTime: 100,
      maxGeometryComplexity: 1000,
      maxRenderTime: 50
    },
    userExperience: {
      maxSearchLatency: 300,
      maxSuggestionLatency: 150,
      maxMapInteractionLatency: 100
    }
  };
}
