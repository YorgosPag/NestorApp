'use client';

/**
 * ENTERPRISE: Client-side Opportunities Service
 *
 * ADR-214 Phase 4: READ method delegated to firestoreQueryService.
 * SECURITY FIX: tenant filtering auto-injected (was previously MISSING).
 *
 * Provides client-side CRUD operations for Opportunities with real-time sync.
 * Uses Firebase client SDK for direct Firestore operations.
 * Dispatches events via RealtimeService for cross-page synchronization.
 *
 * NOTE: Server-side operations (server actions) are in opportunities.service.ts
 * This file is for client-side operations that need immediate real-time dispatch.
 */

import { doc, updateDoc, setDoc, deleteDoc, serverTimestamp, orderBy, type DocumentData } from 'firebase/firestore';
import { generateOpportunityId } from '@/services/enterprise-id.service';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { firestoreQueryService } from '@/services/firestore';
import type { Opportunity } from '@/types/crm';
// Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('OpportunitiesClientService');

/**
 * Opportunity create payload type
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
 * Opportunity update payload type
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
 * Δημιουργία νέας ευκαιρίας στο Firebase (Client-side)
 */
export async function createOpportunityClient(
  data: OpportunityCreatePayload
): Promise<{ success: boolean; opportunityId?: string; error?: string }> {
  try {
    logger.info('Creating new opportunity');

    // ADR-210: Enterprise ID generation — setDoc with pre-generated ID
    const id = generateOpportunityId();
    const opportunityRef = doc(db, COLLECTIONS.OPPORTUNITIES, id);
    await setDoc(opportunityRef, {
      ...data,
      id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    logger.info('Opportunity created', { opportunityId: id });

    // Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('OPPORTUNITY_CREATED', {
      opportunityId: id,
      opportunity: {
        name: data.name,
        stage: data.stage,
        value: data.value,
        leadId: data.leadId ?? null,
        assignedTo: data.assignedTo,
      },
      timestamp: Date.now()
    });

    return { success: true, opportunityId: id };

  } catch (error) {
    logger.error('Error creating opportunity', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Ενημέρωση ευκαιρίας στο Firebase (Client-side)
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

    // Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('OPPORTUNITY_UPDATED', {
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
 * Διαγραφή ευκαιρίας από το Firebase (Client-side)
 */
export async function deleteOpportunityClient(
  opportunityId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('Deleting opportunity', { opportunityId });

    const opportunityRef = doc(db, COLLECTIONS.OPPORTUNITIES, opportunityId);
    await deleteDoc(opportunityRef);

    logger.info('Opportunity deleted successfully', { opportunityId });

    // Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('OPPORTUNITY_DELETED', {
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
 * Λίστα ευκαιριών από Firebase (Client-side)
 * ADR-214 Phase 4: Tenant-aware via firestoreQueryService (SECURITY FIX)
 */
export async function getOpportunitiesClient(limitCount: number = 100): Promise<Opportunity[]> {
  try {
    logger.info('Starting Firestore query');

    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('OPPORTUNITIES', {
      constraints: [orderBy('createdAt', 'desc')],
      maxResults: limitCount,
    });

    const opportunities = result.documents as unknown as Opportunity[];

    logger.info('Loaded opportunities from Firebase', { count: opportunities.length });
    return opportunities;

  } catch (error) {
    logger.error('Error loading opportunities', { error });
    return [];
  }
}
