'use client';

/**
 * Real-time Opportunities Hook
 *
 * Εγγράφεται στη συλλογή `OPPORTUNITIES` για ζωντανές ενημερώσεις.
 *
 * ⚠️ **Δύο ερωτήματα, δύο σπίτια** (ADR-798 §22 · ADR-749):
 *  - ο **κύκλος ζωής** της συνδρομής Firestore → `create-realtime-collection-hook.ts`
 *  - η **αισιόδοξη ενημέρωση** από το event bus → `use-realtime-entity-events.ts`
 *
 * Εδώ μένει **μόνο** η μετάφραση εγγράφου (Timestamp → Date).
 *
 * @module services/realtime/hooks/useRealtimeOpportunities
 * @enterprise ADR-227 Phase 1 — Eliminate one-time fetches
 */

import type { DocumentData } from 'firebase/firestore';
import type { Opportunity } from '@/types/crm';
import type { SubscriptionStatus } from '../types';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToDate } from '@/lib/date-local';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';
import { createRealtimeCollectionHook } from './create-realtime-collection-hook';
import { useRealtimeEntityEvents } from './use-realtime-entity-events';

const logger = createModuleLogger('useRealtimeOpportunities');

// ADR-300: Module-level cache survives React unmount/remount (navigation)
const opportunitiesCache = createStaleCache<Opportunity[]>('opportunities');

// ============================================================================
// TYPES
// ============================================================================

interface UseRealtimeOpportunitiesReturn {
  opportunities: Opportunity[];
  loading: boolean;
  error: string | null;
  status: SubscriptionStatus;
  refetch: () => void;
}

// ============================================================================
// MAPPER
// ============================================================================

/** Convert Firestore Timestamp-like values to Date */
const toDateIfTimestamp = (v: unknown): unknown => {
  if (v && typeof v === 'object' && 'toDate' in v) return normalizeToDate(v);
  return v;
};

function toOpportunity(raw: DocumentData & { id: string }): Opportunity {
  const out: Record<string, unknown> = { id: raw.id };
  for (const k in raw) {
    if (k === 'id') continue;
    out[k] = toDateIfTimestamp(raw[k]);
  }
  return out as unknown as Opportunity;
}

// ============================================================================
// Η ΠΑΡΑΛΛΑΓΗ — ό,τι είναι γνήσια δικό του
// ============================================================================

const useOpportunitiesCollection = createRealtimeCollectionHook<DocumentData, Opportunity>({
  collection: 'OPPORTUNITIES',
  logger,
  cache: opportunitiesCache,
  mapDocuments: (documents): Opportunity[] =>
    documents.map((doc) => toOpportunity(doc as DocumentData & { id: string })),
});

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useRealtimeOpportunities(enabled = true): UseRealtimeOpportunitiesReturn {
  const {
    items: opportunities,
    setItems: setOpportunities,
    loading,
    error,
    status,
    refetch,
  } = useOpportunitiesCollection(enabled);

  // 🏢 ENTERPRISE: Event bus subscribers for optimistic UI updates (ADR-227 Phase 3)
  useRealtimeEntityEvents({
    created: 'OPPORTUNITY_CREATED',
    updated: 'OPPORTUNITY_UPDATED',
    deleted: 'OPPORTUNITY_DELETED',
    updatedId: (payload) => payload.opportunityId,
    updatedFields: (payload) => payload.updates as Partial<Opportunity>,
    deletedId: (payload) => payload.opportunityId,
    setItems: setOpportunities,
    refetch,
    logger,
  });

  return { opportunities, loading, error, status, refetch };
}

export default useRealtimeOpportunities;
