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
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('OpportunitiesClientService');

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
