/**
 * 🏢 ENTERPRISE: Entity Linking Utilities
 *
 * Barrel export for all entity linking utilities.
 *
 * @author Claude AI Assistant
 * @created 2026-01-07
 */

// ============================================================================
// 🔄 Retry Logic
// ============================================================================

export {
  withRetry,
  withFastRetry,
  withAggressiveRetry,
  withFirestoreRetry,
  calculateBackoffDelay,
  isRetryableError,
  Retryable,
  DEFAULT_RETRY_CONFIG,
  FAST_RETRY_CONFIG,
  AGGRESSIVE_RETRY_CONFIG,
} from './retry';

export type { RetryConfig, RetryResult } from './retry';

// ============================================================================
// 📦 Cache Layer
// ============================================================================

export {
  EntityLinkingCache,
  ENTITY_LINKING_CACHE_KEYS,
  ENTITY_LINKING_TTL,
  buildAvailableEntitiesKey,
  buildLinkedEntitiesKey,
  buildEntityDetailsKey,
  buildRelationshipStatusKey,
} from './cache';

// ============================================================================
// 📋 Audit Logging
// ============================================================================

export { AuditLogger } from './audit';

export type {
  AuditAction,
  AuditSeverity,
  AuditLogEntry,
  AuditLogParams,
  AuditConfig,
} from './audit';

// ============================================================================
// 🚀 Optimistic Updates
// ============================================================================

export {
  OptimisticUpdateManager,
  optimisticUpdateManager,
  createOptimisticHelpers,
} from './optimistic';

export type {
  StateSnapshot,
  OptimisticUpdateParams,
  OptimisticUpdateResult,
  OptimisticState,
} from './optimistic';
