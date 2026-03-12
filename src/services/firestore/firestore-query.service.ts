/**
 * @fileoverview FirestoreQueryService — Unified Firestore Query Layer
 * @description Singleton service for tenant-aware CRUD + subscriptions (ADR-214 Phase 1)
 * @version 1.0.0
 * @created 2026-03-12
 *
 * This is the foundational service for the 11-phase Firestore Query Centralization.
 * It provides:
 * - Tenant-aware reads (automatic where clause based on collection config)
 * - Sanitized writes (undefined → null)
 * - Real-time subscriptions with tenant filtering
 * - Batch reads with automatic chunking (Firestore `in` limit = 10)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit as firestoreLimit,
  documentId,
  onSnapshot,
  serverTimestamp,
  type DocumentData,
  type DocumentSnapshot,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS, FIRESTORE_LIMITS, type CollectionKey } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { requireAuthContext } from './auth-context';
import { getTenantConfig, resolveTenantValue } from './tenant-config';
import { chunkArray } from '@/lib/array-utils';
import type {
  TenantContext,
  QueryOptions,
  SubscribeOptions,
  CreateOptions,
  UpdateOptions,
  QueryResult,
  IFirestoreQueryService,
} from './firestore-query.types';

// Re-export error classes from AuthorizedQueryService (no duplication)
export { AuthorizationError, QueryExecutionError } from '@/lib/auth/query-middleware';

// ============================================================================
// HELPERS
// ============================================================================

/** Resolve Firestore collection name from CollectionKey */
function resolveCollectionName(key: CollectionKey): string {
  return COLLECTIONS[key];
}

/** Build tenant where-clause constraints based on config + auth context */
function buildTenantConstraints(
  key: CollectionKey,
  ctx: TenantContext,
  tenantOverride?: QueryOptions['tenantOverride']
): QueryConstraint[] {
  // Explicit opt-out
  if (tenantOverride === 'skip') return [];

  const config = tenantOverride
    ? { mode: tenantOverride, fieldName: tenantOverride === 'userId' ? 'userId' : tenantOverride }
    : getTenantConfig(key);

  // System collections — no tenant filter
  if (config.mode === 'none') return [];

  // Super admin without companyId → sees everything
  if (ctx.isSuperAdmin && !ctx.companyId) return [];

  const value = resolveTenantValue(config.mode, ctx);
  if (!value) return [];

  return [where(config.fieldName, '==', value)];
}

// ADR-218: chunkArray imported from centralized @/lib/array-utils

/** Extract typed document data from a snapshot */
function extractDoc<T>(snap: DocumentSnapshot): T | null {
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T;
}

// ============================================================================
// SERVICE
// ============================================================================

class FirestoreQueryService implements IFirestoreQueryService {

  // --- READ: Single Document ---------------------------------------------------

  async getById<T extends DocumentData>(
    key: CollectionKey,
    docId: string
  ): Promise<T | null> {
    const colName = resolveCollectionName(key);
    const ref = doc(db, colName, docId);
    const snap = await getDoc(ref);
    return extractDoc<T>(snap);
  }

  // --- READ: Multiple Documents ------------------------------------------------

  async getAll<T extends DocumentData>(
    key: CollectionKey,
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const ctx = await requireAuthContext();
    const colName = resolveCollectionName(key);
    const colRef = collection(db, colName);

    const allConstraints: QueryConstraint[] = [
      ...buildTenantConstraints(key, ctx, options.tenantOverride),
      ...(options.constraints ?? []),
    ];

    if (options.maxResults) {
      allConstraints.push(firestoreLimit(options.maxResults));
    }

    const q = allConstraints.length > 0
      ? query(colRef, ...allConstraints)
      : query(colRef);

    const snapshot = await getDocs(q);
    const documents = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as T));
    const lastDocument = snapshot.docs[snapshot.docs.length - 1] ?? null;

    return {
      documents,
      size: snapshot.size,
      isEmpty: snapshot.empty,
      lastDocument,
    };
  }

  // --- WRITE: Create -----------------------------------------------------------

  async create<T extends Record<string, unknown>>(
    key: CollectionKey,
    data: T,
    options: CreateOptions
  ): Promise<string> {
    const colName = resolveCollectionName(key);
    const docId = options.documentId;
    const ref = doc(db, colName, docId);

    const addTimestamps = options.addTimestamps !== false;
    const addTenantContext = options.addTenantContext !== false;

    let payload: Record<string, unknown> = sanitizeForFirestore({ ...data });

    if (addTimestamps) {
      payload = {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
    }

    if (addTenantContext) {
      const ctx = await requireAuthContext();
      const config = getTenantConfig(key);
      if (config.mode !== 'none') {
        const tenantValue = resolveTenantValue(config.mode, ctx);
        if (tenantValue) {
          payload[config.fieldName] = tenantValue;
        }
      }
      payload.createdBy = ctx.uid;
    }

    await setDoc(ref, payload);
    return docId;
  }

  // --- WRITE: Update -----------------------------------------------------------

  async update<T extends Record<string, unknown>>(
    key: CollectionKey,
    docId: string,
    data: Partial<T>,
    options: UpdateOptions = {}
  ): Promise<void> {
    const colName = resolveCollectionName(key);
    const ref = doc(db, colName, docId);
    const touchUpdatedAt = options.touchUpdatedAt !== false;

    const payload: Record<string, unknown> = sanitizeForFirestore({ ...data } as Record<string, unknown>);

    if (touchUpdatedAt) {
      payload.updatedAt = serverTimestamp();
    }

    await updateDoc(ref, payload);
  }

  // --- WRITE: Delete -----------------------------------------------------------

  async remove(key: CollectionKey, docId: string): Promise<void> {
    const colName = resolveCollectionName(key);
    const ref = doc(db, colName, docId);
    await deleteDoc(ref);
  }

  // --- SUBSCRIBE: Real-time ----------------------------------------------------

  subscribe<T extends DocumentData>(
    key: CollectionKey,
    onData: (result: QueryResult<T>) => void,
    onError: (error: Error) => void,
    options: SubscribeOptions = {}
  ): Unsubscribe {
    if (options.enabled === false) {
      // Return no-op unsubscribe when disabled
      return () => { /* noop */ };
    }

    const colName = resolveCollectionName(key);
    const colRef = collection(db, colName);

    // We need auth context synchronously for subscription setup, so we
    // start the subscription after resolving auth.
    let unsubscribe: Unsubscribe = () => { /* noop */ };
    let cancelled = false;

    void requireAuthContext().then(ctx => {
      if (cancelled) return;

      const allConstraints: QueryConstraint[] = [
        ...buildTenantConstraints(key, ctx, options.tenantOverride),
        ...(options.constraints ?? []),
      ];

      if (options.maxResults) {
        allConstraints.push(firestoreLimit(options.maxResults));
      }

      const q = allConstraints.length > 0
        ? query(colRef, ...allConstraints)
        : query(colRef);

      unsubscribe = onSnapshot(q,
        snapshot => {
          const documents = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as T));
          const lastDocument = snapshot.docs[snapshot.docs.length - 1] ?? null;
          onData({
            documents,
            size: snapshot.size,
            isEmpty: snapshot.empty,
            lastDocument,
          });
        },
        onError
      );
    }).catch(onError);

    // Return a function that cancels pending setup OR the actual listener
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }

  // --- BATCH: Multiple IDs -----------------------------------------------------

  async batchGet<T extends DocumentData>(
    key: CollectionKey,
    docIds: readonly string[]
  ): Promise<ReadonlyMap<string, T>> {
    if (docIds.length === 0) return new Map();

    const colName = resolveCollectionName(key);
    const colRef = collection(db, colName);
    const chunks = chunkArray(docIds, FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS);

    const results = new Map<string, T>();

    const chunkPromises = chunks.map(async chunk => {
      const q = query(colRef, where(documentId(), 'in', chunk));
      const snapshot = await getDocs(q);
      for (const docSnap of snapshot.docs) {
        results.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as unknown as T);
      }
    });

    await Promise.all(chunkPromises);
    return results;
  }

  // --- AUTH CONTEXT (public for repos that need it) ----------------------------

  async requireAuthContext(): Promise<TenantContext> {
    return requireAuthContext();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/** Singleton instance of FirestoreQueryService */
export const firestoreQueryService: IFirestoreQueryService = new FirestoreQueryService();
