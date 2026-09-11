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
  type CollectionReference,
  type DocumentData,
  type DocumentSnapshot,
  type Query,
  type QueryConstraint,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS, FIRESTORE_LIMITS, type CollectionKey } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { requireAuthContext, waitForAuthReady, resolveEffectiveCompanyId } from './auth-context';
import { onSuperAdminActiveCompanyChange } from './super-admin-active-company';
import { getTenantConfig, resolveTenantValue } from './tenant-config';
import { chunkArray } from '@/lib/array-utils';
import type {
  TenantContext,
  QueryOptions,
  SubscribeOptions,
  SubscribeDocOptions,
  CreateOptions,
  UpdateOptions,
  QueryResult,
  IFirestoreQueryService,
} from './firestore-query.types';
import {
  defaultDocumentsEqual,
  defaultDocumentEqual,
  EqualitySlot,
} from './firestore-equality';

// Canonical error types — originally defined in query-middleware.ts, re-exported here
// as the single import point for all consumers (ADR-214 Phase 11).
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

  // ADR-356 SSOT: the companyId decision (regular tenant / super-admin
  // impersonation / super-admin global view) lives in `resolveEffectiveCompanyId`.
  // Custom services that bypass this layer (e.g. `companies.service.ts`,
  // `navigation-companies.service.ts`) call the same helper directly, so the
  // rule is enforced once across every client-side tenant filter.
  if (config.mode === 'companyId') {
    const effective = resolveEffectiveCompanyId(ctx);
    if (!effective) return []; // super admin with no switcher selection
    return [where(config.fieldName, '==', effective)];
  }

  // Non-companyId modes (userId, tenantId, ...) — delegated to the
  // tenant-config resolver. Super admins without `effectiveCompanyId` already
  // returned `[]` above for the companyId mode; other modes use ctx fields
  // directly and are unaffected by the switcher.
  const value = resolveTenantValue(config.mode, ctx);
  if (!value) return [];

  return [where(config.fieldName, '==', value)];
}

// ADR-218: chunkArray imported from centralized @/lib/array-utils

/** «Κανένας ακροατής» — ΕΝΑ όνομα αντί για έξι σκόρπια `() => {}` (CHECK 3.28). */
const NOOP_UNSUBSCRIBE: Unsubscribe = (): void => undefined;

/** Extract typed document data from a snapshot */
function extractDoc<T>(snap: DocumentSnapshot): T | null {
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T;
}

// 🔑 ΟΙ ΤΕΣΣΕΡΙΣ ΒΟΗΘΟΙ ΠΑΡΑΚΑΤΩ ΕΞΗΧΘΗΣΑΝ ΜΕ ΜΕΤΡΗΣΗ (CHECK 3.28, ADR-849 Β1): το
//    `jscpd:diff` βρήκε ΤΡΕΙΣ προϋπάρχοντες κλώνους μέσα σε αυτό το αρχείο — η δόμηση του
//    query (`getAll` ↔ `subscribe`), ο φρουρός ισότητας και ο χειριστής στιγμιότυπου
//    (`subscribe` ↔ `subscribeSubcollection`). Τρία αντίγραφα του ίδιου φακέλου
//    αποτελέσματος είναι τρία σημεία όπου ένα νέο πεδίο μπορεί να ξεχαστεί.

/** Τα έγγραφα ενός στιγμιότυπου συλλογής, με το `id` τους. */
function mapDocuments<T>(snapshot: QuerySnapshot): T[] {
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as T));
}

/** Ο φάκελος αποτελέσματος — ΕΝΑΣ για ανάγνωση και για ακρόαση. */
function toQueryResult<T>(snapshot: QuerySnapshot, documents: readonly T[]): QueryResult<T> {
  return {
    documents,
    size: snapshot.size,
    isEmpty: snapshot.empty,
    lastDocument: snapshot.docs[snapshot.docs.length - 1] ?? null,
  };
}

/** Το query: πρώτα τα `leading` (φίλτρο μισθωτή), μετά του καλούντα, τέλος το όριο. */
function composeQuery(
  ref: CollectionReference,
  leading: readonly QueryConstraint[],
  options: QueryOptions,
): Query {
  const constraints: QueryConstraint[] = [...leading, ...(options.constraints ?? [])];
  if (options.maxResults) {
    constraints.push(firestoreLimit(options.maxResults));
  }
  return constraints.length > 0 ? query(ref, ...constraints) : query(ref);
}

/**
 * Ο χειριστής στιγμιότυπου συλλογής, με τον φρουρό ισότητας (ADR-361) — κοινός για
 * `subscribe` και `subscribeSubcollection`. Το `slot` το κατέχει ο καλών, γιατί εκείνος
 * ξέρει πότε μηδενίζεται (σε κάθε ανοικοδόμηση).
 */
function guardedCollectionListener<T extends DocumentData>(
  slot: EqualitySlot<readonly T[]>,
  options: SubscribeOptions<T>,
  onData: (result: QueryResult<T>) => void,
): (snapshot: QuerySnapshot) => void {
  const equalityFn = options.equalityFn ?? defaultDocumentsEqual;
  const guardEnabled = options.skipEqualityGuard !== true;
  return snapshot => {
    const documents = mapDocuments<T>(snapshot);
    if (guardEnabled && slot.shouldSkip(documents, equalityFn)) {
      return;
    }
    onData(toQueryResult(snapshot, documents));
  };
}

/**
 * **Ο ΕΝΑΣ ακροατής συλλογής** — για `subscribe` **και** `subscribeSubcollection`.
 *
 * Ήταν δύο χειρόγραφα αντίγραφα (CHECK 3.28), και μόνο το ένα ήξερε να ξαναστήνεται όταν
 * αλλάζει ο χώρος. Τώρα η διαφορά τους είναι **δύο παράμετροι**: ποια φίλτρα μπαίνουν
 * πρώτα (`leading`) και αν ο ακροατής ακολουθεί τον χώρο (`followScope`).
 *
 * 🔴 **Μετρητής γενιάς — μόνο η ΤΕΛΕΥΤΑΙΑ ανοικοδόμηση στήνει ακροατή** (ADR-849 Β1). Το
 * `rebuild` περιμένει (`waitForAuthReady` · `requireAuthContext`). Δύο διαδοχικές
 * ειδοποιήσεις — π.χ. μετάβαση `/o/A` → `/o/B`: «έξοδος από χώρο» και αμέσως «νέος χώρος»
 * στο ίδιο commit — ξεκινούσαν **δύο** αναμονές· και οι δύο έστηναν `onSnapshot`, και ο
 * πρώτος **δεν απεγγραφόταν ποτέ**. Διαρροή ακροατή = αναγνώσεις που πληρώνονται για πάντα.
 */
function subscribeToCollection<T extends DocumentData>(
  ref: CollectionReference,
  leading: (ctx: TenantContext) => readonly QueryConstraint[],
  followScope: boolean,
  onData: (result: QueryResult<T>) => void,
  onError: (error: Error) => void,
  options: SubscribeOptions<T>,
): Unsubscribe {
  // Return no-op unsubscribe when disabled — ΕΝΑΣ έλεγχος, όχι ένας ανά μέθοδο.
  if (options.enabled === false) return NOOP_UNSUBSCRIBE;

  let innerUnsub: Unsubscribe = NOOP_UNSUBSCRIBE;
  let cancelled = false;
  let generation = 0;

  // ADR-361: content-equality guard. Reset on every rebuild so a tenant change
  // does not suppress the first delivery of the new tenant.
  const slot = new EqualitySlot<readonly T[]>();
  const listener = guardedCollectionListener(slot, options, onData);

  const rebuild = async (): Promise<void> => {
    const mine = ++generation;
    innerUnsub();
    innerUnsub = NOOP_UNSUBSCRIBE;
    slot.reset();
    const stale = (): boolean => cancelled || mine !== generation;
    if (stale()) return;
    if (!(await waitForAuthReady())) return;
    if (stale()) return;
    const ctx = await requireAuthContext();
    if (stale()) return;
    innerUnsub = onSnapshot(composeQuery(ref, leading(ctx), options), listener, onError);
  };

  void rebuild().catch(onError);

  // Rebuild when the requested workspace changes (URL · switcher, ADR-354 / ADR-849 Β1) —
  // otherwise long-lived real-time listeners stay scoped to the previous tenant.
  const unsubScope = followScope
    ? onSuperAdminActiveCompanyChange(() => {
        void rebuild().catch(onError);
      })
    : NOOP_UNSUBSCRIBE;

  return () => {
    cancelled = true;
    innerUnsub();
    unsubScope();
  };
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
    const colRef = collection(db, resolveCollectionName(key));
    const q = composeQuery(colRef, buildTenantConstraints(key, ctx, options.tenantOverride), options);

    const snapshot = await getDocs(q);
    return toQueryResult(snapshot, mapDocuments<T>(snapshot));
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
    options: SubscribeOptions<T> = {}
  ): Unsubscribe {
    return subscribeToCollection(
      collection(db, resolveCollectionName(key)),
      ctx => buildTenantConstraints(key, ctx, options.tenantOverride),
      true,
      onData,
      onError,
      options,
    );
  }

  // --- SUBSCRIBE: Single Document -----------------------------------------------

  subscribeDoc<T extends DocumentData>(
    key: CollectionKey,
    docId: string,
    onData: (document: T | null) => void,
    onError: (error: Error) => void,
    options: SubscribeDocOptions<T> = {}
  ): Unsubscribe {
    if (options.enabled === false) {
      return NOOP_UNSUBSCRIBE;
    }

    const colName = resolveCollectionName(key);
    const docRef = doc(db, colName, docId);

    let unsubscribe: Unsubscribe = NOOP_UNSUBSCRIBE;
    let cancelled = false;

    // ADR-361: content-equality guard for single-document subscription.
    const slot = new EqualitySlot<T | null>();
    const equalityFn = options.equalityFn ?? defaultDocumentEqual;
    const guardEnabled = options.skipEqualityGuard !== true;

    void waitForAuthReady().then(hasUser => {
      if (cancelled || !hasUser) return;
      return requireAuthContext();
    }).then(() => {
      if (cancelled) return;

      unsubscribe = onSnapshot(docRef,
        snapshot => {
          const document = extractDoc<T>(snapshot);
          if (guardEnabled && slot.shouldSkip(document, equalityFn)) {
            return;
          }
          onData(document);
        },
        onError
      );
    }).catch(onError);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }

  // --- SUBSCRIBE: Subcollection -----------------------------------------------

  subscribeSubcollection<T extends DocumentData>(
    parentKey: CollectionKey,
    parentId: string,
    subcollectionName: string,
    onData: (result: QueryResult<T>) => void,
    onError: (error: Error) => void,
    options: SubscribeOptions<T> = {}
  ): Unsubscribe {
    // Υποσυλλογή: τον μισθωτή τον φέρει ήδη ο γονέας (η διαδρομή του εγγράφου) ⇒ κανένα
    // φίλτρο πρώτο, και καμία ανοικοδόμηση όταν αλλάζει ο χώρος — ίδια συμπεριφορά με πριν.
    return subscribeToCollection(
      collection(db, resolveCollectionName(parentKey), parentId, subcollectionName),
      () => [],
      false,
      onData,
      onError,
      options,
    );
  }

  // --- BATCH: Multiple IDs -----------------------------------------------------

  async batchGet<T extends DocumentData>(
    key: CollectionKey,
    docIds: readonly string[]
  ): Promise<ReadonlyMap<string, T>> {
    if (docIds.length === 0) return new Map();

    const colName = resolveCollectionName(key);
    const colRef = collection(db, colName);
    const chunks = chunkArray([...docIds], FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS);

    const results = new Map<string, T>();

    const chunkPromises = chunks.map(async chunk => {
      // companyId: N/A — generic batchGet by documentId() (Firestore reserved field).
      // Tenant isolation is enforced at the firestore.rules level via resource.data.companyId
      // checks on each fetched document. Adding a where('companyId') here would require
      // every collection to have a companyId field (some don't, e.g. system/* docs).
      const q = query(
        // companyId: N/A — generic batchGet by documentId(), tenant enforced by firestore.rules
        colRef,
        where(documentId(), 'in', chunk)
      );
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
