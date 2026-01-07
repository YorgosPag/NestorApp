/**
 * 🏢 ENTERPRISE: Entity Linking Cache Layer
 *
 * Cache wrapper for entity linking operations.
 * Uses the existing EnterpriseAPICache for storage.
 *
 * @author Claude AI Assistant
 * @created 2026-01-07
 * @pattern Cache Aside Pattern (Enterprise Standard)
 *
 * @example
 * ```typescript
 * import { EntityLinkingCache } from './cache';
 *
 * // Get available buildings (with cache)
 * const buildings = await EntityLinkingCache.getOrFetch(
 *   'available-buildings:project123',
 *   () => fetchBuildings('project123')
 * );
 * ```
 */

import { EnterpriseAPICache, apiCache } from '@/lib/cache/enterprise-api-cache';
import type { EntityType, EntityWithMetadata } from '../types';

// ============================================================================
// 🏢 ENTERPRISE: Cache Configuration
// ============================================================================

/**
 * Cache key prefixes for entity linking operations
 */
export const ENTITY_LINKING_CACHE_KEYS = {
  AVAILABLE_ENTITIES: 'entity-linking:available',
  LINKED_ENTITIES: 'entity-linking:linked',
  ENTITY_DETAILS: 'entity-linking:details',
  RELATIONSHIP_STATUS: 'entity-linking:status',
} as const;

/**
 * TTL configuration for entity linking cache (in milliseconds)
 */
export const ENTITY_LINKING_TTL = {
  /** Available entities list - short TTL as it changes frequently */
  AVAILABLE_ENTITIES: 30 * 1000, // 30 seconds
  /** Linked entities list - medium TTL */
  LINKED_ENTITIES: 60 * 1000, // 1 minute
  /** Entity details - longer TTL */
  ENTITY_DETAILS: 2 * 60 * 1000, // 2 minutes
  /** Relationship status - short TTL */
  RELATIONSHIP_STATUS: 15 * 1000, // 15 seconds
} as const;

// ============================================================================
// 🏢 ENTERPRISE: Cache Key Builders
// ============================================================================

/**
 * Build cache key for available entities
 */
export function buildAvailableEntitiesKey(entityType: EntityType, parentId?: string): string {
  const base = `${ENTITY_LINKING_CACHE_KEYS.AVAILABLE_ENTITIES}:${entityType}`;
  return parentId ? `${base}:parent:${parentId}` : base;
}

/**
 * Build cache key for linked entities
 */
export function buildLinkedEntitiesKey(parentType: EntityType, parentId: string): string {
  return `${ENTITY_LINKING_CACHE_KEYS.LINKED_ENTITIES}:${parentType}:${parentId}`;
}

/**
 * Build cache key for entity details
 */
export function buildEntityDetailsKey(entityType: EntityType, entityId: string): string {
  return `${ENTITY_LINKING_CACHE_KEYS.ENTITY_DETAILS}:${entityType}:${entityId}`;
}

/**
 * Build cache key for relationship status
 */
export function buildRelationshipStatusKey(entityId: string, parentId: string): string {
  return `${ENTITY_LINKING_CACHE_KEYS.RELATIONSHIP_STATUS}:${entityId}:${parentId}`;
}

// ============================================================================
// 🏢 ENTERPRISE: Entity Linking Cache Class
// ============================================================================

/**
 * 📦 Entity Linking Cache
 *
 * Provides caching functionality for entity linking operations.
 * Uses the existing EnterpriseAPICache singleton.
 *
 * Features:
 * - Automatic TTL management
 * - Pattern-based invalidation
 * - Cache-aside pattern with fetch callback
 * - Type-safe cache operations
 */
export class EntityLinkingCache {
  private static cache: EnterpriseAPICache = apiCache;

  // ==========================================================================
  // CACHE READ OPERATIONS
  // ==========================================================================

  /**
   * Get available entities from cache
   */
  static getAvailableEntities(
    entityType: EntityType,
    parentId?: string
  ): EntityWithMetadata[] | null {
    const key = buildAvailableEntitiesKey(entityType, parentId);
    return this.cache.get<EntityWithMetadata[]>(key);
  }

  /**
   * Get linked entities from cache
   */
  static getLinkedEntities(
    parentType: EntityType,
    parentId: string
  ): EntityWithMetadata[] | null {
    const key = buildLinkedEntitiesKey(parentType, parentId);
    return this.cache.get<EntityWithMetadata[]>(key);
  }

  /**
   * Get entity details from cache
   */
  static getEntityDetails<T extends EntityWithMetadata>(
    entityType: EntityType,
    entityId: string
  ): T | null {
    const key = buildEntityDetailsKey(entityType, entityId);
    return this.cache.get<T>(key);
  }

  // ==========================================================================
  // CACHE WRITE OPERATIONS
  // ==========================================================================

  /**
   * Cache available entities
   */
  static setAvailableEntities(
    entityType: EntityType,
    entities: EntityWithMetadata[],
    parentId?: string
  ): void {
    const key = buildAvailableEntitiesKey(entityType, parentId);
    this.cache.set(key, entities, ENTITY_LINKING_TTL.AVAILABLE_ENTITIES);
  }

  /**
   * Cache linked entities
   */
  static setLinkedEntities(
    parentType: EntityType,
    parentId: string,
    entities: EntityWithMetadata[]
  ): void {
    const key = buildLinkedEntitiesKey(parentType, parentId);
    this.cache.set(key, entities, ENTITY_LINKING_TTL.LINKED_ENTITIES);
  }

  /**
   * Cache entity details
   */
  static setEntityDetails<T extends EntityWithMetadata>(
    entityType: EntityType,
    entityId: string,
    entity: T
  ): void {
    const key = buildEntityDetailsKey(entityType, entityId);
    this.cache.set(key, entity, ENTITY_LINKING_TTL.ENTITY_DETAILS);
  }

  // ==========================================================================
  // CACHE INVALIDATION
  // ==========================================================================

  /**
   * Invalidate all cache entries for an entity type
   */
  static invalidateEntityType(entityType: EntityType): number {
    return this.cache.invalidatePattern(`entity-linking:${entityType}`);
  }

  /**
   * Invalidate cache when an entity is linked/unlinked
   */
  static invalidateOnLink(
    entityType: EntityType,
    entityId: string,
    parentId: string
  ): void {
    // Invalidate available entities cache
    this.cache.invalidatePattern(buildAvailableEntitiesKey(entityType));

    // Invalidate entity details
    this.cache.delete(buildEntityDetailsKey(entityType, entityId));

    // Invalidate parent's linked entities
    this.cache.invalidatePattern(`${ENTITY_LINKING_CACHE_KEYS.LINKED_ENTITIES}:${parentId}`);

    // Invalidate relationship status
    this.cache.delete(buildRelationshipStatusKey(entityId, parentId));

    console.log(
      `🔥 [EntityLinkingCache] Invalidated cache for ${entityType}:${entityId} → ${parentId}`
    );
  }

  /**
   * Invalidate all entity linking cache
   */
  static invalidateAll(): number {
    return this.cache.invalidatePattern('entity-linking:');
  }

  // ==========================================================================
  // CACHE-ASIDE PATTERN
  // ==========================================================================

  /**
   * 📦 Get from cache or fetch from source
   *
   * Implements the Cache-Aside pattern:
   * 1. Check cache first
   * 2. If miss, fetch from source
   * 3. Store in cache
   * 4. Return data
   *
   * @param key - Cache key
   * @param fetchFn - Function to fetch data if not in cache
   * @param ttl - Optional custom TTL
   * @returns Cached or fetched data
   *
   * @example
   * ```typescript
   * const buildings = await EntityLinkingCache.getOrFetch(
   *   'available-buildings:project123',
   *   () => fetchAvailableBuildings('project123'),
   *   30000 // 30 seconds TTL
   * );
   * ```
   */
  static async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try cache first
    const cached = this.cache.get<T>(key);
    if (cached !== null) {
      console.log(`🎯 [EntityLinkingCache] Cache hit: ${key}`);
      return cached;
    }

    // Cache miss - fetch from source
    console.log(`📥 [EntityLinkingCache] Cache miss, fetching: ${key}`);
    const data = await fetchFn();

    // Store in cache
    this.cache.set(key, data, ttl);

    return data;
  }

  /**
   * Get available entities with cache-aside pattern
   */
  static async getOrFetchAvailableEntities(
    entityType: EntityType,
    fetchFn: () => Promise<EntityWithMetadata[]>,
    parentId?: string
  ): Promise<EntityWithMetadata[]> {
    const key = buildAvailableEntitiesKey(entityType, parentId);
    return this.getOrFetch(key, fetchFn, ENTITY_LINKING_TTL.AVAILABLE_ENTITIES);
  }

  /**
   * Get linked entities with cache-aside pattern
   */
  static async getOrFetchLinkedEntities(
    parentType: EntityType,
    parentId: string,
    fetchFn: () => Promise<EntityWithMetadata[]>
  ): Promise<EntityWithMetadata[]> {
    const key = buildLinkedEntitiesKey(parentType, parentId);
    return this.getOrFetch(key, fetchFn, ENTITY_LINKING_TTL.LINKED_ENTITIES);
  }

  // ==========================================================================
  // CACHE STATISTICS
  // ==========================================================================

  /**
   * Get cache statistics
   */
  static getStats(): {
    hits: number;
    misses: number;
    hitRatio: number;
    cacheSize: number;
  } {
    return this.cache.getStats();
  }

  /**
   * Run cache maintenance (cleanup expired entries)
   */
  static runMaintenance(): number {
    return this.cache.cleanup();
  }
}

// Default export
export default EntityLinkingCache;
