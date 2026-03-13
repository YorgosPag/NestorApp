// Firestore common helpers
import {
  collection, DocumentSnapshot, QuerySnapshot, doc, getDoc, Timestamp,
} from 'firebase/firestore';
import type { FirestoreDataConverter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizeToDate } from '@/lib/date-local';

export const getCol = <T = unknown>(path: string, converter?: FirestoreDataConverter<T>) =>
  converter ? collection(db, path).withConverter(converter) : collection(db, path);

export const mapDocs = <T>(qs: QuerySnapshot<T>) =>
  qs.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));

// ADR-218: Thin wrapper delegating to centralized normalizeToDate
export const asDate = (v: unknown): Date => normalizeToDate(v) ?? new Date(NaN);

/**
 * Normalize any timestamp-like value into a Firestore Timestamp, or null.
 * Replaces scattered `instanceof Timestamp ? ... : Timestamp.fromDate(...)` chains.
 * Lives here (not in date-local) because it depends on the Firebase SDK.
 * @see ADR-218 Phase 2
 */
export const normalizeToTimestamp = (val: unknown): Timestamp | null => {
  const d = normalizeToDate(val);
  return d ? Timestamp.fromDate(d) : null;
};

// Re-export from centralized array-utils (ADR-213 Phase 10)
export { chunkArray as chunk } from '@/lib/array-utils';

// Useful when we accept cursorId string (optional)
export const startAfterDocId = async (colPath: string, id?: string | null): Promise<DocumentSnapshot | null> => {
    if (!id) return null;
    try {
        const docRef = doc(db, colPath, id);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap : null;
    } catch {
        return null;
    }
};
