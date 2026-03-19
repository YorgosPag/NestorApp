'use client';

/**
 * 🏢 ENTERPRISE: Client-side Communications Service
 *
 * ADR-214 Phase 5: READ methods delegated to firestoreQueryService.
 * SECURITY FIX: tenant filtering auto-injected (companyId was previously MISSING).
 *
 * Provides client-side CRUD operations for Communications with real-time sync.
 * Uses Firebase client SDK for direct Firestore operations.
 * Dispatches events via RealtimeService for cross-page synchronization.
 *
 * NOTE: Server-side operations (server actions) are in communications.service.ts
 * This file is for client-side operations that need immediate real-time dispatch.
 *
 * 🔄 2026-01-17: Uses MESSAGES collection (COMMUNICATIONS collection deprecated)
 * 🔄 2026-03-13: ADR-214 Phase 5 — READ methods via firestoreQueryService (auto companyId)
 *                + getCommunicationsByContact, deleteAllCommunications relocated from server file
 */

import { orderBy, where, collection, doc, updateDoc, setDoc, deleteDoc, serverTimestamp, writeBatch, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateMessageId } from '@/services/enterprise-id.service';
import type { Communication } from '@/types/crm';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { firestoreQueryService } from '@/services/firestore';
import { normalizeToISO } from '@/lib/date-local';

const logger = createModuleLogger('CommunicationsClientService');

// --- ADR-214 Phase 5: Transform helper (same pattern as Phase 4) ---

/** Transform raw DocumentData (from firestoreQueryService) to Communication */
const toCommunication = (raw: DocumentData & { id: string }): Communication => {
  const communication: Record<string, unknown> = {};
  for (const key in raw) {
    const iso = normalizeToISO(raw[key]);
    communication[key] = iso ?? raw[key];
  }
  return communication as unknown as Communication;
};

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

    const enterpriseId = generateMessageId();
    const docRef = doc(db, COLLECTIONS.MESSAGES, enterpriseId);
    await setDoc(docRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    logger.info('Communication created', { communicationId: enterpriseId });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('COMMUNICATION_CREATED', {
      communicationId: enterpriseId,
      communication: {
        type: data.type,
        subject: data.subject,
        leadId: data.leadId ?? null,
        contactId: data.contactId ?? null,
        userId: data.userId,
      },
      timestamp: Date.now()
    });

    return { success: true, communicationId: enterpriseId };

  } catch (error) {
    logger.error('Error creating communication', { error });
    return {
      success: false,
      error: getErrorMessage(error)
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
    RealtimeService.dispatch('COMMUNICATION_UPDATED', {
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
      error: getErrorMessage(error)
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
    RealtimeService.dispatch('COMMUNICATION_DELETED', {
      communicationId,
      timestamp: Date.now()
    });

    return { success: true };

  } catch (error) {
    logger.error('Error deleting communication', { communicationId, error });
    return {
      success: false,
      error: getErrorMessage(error)
    };
  }
}

// --- READ methods: ADR-214 Phase 5 (tenant-aware via firestoreQueryService) ---
// SECURITY FIX: Auto companyId filter — previously MISSING

/**
 * 🎯 ENTERPRISE: Λίστα επικοινωνιών (Client-side, tenant-aware)
 */
export async function getCommunicationsClient(limitCount: number = 100): Promise<Communication[]> {
  try {
    logger.info('Starting Firestore query');

    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('MESSAGES', {
      constraints: [orderBy('createdAt', 'desc')],
      maxResults: limitCount,
    });

    const communications = result.documents.map(toCommunication);
    logger.info('Loaded communications from Firebase', { count: communications.length });
    return communications;

  } catch (error) {
    logger.error('Error loading communications', { error });
    return [];
  }
}

/**
 * 🎯 ENTERPRISE: Λίστα επικοινωνιών ανά επαφή (Client-side, tenant-aware)
 */
export async function getCommunicationsByContactClient(
  contactId: string,
  limitCount: number = 50
): Promise<Communication[]> {
  try {
    logger.info('Fetching communications for contact', { contactId });

    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('MESSAGES', {
      constraints: [where('contactId', '==', contactId), orderBy('createdAt', 'desc')],
      maxResults: limitCount,
    });

    const communications = result.documents.map(toCommunication);
    logger.info('Loaded communications for contact', { contactId, count: communications.length });
    return communications;

  } catch (error) {
    logger.error('Error loading communications for contact', { contactId, error });
    return [];
  }
}

// --- Relocated from communications.service.ts (ADR-214 Phase 5 — SECURITY FIX) ---
// These were client SDK reads inside a 'use server' file. Moved here where
// firestoreQueryService.requireAuthContext() can resolve auth.currentUser.

/**
 * 🎯 ENTERPRISE: Επικοινωνίες ανά επαφή (tenant-aware)
 * Relocated from communications.service.ts — was server action using client SDK
 * SECURITY FIX: Auto companyId filter (was previously MISSING)
 */
export async function getCommunicationsByContact(contactId: string): Promise<Communication[]> {
  const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('MESSAGES', {
    constraints: [where('contactId', '==', contactId), orderBy('createdAt', 'desc')],
  });
  return result.documents.map(toCommunication);
}

/**
 * 🎯 ENTERPRISE: Διαγραφή όλων των επικοινωνιών (tenant-aware)
 * Relocated from communications.service.ts — was server action using client SDK
 * SECURITY FIX: Only deletes current company's messages (was deleting ENTIRE collection!)
 */
export async function deleteAllCommunications(): Promise<{ success: boolean; deletedCount: number }> {
  // Read: firestoreQueryService (tenant-aware — only current company's messages)
  const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('MESSAGES');
  const batch = writeBatch(db);
  let deletedCount = 0;

  for (const document of result.documents) {
    batch.delete(doc(db, COLLECTIONS.MESSAGES, document.id));
    deletedCount++;
  }

  await batch.commit();
  return { success: true, deletedCount };
}
