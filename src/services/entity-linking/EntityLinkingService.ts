/**
 * 🏢 ENTERPRISE: Entity Linking Service
 *
 * Centralized service for managing entity relationships.
 * Handles linking/unlinking between Companies, Projects, Buildings, Units, Floors.
 *
 * Features:
 * - Retry logic with exponential backoff
 * - Caching layer with TTL
 * - Audit logging for compliance
 * - Optimistic update support
 *
 * @author Claude AI Assistant
 * @created 2026-01-07
 * @updated 2026-01-07 - Added enterprise utilities (retry, cache, audit)
 * @pattern Service Layer Pattern (Bentley, Google, Microsoft)
 *
 * @example
 * ```typescript
 * import { EntityLinkingService } from '@/services/entity-linking';
 *
 * // Link a building to a project
 * const result = await EntityLinkingService.linkEntity({
 *   entityId: 'building123',
 *   entityType: 'building',
 *   parentId: 'project456',
 *   parentType: 'project'
 * });
 *
 * if (result.success) {
 *   logger.info('Building linked successfully!');
 * }
 * ```
 */

import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  ENTITY_LINKING_CONFIG,
  ENTITY_API_ENDPOINTS,
  ERROR_MESSAGES,
  getRelationshipKey,
  isEnterpriseId,
} from './config';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import type {
  EntityType,
  LinkEntityParams,
  UnlinkEntityParams,
  GetAvailableEntitiesParams,
  LinkResult,
  OperationErrorResult,
  GetAvailableEntitiesResult,
  EntityWithMetadata,
  EntityLinkingErrorCode,
} from './types';

// Enterprise utilities
import { withFirestoreRetry } from './utils/retry';
import { EntityLinkingCache } from './utils/cache';
import { AuditLogger } from './utils/audit';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('EntityLinkingService');

// ============================================================================
// 🏢 ENTERPRISE: Entity Linking Service Class
// ============================================================================

/**
 * Enterprise Entity Linking Service
 *
 * Provides centralized methods for:
 * - Linking entities to parent entities
 * - Unlinking entities from parents
 * - Fetching available entities for linking
 * - Validation and error handling
 */
export class EntityLinkingService {
  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * 🔗 Link an entity to a parent entity
   *
   * Features:
   * - Retry logic with exponential backoff
   * - Cache invalidation
   * - Audit logging
   *
   * @param params - Link parameters
   * @returns Promise<LinkResult> - Success or error result
   */
  static async linkEntity(params: LinkEntityParams): Promise<LinkResult> {
    const { entityId, entityType, parentId, parentType } = params;
    const startTime = Date.now();

    // 📋 STEP 1: Validate inputs
    const validationError = this.validateLinkParams(params);
    if (validationError) {
      AuditLogger.log({
        action: 'VALIDATION_FAILED',
        entityType,
        entityId,
        success: false,
        errorMessage: validationError.error,
        errorCode: validationError.errorCode,
      });
      return validationError;
    }

    // 📋 STEP 2: Get relationship configuration
    const relationshipKey = getRelationshipKey(entityType, parentType);
    if (!relationshipKey) {
      const error = this.createErrorResult(
        'INVALID_RELATIONSHIP',
        `Cannot link ${entityType} to ${parentType}`
      );
      AuditLogger.log({
        action: 'VALIDATION_FAILED',
        entityType,
        entityId,
        success: false,
        errorMessage: error.error,
        errorCode: error.errorCode,
      });
      return error;
    }

    const config = ENTITY_LINKING_CONFIG[relationshipKey];

    // 📋 STEP 3: Execute with retry logic
    const retryResult = await withFirestoreRetry(async () => {
      // Get current entity state (for previous parent tracking)
      const entityRef = doc(db, config.collection, entityId);
      const entitySnap = await getDoc(entityRef);

      if (!entitySnap.exists()) {
        throw new Error(`ENTITY_NOT_FOUND: ${entityType} not found: ${entityId}`);
      }

      const currentData = entitySnap.data();
      const previousParentId = (currentData[config.foreignKey] as string) || null;

      // Update entity with new parent ID
      await updateDoc(entityRef, {
        [config.foreignKey]: parentId,
        updatedAt: new Date().toISOString(),
      });

      return { previousParentId };
    });

    const durationMs = Date.now() - startTime;

    // Handle retry failure
    if (!retryResult.success) {
      const errorMessage = retryResult.error?.message ?? 'Unknown error';
      const isEntityNotFound = errorMessage.includes('ENTITY_NOT_FOUND');

      AuditLogger.logError(
        'LINK_ENTITY',
        entityType,
        entityId,
        errorMessage,
        isEntityNotFound ? 'ENTITY_NOT_FOUND' : 'NETWORK_ERROR'
      );

      return this.createErrorResult(
        isEntityNotFound ? 'ENTITY_NOT_FOUND' : 'NETWORK_ERROR',
        errorMessage
      );
    }

    const { previousParentId } = retryResult.data!;

    // 📋 STEP 4: Invalidate cache
    EntityLinkingCache.invalidateOnLink(entityType, entityId, parentId);

    // 📋 STEP 5: Dispatch success event via centralized RealtimeService
    // 🏢 ENTERPRISE: Using centralized RealtimeService for cross-page/cross-tab sync
    RealtimeService.dispatchEntityLinked({
      entityId,
      entityType,
      parentId,
      parentType,
      previousParentId,
      timestamp: Date.now(),
    });

    // Also dispatch the legacy event for backward compatibility
    this.dispatchLegacyLinkEvent(config.successEvent, {
      entityId,
      entityType,
      previousParentId,
      newParentId: parentId,
    });

    // 📋 STEP 6: Log audit entry
    AuditLogger.logLink(
      entityType,
      entityId,
      parentType,
      parentId,
      previousParentId,
      true,
      durationMs
    );

    // 📋 STEP 7: Return success result
    logger.info(
      `✅ [EntityLinkingService] ${entityType} ${entityId} linked to ${parentType} ${parentId} (${durationMs}ms, ${retryResult.attempts} attempts)`
    );

    return {
      success: true,
      entityId,
      entityType,
      parentId,
      parentType,
      previousParentId,
      timestamp: Date.now(),
    };
  }

  /**
   * 🔓 Unlink an entity from its parent
   *
   * Features:
   * - Retry logic with exponential backoff
   * - Cache invalidation
   * - Audit logging
   *
   * @param params - Unlink parameters
   * @returns Promise<LinkResult> - Success or error result
   */
  static async unlinkEntity(params: UnlinkEntityParams): Promise<LinkResult> {
    const { entityId, entityType } = params;
    const startTime = Date.now();

    // Determine parent type based on entity type
    const parentTypeMap: Record<EntityType, EntityType | null> = {
      project: 'company',
      building: 'project',
      unit: 'building',
      floor: 'building',
      company: null, // Companies have no parent
    };

    const parentType = parentTypeMap[entityType];
    if (!parentType) {
      AuditLogger.log({
        action: 'VALIDATION_FAILED',
        entityType,
        entityId,
        success: false,
        errorMessage: `Cannot unlink ${entityType}`,
        errorCode: 'INVALID_RELATIONSHIP',
      });
      return this.createErrorResult('INVALID_RELATIONSHIP', `Cannot unlink ${entityType}`);
    }

    const relationshipKey = getRelationshipKey(entityType, parentType);
    if (!relationshipKey) {
      return this.createErrorResult('INVALID_RELATIONSHIP', `Invalid relationship for ${entityType}`);
    }

    const config = ENTITY_LINKING_CONFIG[relationshipKey];

    // Execute with retry logic
    const retryResult = await withFirestoreRetry(async () => {
      // Get current parent for event dispatch
      const entityRef = doc(db, config.collection, entityId);
      const entitySnap = await getDoc(entityRef);

      if (!entitySnap.exists()) {
        throw new Error(`ENTITY_NOT_FOUND: ${entityType} not found: ${entityId}`);
      }

      const currentData = entitySnap.data();
      const previousParentId = (currentData[config.foreignKey] as string) || null;

      // Set parent to null
      await updateDoc(entityRef, {
        [config.foreignKey]: null,
        updatedAt: new Date().toISOString(),
      });

      return { previousParentId };
    });

    const durationMs = Date.now() - startTime;

    // Handle retry failure
    if (!retryResult.success) {
      const errorMessage = retryResult.error?.message ?? 'Unknown error';
      const isEntityNotFound = errorMessage.includes('ENTITY_NOT_FOUND');

      AuditLogger.logError(
        'UNLINK_ENTITY',
        entityType,
        entityId,
        errorMessage,
        isEntityNotFound ? 'ENTITY_NOT_FOUND' : 'NETWORK_ERROR'
      );

      return this.createErrorResult(
        isEntityNotFound ? 'ENTITY_NOT_FOUND' : 'NETWORK_ERROR',
        errorMessage
      );
    }

    const { previousParentId } = retryResult.data!;

    // Invalidate cache
    if (previousParentId) {
      EntityLinkingCache.invalidateOnLink(entityType, entityId, previousParentId);
    }

    // Dispatch event via centralized RealtimeService
    // 🏢 ENTERPRISE: Using centralized RealtimeService for cross-page/cross-tab sync
    RealtimeService.dispatchEntityUnlinked({
      entityId,
      entityType,
      previousParentId,
      timestamp: Date.now(),
    });

    // Also dispatch the legacy event for backward compatibility
    this.dispatchLegacyLinkEvent(config.successEvent, {
      entityId,
      entityType,
      previousParentId,
      newParentId: null,
    });

    // Log audit entry
    AuditLogger.logUnlink(entityType, entityId, previousParentId, true, durationMs);

    logger.info(
      `✅ [EntityLinkingService] ${entityType} ${entityId} unlinked (${durationMs}ms, ${retryResult.attempts} attempts)`
    );

    return {
      success: true,
      entityId,
      entityType,
      parentId: '',
      parentType,
      previousParentId,
      timestamp: Date.now(),
    };
  }

  /**
   * 📋 Get available entities for linking
   *
   * Features:
   * - Cache-aside pattern with TTL
   * - Retry logic with exponential backoff
   * - Audit logging
   *
   * @param params - Query parameters
   * @returns Promise<GetAvailableEntitiesResult> - Available entities
   */
  static async getAvailableEntities(
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
        // Filter by enterprise ID
        const entityId = String(entity.id || '');
        if (!isEnterpriseId(entityId)) return false;

        // Filter by parent linkage if specified
        if (parentId && !includeLinkedToOthers) {
          const foreignKeyMap: Record<EntityType, string> = {
            building: 'projectId',
            unit: 'buildingId',
            project: 'companyId',
            floor: 'buildingId',
            company: '',
          };

          const foreignKey = foreignKeyMap[entityType];
          if (foreignKey) {
            const linkedParent = entity[foreignKey] as string | null | undefined;
            // Only include if not linked OR linked to current parent
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

    // Log audit
    AuditLogger.logSuccess('GET_AVAILABLE_ENTITIES', entityType, parentId ?? 'all', {
      count: filteredEntities.length,
      durationMs,
    });

    logger.info(
      `✅ [EntityLinkingService] Found ${filteredEntities.length} available ${entityType}s (${durationMs}ms)`
    );

    return {
      success: true,
      entities: filteredEntities,
      count: filteredEntities.length,
    };
  }

  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================

  /**
   * 🏢 Link a building to a project (convenience method)
   */
  static async linkBuildingToProject(buildingId: string, projectId: string): Promise<LinkResult> {
    return this.linkEntity({
      entityId: buildingId,
      entityType: 'building',
      parentId: projectId,
      parentType: 'project',
    });
  }

  /**
   * 🏠 Link a unit to a building (convenience method)
   */
  static async linkUnitToBuilding(unitId: string, buildingId: string): Promise<LinkResult> {
    return this.linkEntity({
      entityId: unitId,
      entityType: 'unit',
      parentId: buildingId,
      parentType: 'building',
    });
  }

  /**
   * 📋 Link a project to a company (convenience method)
   */
  static async linkProjectToCompany(projectId: string, companyId: string): Promise<LinkResult> {
    return this.linkEntity({
      entityId: projectId,
      entityType: 'project',
      parentId: companyId,
      parentType: 'company',
    });
  }

  /**
   * 🏢 Get available buildings for a project
   */
  static async getAvailableBuildingsForProject(projectId: string): Promise<GetAvailableEntitiesResult> {
    return this.getAvailableEntities({
      entityType: 'building',
      parentId: projectId,
      parentType: 'project',
      includeLinkedToOthers: false,
    });
  }

  /**
   * 🏠 Get available units for a building
   */
  static async getAvailableUnitsForBuilding(buildingId: string): Promise<GetAvailableEntitiesResult> {
    return this.getAvailableEntities({
      entityType: 'unit',
      parentId: buildingId,
      parentType: 'building',
      includeLinkedToOthers: false,
    });
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Validate link parameters
   */
  private static validateLinkParams(params: LinkEntityParams): OperationErrorResult | null {
    const { entityId, entityType, parentId, parentType } = params;

    if (!entityId || typeof entityId !== 'string') {
      return this.createErrorResult('VALIDATION_ERROR', 'Entity ID is required');
    }

    if (!parentId || typeof parentId !== 'string') {
      return this.createErrorResult('VALIDATION_ERROR', 'Parent ID is required');
    }

    if (!entityType) {
      return this.createErrorResult('VALIDATION_ERROR', 'Entity type is required');
    }

    if (!parentType) {
      return this.createErrorResult('VALIDATION_ERROR', 'Parent type is required');
    }

    return null;
  }

  /**
   * Create an error result object
   */
  private static createErrorResult(
    errorCode: EntityLinkingErrorCode,
    details?: string
  ): OperationErrorResult {
    return {
      success: false,
      error: ERROR_MESSAGES[errorCode],
      errorCode,
      details,
      timestamp: Date.now(),
    };
  }

  /**
   * 🏢 ENTERPRISE: Legacy event dispatch for backward compatibility
   * @deprecated Use RealtimeService.dispatchEntityLinked/Unlinked for new code
   * Maintained for existing listeners that depend on specific event names
   */
  private static dispatchLegacyLinkEvent(
    eventName: string,
    payload: {
      entityId: string;
      entityType: EntityType;
      previousParentId: string | null;
      newParentId: string | null;
    }
  ): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: {
            ...payload,
            timestamp: Date.now(),
          },
        })
      );
      logger.info(`📡 [EntityLinkingService] Dispatched legacy event: ${eventName}`);
    }
  }
}

// Default export for convenience
export default EntityLinkingService;
