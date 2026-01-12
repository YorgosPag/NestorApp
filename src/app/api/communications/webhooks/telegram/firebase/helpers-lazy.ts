// /home/user/studio/src/app/api/communications/webhooks/telegram/firebase/helpers-lazy.ts

import { isFirebaseAvailable } from './availability';

// ============================================================================
// 🏢 ENTERPRISE: Firestore Helper Types (ADR-compliant - NO any)
// ============================================================================

/** Firestore collection reference */
type CollectionRef = ReturnType<import('firebase-admin/firestore').Firestore['collection']>;

/** Firestore query constraint */
interface QueryConstraint {
  field: string;
  op?: string;
  value?: unknown;
  direction?: string;
  count?: number;
}

/** Firestore collection function */
type CollectionFn = (path: string) => CollectionRef;

/** Firestore query function - returns same ref for chaining */
type QueryFn = (ref: CollectionRef, ...constraints: QueryConstraint[]) => CollectionRef;

/** Firestore where constraint builder */
type WhereFn = (field: string, op: string, value: unknown) => QueryConstraint;

/** Firestore getDocs function */
type GetDocsFn = (query: CollectionRef) => Promise<import('firebase-admin/firestore').QuerySnapshot>;

/** Firestore orderBy constraint builder */
type OrderByFn = (field: string, direction?: string) => QueryConstraint;

/** Firestore limit constraint builder */
type LimitFn = (count: number) => QueryConstraint;

/** Firestore addDoc function */
type AddDocFn = (ref: CollectionRef, data: Record<string, unknown>) => Promise<import('firebase-admin/firestore').DocumentReference>;

export interface FirestoreHelpers {
  collection: CollectionFn;
  query: QueryFn;
  where: WhereFn;
  getDocs: GetDocsFn;
  orderBy: OrderByFn;
  firestoreLimit: LimitFn;
  addDoc: AddDocFn;
  Timestamp: typeof import('firebase-admin/firestore').Timestamp;
}

export async function getFirestoreHelpers(): Promise<FirestoreHelpers | null> {
  if (!isFirebaseAvailable()) {
    return null;
  }

  try {
    const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
    const db = getFirestore();

    // Firebase admin uses different API - create wrappers
    const collection: CollectionFn = (path: string) => db.collection(path);
    const query: QueryFn = (ref: CollectionRef) => ref;
    const where: WhereFn = (field: string, op: string, value: unknown) => ({ field, op, value });
    const getDocs: GetDocsFn = (queryRef: CollectionRef) => queryRef.get();
    const orderBy: OrderByFn = (field: string, direction?: string) => ({ field, direction });
    const firestoreLimit: LimitFn = (count: number) => ({ count });
    const addDoc: AddDocFn = (ref: CollectionRef, data: Record<string, unknown>) => ref.add(data);

    return {
      collection,
      query,
      where,
      getDocs,
      orderBy,
      firestoreLimit,
      addDoc,
      Timestamp
    };
  } catch (error) {
    console.error('❌ Failed to import Firestore helpers:', error);
    return null;
  }
}
