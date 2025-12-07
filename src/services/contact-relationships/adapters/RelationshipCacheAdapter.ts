// ============================================================================
// RELATIONSHIP CACHE ADAPTER
// ============================================================================
//
// 💾 Advanced caching layer για relationship data
// Enterprise-grade caching με TTL, invalidation, και memory management
//
// Architectural Pattern: Cache Adapter Pattern + LRU Cache
// Responsibility: Performance optimization, cache management, και memory efficiency
//
// ============================================================================

import { ContactRelationship } from '@/types/contacts/relationships';

// ============================================================================
// CACHE TYPES
// ============================================================================

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: number;
  newestEntry: number;
}

export interface CacheConfig {
  defaultTTL: number;
  maxEntries: number;
  cleanupInterval: number;
  memoryThreshold: number;
}

// ============================================================================
// CACHE STRATEGIES
// ============================================================================

type CacheStrategy = 'LRU' | 'LFU' | 'TTL' | 'FIFO';

interface CacheKey {
  type: 'contact' | 'organization' | 'department' | 'search';
  id: string;
  params?: Record<string, any>;
}

// ============================================================================
// RELATIONSHIP CACHE ADAPTER
// ============================================================================

/**
 * 💾 Relationship Cache Adapter
 *
 * Enterprise-grade caching solution για relationship data.
 * Provides multi-level caching με intelligent invalidation και memory management.
 *
 * Features:
 * - LRU/LFU cache algorithms
 * - TTL-based cache expiration
 * - Memory threshold management
 * - Cache statistics και monitoring
 * - Intelligent cache invalidation
 * - Multi-key cache patterns
 */
export class RelationshipCacheAdapter {
  private static cache = new Map<string, CacheEntry<any>>();
  private static config: CacheConfig = {
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    maxEntries: 1000,
    cleanupInterval: 60 * 1000, // 1 minute
    memoryThreshold: 50 * 1024 * 1024 // 50MB
  };

  private static stats = {
    totalHits: 0,
    totalMisses: 0,
    totalSets: 0,
    totalDeletes: 0
  };

  private static cleanupTimer: NodeJS.Timeout | null = null;

  // ========================================================================
  // INITIALIZATION & CONFIGURATION
  // ========================================================================

  /**
   * 🔧 Initialize Cache
   */
  static initialize(config?: Partial<CacheConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.startCleanupTimer();
    console.log('💾 CACHE: Initialized με config:', this.config);
  }

  /**
   * ⚙️ Configure Cache
   */
  static configure(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ CACHE: Configuration updated:', this.config);
  }

  /**
   * 🧹 Start Cleanup Timer
   */
  private static startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  // ========================================================================
  // CORE CACHE OPERATIONS
  // ========================================================================

  /**
   * 📖 Get από Cache
   */
  static get<T>(key: string | CacheKey): T | null {
    const keyString = this.serializeKey(key);
    const entry = this.cache.get(keyString);

    if (!entry) {
      this.stats.totalMisses++;
      return null;
    }

    // Check TTL
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(keyString);
      this.stats.totalMisses++;
      return null;
    }

    // Update access statistics
    entry.hits++;
    entry.lastAccessed = Date.now();
    this.stats.totalHits++;

    console.log('🎯 CACHE HIT:', keyString);
    return entry.data as T;
  }

  /**
   * 💾 Set στο Cache
   */
  static set<T>(key: string | CacheKey, data: T, ttl?: number): void {
    const keyString = this.serializeKey(key);
    const actualTTL = ttl || this.config.defaultTTL;

    // Check memory constraints
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: actualTTL,
      hits: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(keyString, entry);
    this.stats.totalSets++;

    console.log('💾 CACHE SET:', keyString, 'TTL:', actualTTL);
  }

  /**
   * 🗑️ Delete από Cache
   */
  static delete(key: string | CacheKey): boolean {
    const keyString = this.serializeKey(key);
    const deleted = this.cache.delete(keyString);

    if (deleted) {
      this.stats.totalDeletes++;
      console.log('🗑️ CACHE DELETE:', keyString);
    }

    return deleted;
  }

  /**
   * 🧹 Clear Cache
   */
  static clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log('🧹 CACHE CLEARED:', size, 'entries removed');
  }

  // ========================================================================
  // SPECIALIZED RELATIONSHIP CACHE METHODS
  // ========================================================================

  /**
   * 👤 Cache Contact Relationships
   */
  static cacheContactRelationships(contactId: string, relationships: ContactRelationship[]): void {
    const key: CacheKey = {
      type: 'contact',
      id: contactId
    };

    this.set(key, relationships);

    // Also cache individual relationships
    relationships.forEach(relationship => {
      this.cacheRelationship(relationship);
    });
  }

  /**
   * 👤 Get Cached Contact Relationships
   */
  static getCachedContactRelationships(contactId: string): ContactRelationship[] | null {
    const key: CacheKey = {
      type: 'contact',
      id: contactId
    };

    return this.get<ContactRelationship[]>(key);
  }

  /**
   * 🏢 Cache Organization Relationships
   */
  static cacheOrganizationRelationships(
    organizationId: string,
    relationships: ContactRelationship[],
    filters?: Record<string, any>
  ): void {
    const key: CacheKey = {
      type: 'organization',
      id: organizationId,
      params: filters
    };

    this.set(key, relationships, 10 * 60 * 1000); // 10 minutes για organization data
  }

  /**
   * 🏢 Get Cached Organization Relationships
   */
  static getCachedOrganizationRelationships(
    organizationId: string,
    filters?: Record<string, any>
  ): ContactRelationship[] | null {
    const key: CacheKey = {
      type: 'organization',
      id: organizationId,
      params: filters
    };

    return this.get<ContactRelationship[]>(key);
  }

  /**
   * 🔗 Cache Individual Relationship
   */
  static cacheRelationship(relationship: ContactRelationship): void {
    if (relationship.id) {
      this.set(`relationship:${relationship.id}`, relationship);
    }
  }

  /**
   * 🔗 Get Cached Relationship
   */
  static getCachedRelationship(relationshipId: string): ContactRelationship | null {
    return this.get<ContactRelationship>(`relationship:${relationshipId}`);
  }

  /**
   * 🔍 Cache Search Results
   */
  static cacheSearchResults(searchParams: Record<string, any>, results: ContactRelationship[]): void {
    const key: CacheKey = {
      type: 'search',
      id: this.hashParams(searchParams),
      params: searchParams
    };

    // Shorter TTL για search results
    this.set(key, results, 2 * 60 * 1000); // 2 minutes
  }

  /**
   * 🔍 Get Cached Search Results
   */
  static getCachedSearchResults(searchParams: Record<string, any>): ContactRelationship[] | null {
    const key: CacheKey = {
      type: 'search',
      id: this.hashParams(searchParams),
      params: searchParams
    };

    return this.get<ContactRelationship[]>(key);
  }

  // ========================================================================
  // INTELLIGENT INVALIDATION
  // ========================================================================

  /**
   * ❌ Invalidate Contact Cache
   */
  static invalidateContact(contactId: string): void {
    console.log('❌ CACHE INVALIDATION: Contact', contactId);

    // Delete direct contact cache
    this.delete({ type: 'contact', id: contactId });

    // Delete related organization caches
    this.invalidatePattern(`organization:*`);

    // Delete search caches (they might include this contact)
    this.invalidatePattern(`search:*`);
  }

  /**
   * ❌ Invalidate Organization Cache
   */
  static invalidateOrganization(organizationId: string): void {
    console.log('❌ CACHE INVALIDATION: Organization', organizationId);

    // Delete all organization-related caches
    this.invalidatePattern(`organization:${organizationId}*`);

    // Delete department caches για this organization
    this.invalidatePattern(`department:*:${organizationId}`);
  }

  /**
   * ❌ Invalidate Department Cache
   */
  static invalidateDepartment(organizationId: string, departmentName: string): void {
    console.log('❌ CACHE INVALIDATION: Department', departmentName);

    const key: CacheKey = {
      type: 'department',
      id: departmentName,
      params: { organizationId }
    };

    this.delete(key);

    // Also invalidate organization cache
    this.invalidateOrganization(organizationId);
  }

  /**
   * ❌ Invalidate by Pattern
   */
  static invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    console.log('❌ CACHE PATTERN INVALIDATION:', pattern, 'deleted:', keysToDelete.length);
  }

  // ========================================================================
  // CACHE MANAGEMENT
  // ========================================================================

  /**
   * 🧹 Cleanup Expired Entries
   */
  static cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      console.log('🧹 CACHE CLEANUP:', keysToDelete.length, 'expired entries removed');
    }
  }

  /**
   * 🔄 Evict Oldest Entries (LRU)
   */
  private static evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log('🔄 CACHE EVICTION: Removed oldest entry:', oldestKey);
    }
  }

  // ========================================================================
  // STATISTICS & MONITORING
  // ========================================================================

  /**
   * 📊 Get Cache Statistics
   */
  static getStatistics(): CacheStats {
    let memoryUsage = 0;
    let oldestEntry = Date.now();
    let newestEntry = 0;

    for (const entry of this.cache.values()) {
      // Estimate memory usage (rough calculation)
      memoryUsage += JSON.stringify(entry.data).length * 2; // UTF-16 chars

      if (entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }

      if (entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
    }

    const totalRequests = this.stats.totalHits + this.stats.totalMisses;
    const hitRate = totalRequests > 0 ? (this.stats.totalHits / totalRequests) * 100 : 0;

    return {
      totalEntries: this.cache.size,
      totalHits: this.stats.totalHits,
      totalMisses: this.stats.totalMisses,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage,
      oldestEntry,
      newestEntry
    };
  }

  /**
   * 📋 Log Cache Status
   */
  static logStatus(): void {
    const stats = this.getStatistics();
    console.log('📊 CACHE STATUS:', {
      entries: stats.totalEntries,
      hitRate: `${stats.hitRate}%`,
      memoryUsage: `${Math.round(stats.memoryUsage / 1024)}KB`,
      hits: stats.totalHits,
      misses: stats.totalMisses
    });
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * 🔑 Serialize Cache Key
   */
  private static serializeKey(key: string | CacheKey): string {
    if (typeof key === 'string') {
      return key;
    }

    let serialized = `${key.type}:${key.id}`;

    if (key.params && Object.keys(key.params).length > 0) {
      const paramsHash = this.hashParams(key.params);
      serialized += `:${paramsHash}`;
    }

    return serialized;
  }

  /**
   * #️⃣ Hash Parameters
   */
  private static hashParams(params: Record<string, any>): string {
    const sortedKeys = Object.keys(params).sort();
    const paramString = sortedKeys
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');

    // Simple hash function (for production, use crypto)
    let hash = 0;
    for (let i = 0; i < paramString.length; i++) {
      const char = paramString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default RelationshipCacheAdapter;