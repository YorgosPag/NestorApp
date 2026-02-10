/**
 * 🏢 ENTERPRISE RELATIONSHIP HOOKS
 *
 * React hooks για centralized relationship management
 * Provides type-safe, cached, real-time relationship operations
 *
 * @enterprise Production-ready με error handling, caching, optimistic updates
 * @author Enterprise Development Team
 * @date 2025-12-15
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import type {
  EntityType,
  RelationshipOperationResult,
  IntegrityValidationResult,
  CascadeDeleteResult,
  RelationshipAuditEntry,
  CreateRelationshipOptions,
  RemoveRelationshipOptions,
  HierarchyQueryOptions,
  CascadeDeleteOptions,
  AuditQueryOptions,
  EntityHierarchyTree
} from '../enterprise-relationship-engine.contracts';

// ============================================================================
// RELATIONSHIP CACHE MANAGEMENT
// ============================================================================

interface RelationshipCache {
  readonly children: Map<string, readonly unknown[]>;
  readonly parents: Map<string, unknown | null>;
  readonly hierarchies: Map<string, EntityHierarchyTree>;
  readonly lastUpdated: Map<string, number>;
}

interface RelationshipState {
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: RelationshipCache;
}

// ============================================================================
// ENTERPRISE RELATIONSHIP OPERATIONS HOOK
// ============================================================================

export interface UseEnterpriseRelationshipsResult {
  // 🔗 RELATIONSHIP OPERATIONS
  readonly createRelationship: (
    parentType: EntityType,
    parentId: string,
    childType: EntityType,
    childId: string,
    options?: CreateRelationshipOptions
  ) => Promise<RelationshipOperationResult>;

  readonly removeRelationship: (
    relationshipId: string,
    options?: RemoveRelationshipOptions
  ) => Promise<RelationshipOperationResult>;

  // 🔍 BIDIRECTIONAL QUERIES
  readonly getChildren: <TChild>(
    parentType: EntityType,
    parentId: string,
    childType: EntityType,
    useCache?: boolean
  ) => Promise<readonly TChild[]>;

  readonly getParent: <TParent>(
    childType: EntityType,
    childId: string,
    parentType: EntityType,
    useCache?: boolean
  ) => Promise<TParent | null>;

  readonly getHierarchy: (
    rootType: EntityType,
    rootId: string,
    options?: HierarchyQueryOptions,
    useCache?: boolean
  ) => Promise<EntityHierarchyTree>;

  // 🛡️ INTEGRITY & VALIDATION
  readonly validateIntegrity: () => Promise<IntegrityValidationResult>;

  // 🗑️ CASCADE OPERATIONS
  readonly cascadeDelete: (
    entityType: EntityType,
    entityId: string,
    options?: CascadeDeleteOptions
  ) => Promise<CascadeDeleteResult>;

  // 📋 AUDIT TRAIL
  readonly getAuditTrail: (
    entityType: EntityType,
    entityId: string,
    options?: AuditQueryOptions
  ) => Promise<readonly RelationshipAuditEntry[]>;

  // 🔄 CACHE MANAGEMENT
  readonly invalidateCache: (
    cacheType?: 'children' | 'parents' | 'hierarchies' | 'all'
  ) => void;

  readonly getCacheStats: () => {
    readonly childrenCacheSize: number;
    readonly parentsCacheSize: number;
    readonly hierarchiesCacheSize: number;
    readonly oldestEntry: number | null;
  };

  // 📊 STATE
  readonly state: RelationshipState;
}

export function useEnterpriseRelationships(): UseEnterpriseRelationshipsResult {
  // ========================================
  // STATE MANAGEMENT
  // ========================================

  const [state, setState] = useState<RelationshipState>({
    loading: false,
    error: null,
    cache: {
      children: new Map(),
      parents: new Map(),
      hierarchies: new Map(),
      lastUpdated: new Map()
    }
  });

  // ========================================
  // CACHE UTILITIES
  // ========================================

  const getCacheKey = useCallback((
    operation: string,
    ...params: readonly (string | EntityType | undefined)[]
  ): string => {
    return `${operation}:${params.filter(Boolean).join(':')}`;
  }, []);

  const isCacheValid = useCallback((cacheKey: string, maxAge: number = 5 * 60 * 1000): boolean => {
    const lastUpdated = state.cache.lastUpdated.get(cacheKey);
    if (!lastUpdated) return false;
    return Date.now() - lastUpdated < maxAge;
  }, [state.cache.lastUpdated]);

  const updateCache = useCallback(<T>(
    cacheMap: Map<string, T>,
    cacheKey: string,
    data: T
  ): void => {
    setState(prevState => ({
      ...prevState,
      cache: {
        ...prevState.cache,
        lastUpdated: new Map(prevState.cache.lastUpdated.set(cacheKey, Date.now()))
      }
    }));

    cacheMap.set(cacheKey, data);
  }, []);

  const invalidateCache = useCallback((
    cacheType: 'children' | 'parents' | 'hierarchies' | 'all' = 'all'
  ): void => {
    setState(prevState => {
      const newCache = { ...prevState.cache };

      switch (cacheType) {
        case 'children':
          newCache.children = new Map();
          break;
        case 'parents':
          newCache.parents = new Map();
          break;
        case 'hierarchies':
          newCache.hierarchies = new Map();
          break;
        case 'all':
          newCache.children = new Map();
          newCache.parents = new Map();
          newCache.hierarchies = new Map();
          newCache.lastUpdated = new Map();
          break;
      }

      return {
        ...prevState,
        cache: newCache,
        error: null
      };
    });
  }, []);

  // ========================================
  // RELATIONSHIP OPERATIONS
  // ========================================

  const createRelationship = useCallback(async (
    parentType: EntityType,
    parentId: string,
    childType: EntityType,
    childId: string,
    options: CreateRelationshipOptions = {}
  ): Promise<RelationshipOperationResult> => {
    setState(prevState => ({ ...prevState, loading: true, error: null }));

    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      const result = await apiClient.post<RelationshipOperationResult>(
        '/api/relationships/create',
        {
          parentType,
          parentId,
          childType,
          childId,
          options
        }
      );

      if (result.success) {
        // 🗑️ INVALIDATE RELATED CACHES
        const childrenKey = getCacheKey('children', parentType, parentId, childType);
        const parentKey = getCacheKey('parent', childType, childId, parentType);

        state.cache.children.delete(childrenKey);
        state.cache.parents.delete(parentKey);

        // 🔄 INVALIDATE HIERARCHY CACHES (they might be affected)
        invalidateCache('hierarchies');
      }

      setState(prevState => ({
        ...prevState,
        loading: false,
        error: result.success ? null : 'Relationship creation failed'
      }));

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prevState => ({
        ...prevState,
        loading: false,
        error: errorMessage
      }));

      return {
        success: false,
        entityId: parentId,
        affectedRelationships: [],
        metadata: {
          operationType: 'CREATE',
          timestamp: new Date(),
          performedBy: 'unknown',
          cascadeCount: 0
        },
        errors: [{
          code: 'HOOK_ERROR',
          message: errorMessage,
          entityType: parentType,
          entityId: parentId
        }]
      };
    }
  }, [getCacheKey, invalidateCache, state.cache]);

  const removeRelationship = useCallback(async (
    relationshipId: string,
    options: RemoveRelationshipOptions = {}
  ): Promise<RelationshipOperationResult> => {
    setState(prevState => ({ ...prevState, loading: true, error: null }));

    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      const result = await apiClient.post<RelationshipOperationResult>(
        '/api/relationships/remove',
        { relationshipId, options }
      );

      if (result.success) {
        // 🗑️ INVALIDATE ALL CACHES (removal can affect many relationships)
        invalidateCache('all');
      }

      setState(prevState => ({
        ...prevState,
        loading: false,
        error: result.success ? null : 'Relationship removal failed'
      }));

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prevState => ({
        ...prevState,
        loading: false,
        error: errorMessage
      }));

      return {
        success: false,
        entityId: relationshipId,
        affectedRelationships: [],
        metadata: {
          operationType: 'DELETE',
          timestamp: new Date(),
          performedBy: 'unknown',
          cascadeCount: 0
        },
        errors: [{
          code: 'HOOK_ERROR',
          message: errorMessage,
          entityType: 'contact',
          entityId: relationshipId
        }]
      };
    }
  }, [invalidateCache]);

  // ========================================
  // BIDIRECTIONAL QUERIES
  // ========================================

  const getChildren = useCallback(async <TChild>(
    parentType: EntityType,
    parentId: string,
    childType: EntityType,
    useCache: boolean = true
  ): Promise<readonly TChild[]> => {
    const cacheKey = getCacheKey('children', parentType, parentId, childType);

    // 🔍 CHECK CACHE
    if (useCache && isCacheValid(cacheKey)) {
      const cached = state.cache.children.get(cacheKey) as readonly TChild[] | undefined;
      if (cached) {
        return cached;
      }
    }

    setState(prevState => ({ ...prevState, loading: true, error: null }));

    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      const children = await apiClient.get<readonly TChild[]>(
        `/api/relationships/children?parentType=${parentType}&parentId=${parentId}&childType=${childType}`
      );

      // 💾 CACHE RESULT
      if (useCache) {
        updateCache(state.cache.children, cacheKey, children);
      }

      setState(prevState => ({ ...prevState, loading: false, error: null }));

      return children;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prevState => ({
        ...prevState,
        loading: false,
        error: errorMessage
      }));

      return [];
    }
  }, [getCacheKey, isCacheValid, updateCache, state.cache.children]);

  const getParent = useCallback(async <TParent>(
    childType: EntityType,
    childId: string,
    parentType: EntityType,
    useCache: boolean = true
  ): Promise<TParent | null> => {
    const cacheKey = getCacheKey('parent', childType, childId, parentType);

    // 🔍 CHECK CACHE
    if (useCache && isCacheValid(cacheKey)) {
      const cached = state.cache.parents.get(cacheKey) as TParent | null | undefined;
      if (cached !== undefined) {
        return cached;
      }
    }

    setState(prevState => ({ ...prevState, loading: true, error: null }));

    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      const parent = await apiClient.get<TParent | null>(
        `/api/relationships/parent?childType=${childType}&childId=${childId}&parentType=${parentType}`
      );

      // 💾 CACHE RESULT
      if (useCache) {
        updateCache(state.cache.parents, cacheKey, parent);
      }

      setState(prevState => ({ ...prevState, loading: false, error: null }));

      return parent;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prevState => ({
        ...prevState,
        loading: false,
        error: errorMessage
      }));

      return null;
    }
  }, [getCacheKey, isCacheValid, updateCache, state.cache.parents]);

  const getHierarchy = useCallback(async (
    rootType: EntityType,
    rootId: string,
    options: HierarchyQueryOptions = {},
    useCache: boolean = true
  ): Promise<EntityHierarchyTree> => {
    const cacheKey = getCacheKey('hierarchy', rootType, rootId, JSON.stringify(options));

    // 🔍 CHECK CACHE
    if (useCache && isCacheValid(cacheKey, 10 * 60 * 1000)) { // 10 minutes for hierarchies
      const cached = state.cache.hierarchies.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    setState(prevState => ({ ...prevState, loading: true, error: null }));

    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      const hierarchy = await apiClient.post<EntityHierarchyTree>(
        '/api/relationships/hierarchy',
        { rootType, rootId, options }
      );

      // 💾 CACHE RESULT
      if (useCache) {
        updateCache(state.cache.hierarchies, cacheKey, hierarchy);
      }

      setState(prevState => ({ ...prevState, loading: false, error: null }));

      return hierarchy;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prevState => ({
        ...prevState,
        loading: false,
        error: errorMessage
      }));

      // 🔧 FALLBACK HIERARCHY
      throw new Error(errorMessage);
    }
  }, [getCacheKey, isCacheValid, updateCache, state.cache.hierarchies]);

  // ========================================
  // INTEGRITY & VALIDATION
  // ========================================

  const validateIntegrity = useCallback(async (): Promise<IntegrityValidationResult> => {
    setState(prevState => ({ ...prevState, loading: true, error: null }));

    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      const result = await apiClient.get<IntegrityValidationResult>('/api/relationships/validate-integrity');

      setState(prevState => ({
        ...prevState,
        loading: false,
        error: result.isValid ? null : 'Integrity violations detected'
      }));

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prevState => ({
        ...prevState,
        loading: false,
        error: errorMessage
      }));

      return {
        isValid: false,
        violations: [],
        orphanedEntities: [],
        circularReferences: [],
        checkedAt: new Date(),
        totalEntitiesChecked: 0
      };
    }
  }, []);

  // ========================================
  // CASCADE OPERATIONS
  // ========================================

  const cascadeDelete = useCallback(async (
    entityType: EntityType,
    entityId: string,
    options: CascadeDeleteOptions = {}
  ): Promise<CascadeDeleteResult> => {
    setState(prevState => ({ ...prevState, loading: true, error: null }));

    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      const result = await apiClient.post<CascadeDeleteResult>(
        '/api/relationships/cascade-delete',
        { entityType, entityId, options }
      );

      if (result.success && !options.dryRun) {
        // 🗑️ INVALIDATE ALL CACHES
        invalidateCache('all');
      }

      setState(prevState => ({
        ...prevState,
        loading: false,
        error: result.success ? null : 'Cascade delete failed'
      }));

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prevState => ({
        ...prevState,
        loading: false,
        error: errorMessage
      }));

      return {
        success: false,
        deletedEntities: new Map(),
        totalDeleted: 0,
        skippedEntities: [],
        executionTime: 0
      };
    }
  }, [invalidateCache]);

  // ========================================
  // AUDIT TRAIL
  // ========================================

  const getAuditTrail = useCallback(async (
    entityType: EntityType,
    entityId: string,
    options: AuditQueryOptions = {}
  ): Promise<readonly RelationshipAuditEntry[]> => {
    setState(prevState => ({ ...prevState, loading: true, error: null }));

    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      const queryParams = new URLSearchParams({
        entityType,
        entityId,
        ...Object.fromEntries(
          Object.entries(options).map(([key, value]) => [key, String(value)])
        )
      });

      const auditTrail = await apiClient.get<readonly RelationshipAuditEntry[]>(
        `/api/relationships/audit-trail?${queryParams}`
      );

      setState(prevState => ({ ...prevState, loading: false, error: null }));

      return auditTrail;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prevState => ({
        ...prevState,
        loading: false,
        error: errorMessage
      }));

      return [];
    }
  }, []);

  // ========================================
  // CACHE STATISTICS
  // ========================================

  const getCacheStats = useCallback(() => {
    const childrenCacheSize = state.cache.children.size;
    const parentsCacheSize = state.cache.parents.size;
    const hierarchiesCacheSize = state.cache.hierarchies.size;

    const allUpdates = Array.from(state.cache.lastUpdated.values());
    const oldestEntry = allUpdates.length > 0 ? Math.min(...allUpdates) : null;

    return {
      childrenCacheSize,
      parentsCacheSize,
      hierarchiesCacheSize,
      oldestEntry
    };
  }, [state.cache]);

  // ========================================
  // RETURN HOOK INTERFACE
  // ========================================

  return useMemo(() => ({
    createRelationship,
    removeRelationship,
    getChildren,
    getParent,
    getHierarchy,
    validateIntegrity,
    cascadeDelete,
    getAuditTrail,
    invalidateCache,
    getCacheStats,
    state
  }), [
    createRelationship,
    removeRelationship,
    getChildren,
    getParent,
    getHierarchy,
    validateIntegrity,
    cascadeDelete,
    getAuditTrail,
    invalidateCache,
    getCacheStats,
    state
  ]);
}

// ============================================================================
// SPECIALIZED ENTITY HOOKS
// ============================================================================

/**
 * 🏢 Hook για Company-specific relationship operations
 */
export function useCompanyRelationships(companyId: string) {
  const relationships = useEnterpriseRelationships();

  const getProjects = useCallback(async () => {
    return await relationships.getChildren('company', companyId, 'project');
  }, [relationships, companyId]);

  const addProject = useCallback(async (projectId: string, options?: CreateRelationshipOptions) => {
    return await relationships.createRelationship('company', companyId, 'project', projectId, options);
  }, [relationships, companyId]);

  const getCompanyHierarchy = useCallback(async (options?: HierarchyQueryOptions) => {
    return await relationships.getHierarchy('company', companyId, options);
  }, [relationships, companyId]);

  return {
    getProjects,
    addProject,
    getCompanyHierarchy,
    ...relationships
  };
}

/**
 * 🏗️ Hook για Project-specific relationship operations
 */
export function useProjectRelationships(projectId: string) {
  const relationships = useEnterpriseRelationships();

  const getCompany = useCallback(async () => {
    return await relationships.getParent('project', projectId, 'company');
  }, [relationships, projectId]);

  const getBuildings = useCallback(async () => {
    return await relationships.getChildren('project', projectId, 'building');
  }, [relationships, projectId]);

  const addBuilding = useCallback(async (buildingId: string, options?: CreateRelationshipOptions) => {
    return await relationships.createRelationship('project', projectId, 'building', buildingId, options);
  }, [relationships, projectId]);

  const getProjectHierarchy = useCallback(async (options?: HierarchyQueryOptions) => {
    return await relationships.getHierarchy('project', projectId, options);
  }, [relationships, projectId]);

  return {
    getCompany,
    getBuildings,
    addBuilding,
    getProjectHierarchy,
    ...relationships
  };
}

/**
 * 🏢 Hook για Building-specific relationship operations
 * @enterprise Complete Building→Floors→Units hierarchy management
 */
export function useBuildingRelationships(buildingId: string) {
  const relationships = useEnterpriseRelationships();

  const getProject = useCallback(async () => {
    return await relationships.getParent('building', buildingId, 'project');
  }, [relationships, buildingId]);

  const getFloors = useCallback(async () => {
    return await relationships.getChildren('building', buildingId, 'floor');
  }, [relationships, buildingId]);

  const getUnits = useCallback(async () => {
    // 🏗️ ENTERPRISE: Direct Building→Units relationship via hierarchical query
    return await relationships.getChildren('building', buildingId, 'unit');
  }, [relationships, buildingId]);

  const addFloor = useCallback(async (floorId: string, options?: CreateRelationshipOptions) => {
    return await relationships.createRelationship('building', buildingId, 'floor', floorId, options);
  }, [relationships, buildingId]);

  const getBuildingHierarchy = useCallback(async (options?: HierarchyQueryOptions) => {
    return await relationships.getHierarchy('building', buildingId, options);
  }, [relationships, buildingId]);

  return {
    getProject,
    getFloors,
    getUnits,
    addFloor,
    getBuildingHierarchy,
    ...relationships
  };
}

/**
 * 🏠 Hook για Floor-specific relationship operations
 * @enterprise Complete Floor→Units hierarchy management
 */
export function useFloorRelationships(floorId: string) {
  const relationships = useEnterpriseRelationships();

  const getBuilding = useCallback(async () => {
    return await relationships.getParent('floor', floorId, 'building');
  }, [relationships, floorId]);

  const getUnits = useCallback(async () => {
    return await relationships.getChildren('floor', floorId, 'unit');
  }, [relationships, floorId]);

  const addUnit = useCallback(async (unitId: string, options?: CreateRelationshipOptions) => {
    return await relationships.createRelationship('floor', floorId, 'unit', unitId, options);
  }, [relationships, floorId]);

  const getFloorHierarchy = useCallback(async (options?: HierarchyQueryOptions) => {
    return await relationships.getHierarchy('floor', floorId, options);
  }, [relationships, floorId]);

  return {
    getBuilding,
    getUnits,
    addUnit,
    getFloorHierarchy,
    ...relationships
  };
}
