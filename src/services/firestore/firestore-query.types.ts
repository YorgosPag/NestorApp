/**
 * @fileoverview FirestoreQueryService — Type Definitions
 * @description Central types for the unified Firestore query layer (ADR-214 Phase 1)
 * @version 1.0.0
 * @created 2026-03-12
 */

import type {
  QueryConstraint,
  DocumentData,
  DocumentSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import type { CollectionKey } from '@/config/firestore-collections';

// ============================================================================
// AUTH CONTEXT
// ============================================================================

/** Tenant-aware authentication context extracted from Firebase custom claims */
export interface TenantContext {
  readonly uid: string;
  readonly companyId: string | null;
  readonly isSuperAdmin: boolean;
}

// ============================================================================
// TENANT ISOLATION
// ============================================================================

/** Tenant isolation strategy per collection */
export type TenantIsolationMode = 'companyId' | 'tenantId' | 'userId' | 'none';

/** Per-collection tenant field configuration */
export interface TenantFieldConfig {
  readonly mode: TenantIsolationMode;
  readonly fieldName: string;
}

// ============================================================================
// QUERY OPTIONS
// ============================================================================

/** Options for read queries (getAll, batchGet) */
export interface QueryOptions {
  readonly constraints?: readonly QueryConstraint[];
  readonly tenantOverride?: TenantIsolationMode | 'skip';
  readonly maxResults?: number;
}

/** Options for real-time subscriptions */
export interface SubscribeOptions extends QueryOptions {
  readonly enabled?: boolean;
}

// ============================================================================
// WRITE OPTIONS
// ============================================================================

/** Options for document creation */
export interface CreateOptions {
  /** Pre-generated document ID (ADR-210 compliance: ALWAYS pre-generate IDs) */
  readonly documentId: string;
  /** Auto-add createdAt/updatedAt serverTimestamp fields. Default: true */
  readonly addTimestamps?: boolean;
  /** Auto-add tenant context (companyId etc.) to document. Default: true */
  readonly addTenantContext?: boolean;
}

/** Options for document updates */
export interface UpdateOptions {
  /** Auto-touch updatedAt with serverTimestamp. Default: true */
  readonly touchUpdatedAt?: boolean;
}

// ============================================================================
// QUERY RESULT
// ============================================================================

/** Typed result envelope for query operations */
export interface QueryResult<T> {
  readonly documents: readonly T[];
  readonly size: number;
  readonly isEmpty: boolean;
  readonly lastDocument: DocumentSnapshot | null;
}

// ============================================================================
// SERVICE INTERFACE
// ============================================================================

/** Public contract for the FirestoreQueryService */
export interface IFirestoreQueryService {
  getById<T extends DocumentData>(
    key: CollectionKey,
    docId: string
  ): Promise<T | null>;

  getAll<T extends DocumentData>(
    key: CollectionKey,
    options?: QueryOptions
  ): Promise<QueryResult<T>>;

  create<T extends Record<string, unknown>>(
    key: CollectionKey,
    data: T,
    options: CreateOptions
  ): Promise<string>;

  update<T extends Record<string, unknown>>(
    key: CollectionKey,
    docId: string,
    data: Partial<T>,
    options?: UpdateOptions
  ): Promise<void>;

  remove(key: CollectionKey, docId: string): Promise<void>;

  subscribe<T extends DocumentData>(
    key: CollectionKey,
    onData: (result: QueryResult<T>) => void,
    onError: (error: Error) => void,
    options?: SubscribeOptions
  ): Unsubscribe;

  subscribeDoc<T extends DocumentData>(
    key: CollectionKey,
    docId: string,
    onData: (document: T | null) => void,
    onError: (error: Error) => void,
    options?: SubscribeOptions
  ): Unsubscribe;

  subscribeSubcollection<T extends DocumentData>(
    parentKey: CollectionKey,
    parentId: string,
    subcollectionName: string,
    onData: (result: QueryResult<T>) => void,
    onError: (error: Error) => void,
    options?: SubscribeOptions
  ): Unsubscribe;

  batchGet<T extends DocumentData>(
    key: CollectionKey,
    docIds: readonly string[]
  ): Promise<ReadonlyMap<string, T>>;

  requireAuthContext(): Promise<TenantContext>;
}
