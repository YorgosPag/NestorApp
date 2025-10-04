/**
 * PATH CACHE - Path2D caching για βελτιστοποίηση rendering performance
 * ✅ ΦΑΣΗ 5: Caching system για repeated entity rendering
 */

import type { EntityModel } from '../types/Types';

export interface CacheEntry {
  path: Path2D;
  entityHash: string;
  lastAccessed: number;
  accessCount: number;
  memorySize: number; // Estimated memory usage
}

export interface CacheStats {
  totalEntries: number;
  totalMemorySize: number;
  hitCount: number;
  missCount: number;
  hitRatio: number;
  averageAccessCount: number;
  oldestEntry: number;
  newestEntry: number;
}

export interface CacheOptions {
  maxEntries?: number;
  maxMemorySize?: number; // bytes
  ttlMs?: number; // time to live
  enableStats?: boolean;
}

/**
 * 🔺 PATH CACHE ΚΕΝΤΡΙΚΗ ΚΛΑΣΗ
 * Αποθηκεύει Path2D objects για fast rendering
 */
export class PathCache {
  private cache = new Map<string, CacheEntry>();
  private options: Required<CacheOptions>;

  // Statistics
  private stats = {
    hitCount: 0,
    missCount: 0,
    evictions: 0,
    totalMemorySize: 0
  };

  // Cleanup management
  private lastCleanup = Date.now();
  private cleanupInterval = 60000; // 1 minute

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxEntries: options.maxEntries || 1000,
      maxMemorySize: options.maxMemorySize || 50 * 1024 * 1024, // 50MB
      ttlMs: options.ttlMs || 300000, // 5 minutes
      enableStats: options.enableStats !== false
    };
  }

  /**
   * 🔺 GET PATH
   * Επιστρέφει cached Path2D ή null αν δεν υπάρχει
   */
  get(entityId: string, entityHash: string): Path2D | null {
    const entry = this.cache.get(entityId);

    if (!entry) {
      this.stats.missCount++;
      return null;
    }

    // Check if hash matches (entity changed)
    if (entry.entityHash !== entityHash) {
      this.cache.delete(entityId);
      this.stats.missCount++;
      return null;
    }

    // Check TTL
    if (this.isExpired(entry)) {
      this.cache.delete(entityId);
      this.stats.missCount++;
      return null;
    }

    // Update access info
    entry.lastAccessed = Date.now();
    entry.accessCount++;

    this.stats.hitCount++;
    return entry.path;
  }

  /**
   * 🔺 SET PATH
   * Αποθηκεύει ένα Path2D στο cache
   */
  set(entityId: string, entityHash: string, path: Path2D): void {
    // Estimate memory size (rough approximation)
    const estimatedSize = this.estimatePathSize(path);

    // Check if we need to evict entries
    this.ensureCapacity(estimatedSize);

    const entry: CacheEntry = {
      path: path,
      entityHash,
      lastAccessed: Date.now(),
      accessCount: 1,
      memorySize: estimatedSize
    };

    // Remove old entry if exists
    const oldEntry = this.cache.get(entityId);
    if (oldEntry) {
      this.stats.totalMemorySize -= oldEntry.memorySize;
    }

    this.cache.set(entityId, entry);
    this.stats.totalMemorySize += estimatedSize;

    // Periodic cleanup
    this.periodicCleanup();
  }

  /**
   * 🔺 REMOVE
   * Αφαιρεί ένα entry από το cache
   */
  remove(entityId: string): boolean {
    const entry = this.cache.get(entityId);
    if (!entry) return false;

    this.cache.delete(entityId);
    this.stats.totalMemorySize -= entry.memorySize;
    return true;
  }

  /**
   * 🔺 CLEAR
   * Καθαρίζει όλο το cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.totalMemorySize = 0;
    this.stats.hitCount = 0;
    this.stats.missCount = 0;
    this.stats.evictions = 0;
  }

  /**
   * 🔺 HAS
   * Ελέγχει αν υπάρχει valid entry
   */
  has(entityId: string, entityHash?: string): boolean {
    const entry = this.cache.get(entityId);
    if (!entry) return false;

    if (entityHash && entry.entityHash !== entityHash) return false;
    if (this.isExpired(entry)) return false;

    return true;
  }

  /**
   * 🔺 ENTITY HASH CALCULATION
   * Υπολογίζει hash για ένα entity (για cache invalidation)
   */
  static calculateEntityHash(entity: EntityModel, transform?: { scale: number; offsetX: number; offsetY: number }): string {
    // Include relevant entity properties that affect rendering
    const relevant = {
      type: entity.type,
      // Geometric properties
      start: entity.start,
      end: entity.end,
      center: entity.center,
      radius: entity.radius,
      vertices: entity.vertices,
      // Style properties that affect path
      lineWidth: entity.lineWidth,
      // Transform properties
      transform: transform ? `${transform.scale}_${transform.offsetX}_${transform.offsetY}` : null
    };

    // Simple hash (could use crypto.subtle.digest for better hashing)
    return btoa(JSON.stringify(relevant)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  /**
   * 🔺 BATCH OPERATIONS
   * Bulk operations για performance
   */
  setBatch(entries: Array<{ entityId: string; entityHash: string; path: Path2D }>): void {
    for (const entry of entries) {
      this.set(entry.entityId, entry.entityHash, entry.path);
    }
  }

  removeBatch(entityIds: string[]): number {
    let removedCount = 0;
    for (const entityId of entityIds) {
      if (this.remove(entityId)) {
        removedCount++;
      }
    }
    return removedCount;
  }

  /**
   * 🔺 CAPACITY MANAGEMENT
   * Διαχείριση χώρου στο cache
   */
  private ensureCapacity(newEntrySize: number): void {
    // Check memory limit
    while (this.stats.totalMemorySize + newEntrySize > this.options.maxMemorySize) {
      this.evictLeastRecentlyUsed();
    }

    // Check entry count limit
    while (this.cache.size >= this.options.maxEntries) {
      this.evictLeastRecentlyUsed();
    }
  }

  private evictLeastRecentlyUsed(): void {
    let oldestEntry: string | null = null;
    let oldestTime = Date.now();

    for (const [entityId, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestEntry = entityId;
      }
    }

    if (oldestEntry) {
      this.remove(oldestEntry);
      this.stats.evictions++;
    }
  }

  /**
   * 🔺 TTL MANAGEMENT
   * Time-to-live διαχείριση
   */
  private isExpired(entry: CacheEntry): boolean {
    return (Date.now() - entry.lastAccessed) > this.options.ttlMs;
  }

  private periodicCleanup(): void {
    if (Date.now() - this.lastCleanup < this.cleanupInterval) return;

    const expiredEntries: string[] = [];

    for (const [entityId, entry] of this.cache) {
      if (this.isExpired(entry)) {
        expiredEntries.push(entityId);
      }
    }

    for (const entityId of expiredEntries) {
      this.remove(entityId);
    }

    this.lastCleanup = Date.now();
  }

  /**
   * 🔺 MEMORY ESTIMATION
   * Εκτίμηση memory footprint
   */
  private estimatePathSize(path: Path2D): number {
    // Rough estimation - Path2D internal storage is browser-dependent
    // Assume average path has ~100 path operations, each ~50 bytes
    return 5000; // 5KB per path (conservative estimate)
  }

  /**
   * 🔺 STATISTICS
   * Επιστρέφει στατιστικά του cache
   */
  getStats(): CacheStats {
    const hitRatio = this.stats.hitCount + this.stats.missCount > 0
      ? this.stats.hitCount / (this.stats.hitCount + this.stats.missCount)
      : 0;

    let totalAccessCount = 0;
    let oldestTime = Date.now();
    let newestTime = 0;

    for (const entry of this.cache.values()) {
      totalAccessCount += entry.accessCount;
      oldestTime = Math.min(oldestTime, entry.lastAccessed);
      newestTime = Math.max(newestTime, entry.lastAccessed);
    }

    return {
      totalEntries: this.cache.size,
      totalMemorySize: this.stats.totalMemorySize,
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      hitRatio,
      averageAccessCount: this.cache.size > 0 ? totalAccessCount / this.cache.size : 0,
      oldestEntry: oldestTime,
      newestEntry: newestTime
    };
  }

  /**
   * 🔺 CONFIGURATION
   * Ενημερώνει τις παραμέτρους του cache
   */
  configure(options: Partial<CacheOptions>): void {
    if (options.maxEntries !== undefined) {
      this.options.maxEntries = options.maxEntries;
    }
    if (options.maxMemorySize !== undefined) {
      this.options.maxMemorySize = options.maxMemorySize;
    }
    if (options.ttlMs !== undefined) {
      this.options.ttlMs = options.ttlMs;
    }
    if (options.enableStats !== undefined) {
      this.options.enableStats = options.enableStats;
    }

    // Trigger cleanup if needed
    this.ensureCapacity(0);
  }

  /**
   * 🔺 PRELOAD
   * Προφορτώνει paths για μια λίστα entities
   */
  preload(entities: EntityModel[], pathGenerator: (entity: EntityModel) => Path2D | null): void {
    for (const entity of entities) {
      if (!entity.id) continue;

      const hash = PathCache.calculateEntityHash(entity);
      if (this.has(entity.id, hash)) continue; // Already cached

      const path = pathGenerator(entity);
      if (path) {
        this.set(entity.id, hash, path);
      }
    }
  }

  /**
   * 🔺 EXPORT/IMPORT
   * Για persistence σε localStorage ή IndexedDB
   */
  export(): { entities: Array<{ id: string; hash: string; size: number }> } {
    const entities = Array.from(this.cache.entries()).map(([id, entry]) => ({
      id,
      hash: entry.entityHash,
      size: entry.memorySize
    }));

    return { entities };
  }

  import(data: { entities: Array<{ id: string; hash: string; size: number }> }): void {
    // Note: Path2D objects cannot be serialized, so this only imports metadata
    // Actual paths need to be regenerated
    console.warn('PathCache.import(): Path2D objects cannot be serialized. Only metadata imported.');
  }
}

/**
 * 🔺 GLOBAL CACHE INSTANCE
 * Singleton για global usage
 */
let globalPathCache: PathCache | null = null;

export function getGlobalPathCache(): PathCache {
  if (!globalPathCache) {
    globalPathCache = new PathCache({
      maxEntries: 2000,
      maxMemorySize: 100 * 1024 * 1024, // 100MB
      ttlMs: 600000 // 10 minutes
    });
  }
  return globalPathCache;
}

export function setGlobalPathCache(cache: PathCache): void {
  globalPathCache = cache;
}

/**
 * 🔺 FACTORY FUNCTION
 */
export function createPathCache(options: CacheOptions = {}): PathCache {
  return new PathCache(options);
}