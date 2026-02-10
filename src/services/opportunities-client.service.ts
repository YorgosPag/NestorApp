'use client';

/**
 * 🏢 ENTERPRISE: Client-side Opportunities Service
 *
 * Provides client-side CRUD operations for Opportunities with real-time sync.
 * Uses Firebase client SDK for direct Firestore operations.
 * Dispatches events via RealtimeService for cross-page synchronization.
 *
 * NOTE: Server-side operations (server actions) are in opportunities.service.ts
 * This file is for client-side operations that need immediate real-time dispatch.
 */

import { collection, getDocs, query, orderBy, limit, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { Opportunity } from '@/types/crm';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('OpportunitiesClientService');

/**
 * 🏢 ENTERPRISE: Opportunity create payload type
 * Type-safe data for opportunity creation
 */
export interface OpportunityCreatePayload {
  name: string;
  leadId?: string | null;
  stage?: string;
  value?: number;
  probability?: number;
  expectedCloseDate?: string;
  assignedTo?: string;
  notes?: string;
}

/**
 * 🏢 ENTERPRISE: Opportunity update payload type
 * Type-safe updates for opportunity modifications
 */
export interface OpportunityUpdatePayload {
  name?: string;
  stage?: string;
  value?: number;
  probability?: number;
  expectedCloseDate?: string;
  assignedTo?: string;
  notes?: string;
  leadId?: string | null;
}

/**
 * 🎯 ENTERPRISE: Δημιουργία νέας ευκαιρίας στο Firebase (Client-side)
 * Αποθηκεύει τα δεδομένα στη βάση και ενημερώνει το real-time service
 */
export async function createOpportunityClient(
  data: OpportunityCreatePayload
): Promise<{ success: boolean; opportunityId?: string; error?: string }> {
  try {
    logger.info('Creating new opportunity');

    const opportunitiesRef = collection(db, COLLECTIONS.OPPORTUNITIES);
    const docRef = await addDoc(opportunitiesRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    logger.info('Opportunity created', { opportunityId: docRef.id });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatchOpportunityCreated({
      opportunityId: docRef.id,
      opportunity: {
        name: data.name,
        stage: data.stage,
        value: data.value,
        leadId: data.leadId ?? null,
        assignedTo: data.assignedTo,
      },
      timestamp: Date.now()
    });

    return { success: true, opportunityId: docRef.id };

  } catch (error) {
    logger.error('Error creating opportunity', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 🎯 ENTERPRISE: Ενημέρωση ευκαιρίας στο Firebase (Client-side)
 * Αποθηκεύει τα δεδομένα στη βάση και ενημερώνει το real-time service
 *
 * NOTE: Prefer using server action updateOpportunity() from opportunities.service.ts
 * Use this only when you need immediate client-side dispatch
 */
export async function updateOpportunityClient(
  opportunityId: string,
  updates: OpportunityUpdatePayload
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('Updating opportunity', { opportunityId });

    const opportunityRef = doc(db, COLLECTIONS.OPPORTUNITIES, opportunityId);
    await updateDoc(opportunityRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    logger.info('Opportunity updated successfully', { opportunityId });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatchOpportunityUpdated({
      opportunityId,
      updates: {
        name: updates.name,
        stage: updates.stage,
        value: updates.value,
        probability: updates.probability,
        expectedCloseDate: updates.expectedCloseDate,
        leadId: updates.leadId ?? null,
        assignedTo: updates.assignedTo,
      },
      timestamp: Date.now()
    });

    return { success: true };

  } catch (error) {
    logger.error('Error updating opportunity', { opportunityId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 🎯 ENTERPRISE: Διαγραφή ευκαιρίας από το Firebase (Client-side)
 * Διαγράφει τα δεδομένα από τη βάση και ενημερώνει το real-time service
 */
export async function deleteOpportunityClient(
  opportunityId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('Deleting opportunity', { opportunityId });

    const opportunityRef = doc(db, COLLECTIONS.OPPORTUNITIES, opportunityId);
    await deleteDoc(opportunityRef);

    logger.info('Opportunity deleted successfully', { opportunityId });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatchOpportunityDeleted({
      opportunityId,
      timestamp: Date.now()
    });

    return { success: true };

  } catch (error) {
    logger.error('Error deleting opportunity', { opportunityId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 🎯 ENTERPRISE: Λίστα ευκαιριών από Firebase (Client-side)
 * Για περιπτώσεις που χρειάζεται client-side fetch
 */
export async function getOpportunitiesClient(limitCount: number = 100): Promise<Opportunity[]> {
  try {
    logger.info('Starting Firestore query');

    const opportunitiesQuery = query(
      collection(db, COLLECTIONS.OPPORTUNITIES),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(opportunitiesQuery);

    const opportunities = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as Opportunity[];

    logger.info('Loaded opportunities from Firebase', { count: opportunities.length });
    return opportunities;

  } catch (error) {
    logger.error('Error loading opportunities', { error });
    return [];
  }
}
