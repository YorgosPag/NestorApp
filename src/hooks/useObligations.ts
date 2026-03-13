/**
 * ENTERPRISE OBLIGATIONS HOOKS - PRODUCTION READY
 *
 * Uses centralized useAsyncData hook for data fetching (ADR-223).
 * All data comes from production Firestore database.
 */

"use client";

import { useState, useEffect } from 'react';
import { FirestoreObligationsRepository } from '@/services/obligations/InMemoryObligationsRepository';
import type { ObligationDocument, ObligationTemplate } from '@/types/obligations';
import { createModuleLogger } from '@/lib/telemetry';
import { useAsyncData } from '@/hooks/useAsyncData';
import { RealtimeService } from '@/services/realtime';
import type { ObligationCreatedPayload, ObligationUpdatedPayload, ObligationDeletedPayload } from '@/services/realtime';

const logger = createModuleLogger('useObligations');

const DEFAULT_STATS = {
  total: 0,
  draft: 0,
  inReview: 0,
  returned: 0,
  approved: 0,
  issued: 0,
  superseded: 0,
  archived: 0,
  completed: 0,
  thisMonth: 0,
};

// =============================================================================
// useObligations — List + CRUD
// =============================================================================

export function useObligations() {
  const [repository] = useState(() => new FirestoreObligationsRepository());

  const { data, loading, error, refetch: refreshObligations } = useAsyncData({
    fetcher: async () => {
      const result = await repository.getAll();
      logger.info('Loaded obligations from Firebase', { count: result.length });
      return result;
    },
    deps: [repository],
  });

  const obligations = data ?? [];

  // 🏢 ENTERPRISE: Event bus subscribers for cross-tab obligation sync (ADR-228 Tier 3)
  useEffect(() => {
    const handleCreated = (_payload: ObligationCreatedPayload) => {
      refreshObligations();
    };

    const handleUpdated = (_payload: ObligationUpdatedPayload) => {
      refreshObligations();
    };

    const handleDeleted = (_payload: ObligationDeletedPayload) => {
      refreshObligations();
    };

    const unsub1 = RealtimeService.subscribe('OBLIGATION_CREATED', handleCreated);
    const unsub2 = RealtimeService.subscribe('OBLIGATION_UPDATED', handleUpdated);
    const unsub3 = RealtimeService.subscribe('OBLIGATION_DELETED', handleDeleted);

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [refreshObligations]);

  const deleteObligation = async (id: string): Promise<boolean> => {
    try {
      const success = await repository.delete(id);
      if (success) {
        logger.info('Deleted obligation', { id });
        await refreshObligations();
      }
      return success;
    } catch (err) {
      logger.error('Error deleting obligation', { error: err });
      return false;
    }
  };

  const duplicateObligation = async (id: string): Promise<ObligationDocument | null> => {
    try {
      const duplicate = await repository.duplicate(id);
      if (duplicate) {
        logger.info('Duplicated obligation', { sourceId: id, newId: duplicate.id });
        await refreshObligations();
      }
      return duplicate;
    } catch (err) {
      logger.error('Error duplicating obligation', { error: err });
      return null;
    }
  };

  return {
    obligations,
    loading,
    error,
    deleteObligation,
    duplicateObligation,
    refreshObligations,
  };
}

// =============================================================================
// useObligation — Single by ID
// =============================================================================

export function useObligation(id: string) {
  const [repository] = useState(() => new FirestoreObligationsRepository());

  const { data: obligation, loading, error } = useAsyncData({
    fetcher: () => repository.getById(id),
    deps: [id, repository],
    enabled: !!id,
  });

  return { obligation, loading, error };
}

// =============================================================================
// useObligationTemplates
// =============================================================================

export function useObligationTemplates() {
  const [repository] = useState(() => new FirestoreObligationsRepository());

  const { data, loading, error } = useAsyncData({
    fetcher: async () => {
      const result = await repository.getTemplates();
      logger.info('Loaded obligation templates from Firebase', { count: result.length });
      return result;
    },
    deps: [repository],
  });

  return { templates: (data ?? []) as ObligationTemplate[], loading, error };
}

// =============================================================================
// useObligationStats
// =============================================================================

export function useObligationStats() {
  const [repository] = useState(() => new FirestoreObligationsRepository());

  const { data, loading, error } = useAsyncData({
    fetcher: async () => {
      const result = await repository.getStatistics();
      logger.info('Loaded obligation statistics from Firebase', { data: result });
      return result;
    },
    deps: [repository],
    initialData: DEFAULT_STATS,
  });

  return { ...(data ?? DEFAULT_STATS), loading, error };
}
