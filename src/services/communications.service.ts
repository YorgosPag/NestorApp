
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
  deleteDoc
} from 'firebase/firestore';
import type { Communication } from '@/types/crm';

const COMMUNICATIONS_COLLECTION = 'communications';

const transformCommunication = (doc: any): Communication => {
    const data = doc.data();
    const communication: any = { id: doc.id };

    for (const key in data) {
        if (data[key] instanceof Timestamp) {
            communication[key] = data[key].toDate().toISOString();
        } else {
            communication[key] = data[key];
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
    console.error('Σφάλμα κατά την προσθήκη επικοινωνίας:', error);
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
    console.error('Σφάλμα κατά την ανάκτηση επικοινωνιών:', error);
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
    console.error('Σφάλμα κατά την ενημέρωση επικοινωνίας:', error);
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
        console.error('Σφάλμα κατά τη μαζική διαγραφή επικοινωνιών:', error);
        throw error;
    }
}
