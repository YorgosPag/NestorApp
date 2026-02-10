// Firestore common helpers
import {
  collection, DocumentSnapshot, QuerySnapshot, doc, getDoc,
} from 'firebase/firestore';
import type { FirestoreDataConverter } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const getCol = <T = unknown>(path: string, converter?: FirestoreDataConverter<T>) =>
  converter ? collection(db, path).withConverter(converter) : collection(db, path);

export const mapDocs = <T>(qs: QuerySnapshot<T>) =>
  qs.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));

export const asDate = (v: unknown): Date => {
  if (!v) return new Date(NaN);
  if (v instanceof Date) return v;
  // Firestore Timestamp
  const timestampCandidate = v as { toDate?: () => Date };
  if (typeof timestampCandidate?.toDate === 'function') return timestampCandidate.toDate();
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') return new Date(v);
  return new Date(NaN);
};

export const chunk = <T>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

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
