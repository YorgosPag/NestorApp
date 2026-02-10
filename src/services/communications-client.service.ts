'use client';

/**
 * 🏢 ENTERPRISE: Client-side Communications Service
 *
 * Provides client-side CRUD operations for Communications with real-time sync.
 * Uses Firebase client SDK for direct Firestore operations.
 * Dispatches events via RealtimeService for cross-page synchronization.
 *
 * NOTE: Server-side operations (server actions) are in communications.service.ts
 * This file is for client-side operations that need immediate real-time dispatch.
 *
 * 🔄 2026-01-17: Uses MESSAGES collection (COMMUNICATIONS collection deprecated)
 */

import { collection, getDocs, query, orderBy, limit, where, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { Communication } from '@/types/crm';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CommunicationsClientService');

/**
 * 🏢 ENTERPRISE: Communication create payload type
 * Type-safe data for communication creation
 */
export interface CommunicationCreatePayload {
  type: 'email' | 'phone' | 'meeting' | 'note' | 'other';
  subject?: string;
  content?: string;
  leadId?: string | null;
  contactId?: string | null;
  userId?: string;
  status?: string;
  direction?: 'inbound' | 'outbound';
}

/**
 * 🏢 ENTERPRISE: Communication update payload type
 * Type-safe updates for communication modifications
 */
export interface CommunicationUpdatePayload {
  type?: 'email' | 'phone' | 'meeting' | 'note' | 'other';
  subject?: string;
  content?: string;
  status?: string;
  leadId?: string | null;
  contactId?: string | null;
}

/**
 * 🎯 ENTERPRISE: Δημιουργία νέας επικοινωνίας στο Firebase (Client-side)
 * Αποθηκεύει τα δεδομένα στη βάση και ενημερώνει το real-time service
 */
export async function createCommunicationClient(
  data: CommunicationCreatePayload
): Promise<{ success: boolean; communicationId?: string; error?: string }> {
  try {
    logger.info('Creating new communication');

    const communicationsRef = collection(db, COLLECTIONS.MESSAGES);
    const docRef = await addDoc(communicationsRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    logger.info('Communication created', { communicationId: docRef.id });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatchCommunicationCreated({
      communicationId: docRef.id,
      communication: {
        type: data.type,
        subject: data.subject,
        leadId: data.leadId ?? null,
        contactId: data.contactId ?? null,
        userId: data.userId,
      },
      timestamp: Date.now()
    });

    return { success: true, communicationId: docRef.id };

  } catch (error) {
    logger.error('Error creating communication', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 🎯 ENTERPRISE: Ενημέρωση επικοινωνίας στο Firebase (Client-side)
 * Αποθηκεύει τα δεδομένα στη βάση και ενημερώνει το real-time service
 *
 * NOTE: Prefer using server action updateCommunicationStatus() from communications.service.ts
 * Use this only when you need immediate client-side dispatch
 */
export async function updateCommunicationClient(
  communicationId: string,
  updates: CommunicationUpdatePayload
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('Updating communication', { communicationId });

    const communicationRef = doc(db, COLLECTIONS.MESSAGES, communicationId);
    await updateDoc(communicationRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    logger.info('Communication updated successfully', { communicationId });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatchCommunicationUpdated({
      communicationId,
      updates: {
        type: updates.type,
        subject: updates.subject,
        content: updates.content,
        leadId: updates.leadId ?? null,
        contactId: updates.contactId ?? null,
      },
      timestamp: Date.now()
    });

    return { success: true };

  } catch (error) {
    logger.error('Error updating communication', { communicationId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 🎯 ENTERPRISE: Διαγραφή επικοινωνίας από το Firebase (Client-side)
 * Διαγράφει τα δεδομένα από τη βάση και ενημερώνει το real-time service
 */
export async function deleteCommunicationClient(
  communicationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('Deleting communication', { communicationId });

    const communicationRef = doc(db, COLLECTIONS.MESSAGES, communicationId);
    await deleteDoc(communicationRef);

    logger.info('Communication deleted successfully', { communicationId });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatchCommunicationDeleted({
      communicationId,
      timestamp: Date.now()
    });

    return { success: true };

  } catch (error) {
    logger.error('Error deleting communication', { communicationId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 🎯 ENTERPRISE: Λίστα επικοινωνιών από Firebase (Client-side)
 * Για περιπτώσεις που χρειάζεται client-side fetch
 */
export async function getCommunicationsClient(limitCount: number = 100): Promise<Communication[]> {
  try {
    logger.info('Starting Firestore query');

    const communicationsQuery = query(
      collection(db, COLLECTIONS.MESSAGES),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(communicationsQuery);

    const communications = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as Communication[];

    logger.info('Loaded communications from Firebase', { count: communications.length });
    return communications;

  } catch (error) {
    logger.error('Error loading communications', { error });
    return [];
  }
}

/**
 * 🎯 ENTERPRISE: Λίστα επικοινωνιών ανά επαφή (Client-side)
 */
export async function getCommunicationsByContactClient(
  contactId: string,
  limitCount: number = 50
): Promise<Communication[]> {
  try {
    logger.info('Fetching communications for contact', { contactId });

    const communicationsQuery = query(
      collection(db, COLLECTIONS.MESSAGES),
      where('contactId', '==', contactId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(communicationsQuery);

    const communications = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as Communication[];

    logger.info('Loaded communications for contact', { contactId, count: communications.length });
    return communications;

  } catch (error) {
    logger.error('Error loading communications for contact', { contactId, error });
    return [];
  }
}
