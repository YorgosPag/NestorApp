/**
 * 🏢 ENTERPRISE: Entity Linking Queries
 *
 * Query methods for fetching available entities for linking.
 * Extracted from EntityLinkingService for SRP compliance (ADR-269 Phase B6).
 *
 * @see EntityLinkingService — For link/unlink mutations
 */

import {
  ENTITY_API_ENDPOINTS,
  isEnterpriseId,
} from './config';
import { EntityLinkingCache } from './utils/cache';
import { AuditLogger } from './utils/audit';
import { withFirestoreRetry } from './utils/retry';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  EntityType,
  GetAvailableEntitiesParams,
  GetAvailableEntitiesResult,
  EntityWithMetadata,
} from './types';

const logger = createModuleLogger('EntityLinkingQueries');

// ============================================================================
// 🏢 ENTERPRISE: Entity Linking Query Methods
// ============================================================================

/**
 * 📋 Get available entities for linking
 *
 * Features:
 * - Cache-aside pattern with TTL
 * - Retry logic with exponential backoff
 * - Audit logging
 */
export async function getAvailableEntities(
  params: GetAvailableEntitiesParams
): Promise<GetAvailableEntitiesResult> {
  const { entityType, parentId, includeLinkedToOthers = false } = params;
  const startTime = Date.now();

  // Try cache first
  const cached = EntityLinkingCache.getAvailableEntities(entityType, parentId);
  if (cached) {
    AuditLogger.log({
      action: 'CACHE_HIT',
      entityType,
      success: true,
      metadata: { parentId, count: cached.length },
    });
    return {
      success: true,
      entities: cached,
      count: cached.length,
    };
  }

  AuditLogger.log({
    action: 'CACHE_MISS',
    entityType,
    success: true,
    metadata: { parentId },
  });

  const endpoint = ENTITY_API_ENDPOINTS[entityType];

  // Execute with retry logic
  const retryResult = await withFirestoreRetry(async () => {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  });

  const durationMs = Date.now() - startTime;

  if (!retryResult.success) {
    AuditLogger.logError(
      'GET_AVAILABLE_ENTITIES',
      entityType,
      parentId ?? 'all',
      retryResult.error?.message ?? 'Unknown error',
      'NETWORK_ERROR'
    );
    return {
      success: false,
      entities: [],
      count: 0,
      error: retryResult.error?.message ?? 'Network error',
    };
  }

  const result = retryResult.data;

  if (!result.success) {
    return {
      success: false,
      entities: [],
      count: 0,
      error: result.error || 'Failed to fetch entities',
    };
  }

  // Get the entities array from response (different APIs return different keys)
  const rawEntities = result[`${entityType}s`] || result.data || result.entities || [];

  // Filter entities
  const filteredEntities: EntityWithMetadata[] = rawEntities
    .filter((entity: Record<string, unknown>) => {
      const entityId = String(entity.id || '');
      if (!isEnterpriseId(entityId)) return false;

      if (parentId && !includeLinkedToOthers) {
        const foreignKeyMap: Record<EntityType, string> = {
          building: 'projectId',
          property: 'buildingId',
          project: 'companyId',
          floor: 'buildingId',
          company: '',
        };

        const foreignKey = foreignKeyMap[entityType];
        if (foreignKey) {
          const linkedParent = entity[foreignKey] as string | null | undefined;
          if (linkedParent && linkedParent !== parentId) {
            return false;
          }
        }
      }

      return true;
    })
    .map((entity: Record<string, unknown>) => ({
      id: String(entity.id),
      name: String(entity.name || 'Χωρίς όνομα'),
      subtitle: 'Διαθέσιμο για σύνδεση',
      status: entity.status as string | undefined,
    }));

  // Cache the results
  EntityLinkingCache.setAvailableEntities(entityType, filteredEntities, parentId);

  AuditLogger.logSuccess('GET_AVAILABLE_ENTITIES', entityType, parentId ?? 'all', {
    count: filteredEntities.length,
    durationMs,
  });

  logger.info(
    `✅ [EntityLinkingQueries] Found ${filteredEntities.length} available ${entityType}s (${durationMs}ms)`
  );

  return {
    success: true,
    entities: filteredEntities,
    count: filteredEntities.length,
  };
}

// ============================================================================
// 🏢 CONVENIENCE QUERY METHODS
// ============================================================================

/** Get available buildings for a project */
export async function getAvailableBuildingsForProject(
  projectId: string
): Promise<GetAvailableEntitiesResult> {
  return getAvailableEntities({
    entityType: ENTITY_TYPES.BUILDING,
    parentId: projectId,
    parentType: ENTITY_TYPES.PROJECT,
    includeLinkedToOthers: false,
  });
}

/** Get available properties for a building */
export async function getAvailablePropertiesForBuilding(
  buildingId: string
): Promise<GetAvailableEntitiesResult> {
  return getAvailableEntities({
    entityType: ENTITY_TYPES.PROPERTY,
    parentId: buildingId,
    parentType: ENTITY_TYPES.BUILDING,
    includeLinkedToOthers: false,
  });
}
