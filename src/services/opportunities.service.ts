
'use server';

import { db } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  QueryConstraint,
  Timestamp,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import type { Opportunity, FirestoreishTimestamp } from '@/types/crm';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { DocumentSnapshot, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

const OPPORTUNITIES_COLLECTION = COLLECTIONS.OPPORTUNITIES;

const transformOpportunity = (doc: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>): Opportunity => {
    const data = doc.data();
    const opportunity: Record<string, unknown> = { id: doc.id };

    for (const key in data) {
        if (data[key] instanceof Timestamp) {
            opportunity[key] = data[key].toDate().toISOString();
        } else {
            opportunity[key] = data[key];
        }
    }

    return opportunity as unknown as Opportunity;
};

// Προσθήκη νέας ευκαιρίας
export async function addOpportunity(opportunityData: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ id: string; success: boolean }> {
  try {
    const docRef = await addDoc(collection(db, OPPORTUNITIES_COLLECTION), {
      ...opportunityData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: docRef.id, success: true };
  } catch (error) {
    // Error logging removed //('Σφάλμα κατά την προσθήκη ευκαιρίας:', error);
    throw error;
  }
}

// Ανάκτηση όλων των ευκαιριών
export async function getOpportunities(): Promise<Opportunity[]> {
  try {
    const q = query(collection(db, OPPORTUNITIES_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(transformOpportunity);
  } catch (error) {
    // Error logging removed //('Σφάλμα κατά την ανάκτηση ευκαιριών:', error);
    throw error;
  }
}

// NEW: Ανάκτηση μίας ευκαιρίας με βάση το ID
export async function getOpportunityById(id: string): Promise<Opportunity | null> {
    if (!id) return null;
    try {
        const docRef = doc(db, OPPORTUNITIES_COLLECTION, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return transformOpportunity(docSnap);
        } else {
            // Warning logging removed //(`Opportunity with ID ${id} not found.`);
            return null;
        }
    } catch (error) {
        // Error logging removed //(`Error fetching opportunity with ID ${id}:`, error);
        throw new Error('Failed to fetch opportunity');
    }
}

// Ενημέρωση ευκαιρίας
export async function updateOpportunity(opportunityId: string, updates: Partial<Opportunity>): Promise<{ success: boolean }> {
  try {
    const opportunityRef = doc(db, OPPORTUNITIES_COLLECTION, opportunityId);
    await updateDoc(opportunityRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    // Error logging removed //('Σφάλμα κατά την ενημέρωση ευκαιρίας:', error);
    throw error;
  }
}

// Διαγραφή ευκαιρίας
export async function deleteOpportunity(opportunityId: string): Promise<{ success: boolean }> {
  try {
    await deleteDoc(doc(db, OPPORTUNITIES_COLLECTION, opportunityId));
    return { success: true };
  } catch (error) {
    // Error logging removed //('Σφάλμα κατά τη διαγραφή ευκαιρίας:', error);
    throw error;
  }
}

// Διαγραφή όλων των ευκαιριών
export async function deleteAllOpportunities(): Promise<{ success: boolean; deletedCount: number }> {
    try {
        const querySnapshot = await getDocs(collection(db, OPPORTUNITIES_COLLECTION));
        const batch = writeBatch(db);
        let deletedCount = 0;

        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            deletedCount++;
        });

        await batch.commit();
        return { success: true, deletedCount };
    } catch (error) {
        // Error logging removed //('Σφάλμα κατά τη μαζική διαγραφή ευκαιριών:', error);
        throw error;
    }
}
