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
  /**
   * When a super admin has picked a company via the global switcher (ADR-354),
   * Firestore queries scope to this id instead of returning all tenants.
   * Null for regular users or super admins without active selection.
   */
  readonly effectiveCompanyId: string | null;
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

/**
 * ADR-361: shared subscription-level controls for the equality guard.
 * Applied identically to `subscribe` / `subscribeDoc` / `subscribeSubcollection`.
 */
export interface EqualityGuardOptions {
  /**
   * Disable automatic content-equality guard for this subscription.
   * Default `false` — guard suppresses same-content re-emissions from
   * Firestore cache hydration / pending writes ack. Set to `true` when the
   * consumer must observe every snapshot (e.g. metadata refresh listeners).
   */
  readonly skipEqualityGuard?: boolean;
}

/** Options for collection / subcollection real-time subscriptions */
export interface SubscribeOptions<T = unknown> extends QueryOptions, EqualityGuardOptions {
  readonly enabled?: boolean;
  /**
   * ADR-361: custom comparator for the documents payload.
   * Default: `dequal` deep equal (industry standard — handles Firestore
   * Timestamp, Date, undefined, NaN correctly). Override for hot paths with
   * very large payloads where hashing a small subset of fields is cheaper.
   * Returning `true` means contents are equal → skip delivery.
   */
  readonly equalityFn?: (prev: readonly T[] | null | undefined, next: readonly T[]) => boolean;
}

/** Options for single-document real-time subscriptions */
export interface SubscribeDocOptions<T = unknown> extends EqualityGuardOptions {
  readonly enabled?: boolean;
  /**
   * ADR-361: custom comparator for the document payload.
   * Default: `dequal` deep equal. Returning `true` means contents are equal
   * → skip delivery. `prev` is `undefined` on the first delivery and after
   * `EqualitySlot.reset()`.
   */
  readonly equalityFn?: (prev: T | null | undefined, next: T | null) => boolean;
  /**
   * Pass `'skip'` to bypass tenant-isolation guards for collections that are
   * scoped by userId rather than companyId (e.g. user_preferences).
   */
  readonly tenantOverride?: 'skip';
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
    options?: SubscribeDocOptions<T>
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
