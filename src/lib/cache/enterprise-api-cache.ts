/**
 * 🚀 ENTERPRISE API CACHE SYSTEM
 *
 * Professional-grade caching για database queries με
 * automatic cache invalidation και performance monitoring.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time To Live in milliseconds
  key: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  totalQueries: number;
  hitRatio: number;
  cacheSize: number;
}

export class EnterpriseAPICache {
  private static instance: EnterpriseAPICache | null = null;
  private cache = new Map<string, CacheEntry<any>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    totalQueries: 0,
    hitRatio: 0,
    cacheSize: 0
  };

  // Cache TTL configurations (in milliseconds)
  private readonly TTL_CONFIG = {
    companies: 5 * 60 * 1000,        // 5 minutes για companies
    projects: 3 * 60 * 1000,         // 3 minutes για projects
    buildings: 2 * 60 * 1000,        // 2 minutes για buildings
    storages: 2 * 60 * 1000,         // 2 minutes για storages
    floors: 1 * 60 * 1000,           // 1 minute για floors
    units: 30 * 1000,                // 30 seconds για units
    navigation: 10 * 60 * 1000,      // 10 minutes για navigation
    default: 1 * 60 * 1000           // 1 minute default
  };

  public static getInstance(): EnterpriseAPICache {
    if (!EnterpriseAPICache.instance) {
      EnterpriseAPICache.instance = new EnterpriseAPICache();
    }
    return EnterpriseAPICache.instance;
  }

  /**
   * 📦 Get cached data με automatic expiration check
   */
  public get<T>(key: string): T | null {
    this.stats.totalQueries++;

    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateStats();
      return null;
    }

    // Check if cache entry has expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateStats();
      return null;
    }

    this.stats.hits++;
    this.updateStats();
    console.log(`🎯 CACHE HIT: ${key} (age: ${Math.round((now - entry.timestamp) / 1000)}s)`);
    return entry.data;
  }

  /**
   * 💾 Set cache data με appropriate TTL
   */
  public set<T>(key: string, data: T, customTTL?: number): void {
    const ttl = customTTL || this.getTTLForKey(key);

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      key
    };

    this.cache.set(key, entry);
    this.stats.cacheSize = this.cache.size;

    console.log(`📥 CACHE SET: ${key} (TTL: ${Math.round(ttl / 1000)}s)`);
  }

  /**
   * 🗑️ Delete specific cache entry
   */
  public delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.stats.cacheSize = this.cache.size;

    if (deleted) {
      console.log(`🗑️ CACHE DELETE: ${key}`);
    }

    return deleted;
  }

  /**
   * 🔥 Invalidate cache για specific patterns
   */
  public invalidatePattern(pattern: string): number {
    let deletedCount = 0;

    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    this.stats.cacheSize = this.cache.size;
    console.log(`🔥 CACHE INVALIDATE: Pattern "${pattern}" (${deletedCount} entries deleted)`);

    return deletedCount;
  }

  /**
   * 🧹 Clean expired entries
   */
  public cleanup(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    this.stats.cacheSize = this.cache.size;

    if (cleanedCount > 0) {
      console.log(`🧹 CACHE CLEANUP: ${cleanedCount} expired entries removed`);
    }

    return cleanedCount;
  }

  /**
   * 📊 Get cache statistics
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 🔄 Clear entire cache
   */
  public clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      totalQueries: 0,
      hitRatio: 0,
      cacheSize: 0
    };
    console.log('🔄 CACHE CLEARED');
  }

  /**
   * ⏰ Get TTL για specific cache key
   */
  private getTTLForKey(key: string): number {
    if (key.includes('companies')) return this.TTL_CONFIG.companies;
    if (key.includes('projects')) return this.TTL_CONFIG.projects;
    if (key.includes('buildings')) return this.TTL_CONFIG.buildings;
    if (key.includes('storages')) return this.TTL_CONFIG.storages;
    if (key.includes('floors')) return this.TTL_CONFIG.floors;
    if (key.includes('units')) return this.TTL_CONFIG.units;
    if (key.includes('navigation')) return this.TTL_CONFIG.navigation;
    return this.TTL_CONFIG.default;
  }

  /**
   * 📈 Update cache statistics
   */
  private updateStats(): void {
    this.stats.hitRatio = this.stats.totalQueries > 0
      ? (this.stats.hits / this.stats.totalQueries) * 100
      : 0;
    this.stats.cacheSize = this.cache.size;
  }
}

/**
 * 🎯 Cache Helper Functions
 */
export class CacheHelpers {
  private static cache = EnterpriseAPICache.getInstance();

  /**
   * 🏢 Cache companies data
   */
  static cacheCompanies(companies: any[]): void {
    this.cache.set('api:companies', companies);
  }

  static getCachedCompanies(): any[] | null {
    return this.cache.get('api:companies');
  }

  /**
   * 🏗️ Cache projects data για specific company
   */
  static cacheProjectsByCompany(companyId: string, projects: any[]): void {
    this.cache.set(`api:projects:company:${companyId}`, projects);
  }

  static getCachedProjectsByCompany(companyId: string): any[] | null {
    return this.cache.get(`api:projects:company:${companyId}`);
  }

  /**
   * 🏢 Cache buildings για specific project
   */
  static cacheBuildingsByProject(projectId: string, buildings: any[]): void {
    this.cache.set(`api:buildings:project:${projectId}`, buildings);
  }

  static getCachedBuildingsByProject(projectId: string): any[] | null {
    return this.cache.get(`api:buildings:project:${projectId}`);
  }

  /**
   * 🏢 Cache all buildings data
   */
  static cacheAllBuildings(buildings: any[]): void {
    this.cache.set('api:buildings:all', buildings);
  }

  static getCachedAllBuildings(): any[] | null {
    return this.cache.get('api:buildings:all');
  }

  /**
   * 📦 Cache storages για specific project
   */
  static cacheStoragesByProject(projectId: string, storages: any[]): void {
    this.cache.set(`api:storages:project:${projectId}`, storages);
  }

  static getCachedStoragesByProject(projectId: string): any[] | null {
    return this.cache.get(`api:storages:project:${projectId}`);
  }

  /**
   * 📦 Cache all storages data
   */
  static cacheAllStorages(storages: any[]): void {
    this.cache.set('api:storages:all', storages);
  }

  static getCachedAllStorages(): any[] | null {
    return this.cache.get('api:storages:all');
  }

  /**
   * 🔥 Smart cache invalidation
   */
  static invalidateCompanyData(companyId: string): void {
    this.cache.invalidatePattern(`company:${companyId}`);
    this.cache.invalidatePattern(`projects:company:${companyId}`);
  }

  static invalidateProjectData(projectId: string): void {
    this.cache.invalidatePattern(`project:${projectId}`);
    this.cache.invalidatePattern(`buildings:project:${projectId}`);
    this.cache.invalidatePattern(`storages:project:${projectId}`);
  }

  /**
   * 🧹 Automatic cleanup (call this periodically)
   */
  static runMaintenance(): void {
    this.cache.cleanup();

    // Log stats periodically
    const stats = this.cache.getStats();
    if (stats.totalQueries > 0) {
      console.log(`📊 CACHE STATS: ${stats.hitRatio.toFixed(1)}% hit ratio (${stats.hits}/${stats.totalQueries}), ${stats.cacheSize} entries`);
    }
  }
}

// Auto-cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    CacheHelpers.runMaintenance();
  }, 5 * 60 * 1000);
}

// Export global cache instance
export const apiCache = EnterpriseAPICache.getInstance();
export default EnterpriseAPICache;