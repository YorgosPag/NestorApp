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

/**
 * Γιατί μια συλλογή δεν φέρει φίλτρο μισθωτή.
 *
 * 🔴 **ΔΥΟ ΠΟΛΥ ΔΙΑΦΟΡΕΤΙΚΑ ΠΡΑΓΜΑΤΑ, ΠΟΥ ΜΕΧΡΙ ΣΗΜΕΡΑ ΕΛΕΓΑΝ ΤΗΝ ΙΔΙΑ ΛΕΞΗ.**
 * Το `mode: 'none'` σήμαινε ταυτόχρονα «ρύθμιση συστήματος που τη γράφει ο διαχειριστής»
 * και — από το ADR-777 και μετά — «**φυσικό γεγονός που το διαβάζει όλος ο κόσμος**».
 * Η δεύτερη κατηγορία έχει ασφαλιστική συνέπεια που η πρώτη δεν έχει: ένα λάθος εκεί
 * είναι λάθος για **όλους τους πελάτες ταυτόχρονα** (SPEC-777A §14.4).
 *
 * Μία λέξη για δύο νοήματα είναι το σχήμα του ADR-749. Εδώ ονομάζονται.
 */
export type UnscopedCategory =
  /** Ρυθμίσεις / καθολικά singletons — γράφει ο διαχειριστής, διαβάζει ο πιστοποιημένος. */
  | 'system'
  /** Δεδομένα δεμένα σε έργο/αρχείο, όχι σε μισθωτή. */
  | 'project-scoped'
  /**
   * **Κοινό φυσικό γεγονός** (SPEC-777A Α11/Α12 επίπεδο Α): το βλέπουν όλοι, το
   * γράφει **μόνο ο διακομιστής**, δεν ανήκει σε κανέναν.
   */
  | 'public-world';

/**
 * Per-collection tenant field configuration.
 *
 * 🔑 **Διακριτή ένωση, όχι επίπεδη δομή — και ο λόγος είναι επιβολή.** Το SPEC-777A
 * §14.4 κανόνας 3 απαιτεί η μη-tenant-scoped συλλογή να δηλώνεται **ρητά, με γραπτό
 * λόγο**. Ως σχόλιο, αυτό είναι οδηγία που κάποιος θα παραλείψει· ως **τύπος**, το
 * `mode: 'none'` **δεν μεταγλωττίζεται** χωρίς κατηγορία και αιτιολόγηση.
 *
 * Είναι το ίδιο ιδίωμα με το `Record<X, true>` που ήδη χρησιμοποιεί το έργο
 * (`PROVENANCE_ACTIVITY_PRESENCE`): ο μεταγλωττιστής, όχι μια πύλη, είναι ο φθηνότερος
 * φρουρός όταν μπορεί να απαντήσει την ερώτηση.
 */
export type TenantFieldConfig =
  | {
      readonly mode: Exclude<TenantIsolationMode, 'none'>;
      readonly fieldName: string;
    }
  | {
      readonly mode: 'none';
      readonly fieldName: '';
      /** Σε ποια από τις τρεις κατηγορίες ανήκει — βλ. {@link UnscopedCategory}. */
      readonly unscopedCategory: UnscopedCategory;
      /** Ο γραπτός λόγος. **Υποχρεωτικός** (§14.4 κανόνας 3), όπως στο CHECK 3.35. */
      readonly unscopedReason: string;
    };

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
