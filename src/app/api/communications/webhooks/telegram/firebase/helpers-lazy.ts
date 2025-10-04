// /home/user/studio/src/app/api/communications/webhooks/telegram/firebase/helpers-lazy.ts

import { isFirebaseAvailable } from './availability';

export interface FirestoreHelpers {
  collection: any;
  query: any;
  where: any;
  getDocs: any;
  orderBy: any;
  firestoreLimit: any;
  addDoc: any;
  Timestamp: any;
}

export async function getFirestoreHelpers(): Promise<FirestoreHelpers | null> {
  if (!isFirebaseAvailable()) {
    return null;
  }

  try {
    const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
    const db = getFirestore();
    
    // Firebase admin uses different API - create wrappers
    const collection = (path: string) => db.collection(path);
    const query = (ref: any, ...constraints: any[]) => ref;
    const where = (field: string, op: any, value: any) => ({ field, op, value });
    const getDocs = (query: any) => query.get();
    const orderBy = (field: string, direction?: string) => ({ field, direction });
    const firestoreLimit = (count: number) => ({ count });
    const addDoc = (ref: any, data: any) => ref.add(data);

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
