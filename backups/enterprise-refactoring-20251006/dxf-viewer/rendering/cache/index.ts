/**
 * CACHE MODULE - Public API exports
 * ✅ ΦΑΣΗ 5: Performance caching systems
 */

// Path caching
export {
  PathCache,
  createPathCache,
  getGlobalPathCache,
  setGlobalPathCache
} from './PathCache';

// Text metrics caching
export {
  TextMetricsCache,
  createTextMetricsCache,
  getGlobalTextCache
} from './TextMetricsCache';

// Types
export type {
  CacheEntry,
  CacheStats,
  CacheOptions
} from './PathCache';

export type {
  TextMetrics,
  CachedTextMetrics,
  TextCacheOptions
} from './TextMetricsCache';