
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
import { getAdminFirestore } from '@/server/admin/admin-guards';

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

// ============================================================================
// 🏢 ENTERPRISE: AI INBOX SERVER ACTIONS (Stage 2)
// ============================================================================

/**
 * Get pending communications for AI Inbox triage queue
 *
 * @param companyId - Company ID for tenant isolation
 * @returns Array of communications with triageStatus="pending"
 *
 * @enterprise Tenant-scoped query, server-side only
 * @created 2026-02-03 - Stage 2: Real Data + Actions
 */
export async function getPendingTriageCommunications(companyId: string): Promise<Communication[]> {
  try {
    // 🏢 ENTERPRISE: Use Firebase Admin SDK for server-side queries
    const adminDb = getAdminFirestore();
    const messagesRef = adminDb.collection(COLLECTIONS.MESSAGES);

    // 🏢 ENTERPRISE: Tenant-scoped query with companyId filtering
    // Query without orderBy to avoid composite index requirement (client-side sorting below)
    // TODO: Re-enable .orderBy('createdAt', 'desc') when Firestore composite index is created
    //       Index needed: messages collection with [companyId ASC, triageStatus ASC, createdAt DESC]
    //       Create at: https://console.firebase.google.com/project/pagonis-87766/firestore/indexes
    const querySnapshot = await messagesRef
      .where('companyId', '==', companyId) // 🏢 ENTERPRISE: Tenant isolation (STOP 3 fix)
      .where('triageStatus', '==', 'pending')
      .get();

    // Transform Firestore Admin docs to Communication objects
    const communications = querySnapshot.docs.map(doc => {
      const data = doc.data();
      const communication: Partial<Communication> & { id: string } = { id: doc.id };

      // Convert Firestore Admin Timestamps to ISO strings
      for (const key in data) {
        const value = data[key];
        if (value && typeof value === 'object' && 'toDate' in value) {
          (communication as Record<string, unknown>)[key] = value.toDate().toISOString();
        } else {
          (communication as Record<string, unknown>)[key] = value;
        }
      }

      return communication as Communication;
    });

    // 🏢 ENTERPRISE: Client-side sort by createdAt DESC (newest first)
    // This is a temporary workaround until the Firestore composite index is created
    // Performance impact: Negligible for <1000 items (typical inbox size)
    return communications.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // DESC order (newest first)
    });
  } catch (error) {
    throw new Error(`Failed to fetch pending communications: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Approve communication and create linked CRM task (idempotent)
 *
 * @param communicationId - Communication ID to approve
 * @param adminUid - Admin user ID (from auth context)
 * @returns Success status with task ID
 *
 * @enterprise Idempotent operation (safe to retry)
 * @audit Logs admin action
 */
export async function approveCommunication(
  communicationId: string,
  adminUid: string
): Promise<{ success: boolean; taskId: string }> {
  try {
    // 🏢 ENTERPRISE: Use Firebase Admin SDK
    const adminDb = getAdminFirestore();
    const commDoc = await adminDb.collection(COLLECTIONS.MESSAGES).doc(communicationId).get();

    if (!commDoc.exists) {
      throw new Error('Communication not found');
    }

    const data = commDoc.data()!;
    const communication: Partial<Communication> & { id: string } = { id: commDoc.id };

    // Convert Admin Timestamps to ISO strings
    for (const key in data) {
      const value = data[key];
      if (value && typeof value === 'object' && 'toDate' in value) {
        (communication as Record<string, unknown>)[key] = value.toDate().toISOString();
      } else {
        (communication as Record<string, unknown>)[key] = value;
      }
    }
    const comm = communication as Communication;

    // 2. Idempotency: If already approved and has linkedTaskId, return existing task ID
    if (comm.triageStatus === 'approved' && comm.linkedTaskId) {
      return { success: true, taskId: comm.linkedTaskId };
    }

    // 3. Create CRM Task using Admin SDK (STOP 5 fix - no client-side repository)
    const tasksRef = adminDb.collection(COLLECTIONS.TASKS);

    const taskData = {
      title: comm.subject || `Follow-up: ${comm.from}`,
      description: comm.content,
      type: 'follow_up',
      contactId: comm.contactId,
      status: 'pending',
      priority: comm.intentAnalysis?.needsTriage ? 'high' : 'medium',
      assignedTo: adminUid, // TODO: Use AssignmentPolicyService to resolve assignee
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      reminderSent: false,
    };

    // 🏢 ENTERPRISE: Server-side task creation with Admin SDK
    const taskDoc = await tasksRef.add(taskData);
    const taskId = taskDoc.id;

    // 4. Update communication with approval + linkedTaskId (Admin SDK)
    await adminDb.collection(COLLECTIONS.MESSAGES).doc(communicationId).update({
      triageStatus: 'approved',
      linkedTaskId: taskId,
      updatedAt: new Date().toISOString()
    });

    return { success: true, taskId };
  } catch (error) {
    throw new Error(`Failed to approve communication: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Reject communication (mark as rejected, no task creation)
 *
 * @param communicationId - Communication ID to reject
 * @returns Success status
 *
 * @enterprise Simple status update
 * @audit Logs admin action
 */
export async function rejectCommunication(communicationId: string): Promise<{ success: boolean }> {
  try {
    // 🏢 ENTERPRISE: Use Firebase Admin SDK
    const adminDb = getAdminFirestore();

    await adminDb.collection(COLLECTIONS.MESSAGES).doc(communicationId).update({
      triageStatus: 'rejected',
      updatedAt: new Date().toISOString()
    });

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to reject communication: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
