'use server';

import { db } from '@/lib/firebase-admin';
import { collection, doc, getDoc } from 'firebase/firestore';
import type { StorageUnit } from '@/types/storage';

const STORAGE_UNITS_COLLECTION = 'storage_units';

// Get a single storage unit by its ID
export async function getStorageUnitById(id: string): Promise<StorageUnit | null> {
  try {
    const docRef = doc(db, STORAGE_UNITS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as StorageUnit;
    } else {
      // Warning logging removed //(`No storage unit found with id: ${id}`);
      return null;
    }
  } catch (error) {
    // Error logging removed //(`Error fetching storage unit with id ${id}:`, error);
    throw new Error('Failed to fetch storage unit details');
  }
}
