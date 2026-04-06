/**
 * @fileoverview Type definitions for Enterprise Authorization Query Middleware
 * @version 1.0.0
 *
 * Extracted from query-middleware.ts (ADR-065 Phase 6).
 */

import type { DocumentData } from 'firebase/firestore';
import type { QueryConstraint } from 'firebase/firestore';

// ============================================================================
// SESSION & AUTH TYPES
// ============================================================================

/**
 * Session metadata for comprehensive audit logging
 */
export interface SessionMetadata {
  /** Session start timestamp */
  readonly sessionStartTime: Date;
  /** Last activity timestamp */
  readonly lastActivity: Date;
  /** Session duration in milliseconds */
  readonly sessionDuration: number;
  /** Request count in current session */
  readonly requestCount: number;
}

/**
 * Authentication context with comprehensive user information
 */
export interface AuthenticationContext {
  /** Firebase user object, null if not authenticated */
  readonly user: import('firebase/auth').User | null;
  /** User ID, null if not authenticated */
  readonly uid: string | null;
  /** Authentication status */
  readonly isAuthenticated: boolean;
  /** User email for audit logging */
  readonly email: string | null;
  /** Account creation timestamp */
  readonly createdAt: Date | null;
  /** User roles for future RBAC implementation */
  readonly roles: readonly string[];
  /** User permissions for granular access control */
  readonly permissions: readonly string[];
  /** Session metadata for audit trails */
  readonly sessionMetadata: SessionMetadata;
}

// ============================================================================
// QUERY CONFIGURATION & RESULT TYPES
// ============================================================================

/**
 * Configuration options for scoped queries
 */
export interface ScopedQueryConfiguration {
  /** Database field containing owner identifier */
  readonly ownerField: string;
  /** Whether to allow public access in development */
  readonly allowPublicAccess: boolean;
  /** Whether authentication is required */
  readonly requireAuthentication: boolean;
  /** Additional Firestore query constraints */
  readonly additionalConstraints: readonly QueryConstraint[];
  /** Cache duration in milliseconds */
  readonly cacheDuration: number;
  /** Enable audit logging for this query */
  readonly enableAuditLogging: boolean;
}

/**
 * Query execution metadata for performance monitoring
 */
export interface QueryExecutionMetadata {
  /** Query start timestamp */
  readonly startTime: Date;
  /** Query end timestamp */
  readonly endTime: Date;
  /** Execution duration in milliseconds */
  readonly executionDuration: number;
  /** Collection being queried */
  readonly collectionName: string;
  /** Number of constraints applied */
  readonly constraintCount: number;
  /** Whether ownership filtering was applied */
  readonly ownershipFilterApplied: boolean;
}

/**
 * Cache information for performance optimization
 */
export interface CacheInformation {
  /** Whether result was served from cache */
  readonly fromCache: boolean;
  /** Cache entry timestamp */
  readonly cacheTimestamp: Date | null;
  /** Time until cache expiration */
  readonly timeToExpiry: number | null;
  /** Cache key used */
  readonly cacheKey: string | null;
}

/**
 * Result object for authorized queries with metadata
 */
export interface AuthorizedQueryResult<T extends DocumentData = DocumentData> {
  /** Retrieved documents */
  readonly documents: readonly T[];
  /** Whether the result set is empty */
  readonly isEmpty: boolean;
  /** Number of documents retrieved */
  readonly size: number;
  /** Authentication context at query time */
  readonly authenticationContext: AuthenticationContext;
  /** Query execution metadata */
  readonly executionMetadata: QueryExecutionMetadata;
  /** Cache information */
  readonly cacheInfo: CacheInformation;
}

// ============================================================================
// ERROR CLASSES
// ============================================================================

/**
 * Custom error types for authorization failures
 */
export class AuthorizationError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
    this.context = context;
  }
}

export class QueryExecutionError extends Error {
  public readonly originalError: Error;
  public readonly queryContext: Record<string, unknown>;

  constructor(
    message: string,
    originalError: Error,
    queryContext: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'QueryExecutionError';
    this.originalError = originalError;
    this.queryContext = queryContext;
  }
}
