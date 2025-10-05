/**
 * TEXT METRICS CACHE - Caching για text measurements
 * ✅ ΦΑΣΗ 5: Βελτιστοποίηση text rendering performance
 */

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
      ttlMs: options.ttlMs || 300000, // 5 minutes
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
      actualBoundingBoxAscent: nativeMetrics.actualBoundingBoxAscent || fontSize * 0.8,
      actualBoundingBoxDescent: nativeMetrics.actualBoundingBoxDescent || fontSize * 0.2
    };
  }

  /**
   * 🔺 ESTIMATE TEXT METRICS
   * Fallback εκτίμηση όταν δεν υπάρχει Canvas context
   */
  private estimateTextMetrics(text: string, fontSize: number): TextMetrics {
    // Rough estimation based on average character width
    const averageCharWidth = fontSize * 0.6;
    const width = text.length * averageCharWidth;

    return {
      width,
      height: fontSize,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: width,
      actualBoundingBoxAscent: fontSize * 0.8,
      actualBoundingBoxDescent: fontSize * 0.2
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