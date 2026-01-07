/**
 * 🏢 ENTERPRISE: Entity Linking Service
 *
 * Centralized service for managing entity relationships.
 * Single entry point for all entity linking functionality.
 *
 * Features:
 * - Retry logic with exponential backoff
 * - Caching layer with TTL
 * - Audit logging for compliance
 * - Optimistic update support
 *
 * @author Claude AI Assistant
 * @created 2026-01-07
 * @updated 2026-01-07 - Added enterprise utilities
 * @pattern Barrel Export Pattern (Enterprise Standard)
 *
 * @example
 * ```typescript
 * // Service usage
 * import { EntityLinkingService } from '@/services/entity-linking';
 *
 * const result = await EntityLinkingService.linkBuildingToProject('building123', 'project456');
 *
 * // Hook usage in React components
 * import { useEntityLinking } from '@/services/entity-linking';
 *
 * const { link, isLoading, error } = useEntityLinking();
 * ```
 */

// ============================================================================
// 🏢 ENTERPRISE: Core Service
// ============================================================================

export { EntityLinkingService, default } from './EntityLinkingService';

// ============================================================================
// 🏢 ENTERPRISE: React Hook
// ============================================================================

export { useEntityLinking } from './hooks/useEntityLinking';

// ============================================================================
// 🏢 ENTERPRISE: Configuration
// ============================================================================

export {
  ENTITY_LINKING_CONFIG,
  ENTITY_API_ENDPOINTS,
  ERROR_MESSAGES,
  ENTERPRISE_ID_MIN_LENGTH,
  LEGACY_ID_PREFIXES,
  isEnterpriseId,
  getRelationshipKey,
  getRelationshipConfig,
  getEntityApiEndpoint,
} from './config';

// ============================================================================
// 🏢 ENTERPRISE: Utilities
// ============================================================================

// Retry Logic
export {
  withRetry,
  withFastRetry,
  withAggressiveRetry,
  withFirestoreRetry,
  DEFAULT_RETRY_CONFIG,
  FAST_RETRY_CONFIG,
  AGGRESSIVE_RETRY_CONFIG,
} from './utils/retry';

// Cache Layer
export {
  EntityLinkingCache,
  ENTITY_LINKING_CACHE_KEYS,
  ENTITY_LINKING_TTL,
} from './utils/cache';

// Audit Logging
export { AuditLogger } from './utils/audit';

// Optimistic Updates
export {
  OptimisticUpdateManager,
  optimisticUpdateManager,
  createOptimisticHelpers,
} from './utils/optimistic';

// ============================================================================
// 🏢 ENTERPRISE: Types
// ============================================================================

export type {
  // Entity types
  EntityType,
  EntityRelationship,
  BaseEntity,
  EntityWithMetadata,

  // Operation parameters
  LinkEntityParams,
  UnlinkEntityParams,
  GetAvailableEntitiesParams,

  // Results
  BaseOperationResult,
  LinkSuccessResult,
  OperationErrorResult,
  LinkResult,
  GetAvailableEntitiesResult,

  // Error handling
  EntityLinkingErrorCode,

  // Configuration
  RelationshipConfig,
  EntityLinkingConfig,

  // Events
  EntityLinkEventPayload,

  // Hook
  UseEntityLinkingReturn,
} from './types';

// Retry types
export type { RetryConfig, RetryResult } from './utils/retry';

// Audit types
export type {
  AuditAction,
  AuditSeverity,
  AuditLogEntry,
  AuditLogParams,
} from './utils/audit';

// Optimistic update types
export type {
  StateSnapshot,
  OptimisticUpdateParams,
  OptimisticUpdateResult,
} from './utils/optimistic';
