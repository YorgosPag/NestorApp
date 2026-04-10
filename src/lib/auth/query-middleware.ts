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
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

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

const logger = createModuleLogger('query-middleware');

// ============================================================================
// ENTERPRISE QUERY SERVICE
// ============================================================================

/**
 * Enterprise-grade authorization service for Firestore queries
 *
 * @deprecated Superseded by {@link FirestoreQueryService} (ADR-214 Phases 1-10).
 * FirestoreQueryService provides superior tenant isolation (companyId/tenantId/userId),
 * write support, real-time subscriptions, and batch operations.
 * This class is retained for backward compatibility — do NOT use in new code.
 * @see src/services/firestore/firestore-query.service.ts
 */
export class AuthorizedQueryService {
  private readonly firestore: Firestore;
  private readonly sessionMetadata: SessionMetadata;
  private readonly queryCache = new Map<string, { data: AuthorizedQueryResult; timestamp: Date }>();

  constructor(firestore: Firestore) {
    this.firestore = firestore;
    this.sessionMetadata = {
      sessionStartTime: new Date(),
      lastActivity: new Date(),
      sessionDuration: 0,
      requestCount: 0
    };
  }

  public getCurrentAuthenticationContext(): AuthenticationContext {
    const user = auth.currentUser;
    const now = new Date();

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

  public async readOwnedDocuments<T extends DocumentData = DocumentData>(
    collectionName: string,
    options: Partial<ScopedQueryConfiguration> = {}
  ): Promise<AuthorizedQueryResult<T>> {
    const authContext = this.getCurrentAuthenticationContext();

    const config: ScopedQueryConfiguration = {
      ownerField: 'ownerId',
      allowPublicAccess: false,
      requireAuthentication: true,
      additionalConstraints: [],
      cacheDuration: 300000,
      enableAuditLogging: true,
      ...options
    };

    try {
      this.validateAuthenticationRequirements(authContext, config);

      const cacheKey = this.generateCacheKey(collectionName, config, authContext);

      const cachedResult = this.getCachedResult<T>(cacheKey, config.cacheDuration);
      if (cachedResult) {
        return cachedResult;
      }

      const queryResult = await this.executeAuthorizedQuery<T>(
        collectionName,
        config,
        authContext
      );

      this.cacheResult(cacheKey, queryResult);

      if (config.enableAuditLogging) {
        this.logQueryAudit(collectionName, authContext, queryResult);
      }

      return queryResult;

    } catch (error) {
      this.handleQueryError(error, collectionName, authContext);
      throw error;
    }
  }

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

  private async executeAuthorizedQuery<T extends DocumentData>(
    collectionName: string,
    config: ScopedQueryConfiguration,
    authContext: AuthenticationContext
  ): Promise<AuthorizedQueryResult<T>> {
    const startTime = new Date();

    try {
      const collectionRef = collection(this.firestore, collectionName);
      let queryRef: Query<DocumentData> = collectionRef;

      if (!config.allowPublicAccess && authContext.uid) {
        queryRef = query(
          queryRef,
          // 🔒 companyId: N/A — this is a generic query middleware. The
          // `ownerField` is configurable per collection, and tenant scoping
          // (e.g. companyId filter) is expected to be passed via
          // `config.additionalConstraints` by the calling repository.
          where(config.ownerField, '==', authContext.uid),
        );
      }

      if (config.additionalConstraints.length > 0) {
        queryRef = query(queryRef, ...config.additionalConstraints);
      }

      const snapshot = await getDocs(queryRef);
      const endTime = new Date();

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

  private cacheResult<T extends DocumentData>(
    cacheKey: string,
    result: AuthorizedQueryResult<T>
  ): void {
    this.queryCache.set(cacheKey, {
      data: result,
      timestamp: new Date()
    });
  }

  private logQueryAudit<T extends DocumentData>(
    collectionName: string,
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

  private handleQueryError(
    error: unknown,
    collectionName: string,
    authContext: AuthenticationContext
  ): void {
    const errorContext = {
      timestamp: new Date().toISOString(),
      collection: collectionName,
      user: authContext.uid,
      error: getErrorMessage(error)
    };

    if (process.env.NODE_ENV === 'development') {
      logger.error('Query Error', errorContext);
    }
  }

  public clearCache(): void {
    this.queryCache.clear();
  }

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
 *
 * @deprecated Superseded by {@link firestoreQueryService} singleton (ADR-214).
 * Use `import { firestoreQueryService } from '@/services/firestore'` instead.
 */
export class QueryServiceFactory {
  private static instance: AuthorizedQueryService | null = null;

  public static getService(firestore: Firestore): AuthorizedQueryService {
    if (!this.instance) {
      this.instance = new AuthorizedQueryService(firestore);
    }
    return this.instance;
  }
}

// Legacy convenience functions (readProjects, readUserContacts, logQueryContext)
// DELETED in ADR-214 Phase 11 — 0 consumers, fully superseded by FirestoreQueryService.

/**
 * @deprecated Use {@link firestoreQueryService} from `@/services/firestore` instead.
 */
export default AuthorizedQueryService;
