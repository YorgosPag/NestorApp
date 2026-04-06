/**
 * ADMINISTRATIVE BOUNDARIES CACHE MANAGER - Phase 7.2
 *
 * LRU caching, TTL management, IndexedDB persistence, intelligent prefetching
 * Split (ADR-065 Phase 3, #15): cache-types.ts, CacheIndexedDBStore.ts
 */

import { adminBoundariesAnalytics } from '../performance/AdminBoundariesPerformanceAnalytics';
import { createModuleLogger } from '@/lib/telemetry';
import { CacheIndexedDBStore } from './CacheIndexedDBStore';
import type {
  CacheEntry,
  CacheConfig,
  CacheStatistics,
  PrefetchStrategy,
  CacheSetOptions,
  CacheReportSummary,
  CacheReportPerformance,
} from './cache-types';

// Re-export types for consumers
export type {
  CacheEntry,
  CacheConfig,
  CacheStatistics,
  PrefetchStrategy,
  CacheReportSummary,
  CacheReportPerformance,
  CacheSetOptions,
} from './cache-types';

const logger = createModuleLogger('AdminBoundariesCacheManager');

export class AdminBoundariesCacheManager {
  private static instance: AdminBoundariesCacheManager | null = null;
  private memoryCache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  private config: CacheConfig;
  private stats = {
    hits: 0, misses: 0, evictions: 0, writes: 0, persistedWrites: 0,
    accessTimes: new Array<number>(), writeTimes: new Array<number>()
  };
  private store: CacheIndexedDBStore;
  private prefetchConfig: PrefetchStrategy;
  private prefetchQueue = new Set<string>();
  private activePrefetches = new Set<Promise<void>>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.prefetchConfig = this.getDefaultPrefetchConfig();
    this.store = new CacheIndexedDBStore();
    this.initializeCache();
  }

  public static getInstance(): AdminBoundariesCacheManager {
    if (!AdminBoundariesCacheManager.instance) {
      AdminBoundariesCacheManager.instance = new AdminBoundariesCacheManager();
    }
    return AdminBoundariesCacheManager.instance;
  }

  private async initializeCache(): Promise<void> {
    try {
      if (this.config.enablePersistence) {
        await this.store.initialize();
        await this.loadPersistedEntries();
      }

      this.startCleanupInterval();
      this.startStatsInterval();

      if (this.prefetchConfig.enabled) {
        this.startPrefetchingPopular();
      }

      console.debug('AdminBoundariesCacheManager initialized');
    } catch (error) {
      logger.error('Cache initialization error', { error });
      this.config.enablePersistence = false;
    }
  }

  private async loadPersistedEntries(): Promise<void> {
    const entries = await this.store.loadAll();
    for (const entry of entries) {
      this.memoryCache.set(entry.key, entry);
      this.addToAccessOrder(entry.key);
    }
    console.debug(`Loaded ${entries.length} persisted cache entries`);
  }

  // --- CORE CACHE OPERATIONS ---

  public async get<T = unknown>(key: string): Promise<T | null> {
    const startTime = performance.now();

    try {
      const entry = this.memoryCache.get(key);

      if (entry) {
        if (Date.now() - entry.timestamp > entry.ttl) {
          this.memoryCache.delete(key);
          this.removeFromAccessOrder(key);
          this.stats.misses++;
          return null;
        }

        this.updateAccessOrder(key);
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        this.stats.hits++;
        this.recordAccessTime(performance.now() - startTime);
        return entry.data as T;
      }

      if (this.config.enablePersistence && this.store.isReady) {
        const persistedEntry = await this.store.get<T>(key);
        if (persistedEntry) {
          this.memoryCache.set(key, persistedEntry);
          this.addToAccessOrder(key);
          this.stats.hits++;
          this.recordAccessTime(performance.now() - startTime);
          return persistedEntry.data as T;
        }
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Cache get error', { error });
      this.stats.misses++;
      return null;
    }
  }

  public async set<T = unknown>(key: string, data: T, options: CacheSetOptions = {}): Promise<void> {
    const startTime = performance.now();

    try {
      const serializedData = JSON.stringify(data);
      const size = new Blob([serializedData]).size;

      if (size > this.config.maxSize * 1024 * 1024 * 0.1) {
        logger.warn(`Cache entry too large: ${key} (${this.formatBytes(size)})`);
        return;
      }

      const entry: CacheEntry<T> = {
        key,
        data,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessed: Date.now(),
        size,
        ttl: options.ttl || this.config.defaultTTL * 60 * 1000,
        priority: options.priority || 'medium',
        adminLevel: options.adminLevel,
        region: options.region,
        tags: options.tags || []
      };

      await this.ensureCapacity(size);
      this.memoryCache.set(key, entry);
      this.addToAccessOrder(key);

      if (this.config.enablePersistence && (options.persistToDisk !== false)) {
        await this.store.put(entry);
        this.stats.persistedWrites++;
      }

      this.stats.writes++;
      this.recordWriteTime(performance.now() - startTime);

      if (this.prefetchConfig.enabled && entry.accessCount > this.prefetchConfig.triggerThreshold) {
        this.triggerContextualPrefetch(entry);
      }
    } catch (error) {
      logger.error('Cache set error', { error });
    }
  }

  public has(key: string): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) return false;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key);
      this.removeFromAccessOrder(key);
      return false;
    }
    return true;
  }

  public async delete(key: string): Promise<boolean> {
    try {
      const existed = this.memoryCache.delete(key);
      this.removeFromAccessOrder(key);

      if (this.config.enablePersistence && this.store.isReady) {
        await this.store.delete(key);
      }
      return existed;
    } catch (error) {
      logger.error('Cache delete error', { error });
      return false;
    }
  }

  public async clear(): Promise<void> {
    try {
      this.memoryCache.clear();
      this.accessOrder = [];

      if (this.config.enablePersistence && this.store.isReady) {
        await this.store.clear();
      }

      this.stats = {
        hits: 0, misses: 0, evictions: 0, writes: 0, persistedWrites: 0,
        accessTimes: [], writeTimes: []
      };
    } catch (error) {
      logger.error('Cache clear error', { error });
    }
  }

  // --- EVICTION & LRU ---

  private async ensureCapacity(newEntrySize: number): Promise<void> {
    const currentSize = this.getCurrentCacheSize();
    const maxSize = this.config.maxSize * 1024 * 1024;

    while ((currentSize + newEntrySize) > maxSize || this.memoryCache.size >= this.config.maxEntries) {
      if (this.accessOrder.length === 0) break;
      await this.evictLeastRecentlyUsed();
    }
  }

  private async evictLeastRecentlyUsed(): Promise<void> {
    if (this.accessOrder.length === 0) return;

    let lruKey = this.accessOrder[0];
    let lowestPriority = this.getPriorityScore(this.memoryCache.get(lruKey)?.priority || 'medium');

    for (const key of this.accessOrder.slice(0, 5)) {
      const entry = this.memoryCache.get(key);
      if (entry) {
        const priority = this.getPriorityScore(entry.priority);
        if (priority < lowestPriority) {
          lruKey = key;
          lowestPriority = priority;
        }
      }
    }

    await this.delete(lruKey);
    this.stats.evictions++;
  }

  private getPriorityScore(priority: 'high' | 'medium' | 'low'): number {
    return { 'high': 3, 'medium': 2, 'low': 1 }[priority];
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of Array.from(this.memoryCache.entries())) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private addToAccessOrder(key: string): void {
    if (!this.accessOrder.includes(key)) {
      this.accessOrder.push(key);
    }
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private async startPrefetchingPopular(): Promise<void> {
    for (const boundaryId of this.prefetchConfig.popularBoundaries) {
      if (!this.has(boundaryId) && !this.prefetchQueue.has(boundaryId)) {
        this.prefetchQueue.add(boundaryId);
      }
    }
  }

  private triggerContextualPrefetch(entry: CacheEntry): void {
    if (!this.prefetchConfig.contextualPrefetch) return;
    if (this.activePrefetches.size >= this.prefetchConfig.maxConcurrentPrefetches) return;

    if (entry.adminLevel && entry.region) {
      const contextKey = `${entry.region}_${entry.adminLevel}_neighbors`;
      if (!this.prefetchQueue.has(contextKey)) {
        this.prefetchQueue.add(contextKey);
      }
    }
  }

  // --- STATISTICS & MONITORING ---

  public getStatistics(): CacheStatistics {
    const totalRequests = this.stats.hits + this.stats.misses;
    const currentSize = this.getCurrentCacheSize();
    const maxSize = this.config.maxSize * 1024 * 1024;

    return {
      totalEntries: this.memoryCache.size,
      totalSize: currentSize,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0,
      evictionCount: this.stats.evictions,
      persistedEntries: this.stats.persistedWrites,
      memoryUsage: {
        used: currentSize / 1024 / 1024,
        available: (maxSize - currentSize) / 1024 / 1024,
        utilization: (currentSize / maxSize) * 100
      },
      performance: {
        averageAccessTime: this.stats.accessTimes.length > 0
          ? this.stats.accessTimes.reduce((a, b) => a + b, 0) / this.stats.accessTimes.length : 0,
        averageWriteTime: this.stats.writeTimes.length > 0
          ? this.stats.writeTimes.reduce((a, b) => a + b, 0) / this.stats.writeTimes.length : 0,
        slowQueries: this.stats.accessTimes.filter(time => time > 50).length
      }
    };
  }

  public generateCacheReport(): {
    summary: CacheReportSummary;
    recommendations: string[];
    topEntries: Array<{ key: string; accessCount: number; size: number }>;
    performance: CacheReportPerformance;
  } {
    const stats = this.getStatistics();
    const recommendations: string[] = [];

    if (stats.hitRate < 70) {
      recommendations.push('Cache hit rate is below optimal (70%). Consider increasing cache size or TTL.');
    }
    if (stats.memoryUsage.utilization > 90) {
      recommendations.push('Cache memory utilization is high. Consider increasing max cache size.');
    }
    if (stats.performance.averageAccessTime > 10) {
      recommendations.push('Cache access times are slow. Consider optimizing data structure.');
    }
    if (stats.evictionCount > stats.totalEntries * 0.1) {
      recommendations.push('High eviction rate detected. Consider increasing cache capacity.');
    }

    const topEntries = Array.from(this.memoryCache.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10)
      .map(entry => ({ key: entry.key, accessCount: entry.accessCount, size: entry.size }));

    return {
      summary: {
        totalEntries: stats.totalEntries,
        hitRate: Math.round(stats.hitRate),
        memoryUsed: Math.round(stats.memoryUsage.used),
        evictions: stats.evictionCount,
        persistedEntries: stats.persistedEntries
      },
      recommendations,
      topEntries,
      performance: {
        avgAccessTime: Math.round(stats.performance.averageAccessTime * 100) / 100,
        avgWriteTime: Math.round(stats.performance.averageWriteTime * 100) / 100,
        slowQueries: stats.performance.slowQueries
      }
    };
  }

  private getCurrentCacheSize(): number {
    return Array.from(this.memoryCache.values()).reduce((total, entry) => total + entry.size, 0);
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }

  private recordAccessTime(time: number): void {
    this.stats.accessTimes.push(time);
    if (this.stats.accessTimes.length > 100) {
      this.stats.accessTimes = this.stats.accessTimes.slice(-50);
    }
  }

  private recordWriteTime(time: number): void {
    this.stats.writeTimes.push(time);
    if (this.stats.writeTimes.length > 100) {
      this.stats.writeTimes = this.stats.writeTimes.slice(-50);
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => this.cleanupExpiredEntries(), 5 * 60 * 1000);
  }

  private startStatsInterval(): void {
    this.statsInterval = setInterval(() => {
      const stats = this.getStatistics();
      adminBoundariesAnalytics.recordBoundaryProcessing(
        stats.totalEntries, stats.performance.averageAccessTime, 0, 0
      );
    }, 10 * 60 * 1000);
  }

  private getDefaultConfig(): CacheConfig {
    return {
      maxSize: 100, maxEntries: 1000, defaultTTL: 60,
      enablePersistence: true, enablePrefetching: true,
      enableCompression: false, compressionThreshold: 1024 * 100
    };
  }

  private getDefaultPrefetchConfig(): PrefetchStrategy {
    return {
      enabled: true, triggerThreshold: 3, maxConcurrentPrefetches: 3,
      prefetchRadius: 50,
      popularBoundaries: ['greece_attica', 'greece_thessaloniki', 'greece_central_macedonia', 'greece_crete'],
      contextualPrefetch: true
    };
  }

  public updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public updatePrefetchConfig(newConfig: Partial<PrefetchStrategy>): void {
    this.prefetchConfig = { ...this.prefetchConfig, ...newConfig };
  }

  public dispose(): void {
    this.clear();

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    this.store.close();
    AdminBoundariesCacheManager.instance = null;
  }
}

export const adminBoundariesCache = AdminBoundariesCacheManager.getInstance();
