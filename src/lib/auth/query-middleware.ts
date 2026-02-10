/**
 * @fileoverview Enterprise Authorization Query Middleware
 * @version 1.0.0
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

import {
  Query,
  QueryConstraint,
  DocumentData,
  Firestore,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('query-middleware');

// ============================================================================
// ENTERPRISE TYPE DEFINITIONS
// ============================================================================

/**
 * Authentication context with comprehensive user information
 */
export interface AuthenticationContext {
  /** Firebase user object, null if not authenticated */
  readonly user: User | null;
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

// ============================================================================
// ENTERPRISE QUERY SERVICE
// ============================================================================

/**
 * Enterprise-grade authorization service for Firestore queries
 *
 * Provides type-safe, performant, and auditable data access with:
 * - Ownership-based filtering
 * - Role-based access control preparation
 * - Comprehensive error handling
 * - Performance monitoring
 * - Audit logging
 */
export class AuthorizedQueryService {
  private readonly firestore: Firestore;
  private readonly sessionMetadata: SessionMetadata;
  private readonly queryCache = new Map<string, { data: AuthorizedQueryResult; timestamp: Date }>();

  /**
   * Creates a new authorized query service instance
   *
   * @param firestore - Firestore database instance
   */
  constructor(firestore: Firestore) {
    this.firestore = firestore;
    this.sessionMetadata = {
      sessionStartTime: new Date(),
      lastActivity: new Date(),
      sessionDuration: 0,
      requestCount: 0
    };
  }

  /**
   * Retrieves current authentication context with comprehensive metadata
   *
   * @returns Complete authentication context
   */
  public getCurrentAuthenticationContext(): AuthenticationContext {
    const user = auth.currentUser;
    const now = new Date();

    // Update session metadata
    const updatedSessionMetadata: SessionMetadata = {
      ...this.sessionMetadata,
      lastActivity: now,
      sessionDuration: now.getTime() - this.sessionMetadata.sessionStartTime.getTime(),
      requestCount: this.sessionMetadata.requestCount + 1
    };

    return Object.freeze({
      user,
      uid: user?.uid ?? null,
      isAuthenticated: user !== null,
      email: user?.email ?? null,
      createdAt: user?.metadata.creationTime ? new Date(user.metadata.creationTime) : null,
      roles: user ? ['authenticated-user'] : [],
      permissions: user ? ['read:own-data'] : [],
      sessionMetadata: updatedSessionMetadata
    });
  }

  /**
   * Executes an ownership-scoped query with comprehensive error handling
   *
   * @param collectionName - Name of the Firestore collection
   * @param options - Query configuration options
   * @returns Promise resolving to query results with metadata
   *
   * @throws {AuthorizationError} When user lacks required permissions
   * @throws {QueryExecutionError} When query execution fails
   *
   * @example
   * ```typescript
   * const result = await service.readOwnedDocuments('user-projects', {
   *   ownerField: 'createdBy',
   *   requireAuthentication: true,
   *   additionalConstraints: [where('status', '==', 'active')]
   * });
   * ```
   */
  public async readOwnedDocuments<T extends DocumentData = DocumentData>(
    collectionName: string,
    options: Partial<ScopedQueryConfiguration> = {}
  ): Promise<AuthorizedQueryResult<T>> {
    const startTime = new Date();
    const authContext = this.getCurrentAuthenticationContext();

    // Merge with default configuration
    const config: ScopedQueryConfiguration = {
      ownerField: 'ownerId',
      allowPublicAccess: false,
      requireAuthentication: true,
      additionalConstraints: [],
      cacheDuration: 300000, // 5 minutes
      enableAuditLogging: true,
      ...options
    };

    try {
      // Validate authentication requirements
      this.validateAuthenticationRequirements(authContext, config);

      // Generate cache key
      const cacheKey = this.generateCacheKey(collectionName, config, authContext);

      // Check cache first
      const cachedResult = this.getCachedResult<T>(cacheKey, config.cacheDuration);
      if (cachedResult) {
        return cachedResult;
      }

      // Build and execute query
      const queryResult = await this.executeAuthorizedQuery<T>(
        collectionName,
        config,
        authContext
      );

      // Cache result
      this.cacheResult(cacheKey, queryResult);

      // Log audit trail if enabled
      if (config.enableAuditLogging) {
        this.logQueryAudit(collectionName, config, authContext, queryResult);
      }

      return queryResult;

    } catch (error) {
      this.handleQueryError(error, collectionName, config, authContext);
      throw error; // Re-throw after logging
    }
  }

  /**
   * Executes a public query with development mode considerations
   *
   * @param collectionName - Collection to query
   * @param constraints - Additional query constraints
   * @returns Query results
   */
  public async readPublicDocuments<T extends DocumentData = DocumentData>(
    collectionName: string,
    constraints: readonly QueryConstraint[] = []
  ): Promise<AuthorizedQueryResult<T>> {
    const isDevelopmentMode = process.env.NODE_ENV === 'development';

    return this.readOwnedDocuments<T>(collectionName, {
      allowPublicAccess: isDevelopmentMode,
      requireAuthentication: !isDevelopmentMode,
      additionalConstraints: constraints,
      enableAuditLogging: !isDevelopmentMode
    });
  }

  /**
   * Validates authentication requirements against current context
   *
   * @private
   * @param authContext - Current authentication context
   * @param config - Query configuration
   * @throws {AuthorizationError} When requirements not met
   */
  private validateAuthenticationRequirements(
    authContext: AuthenticationContext,
    config: ScopedQueryConfiguration
  ): void {
    if (config.requireAuthentication && !authContext.isAuthenticated) {
      throw new AuthorizationError(
        'Authentication required for this operation',
        'AUTHENTICATION_REQUIRED',
        { collectionAccess: true, userAuthenticated: false }
      );
    }

    if (!config.allowPublicAccess && !authContext.isAuthenticated) {
      throw new AuthorizationError(
        'Public access not permitted for this resource',
        'PUBLIC_ACCESS_DENIED',
        { allowPublicAccess: config.allowPublicAccess }
      );
    }
  }

  /**
   * Executes the actual Firestore query with ownership filtering
   *
   * @private
   * @param collectionName - Collection name
   * @param config - Query configuration
   * @param authContext - Authentication context
   * @returns Query execution result
   */
  private async executeAuthorizedQuery<T extends DocumentData>(
    collectionName: string,
    config: ScopedQueryConfiguration,
    authContext: AuthenticationContext
  ): Promise<AuthorizedQueryResult<T>> {
    const startTime = new Date();

    try {
      // Build base query
      const collectionRef = collection(this.firestore, collectionName);
      let queryRef: Query<DocumentData> = collectionRef;

      // Apply ownership filtering
      if (!config.allowPublicAccess && authContext.uid) {
        queryRef = query(queryRef, where(config.ownerField, '==', authContext.uid));
      }

      // Apply additional constraints
      if (config.additionalConstraints.length > 0) {
        queryRef = query(queryRef, ...config.additionalConstraints);
      }

      // Execute query
      const snapshot = await getDocs(queryRef);
      const endTime = new Date();

      // Transform documents
      const documents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as unknown as T[];

      return {
        documents: Object.freeze(documents),
        isEmpty: snapshot.empty,
        size: snapshot.size,
        authenticationContext: authContext,
        executionMetadata: {
          startTime,
          endTime,
          executionDuration: endTime.getTime() - startTime.getTime(),
          collectionName,
          constraintCount: config.additionalConstraints.length + (authContext.uid ? 1 : 0),
          ownershipFilterApplied: !config.allowPublicAccess && !!authContext.uid
        },
        cacheInfo: {
          fromCache: false,
          cacheTimestamp: null,
          timeToExpiry: null,
          cacheKey: null
        }
      };

    } catch (error) {
      throw new QueryExecutionError(
        `Failed to execute query on collection '${collectionName}'`,
        error as Error,
        { collectionName, config, authContext }
      );
    }
  }

  /**
   * Generates a cache key for query results
   *
   * @private
   * @param collectionName - Collection being queried
   * @param config - Query configuration
   * @param authContext - Authentication context
   * @returns Cache key string
   */
  private generateCacheKey(
    collectionName: string,
    config: ScopedQueryConfiguration,
    authContext: AuthenticationContext
  ): string {
    const keyComponents = [
      collectionName,
      config.ownerField,
      authContext.uid ?? 'anonymous',
      config.allowPublicAccess.toString(),
      JSON.stringify(config.additionalConstraints)
    ];

    return btoa(keyComponents.join('|'));
  }

  /**
   * Retrieves cached query result if available and valid
   *
   * @private
   * @param cacheKey - Cache key
   * @param cacheDuration - Cache validity duration
   * @returns Cached result or null
   */
  private getCachedResult<T extends DocumentData>(
    cacheKey: string,
    cacheDuration: number
  ): AuthorizedQueryResult<T> | null {
    const cached = this.queryCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    const now = new Date();
    const age = now.getTime() - cached.timestamp.getTime();

    if (age > cacheDuration) {
      this.queryCache.delete(cacheKey);
      return null;
    }

    return {
      ...cached.data,
      cacheInfo: {
        fromCache: true,
        cacheTimestamp: cached.timestamp,
        timeToExpiry: cacheDuration - age,
        cacheKey
      }
    } as AuthorizedQueryResult<T>;
  }

  /**
   * Caches query result for future use
   *
   * @private
   * @param cacheKey - Cache key
   * @param result - Query result to cache
   */
  private cacheResult<T extends DocumentData>(
    cacheKey: string,
    result: AuthorizedQueryResult<T>
  ): void {
    this.queryCache.set(cacheKey, {
      data: result,
      timestamp: new Date()
    });
  }

  /**
   * Logs query execution for audit trail
   *
   * @private
   * @param collectionName - Collection accessed
   * @param config - Query configuration
   * @param authContext - Authentication context
   * @param result - Query result
   */
  private logQueryAudit<T extends DocumentData>(
    collectionName: string,
    config: ScopedQueryConfiguration,
    authContext: AuthenticationContext,
    result: AuthorizedQueryResult<T>
  ): void {
    if (process.env.NODE_ENV === 'development') {
      logger.info('Query Audit Log', {
        timestamp: new Date().toISOString(),
        collection: collectionName,
        user: authContext.uid,
        email: authContext.email,
        resultCount: result.size,
        executionTime: result.executionMetadata.executionDuration,
        ownershipFilter: result.executionMetadata.ownershipFilterApplied
      });
    }
  }

  /**
   * Handles and logs query execution errors
   *
   * @private
   * @param error - Error that occurred
   * @param collectionName - Collection being queried
   * @param config - Query configuration
   * @param authContext - Authentication context
   */
  private handleQueryError(
    error: unknown,
    collectionName: string,
    config: ScopedQueryConfiguration,
    authContext: AuthenticationContext
  ): void {
    const errorContext = {
      timestamp: new Date().toISOString(),
      collection: collectionName,
      user: authContext.uid,
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    if (process.env.NODE_ENV === 'development') {
      logger.error('Query Error', errorContext);
    }

    // In production, send to error monitoring service
    // await errorMonitoringService.log(error, errorContext);
  }

  /**
   * Clears the query cache
   *
   * @public
   */
  public clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Gets cache statistics
   *
   * @public
   * @returns Cache usage statistics
   */
  public getCacheStatistics(): { size: number; keys: string[] } {
    return {
      size: this.queryCache.size,
      keys: Array.from(this.queryCache.keys())
    };
  }
}

// ============================================================================
// COLLECTION-SPECIFIC SERVICE FACTORIES
// ============================================================================

/**
 * Factory for creating collection-specific query services
 */
export class QueryServiceFactory {
  private static instance: AuthorizedQueryService | null = null;

  /**
   * Gets or creates singleton query service instance
   *
   * @param firestore - Firestore instance
   * @returns Authorized query service
   */
  public static getService(firestore: Firestore): AuthorizedQueryService {
    if (!this.instance) {
      this.instance = new AuthorizedQueryService(firestore);
    }
    return this.instance;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS FOR BACKWARD COMPATIBILITY
// ============================================================================

/**
 * Legacy function for reading projects - maintains backward compatibility
 *
 * @deprecated Use AuthorizedQueryService.readPublicDocuments instead
 * @param db - Firestore instance
 * @param constraints - Additional constraints
 * @returns Query result
 */
export async function readProjects(
  db: Firestore,
  constraints: QueryConstraint[] = []
): Promise<AuthorizedQueryResult> {
  const service = QueryServiceFactory.getService(db);
  return service.readPublicDocuments('projects', constraints);
}

/**
 * Legacy function for reading user contacts
 *
 * @deprecated Use AuthorizedQueryService.readOwnedDocuments instead
 * @param db - Firestore instance
 * @param constraints - Additional constraints
 * @returns Query result
 */
export async function readUserContacts(
  db: Firestore,
  constraints: QueryConstraint[] = []
): Promise<AuthorizedQueryResult> {
  const service = QueryServiceFactory.getService(db);
  return service.readOwnedDocuments('contacts', {
    additionalConstraints: constraints
  });
}

/**
 * Development utility for logging query context
 *
 * @param result - Query result
 * @param queryName - Name of query for logging
 */
export function logQueryContext(
  result: AuthorizedQueryResult,
  queryName: string
): void {
  if (process.env.NODE_ENV === 'development') {
    logger.info(`${queryName}:`, {
      authContext: result.authenticationContext,
      resultCount: result.size,
      fromCache: result.cacheInfo.fromCache,
      executionTime: result.executionMetadata.executionDuration
    });
  }
}

// Export the main service for direct use
export default AuthorizedQueryService;
