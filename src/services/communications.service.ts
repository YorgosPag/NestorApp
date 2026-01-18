
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  QueryConstraint,
  Timestamp,
  writeBatch,
  deleteDoc,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import type { Communication } from '@/types/crm';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: Centralized collection configuration
// 🔄 2026-01-17: Changed from COMMUNICATIONS to MESSAGES (COMMUNICATIONS collection deprecated)
const COMMUNICATIONS_COLLECTION = COLLECTIONS.MESSAGES;

// 🏢 ENTERPRISE: Type-safe document transformation
const transformCommunication = (docSnapshot: QueryDocumentSnapshot<DocumentData>): Communication => {
    const data = docSnapshot.data();
    const communication: Partial<Communication> & { id: string } = { id: docSnapshot.id };

    for (const key in data) {
        const value = data[key];
        if (value instanceof Timestamp) {
            (communication as Record<string, unknown>)[key] = value.toDate().toISOString();
        } else {
            (communication as Record<string, unknown>)[key] = value;
        }
    }
    return communication as Communication;
};

export async function addCommunication(communicationData: Omit<Communication, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    const docRef = await addDoc(collection(db, COMMUNICATIONS_COLLECTION), {
      ...communicationData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { id: docRef.id, success: true };
  } catch (error) {
    // Error logging removed //('Σφάλμα κατά την προσθήκη επικοινωνίας:', error);
    throw error;
  }
}

export async function getCommunicationsByContact(contactId: string): Promise<Communication[]> {
  try {
    const q = query(
      collection(db, COMMUNICATIONS_COLLECTION),
      where('contactId', '==', contactId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(transformCommunication);
  } catch (error) {
    // Error logging removed //('Σφάλμα κατά την ανάκτηση επικοινωνιών:', error);
    throw error;
  }
}

export async function updateCommunicationStatus(communicationId: string, status: Communication['status']) {
  try {
    const commRef = doc(db, COMMUNICATIONS_COLLECTION, communicationId);
    await updateDoc(commRef, {
      status,
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    // Error logging removed //('Σφάλμα κατά την ενημέρωση επικοινωνίας:', error);
    throw error;
  }
}

// ΝΕΑ ΣΥΝΑΡΤΗΣΗ: Διαγραφή όλων των επικοινωνιών
export async function deleteAllCommunications(): Promise<{ success: boolean; deletedCount: number }> {
    try {
        const querySnapshot = await getDocs(collection(db, COMMUNICATIONS_COLLECTION));
        const batch = writeBatch(db);
        let deletedCount = 0;

        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            deletedCount++;
        });

        await batch.commit();
        return { success: true, deletedCount };
    } catch (error) {
        // Error logging removed //('Σφάλμα κατά τη μαζική διαγραφή επικοινωνιών:', error);
        throw error;
    }
}
