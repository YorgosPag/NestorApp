/**
 * CACHE TYPES & INTERFACES
 *
 * Type definitions for Administrative Boundaries Cache System
 *
 * @module services/cache/cache-types
 * Extracted from AdminBoundariesCacheManager.ts (ADR-065 Phase 3, #15)
 */

import type { GreekAdminLevel } from '../../types/administrative-types';

// ============================================================================
// CACHE ENTRY & CONFIG
// ============================================================================

export interface CacheReportSummary {
  totalEntries: number;
  hitRate: number;
  memoryUsed: number;
  evictions: number;
  persistedEntries: number;
}

export interface CacheReportPerformance {
  avgAccessTime: number;
  avgWriteTime: number;
  slowQueries: number;
}

export interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  ttl: number;
  priority: 'high' | 'medium' | 'low';
  adminLevel?: GreekAdminLevel;
  region?: string;
  tags: string[];
}

export interface CacheConfig {
  maxSize: number;
  maxEntries: number;
  defaultTTL: number;
  enablePersistence: boolean;
  enablePrefetching: boolean;
  enableCompression: boolean;
  compressionThreshold: number;
}

export interface CacheStatistics {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  persistedEntries: number;
  memoryUsage: {
    used: number;
    available: number;
    utilization: number;
  };
  performance: {
    averageAccessTime: number;
    averageWriteTime: number;
    slowQueries: number;
  };
}

export interface PrefetchStrategy {
  enabled: boolean;
  triggerThreshold: number;
  maxConcurrentPrefetches: number;
  prefetchRadius: number;
  popularBoundaries: string[];
  contextualPrefetch: boolean;
}

export interface CacheSetOptions {
  ttl?: number;
  priority?: 'high' | 'medium' | 'low';
  adminLevel?: GreekAdminLevel;
  region?: string;
  tags?: string[];
  persistToDisk?: boolean;
}
