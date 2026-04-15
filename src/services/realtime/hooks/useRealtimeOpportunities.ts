'use client';

/**
 * Real-time Opportunities Hook
 *
 * Canonical pattern from useRealtimeBuildings.ts.
 * Subscribes to OPPORTUNITIES collection for live updates.
 *
 * @module services/realtime/hooks/useRealtimeOpportunities
 * @enterprise ADR-227 Phase 1 — Eliminate one-time fetches
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import type { DocumentData } from 'firebase/firestore';
import type { Opportunity } from '@/types/crm';
import type { SubscriptionStatus, OpportunityCreatedPayload, OpportunityUpdatedPayload, OpportunityDeletedPayload } from '../types';
import { RealtimeService } from '@/services/realtime';
import { applyUpdates } from '@/lib/utils';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToDate } from '@/lib/date-local';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

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
// HOOK IMPLEMENTATION
// ============================================================================

export function useRealtimeOpportunities(enabled = true): UseRealtimeOpportunitiesReturn {
  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [opportunities, setOpportunities] = useState<Opportunity[]>(opportunitiesCache.get() ?? []);
  const [loading, setLoading] = useState(enabled && !opportunitiesCache.hasLoaded());
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus>('idle');
  const refreshTriggerRef = useRef(0);

  const refetch = useCallback(() => {
    refreshTriggerRef.current += 1;
    setLoading(true);
    setError(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setLoading(false);
      return;
    }

    setStatus('connecting');
    // ADR-300: Only show spinner on first load — not on re-navigation
    if (!opportunitiesCache.hasLoaded()) setLoading(true);

    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'OPPORTUNITIES',
      (result: QueryResult<DocumentData>) => {
        const mapped = result.documents.map((doc) =>
          toOpportunity(doc as DocumentData & { id: string })
        );

        logger.info('Received opportunities in real-time', { count: mapped.length });

        // ADR-300: Write to module-level cache so next remount skips spinner
        opportunitiesCache.set(mapped);
        setOpportunities(mapped);
        setLoading(false);
        setError(null);
        setStatus('active');
      },
      (err: Error) => {
        logger.error('Firestore error', { error: err.message });
        setError(err.message);
        setLoading(false);
        setStatus('error');
      }
    );

    return () => {
      logger.info('Cleaning up opportunities subscription');
      unsubscribe();
    };
  }, [enabled, refreshTriggerRef.current]);

  // 🏢 ENTERPRISE: Event bus subscribers for optimistic UI updates (ADR-227 Phase 3)
  useEffect(() => {
    const handleCreated = (_payload: OpportunityCreatedPayload) => {
      logger.info('Opportunity created, triggering refetch');
      refetch();
    };

    const handleUpdated = (payload: OpportunityUpdatedPayload) => {
      logger.info('Applying optimistic update for opportunity', { opportunityId: payload.opportunityId });
      setOpportunities(prev => prev.map(opp =>
        opp.id === payload.opportunityId
          ? applyUpdates(opp, payload.updates as Partial<Opportunity>)
          : opp
      ));
    };

    const handleDeleted = (payload: OpportunityDeletedPayload) => {
      logger.info('Removing deleted opportunity from list', { opportunityId: payload.opportunityId });
      setOpportunities(prev => prev.filter(opp => opp.id !== payload.opportunityId));
    };

    const unsubCreate = RealtimeService.subscribe('OPPORTUNITY_CREATED', handleCreated);
    const unsubUpdate = RealtimeService.subscribe('OPPORTUNITY_UPDATED', handleUpdated);
    const unsubDelete = RealtimeService.subscribe('OPPORTUNITY_DELETED', handleDeleted);

    return () => {
      unsubCreate();
      unsubUpdate();
      unsubDelete();
    };
  }, [refetch]);

  return { opportunities, loading, error, status, refetch };
}

export default useRealtimeOpportunities;
