'use client';

/**
 * ADR-652 M2 — Scoped content-library engine (SSoT).
 *
 * Η ΜΙΑ μηχανή για κάθε «βιβλιοθήκη περιεχομένου» του BIM: ένα root Firestore
 * collection όπου κάθε doc φέρει `scope` (`system` / `company` / `project` / `user`)
 * και ο actor βλέπει το ΕΝΩΜΕΝΟ σύνολο των scopes που τον αφορούν — ακριβώς το
 * μοντέλο μιας Revit content library (system content + office content + project
 * content + my content).
 *
 * Εξήχθη από τον `MaterialLibraryService` (ADR-363 Phase 6.5) όταν προστέθηκε η
 * δεύτερη βιβλιοθήκη (`BlockLibraryService`, ADR-652 M2): αντί για sibling clone
 * του ίδιου CRUD+cache+subscribe-merge (το λάθος που απαγορεύει ο κανόνας N.18),
 * ΚΑΙ ΟΙ ΔΥΟ υπηρεσίες συνθέτουν ΑΥΤΟΝ τον πυρήνα και κρατούν μόνο ό,τι είναι
 * πραγματικά domain-specific (payload shape, validation, error codes).
 *
 * Τι παρέχει:
 *  - multi-scope `list()` (getDocs ανά bucket + merge) με cache TTL 5min
 *  - multi-scope `subscribe()` (ένα listener ανά bucket + merge + equality guard)
 *  - `create/patch/remove/getById` με builtin guard (system-seeded = immutable)
 *  - tenant isolation: κάθε tenant-scoped bucket φέρει ΠΑΝΤΑ `companyId` (CHECK 3.10)
 *
 * SOS N.6: τα ids τα δίνει ο caller από τον `enterprise-id.service` — ο πυρήνας
 * γράφει ΜΟΝΟ με `setDoc()` + ρητό id (ποτέ auto-generated document id).
 *
 * @see ./MaterialLibraryService.ts — πρώτος καταναλωτής (bim_materials)
 * @see ./BlockLibraryService.ts — δεύτερος καταναλωτής (block_library)
 * @see docs/centralized-systems/reference/adrs/ADR-652-block-library.md
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type CollectionReference,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS, type CollectionKey } from '@/config/firestore-collections';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { DXF_TIMING } from '../../config/dxf-timing';

// ============================================================================
// CONTRACT
// ============================================================================

/** Το ελάχιστο shape που πρέπει να έχει κάθε doc βιβλιοθήκης. */
export interface ScopedLibraryDoc {
  readonly id: string;
  readonly scope: string;
  /** system/partner seed → immutable από client. */
  readonly builtin?: boolean;
  readonly updatedAt?: { toMillis?: () => number } | null;
}

/**
 * Ένα «κουβαδάκι» ορατότητας = ένα Firestore query. `tenantScoped: true` →
 * ο πυρήνας προσθέτει ΠΑΝΤΑ `companyId ==` (getDocs) / αφήνει το tenant injection
 * του `firestoreQueryService` (subscribe). `false` → shared/system content
 * (`tenantOverride: 'skip'`), ορατό σε κάθε authenticated χρήστη.
 */
export interface ScopedLibraryBucket {
  readonly key: string;
  readonly constraints: readonly QueryConstraint[];
  readonly tenantScoped: boolean;
}

/** Domain error codes — κάθε βιβλιοθήκη έχει τα δικά της (typed strings). */
export interface ScopedLibraryErrors {
  readonly notFound: string;
  readonly builtinNotMutable: string;
}

export interface ScopedLibraryConfig {
  readonly collectionKey: CollectionKey;
  readonly companyId: string;
  readonly userId: string;
  readonly buckets: readonly ScopedLibraryBucket[];
  readonly errors: ScopedLibraryErrors;
  /**
   * Τοπολογία collection. Default (top-level): `collection(db, COLLECTIONS[collectionKey])`
   * — το μοντέλο των `block_library` / `bim_materials` (companyId ως ΠΕΔΙΟ). Δώσε factory
   * όταν η βιβλιοθήκη ζει σε SUBcollection, π.χ. `COMPANIES/{companyId}/bim_family_types`
   * (family-types / stair-presets). Η factory καθορίζει ΑΠΟΚΛΕΙΣΤΙΚΑ το path· οι buckets
   * (scope/tenant constraints) μένουν ίδιοι. ⚠️ Ο `subscribe()` (firestoreQueryService,
   * top-level tenant injection) ΔΕΝ υποστηρίζει subcollection topology — δες τον guard εκεί.
   */
  readonly collectionRefFactory?: () => CollectionReference<DocumentData>;
}

const CACHE_TTL_MS = DXF_TIMING.lifecycle.CACHE_TTL; // ADR-516

// ============================================================================
// ΤΑ ΚΑΝΟΝΙΚΑ SCOPE BUCKETS — η σημασιολογία των scopes ζει ΕΔΩ, ΜΙΑ ΦΟΡΑ
// ============================================================================

/** Κοινό/seeded περιεχόμενο — ορατό σε κάθε authenticated χρήστη (χωρίς tenant filter). */
export function systemScopeBucket(): ScopedLibraryBucket {
  return { key: 'system', constraints: [where('scope', '==', 'system')], tenantScoped: false };
}

/** Περιεχόμενο του γραφείου — ορατό σε όλη την εταιρεία. */
export function companyScopeBucket(): ScopedLibraryBucket {
  return { key: 'company', constraints: [where('scope', '==', 'company')], tenantScoped: true };
}

/** Περιεχόμενο ενός έργου. */
export function projectScopeBucket(projectId: string): ScopedLibraryBucket {
  return {
    key: 'project',
    constraints: [where('scope', '==', 'project'), where('projectId', '==', projectId)],
    tenantScoped: true,
  };
}

/**
 * «Τα δικά ΜΟΥ» — ιδιωτικό περιεχόμενο ενός χρήστη μέσα στην εταιρεία του.
 *
 * `ownerField` = το πεδίο ιδιοκτησίας του doc. Default `createdBy` (block/material
 * library). Οι subcollection βιβλιοθήκες family-types / stair-presets κρατούν την
 * ιδιοκτησία σε `ownerId` — περνούν `'ownerId'` ώστε η εκπεμπόμενη query να μένει
 * ΑΚΡΙΒΩΣ η ίδια (καμία αλλαγή σε rules/indexes).
 */
export function userScopeBucket(userId: string, ownerField = 'createdBy'): ScopedLibraryBucket {
  return {
    key: 'user',
    constraints: [where('scope', '==', 'user'), where(ownerField, '==', userId)],
    tenantScoped: true,
  };
}

/** Το προαιρετικό project bucket ως λίστα (0 ή 1) — για spread σε σύνθεση buckets. */
export function optionalProjectScopeBucket(projectId?: string): readonly ScopedLibraryBucket[] {
  return projectId ? [projectScopeBucket(projectId)] : [];
}

/** Snapshot key για το equality guard του subscribe merge. */
function buildEqualityKey(docs: readonly ScopedLibraryDoc[]): string {
  return docs.map((d) => `${d.id}:${d.updatedAt?.toMillis?.() ?? 0}`).join('|');
}

/** Firestore απορρίπτει `undefined` — strip πριν από κάθε write. */
function stripUndefined(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// ============================================================================
// ENGINE
// ============================================================================

export class ScopedLibraryService<T extends ScopedLibraryDoc> {
  private cache: { readonly docs: readonly T[]; readonly ts: number } | null = null;

  constructor(private readonly config: ScopedLibraryConfig) {}

  private get collectionName(): string {
    return COLLECTIONS[this.config.collectionKey];
  }

  /**
   * Το collection στο οποίο ζει η βιβλιοθήκη. Default = top-level
   * `collection(db, collectionName)`. Αν δοθεί `collectionRefFactory` (subcollection
   * topology, π.χ. `COMPANIES/{companyId}/…`), το path έρχεται ΑΠΟΚΛΕΙΣΤΙΚΑ από εκεί.
   */
  private collectionRef(): CollectionReference<DocumentData> {
    return this.config.collectionRefFactory
      ? this.config.collectionRefFactory()
      : collection(db, this.collectionName);
  }

  private docRef(id: string) {
    return doc(this.collectionRef(), id);
  }

  /** Το ενωμένο σύνολο των scopes που βλέπει ο actor (cached, TTL 5min). */
  async list(): Promise<readonly T[]> {
    const now = Date.now();
    if (this.cache && now - this.cache.ts < CACHE_TTL_MS) {
      return this.cache.docs;
    }

    const buckets = await Promise.all(this.config.buckets.map((b) => this.fetchBucket(b)));
    const merged: T[] = [];
    for (const bucket of buckets) merged.push(...bucket);

    this.cache = { docs: merged, ts: now };
    return merged;
  }

  private async fetchBucket(bucket: ScopedLibraryBucket): Promise<readonly T[]> {
    const constraints: QueryConstraint[] = [...bucket.constraints];
    if (bucket.tenantScoped) {
      // Tenant isolation — companyId σε ΚΑΘΕ tenant-scoped query (CHECK 3.10).
      constraints.push(where('companyId', '==', this.config.companyId));
    }
    const snap = await getDocs(query(this.collectionRef(), ...constraints));
    return snap.docs.map((d) => d.data() as unknown as T);
  }

  /**
   * Live merge για το UI: ένα `firestoreQueryService` listener ανά bucket +
   * merge + equality guard (memory rule `feedback_firestore_subscribe_equality_guard`).
   */
  subscribe(
    cb: (docs: readonly T[]) => void,
    onError: (error: Error) => void = () => {},
  ): Unsubscribe {
    // Ο live merge περνά από τον `firestoreQueryService` (top-level tenant injection).
    // Subcollection topology (collectionRefFactory) δεν εκφράζεται από αυτόν → fail loud
    // αντί για σιωπηλά λάθος collection. Οι subcollection καταναλωτές (family/stair)
    // χρησιμοποιούν ΜΟΝΟ `list()` (getDocs-based, topology-aware).
    if (this.config.collectionRefFactory) {
      throw new Error('SCOPED_LIBRARY_SUBSCRIBE_UNSUPPORTED_FOR_SUBCOLLECTION');
    }

    const byBucket = new Map<string, readonly T[]>();
    let lastKey = '__INITIAL__';

    const emit = (): void => {
      const merged: T[] = [];
      for (const bucket of this.config.buckets) {
        merged.push(...(byBucket.get(bucket.key) ?? []));
      }
      const key = buildEqualityKey(merged);
      if (key === lastKey) return;
      lastKey = key;
      this.cache = { docs: merged, ts: Date.now() };
      cb(merged);
    };

    const unsubs = this.config.buckets.map((bucket) =>
      firestoreQueryService.subscribe<DocumentData>(
        this.config.collectionKey,
        (result) => {
          byBucket.set(bucket.key, result.documents as unknown as readonly T[]);
          emit();
        },
        onError,
        {
          constraints: [...bucket.constraints],
          // Shared/system content → παρακάμπτει το tenant injection (ορατό σε όλους).
          ...(bucket.tenantScoped ? {} : { tenantOverride: 'skip' as const }),
        },
      ),
    );

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }

  /**
   * Δημιουργεί doc με ID από τον enterprise-id generator (SOS N.6 — ΠΟΤΕ `addDoc`).
   * Ο caller δίνει το domain payload· ο πυρήνας προσθέτει τα κοινά lifecycle πεδία.
   */
  async create(id: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const payloadDoc = {
      ...stripUndefined(payload),
      id,
      builtin: false,
      companyId: this.config.companyId,
      createdBy: this.config.userId,
      createdAt: serverTimestamp(),
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };
    await setDoc(this.docRef(id), payloadDoc);
    this.invalidateCache();
    return payloadDoc;
  }

  /** Patch σε ΜΗ-builtin doc (system seed → reject). */
  async patch(id: string, data: Record<string, unknown>): Promise<void> {
    await this.requireMutable(id);
    await setDoc(
      this.docRef(id),
      {
        ...stripUndefined(data),
        updatedBy: this.config.userId,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    this.invalidateCache();
  }

  /** Διαγραφή ΜΗ-builtin doc (system seed → reject). */
  async remove(id: string): Promise<void> {
    await this.requireMutable(id);
    await deleteDoc(this.docRef(id));
    this.invalidateCache();
  }

  async getById(id: string): Promise<T | null> {
    const snap = await getDoc(this.docRef(id));
    return snap.exists() ? (snap.data() as unknown as T) : null;
  }

  /** Υπάρχει ΚΑΙ είναι mutable; Αλλιώς πετάει το domain error code. */
  async requireMutable(id: string): Promise<T> {
    const snap = await getDoc(this.docRef(id));
    if (!snap.exists()) {
      throw new Error(this.config.errors.notFound);
    }
    const current = snap.data() as unknown as T;
    if (current.builtin) {
      throw new Error(this.config.errors.builtinNotMutable);
    }
    return current;
  }

  invalidateCache(): void {
    this.cache = null;
  }
}

// ============================================================================
// SUBCOLLECTION 3-SCOPE PRESET — ο ΚΟΙΝΟΣ συνθέτης για family-types & stair-presets
// ============================================================================

/** Το scope context ενός subcollection service (companyId/userId/projectId). */
export interface ScopedSubcollectionContext {
  readonly companyId: string;
  readonly userId: string;
  readonly projectId?: string;
}

export interface SubcollectionScopedLibraryParams {
  readonly collectionKey: CollectionKey;
  readonly context: ScopedSubcollectionContext;
  readonly collectionRefFactory: () => CollectionReference<DocumentData>;
  readonly errors: ScopedLibraryErrors;
  /** Πεδίο ιδιοκτησίας του user scope. Default `ownerId` (family/stair convention). */
  readonly ownerField?: string;
}

/**
 * Χτίζει έναν `ScopedLibraryService` για την ΤΥΠΙΚΗ subcollection βιβλιοθήκη 3 scopes
 * (δικά μου [ownerField] + εταιρείας + optional έργου), σε path `COMPANIES/{companyId}/…`.
 *
 * ΓΙΑΤΙ ΕΔΩ (N.18): family-types και stair-presets είναι **δίδυμα** — ίδιο 3-scope μοντέλο
 * σε subcollection. Αντί για δύο πανομοιότυπα constructor bodies (sibling clone), και τα
 * δύο καλούν ΑΥΤΟΝ τον συνθέτη· η σημασιολογία των buckets ζει ΜΙΑ φορά (στα factories).
 */
export function createSubcollectionScopedLibrary<T extends ScopedLibraryDoc>(
  params: SubcollectionScopedLibraryParams,
): ScopedLibraryService<T> {
  const { context } = params;
  return new ScopedLibraryService<T>({
    collectionKey: params.collectionKey,
    companyId: context.companyId,
    userId: context.userId,
    collectionRefFactory: params.collectionRefFactory,
    // 3-scope: δικά μου + εταιρείας + (optional) έργου. companyId σε κάθε tenant bucket.
    buckets: [
      userScopeBucket(context.userId, params.ownerField ?? 'ownerId'),
      companyScopeBucket(),
      ...optionalProjectScopeBucket(context.projectId),
    ],
    errors: params.errors,
  });
}
