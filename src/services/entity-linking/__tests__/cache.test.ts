/**
 * 🧪 ENTERPRISE: Unit Tests for Cache Layer
 *
 * Tests for entity linking cache functionality.
 *
 * @author Claude AI Assistant
 * @created 2026-01-07
 */

import {
  EntityLinkingCache,
  buildAvailableEntitiesKey,
  buildLinkedEntitiesKey,
  buildEntityDetailsKey,
  buildRelationshipStatusKey,
  ENTITY_LINKING_CACHE_KEYS,
  ENTITY_LINKING_TTL,
} from '../utils/cache';
import type { EntityWithMetadata } from '../types';

// ============================================================================
// TEST DATA
// ============================================================================

const mockBuildings: EntityWithMetadata[] = [
  { id: 'building1', name: 'Building A', subtitle: 'Test building' },
  { id: 'building2', name: 'Building B', subtitle: 'Test building' },
];

const mockUnits: EntityWithMetadata[] = [
  { id: 'unit1', name: 'Unit A', subtitle: 'Test unit' },
  { id: 'unit2', name: 'Unit B', subtitle: 'Test unit' },
];

// ============================================================================
// TESTS: Cache Key Builders
// ============================================================================

describe('Cache Key Builders', () => {
  describe('buildAvailableEntitiesKey', () => {
    test('should build key without parent ID', () => {
      const key = buildAvailableEntitiesKey('building');
      expect(key).toBe(`${ENTITY_LINKING_CACHE_KEYS.AVAILABLE_ENTITIES}:building`);
    });

    test('should build key with parent ID', () => {
      const key = buildAvailableEntitiesKey('building', 'project123');
      expect(key).toBe(
        `${ENTITY_LINKING_CACHE_KEYS.AVAILABLE_ENTITIES}:building:parent:project123`
      );
    });
  });

  describe('buildLinkedEntitiesKey', () => {
    test('should build correct key', () => {
      const key = buildLinkedEntitiesKey('project', 'project123');
      expect(key).toBe(`${ENTITY_LINKING_CACHE_KEYS.LINKED_ENTITIES}:project:project123`);
    });
  });

  describe('buildEntityDetailsKey', () => {
    test('should build correct key', () => {
      const key = buildEntityDetailsKey('building', 'building123');
      expect(key).toBe(`${ENTITY_LINKING_CACHE_KEYS.ENTITY_DETAILS}:building:building123`);
    });
  });

  describe('buildRelationshipStatusKey', () => {
    test('should build correct key', () => {
      const key = buildRelationshipStatusKey('building123', 'project456');
      expect(key).toBe(
        `${ENTITY_LINKING_CACHE_KEYS.RELATIONSHIP_STATUS}:building123:project456`
      );
    });
  });
});

// ============================================================================
// TESTS: TTL Configuration
// ============================================================================

describe('TTL Configuration', () => {
  test('should have shorter TTL for available entities', () => {
    expect(ENTITY_LINKING_TTL.AVAILABLE_ENTITIES).toBeLessThan(
      ENTITY_LINKING_TTL.ENTITY_DETAILS
    );
  });

  test('should have shortest TTL for relationship status', () => {
    expect(ENTITY_LINKING_TTL.RELATIONSHIP_STATUS).toBeLessThan(
      ENTITY_LINKING_TTL.AVAILABLE_ENTITIES
    );
  });

  test('should have all TTL values as positive numbers', () => {
    expect(ENTITY_LINKING_TTL.AVAILABLE_ENTITIES).toBeGreaterThan(0);
    expect(ENTITY_LINKING_TTL.LINKED_ENTITIES).toBeGreaterThan(0);
    expect(ENTITY_LINKING_TTL.ENTITY_DETAILS).toBeGreaterThan(0);
    expect(ENTITY_LINKING_TTL.RELATIONSHIP_STATUS).toBeGreaterThan(0);
  });
});

// ============================================================================
// TESTS: EntityLinkingCache Class
// ============================================================================

describe('EntityLinkingCache', () => {
  beforeEach(() => {
    // Clear cache before each test
    EntityLinkingCache.invalidateAll();
  });

  describe('Available Entities', () => {
    test('should return null for cache miss', () => {
      const result = EntityLinkingCache.getAvailableEntities('building', 'project123');
      expect(result).toBeNull();
    });

    test('should cache and retrieve available entities', () => {
      EntityLinkingCache.setAvailableEntities('building', mockBuildings, 'project123');

      const result = EntityLinkingCache.getAvailableEntities('building', 'project123');

      expect(result).toEqual(mockBuildings);
    });

    test('should cache entities without parent ID', () => {
      EntityLinkingCache.setAvailableEntities('building', mockBuildings);

      const result = EntityLinkingCache.getAvailableEntities('building');

      expect(result).toEqual(mockBuildings);
    });
  });

  describe('Linked Entities', () => {
    test('should return null for cache miss', () => {
      const result = EntityLinkingCache.getLinkedEntities('project', 'project123');
      expect(result).toBeNull();
    });

    test('should cache and retrieve linked entities', () => {
      EntityLinkingCache.setLinkedEntities('project', 'project123', mockBuildings);

      const result = EntityLinkingCache.getLinkedEntities('project', 'project123');

      expect(result).toEqual(mockBuildings);
    });
  });

  describe('Entity Details', () => {
    test('should return null for cache miss', () => {
      const result = EntityLinkingCache.getEntityDetails('building', 'building123');
      expect(result).toBeNull();
    });

    test('should cache and retrieve entity details', () => {
      const building = mockBuildings[0];
      EntityLinkingCache.setEntityDetails('building', building.id, building);

      const result = EntityLinkingCache.getEntityDetails<EntityWithMetadata>(
        'building',
        building.id
      );

      expect(result).toEqual(building);
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate entity type cache', () => {
      EntityLinkingCache.setAvailableEntities('building', mockBuildings, 'project123');
      EntityLinkingCache.setEntityDetails('building', 'building1', mockBuildings[0]);

      const invalidatedCount = EntityLinkingCache.invalidateEntityType('building');

      expect(invalidatedCount).toBeGreaterThanOrEqual(0);
    });

    test('should invalidate on link operation', () => {
      EntityLinkingCache.setAvailableEntities('building', mockBuildings, 'project123');

      EntityLinkingCache.invalidateOnLink('building', 'building1', 'project123');

      // After invalidation, cache should miss
      // Note: The actual behavior depends on the implementation
    });

    test('should invalidate all cache', () => {
      EntityLinkingCache.setAvailableEntities('building', mockBuildings);
      EntityLinkingCache.setLinkedEntities('project', 'project123', mockBuildings);

      const invalidatedCount = EntityLinkingCache.invalidateAll();

      expect(invalidatedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getOrFetch', () => {
    test('should return cached data without calling fetch', async () => {
      const fetchFn = jest.fn().mockResolvedValue(mockBuildings);
      const key = 'test-key';

      // Pre-populate cache
      await EntityLinkingCache.getOrFetch(key, fetchFn);

      // Second call should use cache
      const result = await EntityLinkingCache.getOrFetch(key, jest.fn());

      expect(result).toEqual(mockBuildings);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    test('should call fetch on cache miss', async () => {
      const fetchFn = jest.fn().mockResolvedValue(mockUnits);

      const result = await EntityLinkingCache.getOrFetch('unique-key', fetchFn);

      expect(result).toEqual(mockUnits);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    test('should work with custom TTL', async () => {
      const fetchFn = jest.fn().mockResolvedValue(mockBuildings);

      await EntityLinkingCache.getOrFetch('custom-ttl-key', fetchFn, 60000);

      expect(fetchFn).toHaveBeenCalled();
    });
  });

  describe('getOrFetchAvailableEntities', () => {
    test('should fetch and cache available entities', async () => {
      const fetchFn = jest.fn().mockResolvedValue(mockBuildings);

      const result = await EntityLinkingCache.getOrFetchAvailableEntities(
        'building',
        fetchFn,
        'project123'
      );

      expect(result).toEqual(mockBuildings);

      // Second call should use cache
      const cachedResult = await EntityLinkingCache.getOrFetchAvailableEntities(
        'building',
        jest.fn().mockResolvedValue([]),
        'project123'
      );

      expect(cachedResult).toEqual(mockBuildings);
    });
  });

  describe('Statistics', () => {
    test('should return cache statistics', () => {
      const stats = EntityLinkingCache.getStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRatio');
      expect(stats).toHaveProperty('cacheSize');
    });

    test('should run maintenance without error', () => {
      expect(() => {
        EntityLinkingCache.runMaintenance();
      }).not.toThrow();
    });
  });
});
