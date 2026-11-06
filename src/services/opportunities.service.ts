/**
 * ENTERPRISE: Firestore READS for Opportunities (Client SDK)
 *
 * ADR-214 Phase 4: READ methods delegated to firestoreQueryService (tenant filtering auto-injected).
 *
 * ✍️ ADR-930 §3.10: this file does NOT write. Every write goes through ONE server door with a history row —
 *    fields/create/delete → `/api/opportunities` (`crm-mutation-gateway`), stage → `…/stage`, owner → `…/owner`.
 *    Until 2026-11-06 the browser wrote here with `setDoc`/`updateDoc`/`deleteDoc` — and left no history.
 */

import { orderBy, where, type DocumentData } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
import type { Opportunity } from '@/types/crm';
import { withIsoDateFields } from '@/lib/date-local';
import { OPPORTUNITY_DATE_FIELDS } from '@/services/crm/opportunity-fields-schema';

/** Transform raw DocumentData (from firestoreQueryService) to Opportunity */
export const toOpportunity = (raw: DocumentData & { id: string }): Opportunity =>
  withIsoDateFields(raw, OPPORTUNITY_DATE_FIELDS) as unknown as Opportunity;

// --- READ methods: ADR-214 Phase 4 (tenant-aware via firestoreQueryService) ---

/** Ανάκτηση όλων των ευκαιριών (with automatic tenant filtering) */
export async function getOpportunities(): Promise<Opportunity[]> {
  try {
    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('OPPORTUNITIES', {
      constraints: [orderBy('createdAt', 'desc')],
    });
    return result.documents.map(toOpportunity);
  } catch (error) {
    throw error;
  }
}

/** Οι ευκαιρίες μιας επαφής (with automatic tenant filtering) */
export async function getOpportunitiesByContact(contactId: string): Promise<Opportunity[]> {
  const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('OPPORTUNITIES', {
    constraints: [where('contactId', '==', contactId)],
  });
  return result.documents.map(toOpportunity);
}

/** Ανάκτηση μίας ευκαιρίας με βάση το ID */
export async function getOpportunityById(id: string): Promise<Opportunity | null> {
  if (!id) return null;
  try {
    const raw = await firestoreQueryService.getById<DocumentData & { id: string }>('OPPORTUNITIES', id);
    if (!raw) return null;
    return toOpportunity(raw);
  } catch (error) {
    throw new Error('Failed to fetch opportunity');
  }
}
