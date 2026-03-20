'use client';

/**
 * ENTERPRISE: Client-side Opportunities Service
 *
 * ADR-214 Phase 4: READ method delegated to firestoreQueryService.
 * ADR-252 Security Fix: WRITE operations routed through server-side API routes.
 * SECURITY FIX: tenant filtering auto-injected (was previously MISSING).
 *
 * Provides client-side READ + server-routed WRITE operations for Opportunities.
 * Dispatches events via RealtimeService for cross-page synchronization.
 *
 * WRITE operations: POST/PATCH/DELETE via /api/opportunities (server-side validation)
 * READ operations: Client-side via firestoreQueryService (tenant-aware)
 */

import { orderBy, type DocumentData } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
import type { Opportunity } from '@/types/crm';
// Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

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
 * Δημιουργία νέας ευκαιρίας μέσω API (ADR-252 Security Fix)
 */
export async function createOpportunityClient(
  data: OpportunityCreatePayload
): Promise<{ success: boolean; opportunityId?: string; error?: string }> {
  try {
    logger.info('Creating new opportunity via API');

    const response = await fetch('/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const id = result.data.id;
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
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Ενημέρωση ευκαιρίας μέσω API (ADR-252 Security Fix)
 */
export async function updateOpportunityClient(
  opportunityId: string,
  updates: OpportunityUpdatePayload
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('Updating opportunity via API', { opportunityId });

    const response = await fetch(`/api/opportunities/${opportunityId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const result = await response.json();

    if (!result.success) {
      return { success: false, error: result.error };
    }

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
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Διαγραφή ευκαιρίας μέσω API (ADR-252 Security Fix)
 */
export async function deleteOpportunityClient(
  opportunityId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('Deleting opportunity via API', { opportunityId });

    const response = await fetch(`/api/opportunities/${opportunityId}`, {
      method: 'DELETE',
    });
    const result = await response.json();

    if (!result.success) {
      return { success: false, error: result.error };
    }

    logger.info('Opportunity deleted successfully', { opportunityId });

    // Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('OPPORTUNITY_DELETED', {
      opportunityId,
      timestamp: Date.now()
    });

    return { success: true };
  } catch (error) {
    logger.error('Error deleting opportunity', { opportunityId, error });
    return { success: false, error: getErrorMessage(error) };
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
