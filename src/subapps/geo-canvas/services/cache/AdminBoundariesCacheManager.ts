/**
 * 🏛️ ADMINISTRATIVE BOUNDARIES CACHE MANAGER - Phase 7.2
 *
 * Enterprise cache management system για administrative boundaries
 * Advanced LRU caching, TTL management, IndexedDB persistence, και intelligent prefetching
 *
 * @module services/cache/AdminBoundariesCacheManager
 */

import { adminBoundariesAnalytics } from '../performance/AdminBoundariesPerformanceAnalytics';
import type {
  AdminSearchResult,
  GreekAdminLevel,
  BoundingBox
} from '../../types/administrative-types';

// ============================================================================
// CACHE TYPES & INTERFACES
// ============================================================================

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number; // bytes
  ttl: number; // milliseconds
  priority: 'high' | 'medium' | 'low';
  adminLevel?: GreekAdminLevel;
  region?: string;
  tags: string[];
}

export interface CacheConfig {
  maxSize: number; // MB
  maxEntries: number;
  defaultTTL: number; // minutes
  enablePersistence: boolean;
  enablePrefetching: boolean;
  enableCompression: boolean;
  compressionThreshold: number; // bytes
}

export interface CacheStatistics {
  totalEntries: number;
  totalSize: number; // bytes
  hitRate: number; // percentage
  missRate: number; // percentage
  evictionCount: number;
  persistedEntries: number;
  memoryUsage: {
    used: number; // MB
    available: number; // MB
    utilization: number; // percentage
  };
  performance: {
    averageAccessTime: number; // ms
    averageWriteTime: number; // ms
    slowQueries: number;
  };
}

export interface PrefetchStrategy {
  enabled: boolean;
  triggerThreshold: number; // access count
  maxConcurrentPrefetches: number;
  prefetchRadius: number; // km for geographic prefetching
  popularBoundaries: string[]; // preload these by default
  contextualPrefetch: boolean; // prefetch based on search patterns
}

// ============================================================================
// CACHE MANAGER CLASS
// ============================================================================

/**
 * Advanced Cache Manager για Administrative Boundaries
 * Features: LRU eviction, TTL management, compression, persistence, prefetching
 */
export class AdminBoundariesCacheManager {

  private static instance: AdminBoundariesCacheManager | null = null;

  // Core cache storage
  private memoryCache = new Map<string, CacheEntry>();
  private accessOrder: string[] = []; // LRU tracking
  private config: CacheConfig;

  // Statistics & monitoring
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    writes: 0,
    persistedWrites: 0,
    accessTimes: new Array<number>(),
    writeTimes: new Array<number>()
  };

  // IndexedDB persistence
  private dbName = 'AdminBoundariesCache';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  // Prefetching system
  private prefetchConfig: PrefetchStrategy;
  private prefetchQueue = new Set<string>();
  private activePrefetches = new Set<Promise<void>>();

  // Cleanup intervals
  private cleanupInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;

  // ============================================================================
  // SINGLETON PATTERN
  // ============================================================================

  private constructor() {
    this.config = this.getDefaultConfig();
    this.prefetchConfig = this.getDefaultPrefetchConfig();
    this.initializeCache();
  }

  public static getInstance(): AdminBoundariesCacheManager {
    if (!AdminBoundariesCacheManager.instance) {
      AdminBoundariesCacheManager.instance = new AdminBoundariesCacheManager();
    }
    return AdminBoundariesCacheManager.instance;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private async initializeCache(): Promise<void> {
    try {
      // Initialize IndexedDB if persistence is enabled
      if (this.config.enablePersistence) {
        await this.initializeIndexedDB();
        await this.loadPersistedEntries();
      }

      // Start cleanup processes
      this.startCleanupInterval();
      this.startStatsInterval();

      // Prefetch popular boundaries
      if (this.prefetchConfig.enabled) {
        this.startPrefetchingPopular();
      }

      console.log('🏛️ AdminBoundariesCacheManager initialized');

    } catch (error) {
      console.error('Cache initialization error:', error);
      // Fallback to memory-only mode
      this.config.enablePersistence = false;
    }
  }

  private async initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('boundaries')) {
          const boundariesStore = db.createObjectStore('boundaries', { keyPath: 'key' });
          boundariesStore.createIndex('adminLevel', 'adminLevel', { unique: false });
          boundariesStore.createIndex('region', 'region', { unique: false });
          boundariesStore.createIndex('timestamp', 'timestamp', { unique: false });
          boundariesStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }

        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  // ============================================================================
  // CORE CACHE OPERATIONS
  // ============================================================================

  /**
   * Get entry from cache με LRU tracking
   */
  public async get<T = any>(key: string): Promise<T | null> {
    const startTime = performance.now();

    try {
      // Check memory cache first
      const entry = this.memoryCache.get(key);

      if (entry) {
        // Check TTL expiration
        if (Date.now() - entry.timestamp > entry.ttl) {
          this.memoryCache.delete(key);
          this.removeFromAccessOrder(key);
          this.stats.misses++;
          return null;
        }

        // Update LRU order
        this.updateAccessOrder(key);
        entry.accessCount++;
        entry.lastAccessed = Date.now();

        this.stats.hits++;
        this.recordAccessTime(performance.now() - startTime);

        console.log(`📦 Cache HIT: ${key} (${entry.accessCount} accesses)`);
        return entry.data as T;
      }

      // Try IndexedDB if enabled
      if (this.config.enablePersistence && this.db) {
        const persistedEntry = await this.getFromIndexedDB<T>(key);
        if (persistedEntry) {
          // Move to memory cache
          this.memoryCache.set(key, persistedEntry);
          this.addToAccessOrder(key);

          this.stats.hits++;
          this.recordAccessTime(performance.now() - startTime);

          console.log(`💾 Cache HIT (persisted): ${key}`);
          return persistedEntry.data as T;
        }
      }

      this.stats.misses++;
      console.log(`❌ Cache MISS: ${key}`);
      return null;

    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set entry in cache με intelligent eviction
   */
  public async set<T = any>(
    key: string,
    data: T,
    options: {
      ttl?: number;
      priority?: 'high' | 'medium' | 'low';
      adminLevel?: GreekAdminLevel;
      region?: string;
      tags?: string[];
      persistToDisk?: boolean;
    } = {}
  ): Promise<void> {
    const startTime = performance.now();

    try {
      // Calculate data size
      const serializedData = JSON.stringify(data);
      const size = new Blob([serializedData]).size;

      // Check size limits
      if (size > this.config.maxSize * 1024 * 1024 * 0.1) { // Max 10% of cache per entry
        console.warn(`Cache entry too large: ${key} (${this.formatBytes(size)})`);
        return;
      }

      // Create cache entry
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

      // Ensure cache capacity
      await this.ensureCapacity(size);

      // Add to memory cache
      this.memoryCache.set(key, entry);
      this.addToAccessOrder(key);

      // Persist to IndexedDB if enabled
      if (this.config.enablePersistence && (options.persistToDisk !== false)) {
        await this.persistToIndexedDB(entry);
      }

      this.stats.writes++;
      this.recordWriteTime(performance.now() - startTime);

      // Trigger prefetching if appropriate
      if (this.prefetchConfig.enabled && entry.accessCount > this.prefetchConfig.triggerThreshold) {
        this.triggerContextualPrefetch(entry);
      }

      console.log(`💾 Cache SET: ${key} (${this.formatBytes(size)}, TTL: ${entry.ttl / 1000}s)`);

    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Check if key exists in cache (without affecting LRU)
   */
  public has(key: string): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) return false;

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key);
      this.removeFromAccessOrder(key);
      return false;
    }

    return true;
  }

  /**
   * Delete entry from cache
   */
  public async delete(key: string): Promise<boolean> {
    try {
      const existed = this.memoryCache.delete(key);
      this.removeFromAccessOrder(key);

      // Also remove from IndexedDB
      if (this.config.enablePersistence && this.db) {
        await this.deleteFromIndexedDB(key);
      }

      if (existed) {
        console.log(`🗑️ Cache DELETE: ${key}`);
      }

      return existed;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear entire cache
   */
  public async clear(): Promise<void> {
    try {
      this.memoryCache.clear();
      this.accessOrder = [];

      if (this.config.enablePersistence && this.db) {
        await this.clearIndexedDB();
      }

      // Reset statistics
      this.stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        writes: 0,
        persistedWrites: 0,
        accessTimes: [],
        writeTimes: []
      };

      console.log('🧹 Cache cleared completely');
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  // ============================================================================
  // CACHE MANAGEMENT & EVICTION
  // ============================================================================

  /**
   * Ensure cache has capacity for new entry
   */
  private async ensureCapacity(newEntrySize: number): Promise<void> {
    const currentSize = this.getCurrentCacheSize();
    const maxSize = this.config.maxSize * 1024 * 1024; // Convert MB to bytes
    const maxEntries = this.config.maxEntries;

    // Check size limit
    while ((currentSize + newEntrySize) > maxSize || this.memoryCache.size >= maxEntries) {
      if (this.accessOrder.length === 0) break;

      await this.evictLeastRecentlyUsed();
    }
  }

  /**
   * Evict least recently used entry
   */
  private async evictLeastRecentlyUsed(): Promise<void> {
    if (this.accessOrder.length === 0) return;

    // Find LRU entry with lowest priority
    let lruKey = this.accessOrder[0];
    let lowestPriority = this.getPriorityScore(this.memoryCache.get(lruKey)?.priority || 'medium');

    for (const key of this.accessOrder.slice(0, 5)) { // Check first 5 LRU entries
      const entry = this.memoryCache.get(key);
      if (entry) {
        const priority = this.getPriorityScore(entry.priority);
        if (priority < lowestPriority) {
          lruKey = key;
          lowestPriority = priority;
        }
      }
    }

    const entry = this.memoryCache.get(lruKey);
    if (entry) {
      console.log(`⚡ Cache EVICT (LRU): ${lruKey} (${this.formatBytes(entry.size)}, accessed ${entry.accessCount} times)`);

      await this.delete(lruKey);
      this.stats.evictions++;
    }
  }

  private getPriorityScore(priority: 'high' | 'medium' | 'low'): number {
    return { 'high': 3, 'medium': 2, 'low': 1 }[priority];
  }

  /**
   * Cleanup expired entries
   */
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

    if (expiredKeys.length > 0) {
      console.log(`⏰ Cache CLEANUP: Removed ${expiredKeys.length} expired entries`);
    }
  }

  // ============================================================================
  // LRU ACCESS ORDER MANAGEMENT
  // ============================================================================

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

  // ============================================================================
  // INDEXEDDB PERSISTENCE
  // ============================================================================

  private async getFromIndexedDB<T = any>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['boundaries'], 'readonly');
      const store = transaction.objectStore('boundaries');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as CacheEntry<T> | undefined;
        if (result) {
          // Check TTL
          if (Date.now() - result.timestamp <= result.ttl) {
            resolve(result);
          } else {
            // Expired, remove from IndexedDB
            this.deleteFromIndexedDB(key);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  }

  private async persistToIndexedDB<T = any>(entry: CacheEntry<T>): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['boundaries'], 'readwrite');
      const store = transaction.objectStore('boundaries');
      const request = store.put(entry);

      request.onsuccess = () => {
        this.stats.persistedWrites++;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteFromIndexedDB(key: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['boundaries'], 'readwrite');
      const store = transaction.objectStore('boundaries');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => resolve(); // Don't fail on delete errors
    });
  }

  private async clearIndexedDB(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['boundaries'], 'readwrite');
      const store = transaction.objectStore('boundaries');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => resolve(); // Don't fail on clear errors
    });
  }

  private async loadPersistedEntries(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['boundaries'], 'readonly');
      const store = transaction.objectStore('boundaries');
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as CacheEntry[];
        let loadedCount = 0;

        for (const entry of entries) {
          // Check TTL
          if (Date.now() - entry.timestamp <= entry.ttl) {
            this.memoryCache.set(entry.key, entry);
            this.addToAccessOrder(entry.key);
            loadedCount++;
          } else {
            // Remove expired entry
            this.deleteFromIndexedDB(entry.key);
          }
        }

        console.log(`💾 Loaded ${loadedCount} persisted cache entries`);
        resolve();
      };

      request.onerror = () => resolve(); // Don't fail if loading errors
    });
  }

  // ============================================================================
  // PREFETCHING SYSTEM
  // ============================================================================

  private async startPrefetchingPopular(): Promise<void> {
    for (const boundaryId of this.prefetchConfig.popularBoundaries) {
      if (!this.has(boundaryId) && !this.prefetchQueue.has(boundaryId)) {
        this.prefetchQueue.add(boundaryId);
        // Note: Actual prefetching would require integration with data fetching service
        console.log(`🔮 Queued for prefetch: ${boundaryId}`);
      }
    }
  }

  private triggerContextualPrefetch(entry: CacheEntry): void {
    if (!this.prefetchConfig.contextualPrefetch) return;
    if (this.activePrefetches.size >= this.prefetchConfig.maxConcurrentPrefetches) return;

    // Example: Prefetch neighboring administrative boundaries
    if (entry.adminLevel && entry.region) {
      const contextKey = `${entry.region}_${entry.adminLevel}_neighbors`;
      if (!this.prefetchQueue.has(contextKey)) {
        this.prefetchQueue.add(contextKey);
        console.log(`🎯 Contextual prefetch triggered: ${contextKey}`);
      }
    }
  }

  // ============================================================================
  // STATISTICS & MONITORING
  // ============================================================================

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
        used: currentSize / 1024 / 1024, // MB
        available: (maxSize - currentSize) / 1024 / 1024, // MB
        utilization: (currentSize / maxSize) * 100
      },
      performance: {
        averageAccessTime: this.stats.accessTimes.length > 0
          ? this.stats.accessTimes.reduce((a, b) => a + b, 0) / this.stats.accessTimes.length
          : 0,
        averageWriteTime: this.stats.writeTimes.length > 0
          ? this.stats.writeTimes.reduce((a, b) => a + b, 0) / this.stats.writeTimes.length
          : 0,
        slowQueries: this.stats.accessTimes.filter(time => time > 50).length
      }
    };
  }

  /**
   * Generate comprehensive cache report
   */
  public generateCacheReport(): {
    summary: any;
    recommendations: string[];
    topEntries: Array<{key: string; accessCount: number; size: number;}>;
    performance: any;
  } {
    const stats = this.getStatistics();
    const recommendations: string[] = [];

    // Analyze cache performance and generate recommendations
    if (stats.hitRate < 70) {
      recommendations.push('Cache hit rate is below optimal (70%). Consider increasing cache size or TTL.');
    }

    if (stats.memoryUsage.utilization > 90) {
      recommendations.push('Cache memory utilization is high. Consider increasing max cache size.');
    }

    if (stats.performance.averageAccessTime > 10) {
      recommendations.push('Cache access times are slow. Consider optimizing data structure or reducing entry sizes.');
    }

    if (stats.evictionCount > stats.totalEntries * 0.1) {
      recommendations.push('High eviction rate detected. Consider increasing cache capacity or improving TTL strategy.');
    }

    // Get top accessed entries
    const topEntries = Array.from(this.memoryCache.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10)
      .map(entry => ({
        key: entry.key,
        accessCount: entry.accessCount,
        size: entry.size
      }));

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

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

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
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private startStatsInterval(): void {
    this.statsInterval = setInterval(() => {
      const stats = this.getStatistics();

      // Report to performance analytics
      adminBoundariesAnalytics.recordBoundaryProcessing(
        stats.totalEntries,
        stats.performance.averageAccessTime,
        0, // geometry complexity not applicable here
        0 // simplification ratio not applicable
      );

      // Log cache status periodically
      console.log(`📊 Cache Status: ${stats.totalEntries} entries, ${Math.round(stats.hitRate)}% hit rate, ${Math.round(stats.memoryUsage.used)}MB used`);
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  private getDefaultConfig(): CacheConfig {
    return {
      maxSize: 100, // 100MB
      maxEntries: 1000,
      defaultTTL: 60, // 60 minutes
      enablePersistence: true,
      enablePrefetching: true,
      enableCompression: false, // Disabled for now
      compressionThreshold: 1024 * 100 // 100KB
    };
  }

  private getDefaultPrefetchConfig(): PrefetchStrategy {
    return {
      enabled: true,
      triggerThreshold: 3, // prefetch after 3 accesses
      maxConcurrentPrefetches: 3,
      prefetchRadius: 50, // 50km radius
      popularBoundaries: [
        'greece_attica',
        'greece_thessaloniki',
        'greece_central_macedonia',
        'greece_crete'
      ],
      contextualPrefetch: true
    };
  }

  public updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🏛️ Cache configuration updated');
  }

  public updatePrefetchConfig(newConfig: Partial<PrefetchStrategy>): void {
    this.prefetchConfig = { ...this.prefetchConfig, ...newConfig };
    console.log('🔮 Prefetch configuration updated');
  }

  // ============================================================================
  // CLEANUP & DISPOSAL
  // ============================================================================

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

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    AdminBoundariesCacheManager.instance = null;
    console.log('🏛️ AdminBoundariesCacheManager disposed');
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Singleton instance για Administrative Boundaries Cache Management
 */
export const adminBoundariesCache = AdminBoundariesCacheManager.getInstance();
export default adminBoundariesCache;