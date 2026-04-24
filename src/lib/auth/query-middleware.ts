/**
 * @fileoverview Enterprise Authorization Query Middleware
 * @version 1.1.0
 * @author Nestor Construct Platform
 * @since 2025-12-15
 *
 * Provides production-grade authorization layer for Firestore queries with:
 * - Type-safe ownership filtering
 * - Role-based access control preparation
 * - Comprehensive error handling
 * - Performance optimization
 * - Audit logging capabilities
 *
 * Types extracted to query-middleware-types.ts (ADR-065 Phase 6).
 *
 * @example
 * ```typescript
 * import { AuthorizedQueryService } from '@/lib/auth/query-middleware';
 *
 * const queryService = new AuthorizedQueryService(db);
 * const result = await queryService.readOwnedDocuments('projects', {
 *   ownerField: 'createdBy',
 *   additionalConstraints: [where('status', '==', 'active')]
 * });
 * ```
 */

import type {
  AuthenticationContext,
  ScopedQueryConfiguration,
  AuthorizedQueryResult,
  SessionMetadata
} from './query-middleware-types';

import {
  AuthorizationError,
  QueryExecutionError
} from './query-middleware-types';

// Re-export all types and errors for backward compatibility
export type {
  AuthenticationContext,
  ScopedQueryConfiguration,
  AuthorizedQueryResult,
  QueryExecutionMetadata,
  CacheInformation,
  SessionMetadata
} from './query-middleware-types';

export { AuthorizationError, QueryExecutionError } from './query-middleware-types';

// Legacy class AuthorizedQueryService deleted — 0 consumers.
// Use firestoreQueryService from @/services/firestore instead.
