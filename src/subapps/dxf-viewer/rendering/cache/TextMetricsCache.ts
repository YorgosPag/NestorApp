/**
 * TEXT METRICS CACHE - Caching για text measurements
 * ✅ ΦΑΣΗ 5: Βελτιστοποίηση text rendering performance
 *
 * 🏢 ADR-107: Uses centralized TEXT_METRICS_RATIOS for fallback calculations
 * 🏢 ADR-113: Uses centralized CACHE_TIMING for TTL constants
 */

// 🏢 ADR-107: Centralized Text Metrics Ratios
import { TEXT_METRICS_RATIOS } from '../../config/text-rendering-config';
// 🏢 ADR-113: Centralized Cache Timing Constants
import { CACHE_TIMING } from '../../config/timing-config';

export interface TextMetrics {
  width: number;
  height: number;
  actualBoundingBoxLeft: number;
  actualBoundingBoxRight: number;
  actualBoundingBoxAscent: number;
  actualBoundingBoxDescent: number;
}

export interface CachedTextMetrics extends TextMetrics {
  text: string;
  font: string;
  fontSize: number;
  fontFamily: string;
  lastAccessed: number;
  accessCount: number;
}

export interface TextCacheOptions {
  maxEntries?: number;
  ttlMs?: number;
  enableMeasurement?: boolean;
}

/**
 * 🔺 TEXT METRICS CACHE
 * Cache για expensive text measurement operations
 */
export class TextMetricsCache {
  private cache = new Map<string, CachedTextMetrics>();
  private options: Required<TextCacheOptions>;
  private context: CanvasRenderingContext2D | null = null;

  // Statistics
  private stats = {
    hitCount: 0,
    missCount: 0,
    measurementCount: 0
  };

  constructor(options: TextCacheOptions = {}) {
    this.options = {
      maxEntries: options.maxEntries || 500,
      // 🏢 ADR-113: Centralized cache timing
      ttlMs: options.ttlMs || CACHE_TIMING.DEFAULT_TTL_MS,
      enableMeasurement: options.enableMeasurement !== false
    };

    // Create measurement context
    if (this.options.enableMeasurement && typeof window !== 'undefined') {
      const canvas = document.createElement('canvas');
      this.context = canvas.getContext('2d');
    }
  }

  /**
   * 🔺 GET TEXT METRICS
   * Επιστρέφει cached ή calculated text metrics
   */
  getTextMetrics(text: string, font: string, fontSize: number, fontFamily: string): TextMetrics {
    const key = this.generateKey(text, font, fontSize, fontFamily);
    const cached = this.cache.get(key);

    // Check cache hit
    if (cached && !this.isExpired(cached)) {
      cached.lastAccessed = Date.now();
      cached.accessCount++;
      this.stats.hitCount++;
      return cached;
    }

    // Cache miss - calculate metrics
    this.stats.missCount++;
    const metrics = this.measureText(text, font, fontSize, fontFamily);

    // Store in cache
    const cachedMetrics: CachedTextMetrics = {
      ...metrics,
      text,
      font,
      fontSize,
      fontFamily,
      lastAccessed: Date.now(),
      accessCount: 1
    };

    this.set(key, cachedMetrics);
    return metrics;
  }

  /**
   * 🔺 MEASURE TEXT
   * Πραγματική μέτρηση text με Canvas API
   */
  private measureText(text: string, font: string, fontSize: number, fontFamily: string): TextMetrics {
    if (!this.context) {
      // Fallback estimation
      return this.estimateTextMetrics(text, fontSize);
    }

    this.stats.measurementCount++;

    // Set font για accurate measurement
    this.context.font = `${fontSize}px ${fontFamily}`;
    const nativeMetrics = this.context.measureText(text);

    return {
      width: nativeMetrics.width,
      height: fontSize, // Approximation
      actualBoundingBoxLeft: nativeMetrics.actualBoundingBoxLeft || 0,
      actualBoundingBoxRight: nativeMetrics.actualBoundingBoxRight || nativeMetrics.width,
      // 🏢 ADR-107: Centralized text metrics ratios
      actualBoundingBoxAscent: nativeMetrics.actualBoundingBoxAscent || fontSize * TEXT_METRICS_RATIOS.ASCENT_RATIO,
      actualBoundingBoxDescent: nativeMetrics.actualBoundingBoxDescent || fontSize * TEXT_METRICS_RATIOS.DESCENT_RATIO
    };
  }

  /**
   * 🔺 ESTIMATE TEXT METRICS
   * Fallback εκτίμηση όταν δεν υπάρχει Canvas context
   */
  private estimateTextMetrics(text: string, fontSize: number): TextMetrics {
    // 🏢 ADR-107: Use centralized text metrics ratios for estimation
    const averageCharWidth = fontSize * TEXT_METRICS_RATIOS.CHAR_WIDTH_MONOSPACE;
    const width = text.length * averageCharWidth;

    return {
      width,
      height: fontSize,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: width,
      actualBoundingBoxAscent: fontSize * TEXT_METRICS_RATIOS.ASCENT_RATIO,
      actualBoundingBoxDescent: fontSize * TEXT_METRICS_RATIOS.DESCENT_RATIO
    };
  }

  /**
   * 🔺 CACHE MANAGEMENT
   */
  private set(key: string, metrics: CachedTextMetrics): void {
    // Ensure capacity
    while (this.cache.size >= this.options.maxEntries) {
      this.evictOldestEntry();
    }

    this.cache.set(key, metrics);
  }

  private evictOldestEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, metrics] of this.cache) {
      if (metrics.lastAccessed < oldestTime) {
        oldestTime = metrics.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private isExpired(metrics: CachedTextMetrics): boolean {
    return (Date.now() - metrics.lastAccessed) > this.options.ttlMs;
  }

  private generateKey(text: string, font: string, fontSize: number, fontFamily: string): string {
    return `${text}_${font}_${fontSize}_${fontFamily}`;
  }

  /**
   * 🔺 UTILITY METHODS
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hitCount: 0, missCount: 0, measurementCount: 0 };
  }

  getStats() {
    const hitRatio = this.stats.hitCount + this.stats.missCount > 0
      ? this.stats.hitCount / (this.stats.hitCount + this.stats.missCount)
      : 0;

    return {
      ...this.stats,
      hitRatio,
      cacheSize: this.cache.size,
      maxEntries: this.options.maxEntries
    };
  }

  configure(options: Partial<TextCacheOptions>): void {
    if (options.maxEntries !== undefined) {
      this.options.maxEntries = options.maxEntries;
    }
    if (options.ttlMs !== undefined) {
      this.options.ttlMs = options.ttlMs;
    }

    // Cleanup if needed
    while (this.cache.size > this.options.maxEntries) {
      this.evictOldestEntry();
    }
  }
}

/**
 * 🔺 GLOBAL TEXT CACHE
 */
let globalTextCache: TextMetricsCache | null = null;

export function getGlobalTextCache(): TextMetricsCache {
  if (!globalTextCache) {
    globalTextCache = new TextMetricsCache();
  }
  return globalTextCache;
}

/**
 * 🔺 FACTORY FUNCTION
 */
export function createTextMetricsCache(options: TextCacheOptions = {}): TextMetricsCache {
  return new TextMetricsCache(options);
}